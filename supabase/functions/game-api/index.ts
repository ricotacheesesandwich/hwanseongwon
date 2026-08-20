import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

function resolveSecretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const single = Deno.env.get("SUPABASE_SECRET_KEY");
  if (single) return single;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.default === "string" && parsed.default) {
        return parsed.default;
      }
      const first = Object.values(parsed).find(
        (value) => typeof value === "string" && value,
      );
      if (typeof first === "string") return first;
    } catch (_) {
      // 아래 오류 처리로 이동합니다.
    }
  }

  return "";
}

const SECRET_KEY = resolveSecretKey();
const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const SPACE_TIME_ADDITIONS = [0, 0.2, 0.5, 1.2, 2.0, 2.5];
const COLD_CONTACT_MULTIPLIER_ADD = 0.2;
const INFECTION_TOTAL_HOURS = 120;

type SessionInfo = {
  account_key: string;
  account_type: "admin" | "player";
  character_id: number | null;
  expires_at: string;
};

type GameRow = {
  state: any;
  map_rules: any;
  version: number;
};

function allowedOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null) {
  const configured = allowedOrigins();
  const allowedOrigin =
    origin && configured.includes(origin)
      ? origin
      : configured.length === 0
        ? "*"
        : configured[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(
  body: unknown,
  status = 200,
  origin: string | null = null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const configured = allowedOrigins();
  if (!origin) return true;
  if (configured.length === 0) return true;
  return configured.includes(origin);
}

function getClientBucket(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip")?.trim();
  return forwarded || real || "unknown-client";
}

async function validateSession(token: string): Promise<SessionInfo | null> {
  if (!token) return null;
  const { data, error } = await admin.rpc("edge_validate_session", {
    p_token: token,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return row || null;
}

async function getGameRow(): Promise<GameRow | null> {
  const { data, error } = await admin
    .from("game_state")
    .select("state,map_rules,version")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data as GameRow | null;
}

async function emitVersion(version: number) {
  const { error } = await admin.from("game_state_events").insert({ version });
  if (error) throw error;

  const threshold = Math.max(0, version - 500);
  if (threshold > 0) {
    await admin.from("game_state_events").delete().lt("version", threshold);
  }
}

async function updateGameRow(
  currentVersion: number,
  nextState: any,
  mapRules?: any,
): Promise<number | null> {
  const nextVersion = currentVersion + 1;
  const patch: Record<string, unknown> = {
    state: nextState,
    version: nextVersion,
    updated_at: new Date().toISOString(),
  };
  if (mapRules !== undefined) patch.map_rules = mapRules;

  const { data, error } = await admin
    .from("game_state")
    .update(patch)
    .eq("id", 1)
    .eq("version", currentVersion)
    .select("version")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  await emitVersion(nextVersion);
  return nextVersion;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function edgeKey(x1: number, y1: number, x2: number, y2: number) {
  const a = `${x1}:${y1}`;
  const b = `${x2}:${y2}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

function floorRoom(rules: any, floorId: string, x: number, y: number) {
  return rules?.floors?.[floorId]?.cells?.[cellKey(x, y)] || null;
}

function buildingFromFloorKey(floorId: string): string {
  const key = String(floorId || "");
  if (key.startsWith("research:")) return "research";
  if (key.startsWith("living:")) return "living";
  if (key.startsWith("support:")) return "support";
  if (key.startsWith("bunker:")) return "bunker";
  return "main";
}

function fallbackBuildingArrival(buildingId: string) {
  const defaults: Record<string, { floor: string; x: number; y: number }> = {
    main: { floor: "1F", x: 5, y: 4 },
    living: { floor: "living:1F", x: 5, y: 4 },
    research: { floor: "research:1F", x: 5, y: 4 },
    support: { floor: "support:1F", x: 5, y: 4 },
  };
  return defaults[buildingId] || null;
}

const BUNKER_DESCENT_COST = 2;
const BUNKER_TRANSFER_COST = 3;
const BUNKER_CENTER_FLOOR = "bunker:center";
const BUNKER_CENTER_ENTRY_ROOM = "bunker_a_center_entry";
const BUNKER_CENTER_POSITION = { x: 5, y: 4 };
const BUNKER_CENTER_RETURN_POSITION = { x: 6, y: 6 };

const BUNKER_ACCESS_POINTS: Record<string, string[]> = {
  "B1:document_archive": ["bunker:A", "bunker:B"],
  "support:1F:support_hvac": ["bunker:C"],
  "living:B1:living_b1_cleaning": ["bunker:B"],
  "research:1F:research_1f_sample": ["bunker:A"],
};

const BUNKER_DESCENT_ARRIVAL_POINTS: Record<string, { x: number; y: number }> =
  {
    "B1:document_archive:bunker:A": { x: 1, y: 6 },
    "B1:document_archive:bunker:B": { x: 1, y: 6 },
    "research:1F:research_1f_sample:bunker:A": { x: 10, y: 0 },
    "living:B1:living_b1_cleaning:bunker:B": { x: 10, y: 0 },
    "support:1F:support_hvac:bunker:C": { x: 10, y: 0 },
  };

const BUNKER_SURFACE_EXITS: Record<
  string,
  { floor: string; x: number; y: number }
> = {
  "bunker:A:bunker_a_security_stairs": {
    floor: "research:1F",
    x: 1,
    y: 6,
  },
  "bunker:A:bunker_a_emergency_stairs": {
    floor: "B1",
    x: 4,
    y: 0,
  },
  "bunker:B:bunker_b_security_stairs": {
    floor: "living:B1",
    x: 8,
    y: 6,
  },
  "bunker:B:bunker_b_emergency_stairs": {
    floor: "B1",
    x: 4,
    y: 0,
  },
  "bunker:C:bunker_c_security_stairs": {
    floor: "support:1F",
    x: 8,
    y: 6,
  },
  "bunker:C:bunker_c_emergency_stairs": {
    floor: "support:1F",
    x: 8,
    y: 6,
  },
};

const BUNKER_TRANSFER_ROOMS: Record<
  string,
  { targetFloor: string; targetX: number; targetY: number }
> = {
  "bunker:A:bunker_a_transfer_b": {
    targetFloor: "bunker:B",
    targetX: 0,
    targetY: 3,
  },
  "bunker:A:bunker_a_transfer_c": {
    targetFloor: "bunker:C",
    targetX: 11,
    targetY: 3,
  },
  "bunker:B:bunker_b_transfer_a": {
    targetFloor: "bunker:A",
    targetX: 0,
    targetY: 3,
  },
  "bunker:B:bunker_b_transfer_c": {
    targetFloor: "bunker:C",
    targetX: 0,
    targetY: 3,
  },
  "bunker:C:bunker_c_transfer_b": {
    targetFloor: "bunker:B",
    targetX: 11,
    targetY: 3,
  },
  "bunker:C:bunker_c_transfer_a": {
    targetFloor: "bunker:A",
    targetX: 11,
    targetY: 3,
  },
};

type SpecialBunkerMove = {
  targetX: number;
  targetY: number;
  cost: number;
  source: string;
};

function resolveSpecialBunkerMove(
  state: any,
  rules: any,
  character: any,
  targetFloor: string,
): SpecialBunkerMove | null {
  const fromFloor = String(character.floor || "");
  const fromCell = floorRoom(
    rules,
    fromFloor,
    Number(character.x),
    Number(character.y),
  );
  const fromRoomId = String(fromCell?.roomId || "");

  // 지상 → 지하벙커 진입
  const descentTargets =
    BUNKER_ACCESS_POINTS[`${fromFloor}:${fromRoomId}`] || [];
  if (
    state?.bunkerAccessByRole?.spirit === true &&
    descentTargets.includes(targetFloor)
  ) {
    const arrival =
      BUNKER_DESCENT_ARRIVAL_POINTS[
        `${fromFloor}:${fromRoomId}:${targetFloor}`
      ];
    if (!arrival) return null;
    return {
      targetX: arrival.x,
      targetY: arrival.y,
      cost: BUNKER_DESCENT_COST,
      source: "지하벙커 이동",
    };
  }

  // 지하벙커 A/B/C → 지상 복귀
  const surfaceExit = BUNKER_SURFACE_EXITS[`${fromFloor}:${fromRoomId}`];
  if (surfaceExit && surfaceExit.floor === targetFloor) {
    return {
      targetX: surfaceExit.x,
      targetY: surfaceExit.y,
      cost: 0,
      source: "벙커 계단",
    };
  }

  // 지하벙커 A/B/C 이동문
  const transfer = BUNKER_TRANSFER_ROOMS[`${fromFloor}:${fromRoomId}`];
  if (transfer && transfer.targetFloor === targetFloor) {
    return {
      targetX: transfer.targetX,
      targetY: transfer.targetY,
      cost: BUNKER_TRANSFER_COST,
      source: "벙커 이동문",
    };
  }

  // A 구역 ↔ 중앙 구역
  if (
    fromFloor === "bunker:A" &&
    fromRoomId === BUNKER_CENTER_ENTRY_ROOM &&
    targetFloor === BUNKER_CENTER_FLOOR
  ) {
    return {
      targetX: BUNKER_CENTER_POSITION.x,
      targetY: BUNKER_CENTER_POSITION.y,
      cost: 0,
      source: "벙커 중앙 출입입구",
    };
  }

  if (fromFloor === BUNKER_CENTER_FLOOR && targetFloor === "bunker:A") {
    return {
      targetX: BUNKER_CENTER_RETURN_POSITION.x,
      targetY: BUNKER_CENTER_RETURN_POSITION.y,
      cost: 0,
      source: "벙커 중앙 출입입구",
    };
  }

  return null;
}

function involvesBunkerFloor(fromFloor: string, targetFloor: string) {
  return fromFloor.startsWith("bunker:") || targetFloor.startsWith("bunker:");
}

function canStep(
  rules: any,
  floorId: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  const floor = rules?.floors?.[floorId];
  if (!floor) return false;
  const from = floor.cells?.[cellKey(fromX, fromY)];
  const to = floor.cells?.[cellKey(toX, toY)];
  if (!from || !to) return false;
  if (from.roomId === to.roomId) return true;
  return (floor.doorways || []).includes(edgeKey(fromX, fromY, toX, toY));
}

function movementCost(
  rules: any,
  floorId: string,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  maxCost: number,
): number | null {
  const columns = Number(rules?.columns || 12);
  const rows = Number(rules?.rows || 8);
  if (
    targetX < 0 ||
    targetX >= columns ||
    targetY < 0 ||
    targetY >= rows ||
    (startX === targetX && startY === targetY)
  ) {
    return null;
  }

  const start = cellKey(startX, startY);
  const target = cellKey(targetX, targetY);
  const distances = new Map<string, number>([[start, 0]]);
  const queue: Array<{ x: number; y: number; cost: number }> = [
    { x: startX, y: startY, cost: 0 },
  ];
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const currentKey = cellKey(current.x, current.y);
    if (current.cost !== distances.get(currentKey)) continue;
    if (currentKey === target) return current.cost;

    for (const [dx, dy] of dirs) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (x < 0 || x >= columns || y < 0 || y >= rows) continue;
      if (!canStep(rules, floorId, current.x, current.y, x, y)) continue;

      const fromRoom = floorRoom(rules, floorId, current.x, current.y);
      const toRoom = floorRoom(rules, floorId, x, y);
      if (!fromRoom || !toRoom) continue;
      const nextCost =
        current.cost + (fromRoom.roomId === toRoom.roomId ? 0 : 1);
      if (nextCost > maxCost) continue;

      const key = cellKey(x, y);
      if (distances.has(key) && distances.get(key)! <= nextCost) continue;
      distances.set(key, nextCost);
      queue.push({ x, y, cost: nextCost });
    }
  }

  return null;
}

function addLog(state: any, message: string) {
  if (!Array.isArray(state.logs)) state.logs = [];
  const now = new Date();
  const time = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(now);
  state.logs.unshift({
    id: `server-log-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    time,
    message,
  });
  state.logs = state.logs.slice(0, 100);
}

function recordMovement(
  state: any,
  character: any,
  details: {
    fromFloor: string;
    fromRoom: string;
    toFloor: string;
    toRoom: string;
    cost: number;
    source: string;
  },
) {
  if (!Array.isArray(state.movementLogs)) state.movementLogs = [];
  state.movementLogs.unshift({
    id: `movement-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
    characterId: character.id,
    ...details,
    createdAt: new Date().toISOString(),
  });
  state.movementLogs = state.movementLogs.slice(0, 300);
}

function roomIdAt(rules: any, character: any): string | null {
  return (
    floorRoom(rules, character.floor, Number(character.x), Number(character.y))
      ?.roomId || null
  );
}

function settleAllSurvivorClocks(state: any, rules: any) {
  if (!Array.isArray(state.characters)) return;
  const now = Date.now();

  const spirits = state.characters.filter((c: any) => c.role === "spirit");

  for (const character of state.characters) {
    if (character.role !== "survivor") continue;

    if (!character.freezeClock) {
      character.freezeClock = {
        baseHours: 0,
        lastUpdated: new Date(now).toISOString(),
        modifiers: [],
      };
    }

    const roomId = roomIdAt(rules, character);
    if (!roomId) continue;

    const burningKey = `${character.floor}::${roomId}`;
    const level = Math.max(
      0,
      Math.min(5, Number(state.spaceBurning?.[burningKey] || 0)),
    );
    const spaceAdd = SPACE_TIME_ADDITIONS[level] || 0;

    const coldContact = spirits.some(
      (spirit: any) =>
        spirit.floor === character.floor && roomIdAt(rules, spirit) === roomId,
    );

    let multiplier =
      1 + spaceAdd + (coldContact ? COLD_CONTACT_MULTIPLIER_ADD : 0);
    let minimum = 1;
    for (const modifier of character.freezeClock.modifiers || []) {
      multiplier += Number(modifier.add || 0);
      minimum = Math.max(minimum, Number(modifier.min || 1));
    }
    multiplier = Math.max(multiplier, minimum);

    const last = new Date(character.freezeClock.lastUpdated || now).getTime();
    const realHours = Math.max(0, (now - last) / 36e5);
    character.freezeClock.baseHours = Math.min(
      INFECTION_TOTAL_HOURS,
      Number(character.freezeClock.baseHours || 0) + realHours * multiplier,
    );
    character.freezeClock.lastUpdated = new Date(now).toISOString();
  }
}

function playerFloorReleased(state: any, character: any, targetFloor: string) {
  const role = character.role;
  return state?.exposure?.[role]?.floors?.[targetFloor] === true;
}

function isSafeMediaPath(path: string) {
  return /^(thumbnail|original)-resource-[a-zA-Z0-9_-]+$/.test(path);
}

function playerCanAccessMedia(state: any, characterId: number, path: string) {
  const character = state?.characters?.find(
    (item: any) => Number(item.id) === Number(characterId),
  );
  if (!character) return false;
  return (character.inventory || []).some(
    (item: any) => item.thumbnailKey === path || item.originalKey === path,
  );
}

function publicCharacterSnapshot(character: any) {
  return {
    id: Number(character.id),
    name: String(character.name || ""),
    role: character.role === "spirit" ? "spirit" : "survivor",
    floor: String(character.floor || "1F"),
    x: Number(character.x || 0),
    y: Number(character.y || 0),
    statuses: [],
    manualStatuses: [],
    inventory: [],
    investigations: [],
    records: [],
    ap: 0,
    maxAp: 0,
  };
}

function stateForAccount(
  sourceState: any,
  rules: any,
  account: { account_type: "admin" | "player"; character_id: number | null },
) {
  if (account.account_type === "admin") return clone(sourceState);

  const characterId = Number(account.character_id || 0);
  const viewer = sourceState?.characters?.find(
    (item: any) => Number(item.id) === characterId,
  );
  if (!viewer) return null;

  const viewerRoom = roomIdAt(rules, viewer);
  const ownTeams = (sourceState.teams || []).filter((team: any) =>
    (team.memberIds || []).map(Number).includes(characterId),
  );
  const sharedIds = new Set<number>([characterId]);

  for (const team of ownTeams) {
    if (team.visible === false) continue;
    for (const memberId of team.memberIds || []) {
      const member = sourceState.characters?.find(
        (item: any) => Number(item.id) === Number(memberId),
      );
      if (member && member.role === viewer.role) {
        sharedIds.add(Number(member.id));
      }
    }
  }

  // 같은 공간은 roomId 단위로 인식합니다.
  // 동결체는 같은 공간의 생환자를 볼 수 있지만,
  // 생환자는 기존 규칙대로 동결체 정보를 받지 않습니다.
  for (const candidate of sourceState.characters || []) {
    if (candidate.floor !== viewer.floor) continue;
    if (!viewerRoom || roomIdAt(rules, candidate) !== viewerRoom) continue;
    if (viewer.role === "survivor" && candidate.role !== "survivor") continue;
    sharedIds.add(Number(candidate.id));
  }

  const visibleCharacters = (sourceState.characters || [])
    .filter((item: any) => sharedIds.has(Number(item.id)))
    .map((item: any) =>
      Number(item.id) === characterId
        ? clone(item)
        : publicCharacterSnapshot(item),
    );

  const visibleIds = new Set(
    visibleCharacters.map((item: any) => Number(item.id)),
  );
  const teams = ownTeams.map((team: any) => ({
    ...clone(team),
    memberIds: (team.memberIds || [])
      .map(Number)
      .filter((id: number) => id === characterId || visibleIds.has(id)),
  }));

  const sameRoomOpposite = (sourceState.characters || []).filter(
    (candidate: any) =>
      candidate.role !== viewer.role &&
      candidate.floor === viewer.floor &&
      Boolean(viewerRoom) &&
      roomIdAt(rules, candidate) === viewerRoom,
  );

  const currentBurningKey = viewerRoom
    ? `${viewer.floor}::${viewerRoom}`
    : null;
  const spaceBurning = currentBurningKey
    ? {
        [currentBurningKey]: Number(
          sourceState.spaceBurning?.[currentBurningKey] || 0,
        ),
      }
    : {};

  const exposure = sourceState.exposure?.[viewer.role]
    ? { [viewer.role]: clone(sourceState.exposure[viewer.role]) }
    : {};

  const emergencyEvents = (sourceState.emergencyEvents || []).filter(
    (event: any) =>
      event.active === true &&
      (event.audience === "all" || event.audience === viewer.role),
  );

  return {
    ...clone(sourceState),
    characters: visibleCharacters,
    teams,
    logs: [],
    movementLogs: [],
    adminMemos: [],
    connections: [],
    resourceLibrary: [],
    exposure,
    spaceBurning,
    emergencyEvents,
    _viewerSignals: {
      characterId,
      warmthCount: viewer.role === "spirit" ? sameRoomOpposite.length : 0,
      coldContactCount:
        viewer.role === "survivor" ? sameRoomOpposite.length : 0,
    },
  };
}

async function handleLogin(req: Request, body: any, origin: string | null) {
  const password = String(body.password || "");
  if (!password || password.length > 72) {
    return json({ message: "등록되지 않은 비밀번호입니다." }, 401, origin);
  }

  const { data, error } = await admin.rpc("edge_login", {
    p_password: password,
    p_bucket: getClientBucket(req),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;

  if (!row || row.status === "invalid") {
    return json({ message: "등록되지 않은 비밀번호입니다." }, 401, origin);
  }
  if (row.status === "blocked") {
    return json(
      {
        message: "로그인 시도가 너무 많습니다.",
        retryAfterSeconds: row.retry_after_seconds || 900,
      },
      429,
      origin,
    );
  }

  const game = await getGameRow();
  return json(
    {
      token: row.token,
      account: {
        type: row.account_type,
        characterId: row.character_id,
      },
      state: game
        ? stateForAccount(game.state, game.map_rules, {
            account_type: row.account_type,
            character_id: row.character_id,
          })
        : null,
      version: game?.version || 0,
    },
    200,
    origin,
  );
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ message: "POST 요청만 지원합니다." }, 405, origin);
  }

  if (!SUPABASE_URL || !SECRET_KEY) {
    return json({ message: "서버 비밀키 설정을 확인하세요." }, 500, origin);
  }

  if (!checkOrigin(req)) {
    return json(
      { message: "허용되지 않은 사이트에서 온 요청입니다." },
      403,
      origin,
    );
  }

  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "login") {
      return await handleLogin(req, body, origin);
    }

    const token = String(body.token || "");
    const account = await validateSession(token);
    if (!account) {
      return json({ message: "로그인이 만료되었습니다." }, 401, origin);
    }

    if (action === "logout") {
      await admin.rpc("edge_logout", { p_token: token });
      return json({ ok: true }, 200, origin);
    }

    if (action === "resume" || action === "get-state") {
      const game = await getGameRow();
      if (!game) {
        return json(
          {
            account: {
              type: account.account_type,
              characterId: account.character_id,
            },
            state: null,
            version: 0,
          },
          200,
          origin,
        );
      }
      return json(
        {
          account: {
            type: account.account_type,
            characterId: account.character_id,
          },
          state: stateForAccount(game.state, game.map_rules, account),
          version: game.version,
        },
        200,
        origin,
      );
    }

    if (action === "media-upload-token") {
      if (account.account_type !== "admin") {
        return json({ message: "관리자 권한이 필요합니다." }, 403, origin);
      }
      const path = String(body.path || "");
      const size = Number(body.size || 0);
      if (!isSafeMediaPath(path) || !(size >= 0) || size > 100 * 1024 * 1024) {
        return json(
          { message: "업로드 파일 정보가 올바르지 않습니다." },
          400,
          origin,
        );
      }
      const { data, error } = await admin.storage
        .from("game-media")
        .createSignedUploadUrl(path, { upsert: true });
      if (error) throw error;
      return json(
        {
          path: data.path,
          uploadToken: data.token,
        },
        200,
        origin,
      );
    }

    if (action === "media-url") {
      const path = String(body.path || "");
      if (!isSafeMediaPath(path)) {
        return json({ message: "파일 경로가 올바르지 않습니다." }, 400, origin);
      }
      const game = await getGameRow();
      if (!game) {
        return json({ message: "게임 상태가 없습니다." }, 409, origin);
      }

      const allowed =
        account.account_type === "admin" ||
        (account.account_type === "player" &&
          account.character_id &&
          playerCanAccessMedia(game.state, Number(account.character_id), path));
      if (!allowed) {
        return json({ message: "이 파일을 열 권한이 없습니다." }, 403, origin);
      }

      const options = body.download ? { download: true } : undefined;
      const { data, error } = await admin.storage
        .from("game-media")
        .createSignedUrl(path, 600, options);
      if (error) throw error;
      return json({ signedUrl: data.signedUrl, expiresIn: 600 }, 200, origin);
    }

    if (action === "bootstrap") {
      if (account.account_type !== "admin") {
        return json({ message: "관리자 권한이 필요합니다." }, 403, origin);
      }

      const existing = await getGameRow();
      if (existing) {
        return json(
          { state: existing.state, version: existing.version },
          200,
          origin,
        );
      }

      if (!body.initialState || !body.mapRules?.floors) {
        return json(
          { message: "초기 게임 데이터가 올바르지 않습니다." },
          400,
          origin,
        );
      }

      const { data, error } = await admin
        .from("game_state")
        .insert({
          id: 1,
          state: body.initialState,
          map_rules: body.mapRules,
          version: 1,
          updated_at: new Date().toISOString(),
        })
        .select("state,version")
        .single();
      if (error) throw error;
      await emitVersion(1);
      return json({ state: data.state, version: data.version }, 200, origin);
    }

    if (action === "save-state") {
      if (account.account_type !== "admin") {
        return json({ message: "관리자 권한이 필요합니다." }, 403, origin);
      }

      const game = await getGameRow();
      if (!game) {
        return json({ message: "게임 상태가 없습니다." }, 409, origin);
      }

      const expectedVersion = Number(body.expectedVersion || 0);
      if (expectedVersion !== game.version) {
        return json(
          { message: "다른 사용자의 변경이 먼저 반영되었습니다." },
          409,
          origin,
        );
      }

      const nextMapRules = body.mapRules?.floors ? body.mapRules : undefined;
      const nextVersion = await updateGameRow(
        game.version,
        body.state,
        nextMapRules,
      );
      if (!nextVersion) {
        return json(
          { message: "다른 사용자의 변경이 먼저 반영되었습니다." },
          409,
          origin,
        );
      }
      return json({ ok: true, version: nextVersion }, 200, origin);
    }

    if (action === "sync-map-rules") {
      if (account.account_type !== "admin") {
        return json({ message: "관리자 권한이 필요합니다." }, 403, origin);
      }

      if (!body.mapRules?.floors) {
        return json({ message: "지도 규칙이 올바르지 않습니다." }, 400, origin);
      }

      const game = await getGameRow();
      if (!game) {
        return json({ message: "게임 상태가 없습니다." }, 409, origin);
      }

      const nextVersion = await updateGameRow(
        game.version,
        game.state,
        body.mapRules,
      );
      if (!nextVersion) {
        return json(
          { message: "다른 사용자의 변경이 먼저 반영되었습니다." },
          409,
          origin,
        );
      }

      return json({ ok: true, version: nextVersion }, 200, origin);
    }

    if (action === "save-player-state") {
      if (account.account_type !== "player" || !account.character_id) {
        return json({ message: "플레이어 권한이 필요합니다." }, 403, origin);
      }

      const game = await getGameRow();
      if (!game) {
        return json({ message: "게임 상태가 없습니다." }, 409, origin);
      }
      const current = clone(game.state);
      const proposed = body.state || {};
      const characterId = Number(account.character_id);

      // 플레이어의 일반 저장에서는 공동 마인드맵의 '자기 메모'만 허용합니다.
      // 위치/AP/역할/상태/인벤토리 등은 전용 서버 액션으로만 변경됩니다.
      current.mindMap = current.mindMap || {};
      const currentNotes = Array.isArray(current.mindMap.notes)
        ? current.mindMap.notes
        : [];
      const proposedNotes = Array.isArray(proposed?.mindMap?.notes)
        ? proposed.mindMap.notes
        : [];

      const otherNotes = currentNotes.filter(
        (note: any) => Number(note.authorId) !== characterId,
      );
      const ownNotes = proposedNotes
        .filter((note: any) => Number(note.authorId) === characterId)
        .slice(0, 100)
        .map((note: any) => ({
          id: String(note.id || `mind-note-${Date.now()}`),
          authorId: characterId,
          authorName: String(note.authorName || "").slice(0, 80),
          type: note.type === "sticker" ? "sticker" : "note",
          color: String(note.color || "#fff1a8").slice(0, 32),
          text: String(note.text || "").slice(0, 2000),
          createdAt: String(note.createdAt || new Date().toISOString()),
        }))
        .filter((note: any) => note.text.trim());

      current.mindMap.notes = [...ownNotes, ...otherNotes]
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 100);

      const nextVersion = await updateGameRow(game.version, current);
      if (!nextVersion) {
        return json({ message: "상태 충돌이 발생했습니다." }, 409, origin);
      }
      return json({ ok: true, version: nextVersion }, 200, origin);
    }

    if (action === "move-spirit") {
      if (account.account_type !== "player" || !account.character_id) {
        return json({ message: "플레이어 권한이 필요합니다." }, 403, origin);
      }

      const game = await getGameRow();
      if (!game) {
        return json({ message: "게임 상태가 없습니다." }, 409, origin);
      }

      const next = clone(game.state);
      const rules = game.map_rules;
      const character = next.characters?.find(
        (item: any) => Number(item.id) === Number(account.character_id),
      );
      if (!character || character.role !== "spirit") {
        return json(
          { message: "동결체만 직접 이동할 수 있습니다." },
          403,
          origin,
        );
      }

      const targetFloor = String(body.targetFloor || "");
      if (!rules?.floors?.[targetFloor]) {
        return json(
          { message: "잘못된 목적지입니다.", code: "INVALID_MOVE" },
          400,
          origin,
        );
      }

      settleAllSurvivorClocks(next, rules);

      const fromFloor = String(character.floor);
      const fromCell = floorRoom(
        rules,
        fromFloor,
        Number(character.x),
        Number(character.y),
      );
      if (!fromCell) {
        return json(
          {
            message: "현재 위치 정보가 올바르지 않습니다.",
            code: "INVALID_MOVE",
          },
          400,
          origin,
        );
      }

      let cost = 0;
      let targetX: number;
      let targetY: number;
      let source = "플레이어 이동";

      if (targetFloor === fromFloor) {
        targetX = Number(body.targetX);
        targetY = Number(body.targetY);
        if (!Number.isInteger(targetX) || !Number.isInteger(targetY)) {
          return json(
            {
              message: "목적지 좌표가 올바르지 않습니다.",
              code: "INVALID_MOVE",
            },
            400,
            origin,
          );
        }

        const calculated = movementCost(
          rules,
          fromFloor,
          Number(character.x),
          Number(character.y),
          targetX,
          targetY,
          Number(character.ap || 0),
        );
        if (calculated === null) {
          return json(
            {
              message: "현재 행동력으로 이동할 수 없습니다.",
              code: "INVALID_MOVE",
            },
            400,
            origin,
          );
        }
        cost = calculated;
      } else {
        if (!playerFloorReleased(next, character, targetFloor)) {
          return json(
            {
              message: "아직 공개되지 않은 층입니다.",
              code: "INVALID_MOVE",
            },
            403,
            origin,
          );
        }

        const specialBunkerMove = resolveSpecialBunkerMove(
          next,
          rules,
          character,
          targetFloor,
        );

        if (specialBunkerMove) {
          targetX = specialBunkerMove.targetX;
          targetY = specialBunkerMove.targetY;
          cost = specialBunkerMove.cost;
          source = specialBunkerMove.source;
        } else if (involvesBunkerFloor(fromFloor, targetFloor)) {
          return json(
            {
              message: "현재 위치에서는 해당 지하벙커 이동을 할 수 없습니다.",
              code: "INVALID_MOVE",
            },
            400,
            origin,
          );
        } else {
          const fromBuilding = buildingFromFloorKey(fromFloor);
          const targetBuilding = buildingFromFloorKey(targetFloor);
          const buildingIds = ["main", "living", "research", "support"];
          const isCrossBuilding =
            fromBuilding !== targetBuilding &&
            buildingIds.includes(fromBuilding) &&
            buildingIds.includes(targetBuilding);

          if (isCrossBuilding) {
            const configuredArrival =
              rules?.buildingArrivals?.[targetBuilding] ||
              fallbackBuildingArrival(targetBuilding);

            if (!configuredArrival) {
              return json(
                { message: "도착 지점이 없습니다.", code: "INVALID_MOVE" },
                400,
                origin,
              );
            }

            const arrivalFloor = String(configuredArrival.floor || "");
            const arrivalX = Number(configuredArrival.x);
            const arrivalY = Number(configuredArrival.y);

            if (
              targetFloor !== arrivalFloor ||
              !Number.isInteger(arrivalX) ||
              !Number.isInteger(arrivalY) ||
              !floorRoom(rules, arrivalFloor, arrivalX, arrivalY)
            ) {
              return json(
                {
                  message: "건물 도착 위치가 올바르지 않습니다.",
                  code: "INVALID_MOVE",
                },
                400,
                origin,
              );
            }

            if (Number(character.ap || 0) < 5) {
              return json(
                { message: "행동력이 부족합니다.", code: "NOT_ENOUGH_AP" },
                400,
                origin,
              );
            }

            targetX = arrivalX;
            targetY = arrivalY;
            cost = 5;
            source = "건물 이동";
          } else {
            const fromTransitions = rules.floors[fromFloor]?.transitions || [];
            const currentRoomId = String(fromCell.roomId || "");

            // 프론트와 동일하게 "계단 방 안"에 있으면 해당 계단을 이용할 수 있게 한다.
            // 예: 1F 계단이 2칸짜리여도 transition 좌표 한 칸에 정확히 서 있을 필요가 없다.
            const transition =
              fromTransitions.find(
                (item: any) =>
                  Number(item.x) === Number(character.x) &&
                  Number(item.y) === Number(character.y) &&
                  (item.destinations || []).includes(targetFloor),
              ) ||
              fromTransitions.find((item: any) => {
                if (!(item.destinations || []).includes(targetFloor))
                  return false;
                const transitionCell = floorRoom(
                  rules,
                  fromFloor,
                  Number(item.x),
                  Number(item.y),
                );
                return (
                  transitionCell &&
                  String(transitionCell.roomId || "") === currentRoomId
                );
              });

            if (!transition) {
              return json(
                {
                  message: "현재 위치에서는 층을 이동할 수 없습니다.",
                  code: "INVALID_MOVE",
                },
                400,
                origin,
              );
            }

            const destinationTransitions =
              rules.floors[targetFloor]?.transitions || [];
            const destination =
              destinationTransitions.find(
                (item: any) => item.type === transition.type,
              ) || destinationTransitions[0];
            if (!destination) {
              return json(
                { message: "도착 지점이 없습니다.", code: "INVALID_MOVE" },
                400,
                origin,
              );
            }

            targetX = Number(destination.x);
            targetY = Number(destination.y);

            // 현재 UI 규칙: 계단/비상계단 층 이동은 행동력 미소모.
            // 엘리베이터 등 다른 연결수단은 기존대로 1 소모.
            const transitionType = String(transition.type || "");
            cost = transitionType.toLowerCase().includes("stairs") ? 0 : 1;

            if (Number(character.ap || 0) < cost) {
              return json(
                { message: "행동력이 부족합니다.", code: "NOT_ENOUGH_AP" },
                400,
                origin,
              );
            }

            const labels: Record<string, string> = {
              stairs: "계단",
              elevator: "엘리베이터",
              freight: "화물 승강기",
              emergency_stairs: "비상계단",
              service_link: "서비스 통로",
              main_link: "연결통로",
            };
            source = labels[transitionType] || "연결통로";
          }
        }
      }

      if (Number(character.ap || 0) < cost) {
        return json(
          { message: "행동력이 부족합니다.", code: "NOT_ENOUGH_AP" },
          400,
          origin,
        );
      }

      const toCell = floorRoom(rules, targetFloor, targetX!, targetY!);
      if (!toCell) {
        return json(
          {
            message: "도착 위치가 올바르지 않습니다.",
            code: "INVALID_MOVE",
          },
          400,
          origin,
        );
      }

      character.ap = Number(character.ap || 0) - cost;
      character.floor = targetFloor;
      character.x = targetX!;
      character.y = targetY!;

      recordMovement(next, character, {
        fromFloor,
        fromRoom: String(fromCell.roomLabel || "미지정 공간"),
        toFloor: targetFloor,
        toRoom: String(toCell.roomLabel || "미지정 공간"),
        cost,
        source,
      });

      const movementMessage =
        targetFloor === fromFloor
          ? cost === 0
            ? `${character.name}이(가) ${toCell.roomLabel} 내부에서 위치를 조정했습니다. 행동력 미소모.`
            : `${character.name}이(가) ${fromCell.roomLabel}에서 ${toCell.roomLabel}(으)로 이동했습니다. 공간 변경 ${cost}회, 행동력 −${cost}.`
          : source === "건물 이동"
            ? `${character.name}이(가) ${fromCell.roomLabel}에서 다른 건물의 ${toCell.roomLabel}(으)로 이동했습니다. 행동력 −${cost}.`
            : source === "벙커 이동문" ||
                source === "지하벙커 이동" ||
                source === "벙커 계단" ||
                source === "벙커 중앙 출입입구"
              ? `${character.name}이(가) ${source}을 이용해 ${toCell.roomLabel}(으)로 이동했습니다.${cost ? ` 행동력 −${cost}.` : " 행동력 미소모."}`
              : `${character.name}이(가) ${source}을 이용해 ${targetFloor}으로 이동했습니다. 행동력 −${cost}.`;
      addLog(next, movementMessage);

      const nextVersion = await updateGameRow(game.version, next);
      if (!nextVersion) {
        return json({ message: "상태 충돌이 발생했습니다." }, 409, origin);
      }

      return json(
        {
          state: stateForAccount(next, rules, account),
          version: nextVersion,
          cost,
        },
        200,
        origin,
      );
    }

    if (action === "investigate") {
      if (account.account_type !== "player" || !account.character_id) {
        return json({ message: "플레이어 권한이 필요합니다." }, 403, origin);
      }

      const game = await getGameRow();
      if (!game) {
        return json({ message: "게임 상태가 없습니다." }, 409, origin);
      }
      const next = clone(game.state);
      const rules = game.map_rules;
      const character = next.characters?.find(
        (item: any) => Number(item.id) === Number(account.character_id),
      );
      if (!character) {
        return json({ message: "캐릭터가 없습니다." }, 403, origin);
      }

      if (next?.exposure?.[character.role]?.features?.investigation === false) {
        return json(
          { message: "현재 조사가 공개되지 않았습니다." },
          403,
          origin,
        );
      }

      const investigationId = String(body.investigationId || "");
      const investigation = (
        rules?.floors?.[character.floor]?.investigations || []
      ).find((item: any) => String(item.id) === investigationId);

      if (
        !investigation ||
        Number(investigation.x) !== Number(character.x) ||
        Number(investigation.y) !== Number(character.y)
      ) {
        return json(
          {
            message: "현재 위치의 조사가 아닙니다.",
            code: "INVALID_INVESTIGATION",
          },
          400,
          origin,
        );
      }

      if (!Array.isArray(character.investigations)) {
        character.investigations = [];
      }
      if (character.investigations.includes(investigationId)) {
        return json(
          {
            message: "이미 완료한 조사입니다.",
            code: "ALREADY_INVESTIGATED",
          },
          409,
          origin,
        );
      }
      if (!Array.isArray(character.inventory)) character.inventory = [];
      if (!Array.isArray(character.records)) character.records = [];

      character.investigations.push(investigationId);
      const uid = `${character.id}-${investigationId}`;
      character.inventory.push({
        uid,
        sourceId: investigationId,
        title: investigation.evidenceTitle,
        description: investigation.result,
        certainty: investigation.certainty,
        floor: character.floor,
        room:
          floorRoom(rules, character.floor, character.x, character.y)
            ?.roomLabel || "",
        discoveredBy: character.name,
        fileName: null,
      });
      character.records.unshift({
        id: investigationId,
        title: investigation.title,
        description: investigation.result,
        floor: character.floor,
        room:
          floorRoom(rules, character.floor, character.x, character.y)
            ?.roomLabel || "",
      });
      addLog(
        next,
        `${character.name}이(가) ${investigation.title}을(를) 조사해 「${investigation.evidenceTitle}」을(를) 획득했습니다. 행동력 미소모.`,
      );

      const nextVersion = await updateGameRow(game.version, next);
      if (!nextVersion) {
        return json({ message: "상태 충돌이 발생했습니다." }, 409, origin);
      }

      return json(
        {
          state: stateForAccount(next, rules, account),
          version: nextVersion,
          evidenceTitle: investigation.evidenceTitle,
        },
        200,
        origin,
      );
    }

    return json({ message: "지원하지 않는 작업입니다." }, 400, origin);
  } catch (error) {
    console.error(error);
    return json({ message: "서버 처리 중 오류가 발생했습니다." }, 500, origin);
  }
});
