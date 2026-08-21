// PREVIEW FIX 2026-08-16: infection stage selector uses a custom vertical dropdown, not radio buttons.
(() => {
  "use strict";

  const STORAGE_KEY = "shu-investigation-prototype-v2";
  const THEME_STORAGE_PREFIX = "shu-account-theme";
  const EVENT_READ_STORAGE_PREFIX = "shu-emergency-event-read";
  const SURVIVOR_TUTORIAL_IMAGES = [
    "1번사진.png",
    "2번사진.png",
    "3번사진.png",
    "4번사진.png",
    "5번사진.png",
    "6번사진.png",
    "7번사진.png",
    "8번사진.png",
  ];
  const DEFAULT_THEME_MODE = "light";
  const FLOOR_RELEASE_SCHEMA = 1;
  const FLOOR_ORDER = ["B1", "1F", "2F", "3F", "4F"];
  const EXPOSURE_FLOOR_OPTIONS = [
    { key: "B1", label: "융합학술동 B1", building: "융합학술동" },
    { key: "1F", label: "융합학술동 1F", building: "융합학술동" },
    { key: "2F", label: "융합학술동 2F", building: "융합학술동" },
    { key: "3F", label: "융합학술동 3F", building: "융합학술동" },
    { key: "4F", label: "융합학술동 4F", building: "융합학술동" },

    { key: "living:B1", label: "생활관 B1", building: "생활관" },
    { key: "living:1F", label: "생활관 1F", building: "생활관" },
    { key: "living:2F", label: "생활관 2F", building: "생활관" },
    { key: "living:3F", label: "생활관 3F", building: "생활관" },
    { key: "living:4F", label: "생활관 4F", building: "생활관" },

    { key: "research:1F", label: "연구별관 1F", building: "연구별관" },
    { key: "research:2F", label: "연구별관 2F", building: "연구별관" },
    { key: "research:3F", label: "연구별관 3F", building: "연구별관" },

    { key: "support:1F", label: "관리지원동 1F", building: "관리지원동" },

    { key: "bunker:A", label: "지하벙커 A", building: "지하벙커" },
    { key: "bunker:B", label: "지하벙커 B", building: "지하벙커" },
    { key: "bunker:C", label: "지하벙커 C", building: "지하벙커" },
    { key: "bunker:center", label: "지하벙커 중앙", building: "지하벙커" },
  ];
  const GRID_COLUMNS = 12;
  const GRID_ROWS = 8;

  // 지상 → 지하벙커 진입과 벙커 ↔ 벙커 이동은 서로 다른 비용을 사용합니다.
  // 생존자는 두 경우 모두 행동력을 소모하지 않습니다.
  const BUNKER_DESCENT_COST = 2;
  const BUNKER_TRANSFER_COST = 3;
  const BUNKER_ACCESS_POINTS = {
    "B1:document_archive": ["bunker:A", "bunker:B"],
    "support:1F:support_hvac": ["bunker:C"],
    "living:B1:living_b1_cleaning": ["bunker:B"],
    "research:1F:research_1f_sample": ["bunker:A"],
  };
  const BUNKER_DESCENT_ARRIVAL_POINTS = {
    // 융합학술동 문서보관실은 A/B의 반대편 비상계단으로 내려옵니다.
    "B1:document_archive:bunker:A": { x: 1, y: 6 },
    "B1:document_archive:bunker:B": { x: 1, y: 6 },

    // 각 건물 전용 진입점은 해당 벙커의 보안계단으로 연결합니다.
    "research:1F:research_1f_sample:bunker:A": { x: 10, y: 0 },
    "living:B1:living_b1_cleaning:bunker:B": { x: 10, y: 0 },
    "support:1F:support_hvac:bunker:C": { x: 10, y: 0 },
  };

  const BUNKER_SURFACE_EXITS = {
    "bunker:A:bunker_a_security_stairs": {
      floor: "research:1F",
      x: 1,
      y: 6,
      label: "연구별관 1F 표본접수실",
    },
    "bunker:A:bunker_a_emergency_stairs": {
      floor: "B1",
      x: 4,
      y: 0,
      label: "융합학술동 B1 문서보관실",
    },
    "bunker:B:bunker_b_security_stairs": {
      floor: "living:B1",
      x: 8,
      y: 6,
      label: "생활관 B1 청소용품 보관실",
    },
    "bunker:B:bunker_b_emergency_stairs": {
      floor: "B1",
      x: 4,
      y: 0,
      label: "융합학술동 B1 문서보관실",
    },
    "bunker:C:bunker_c_security_stairs": {
      floor: "support:1F",
      x: 8,
      y: 6,
      label: "관리지원동 1F 중앙 공조 제습 설비",
    },
    "bunker:C:bunker_c_emergency_stairs": {
      floor: "support:1F",
      x: 8,
      y: 6,
      label: "관리지원동 1F 중앙 공조 제습 설비",
    },
  };

  /*
   * 지하벙커 A/B/C의 실제 이동문.
   * 이동문은 지도 바깥에 덧붙는 작은 표식이 아니라
   * 안내도처럼 좌우 가장자리를 차지하는 하나의 실제 공간입니다.
   * 같은 이동문 공간 안에서는 어느 셀에 토큰이 있어도 이동 버튼이 표시됩니다.
   */
  const BUNKER_TRANSFER_ROOMS = {
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

  // A 구역의 '벙커 중앙 출입입구'를 통해서만 중앙 구역으로 진입한다.
  // 중앙 구역은 A 구역에 직접 연결된 단일 공간이다.
  const BUNKER_CENTER_FLOOR = "bunker:center";
  const BUNKER_CENTER_ENTRY_ROOM = "bunker_a_center_entry";
  const BUNKER_CENTER_POSITION = { x: 5, y: 4 };
  const BUNKER_CENTER_RETURN_POSITION = { x: 6, y: 6 };

  const CHARACTER_MAX_HEALTH = 100;
  const ROLE_LABELS = {
    survivor: "생존자",
    spirit: "동결체",
  };

  const STATUS_DEFINITIONS = {
    hypothermia: {
      name: "저체온",
      icon: "❄",
      description: "차가운 환경에 장시간 노출된 상태입니다.",
    },
    frostbite: {
      name: "동상",
      icon: "✣",
      description: "이동과 조사에 주의가 필요한 상태입니다.",
    },
    injured: { name: "부상", icon: "＋", description: "외상을 입었습니다." },
    unstable: {
      name: "불안정",
      icon: "⌁",
      description: "동결 상태가 불안정합니다.",
    },
    immobilized: {
      name: "행동불능",
      icon: "⊘",
      description: "관리자가 해제할 때까지 이동할 수 없습니다.",
    },
    vision_limited: {
      name: "시야 제한",
      icon: "◌",
      description: "생존자라도 본인 중심 3×3만 볼 수 있습니다.",
    },
    tracked: {
      name: "추적당함",
      icon: "◎",
      description: "동결체가 흔적을 따라오고 있습니다.",
    },
  };

  const AVATAR_COLORS = {
    101: ["#243e5a", "#102438"],
    102: ["#9aa8b8", "#586779"],
    103: ["#26363f", "#0d171e"],
    104: ["#3a4d61", "#171f2a"],
    105: ["#8c6d62", "#493c39"],
    106: ["#284052", "#0f2232"],
  };

  const FLOOR_DEFINITIONS = createFloorDefinitions();
  const BUILDING_DEFINITIONS = createBuildingDefinitions();
  Object.assign(FLOOR_DEFINITIONS, createAdditionalFloorDefinitions());
  installCrossBuildingTransitions();

  const storage = createStorageAdapter();
  const syncChannel =
    "BroadcastChannel" in window
      ? new BroadcastChannel("shu-investigation-sync")
      : null;
  const supabaseClient = window.shuSupabase || null;
  const remoteConfig = window.SHU_SUPABASE_CONFIG || null;
  const REMOTE_SESSION_KEY = "shu-remote-game-session";
  const remoteState = {
    version: 0,
    applying: false,
    writeQueue: Promise.resolve(),
    realtimeChannel: null,
    movementInFlight: false,
    pendingRealtimeVersion: 0,
  };

  let session = null;
  let state = ensureFeatureState(loadState());
  let ui = {
    currentFloor: "1F",
    currentBuilding: "main",
    mapMode: "floor",
    selectedCharacterId: 104,
    viewMode: "admin",
    themeMode: DEFAULT_THEME_MODE,
    rightPanelTab: "manage",
    comparisonOpen: false,
    pendingLogin: null,
    adminTool: null,
    adminModalTab: "map",
    operationsOpen: false,
    operationsTab: "overview",
    siteMapLayer: "surface",
    toastTimer: null,
    tutorialSlideIndex: 0,
  };

  const elements = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    bindStaticEvents();
    bindRealtimeSync();
    state = ensureFeatureState(state);

    let restored = false;
    if (isRemoteConfigured()) {
      restored = await tryRestoreRemoteSession();
    }

    if (!restored) showLogin();
    document.body.classList.remove("app-booting");
  }

  function cacheElements() {
    elements.loginView = document.querySelector("#loginView");
    elements.appView = document.querySelector("#appView");
    elements.workspace = document.querySelector("#workspace");
    elements.characterLoginForm = document.querySelector("#characterLoginForm");
    elements.accessPasswordInput = document.querySelector(
      "#accessPasswordInput",
    );
    elements.loginError = document.querySelector("#loginError");
    elements.loginSearchResult = document.querySelector("#loginSearchResult");
    elements.logoutButton = document.querySelector("#logoutButton");
    elements.sessionBadge = document.querySelector("#sessionBadge");
    elements.themeToggleButton = document.querySelector("#themeToggleButton");
    elements.themeToggleLabel = document.querySelector("#themeToggleLabel");
    elements.viewModeNav = document.querySelector("#viewModeNav");
    elements.mapViewSection = document.querySelector("#mapViewSection");
    elements.eventButton = document.querySelector("#eventButton");

    if (elements.eventButton) {
      let survivorHelpButton = document.querySelector("#survivorHelpButton");

      if (!survivorHelpButton) {
        survivorHelpButton = document.createElement("button");
        survivorHelpButton.type = "button";
        survivorHelpButton.id = "survivorHelpButton";
        survivorHelpButton.className = "survivor-help-button is-hidden";
        survivorHelpButton.textContent = "?";
        survivorHelpButton.title = "튜토리얼 / 도움말";
        survivorHelpButton.setAttribute("aria-label", "튜토리얼 / 도움말");
        elements.eventButton.insertAdjacentElement(
          "afterend",
          survivorHelpButton,
        );
      }

      elements.survivorHelpButton = survivorHelpButton;
    }

    let survivorTutorialBackdrop = document.querySelector(
      "#survivorTutorialBackdrop",
    );

    if (!survivorTutorialBackdrop) {
      survivorTutorialBackdrop = document.createElement("div");
      survivorTutorialBackdrop.id = "survivorTutorialBackdrop";
      survivorTutorialBackdrop.className =
        "survivor-tutorial-backdrop is-hidden";
      survivorTutorialBackdrop.setAttribute("aria-hidden", "true");
      survivorTutorialBackdrop.innerHTML = `
        <section
          class="survivor-tutorial"
          role="dialog"
          aria-modal="true"
          aria-label="생존자 튜토리얼"
        >
          <button
            type="button"
            class="survivor-tutorial__close is-hidden"
            data-survivor-tutorial-close
            aria-label="튜토리얼 닫기"
            title="닫기"
          >×</button>

          <div class="survivor-tutorial__image-wrap">
            <img
              class="survivor-tutorial__image"
              data-survivor-tutorial-image
              alt=""
            />
            <div
              class="survivor-tutorial__image-placeholder is-hidden"
              data-survivor-tutorial-placeholder
            ></div>
          </div>

          <div class="survivor-tutorial__controls">
            <button
              type="button"
              class="survivor-tutorial__arrow"
              data-survivor-tutorial-prev
              aria-label="이전 사진"
              title="이전 사진"
            >&lt;</button>

            <span
              class="survivor-tutorial__counter"
              data-survivor-tutorial-counter
              aria-live="polite"
            ></span>

            <button
              type="button"
              class="survivor-tutorial__arrow"
              data-survivor-tutorial-next
              aria-label="다음 사진"
              title="다음 사진"
            >&gt;</button>
          </div>
        </section>
      `;
      document.body.appendChild(survivorTutorialBackdrop);
    }

    elements.survivorTutorialBackdrop = survivorTutorialBackdrop;
    elements.survivorTutorialImage = survivorTutorialBackdrop.querySelector(
      "[data-survivor-tutorial-image]",
    );
    elements.survivorTutorialPlaceholder =
      survivorTutorialBackdrop.querySelector(
        "[data-survivor-tutorial-placeholder]",
      );
    elements.survivorTutorialCounter = survivorTutorialBackdrop.querySelector(
      "[data-survivor-tutorial-counter]",
    );
    elements.survivorTutorialPrev = survivorTutorialBackdrop.querySelector(
      "[data-survivor-tutorial-prev]",
    );
    elements.survivorTutorialNext = survivorTutorialBackdrop.querySelector(
      "[data-survivor-tutorial-next]",
    );
    elements.survivorTutorialClose = survivorTutorialBackdrop.querySelector(
      "[data-survivor-tutorial-close]",
    );
    elements.siteMapButton = document.querySelector("#siteMapButton");
    elements.campusMapBackdrop = document.querySelector("#campusMapBackdrop");
    elements.campusMapPopup = document.querySelector("#campusMapPopup");
    elements.campusMapCanvas = document.querySelector("#campusMapCanvas");
    elements.campusMapCloseButton = document.querySelector(
      "#campusMapCloseButton",
    );
    elements.adminOperationsButton = document.querySelector(
      "#adminOperationsButton",
    );
    elements.adminOperationsView = document.querySelector(
      "#adminOperationsView",
    );
    elements.adminOperationsContent = document.querySelector(
      "#adminOperationsContent",
    );
    elements.leftSidebar = document.querySelector("#leftSidebar");
    elements.rightSidebar = document.querySelector("#rightSidebar");
    elements.floorTabs = document.querySelector("#floorTabs");
    elements.mapEyebrow = document.querySelector("#mapEyebrow");
    elements.currentFloorLabel = document.querySelector("#currentFloorLabel");
    elements.mapGrid = document.querySelector("#mapGrid");
    elements.mapToast = document.querySelector("#mapToast");
    elements.warmthBanner = document.querySelector("#warmthBanner");
    elements.adminManageButton = document.querySelector("#adminManageButton");
    elements.compareViewsButton = document.querySelector("#compareViewsButton");
    elements.selectedCharacterSummary = document.querySelector(
      "#selectedCharacterSummary",
    );
    elements.movementRule = document.querySelector("#movementRule");

    const mapFooter = document.querySelector(".map-panel__footer");
    if (mapFooter) {
      let currentLocationJumpButton = mapFooter.querySelector(
        "[data-jump-current-location]",
      );

      if (!currentLocationJumpButton) {
        currentLocationJumpButton = document.createElement("button");
        currentLocationJumpButton.type = "button";
        currentLocationJumpButton.className = "current-location-jump-button";
        currentLocationJumpButton.dataset.jumpCurrentLocation = "";
        currentLocationJumpButton.dataset.tooltip = "현 위치 이동";
        currentLocationJumpButton.title = "현 위치 이동";
        currentLocationJumpButton.setAttribute("aria-label", "현 위치 이동");
        currentLocationJumpButton.innerHTML = `
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="12" r="3.5"></circle>
            <circle cx="12" cy="12" r="7.5"></circle>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>
          </svg>
        `;
        mapFooter.appendChild(currentLocationJumpButton);
      }

      elements.currentLocationJumpButton = currentLocationJumpButton;
    }

    elements.comparisonSection = document.querySelector("#comparisonSection");
    elements.survivorMiniMap = document.querySelector("#survivorMiniMap");
    elements.spiritMiniMap = document.querySelector("#spiritMiniMap");
    elements.adminMiniMap = document.querySelector("#adminMiniMap");
    elements.survivorPreviewName = document.querySelector(
      "#survivorPreviewName",
    );
    elements.spiritPreviewName = document.querySelector("#spiritPreviewName");
    elements.modalBackdrop = document.querySelector("#modalBackdrop");
    elements.modal = document.querySelector("#modal");
    elements.modalEyebrow = document.querySelector("#modalEyebrow");
    elements.modalTitle = document.querySelector("#modalTitle");
    elements.modalBody = document.querySelector("#modalBody");
    elements.modalFooter = document.querySelector("#modalFooter");
    elements.modalCloseButton = document.querySelector("#modalCloseButton");
  }

  function bindStaticEvents() {
    elements.characterLoginForm.addEventListener(
      "submit",
      handleCharacterLogin,
    );
    elements.loginSearchResult.addEventListener(
      "click",
      handleLoginResultClick,
    );
    elements.logoutButton.addEventListener("click", logout);
    elements.themeToggleButton?.addEventListener("click", toggleThemeMode);
    elements.eventButton.addEventListener("click", showEmergencyEvent);
    elements.survivorHelpButton?.addEventListener("click", () => {
      showSurvivorTutorial();
    });
    elements.survivorTutorialPrev?.addEventListener("click", () => {
      moveSurvivorTutorial(-1);
    });
    elements.survivorTutorialNext?.addEventListener("click", () => {
      moveSurvivorTutorial(1);
    });
    elements.survivorTutorialClose?.addEventListener("click", () => {
      completeAndCloseSurvivorTutorial();
    });
    elements.survivorTutorialImage?.addEventListener("error", () => {
      elements.survivorTutorialImage?.classList.add("is-hidden");
      if (elements.survivorTutorialPlaceholder) {
        const imageSrc =
          SURVIVOR_TUTORIAL_IMAGES[ui.tutorialSlideIndex] || "튜토리얼 이미지";
        elements.survivorTutorialPlaceholder.textContent = imageSrc;
        elements.survivorTutorialPlaceholder.classList.remove("is-hidden");
      }
    });
    elements.survivorTutorialImage?.addEventListener("load", () => {
      elements.survivorTutorialImage?.classList.remove("is-hidden");
      elements.survivorTutorialPlaceholder?.classList.add("is-hidden");
    });
    elements.adminOperationsButton.addEventListener(
      "click",
      openAdminOperationsPage,
    );
    elements.adminOperationsView.addEventListener(
      "click",
      handleOperationsClick,
    );
    elements.adminOperationsView.addEventListener(
      "change",
      handleOperationsChange,
    );
    elements.adminOperationsView.addEventListener(
      "submit",
      handleOperationsSubmit,
    );
    elements.viewModeNav.addEventListener("click", handleViewModeClick);
    elements.floorTabs.addEventListener("click", handleFloorTabClick);
    elements.mapGrid.addEventListener("click", handleMapClick);
    elements.currentLocationJumpButton?.addEventListener(
      "click",
      jumpToCurrentTokenLocation,
    );
    elements.adminManageButton?.addEventListener("click", () =>
      showAdminHubModal(ui.adminModalTab),
    );
    elements.compareViewsButton?.addEventListener("click", toggleComparison);
    elements.leftSidebar.addEventListener("click", handleLeftSidebarClick);
    elements.rightSidebar.addEventListener("click", handleRightSidebarClick);
    elements.rightSidebar.addEventListener("change", handleRightSidebarChange);
    elements.rightSidebar.addEventListener("submit", handleRightSidebarSubmit);
    elements.modal.addEventListener("click", handleModalClick);
    elements.modal.addEventListener("change", handleRightSidebarChange);
    elements.modal.addEventListener("submit", handleRightSidebarSubmit);
    elements.modalCloseButton.addEventListener("click", closeModal);
    elements.modalBackdrop.addEventListener("click", (event) => {
      if (event.target === elements.modalBackdrop) closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        !elements.modalBackdrop.classList.contains("is-hidden")
      ) {
        closeModal();
      }
    });
  }

  function isRemoteConfigured() {
    return Boolean(remoteConfig?.configured && supabaseClient);
  }

  async function remoteApi(action, payload = {}, tokenOverride = null) {
    if (!isRemoteConfigured()) {
      throw new Error("SUPABASE_NOT_CONFIGURED");
    }

    const token = tokenOverride ?? session?.token ?? "";
    const response = await fetch(
      `${remoteConfig.url}/functions/v1/${remoteConfig.functionName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: remoteConfig.publishableKey,
          Authorization: `Bearer ${remoteConfig.publishableKey}`,
        },
        body: JSON.stringify({ action, token, ...payload }),
      },
    );

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `HTTP_${response.status}`;
      const remoteError = new Error(message);
      remoteError.status = response.status;
      remoteError.code = data?.code || null;
      throw remoteError;
    }

    return data;
  }

  function bindRealtimeSync() {
    syncChannel?.addEventListener("message", (event) => {
      if (event.data?.type !== "state-update" || !event.data.state) return;
      if (session?.token) return;

      const previousUnreadCount = session
        ? getUnreadEmergencyEvents().length
        : 0;

      state = ensureFeatureState(event.data.state);

      if (session) {
        renderAll();
        notifyNewEmergencyEvents(previousUnreadCount);
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue || session?.token)
        return;

      try {
        const previousUnreadCount = session
          ? getUnreadEmergencyEvents().length
          : 0;

        state = ensureFeatureState(JSON.parse(event.newValue));

        if (session) {
          renderAll();
          notifyNewEmergencyEvents(previousUnreadCount);
        }
      } catch (error) {
        console.warn("동기화 데이터를 읽지 못했습니다.", error);
      }
    });

    if (!supabaseClient) return;

    remoteState.realtimeChannel = supabaseClient
      .channel("shu-game-state-events")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_state_events",
        },
        async (payload) => {
          const incomingVersion = Number(payload.new?.version || 0);
          if (!session?.token || incomingVersion <= remoteState.version) return;

          /*
           * 이동 API 응답과 Realtime get-state 응답이 서로 앞뒤로 도착하면
           * 예전 위치가 최신 위치를 덮어쓰는 경쟁 상태가 생길 수 있습니다.
           * 이동 처리 중에는 Realtime 갱신을 잠시 보류하고,
           * 이동 응답 적용 후 더 높은 버전이 있을 때만 한 번 다시 읽습니다.
           */
          if (remoteState.movementInFlight) {
            remoteState.pendingRealtimeVersion = Math.max(
              remoteState.pendingRealtimeVersion,
              incomingVersion,
            );
            return;
          }

          await refreshRemoteState({ quiet: true });
        },
      )
      .subscribe();
  }

  function renderPendingLoginResult(pendingLogin) {
    elements.loginError.textContent = "";
    ui.pendingLogin = pendingLogin;

    if (pendingLogin.type === "admin") {
      elements.loginSearchResult.innerHTML = `
        <article class="login-result-card">
          <div class="login-result-card__icon">ADMIN</div>
          <div>
            <p class="eyebrow">OPERATIONS ACCOUNT</p>
            <h2>운영진 관리 화면</h2>
            <p>모든 캐릭터, 팀, 위치와 조사 정보를 관리합니다.</p>
          </div>
          <button type="button" class="button button--admin" data-confirm-admin-login>관리자 접속</button>
        </article>`;
      return;
    }

    const character = pendingLogin.character;
    if (!character) {
      ui.pendingLogin = null;
      elements.loginSearchResult.innerHTML = "";
      elements.loginError.textContent = "등록된 캐릭터가 아닙니다.";
      return;
    }

    elements.loginSearchResult.innerHTML = `
      <article class="login-result-card">
        ${avatarMarkup(character)}
        <div>
          <p class="eyebrow">CHARACTER FOUND</p>
          <h2>${escapeHtml(character.name)}</h2>
          <p>${ROLE_LABELS[character.role]} · ${escapeHtml(character.floor || "위치 미확인")}</p>
        </div>
        <button type="button" class="button button--primary" data-confirm-character-login="${character.id}">이 계정으로 접속</button>
      </article>`;
  }

  function characterForLoginPreview(account, remoteGameState = null) {
    const characterId = Number(account?.characterId);
    if (!Number.isFinite(characterId)) return null;

    const remoteCharacters = Array.isArray(remoteGameState?.characters)
      ? remoteGameState.characters
      : null;

    return (
      remoteCharacters?.find(
        (character) => Number(character.id) === characterId,
      ) || getCharacter(characterId)
    );
  }

  async function handleCharacterLogin(event) {
    event.preventDefault();
    elements.loginError.textContent = "";
    elements.loginSearchResult.innerHTML = "";
    ui.pendingLogin = null;

    const password = elements.accessPasswordInput?.value || "";
    if (!password) {
      elements.loginError.textContent = "접속 비밀번호를 입력해 주세요.";
      return;
    }

    const submitButton = elements.characterLoginForm.querySelector(
      'button[type="submit"]',
    );
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "확인 중…";
    }

    try {
      if (!isRemoteConfigured()) {
        throw new Error("SUPABASE_NOT_CONFIGURED");
      }

      const result = await remoteApi("login", { password }, "");
      elements.accessPasswordInput.value = "";

      if (!result?.token || !result?.account) {
        throw new Error("LOGIN_RESPONSE_INVALID");
      }

      if (!result.state && result.account.type !== "admin") {
        remoteApi("logout", {}, result.token).catch(() => {});
        elements.loginError.textContent =
          "게임 서버가 아직 초기화되지 않았습니다. 운영진이 먼저 로그인해 주세요.";
        return;
      }

      const character =
        result.account.type === "admin"
          ? null
          : characterForLoginPreview(result.account, result.state);

      renderPendingLoginResult({
        type: result.account.type === "admin" ? "admin" : "player",
        characterId:
          result.account.type === "admin"
            ? null
            : Number(result.account.characterId),
        character,
        source: "remote",
        account: result.account,
        token: result.token,
        remoteGameState: result.state || null,
        remoteVersion: Number(result.version || 0),
        needsBootstrap: !result.state && result.account.type === "admin",
      });
    } catch (error) {
      console.error("로그인 확인 실패", error);
      if (error.status === 429) {
        elements.loginError.textContent =
          "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.";
      } else if (error.status === 401) {
        elements.loginError.textContent = "등록되지 않은 비밀번호입니다.";
      } else if (error.message === "SUPABASE_NOT_CONFIGURED") {
        elements.loginError.textContent =
          "Supabase 연결 설정이 완료되지 않았습니다.";
      } else {
        elements.loginError.textContent =
          "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "확인";
      }
    }
  }

  async function handleLoginResultClick(event) {
    const characterButton = event.target.closest(
      "[data-confirm-character-login]",
    );
    const adminButton = event.target.closest("[data-confirm-admin-login]");
    if (!characterButton && !adminButton) return;

    const pendingLogin = ui.pendingLogin;
    if (!pendingLogin) return;

    const confirmButton = characterButton || adminButton;
    confirmButton.disabled = true;
    const originalLabel = confirmButton.textContent;
    confirmButton.textContent = "접속 중…";

    try {
      if (pendingLogin.source !== "remote") {
        throw new Error("REMOTE_LOGIN_REQUIRED");
      }

      let remoteGameState = pendingLogin.remoteGameState;
      let remoteVersion = pendingLogin.remoteVersion;

      if (pendingLogin.needsBootstrap) {
        const bootstrapResult = await remoteApi(
          "bootstrap",
          {
            initialState: ensureFeatureState(state),
            mapRules: createServerMapRules(),
          },
          pendingLogin.token,
        );
        remoteGameState = bootstrapResult.state;
        remoteVersion = Number(bootstrapResult.version || 0);
      }

      if (!remoteGameState) {
        throw new Error("LOGIN_STATE_MISSING");
      }

      sessionStorage.setItem(REMOTE_SESSION_KEY, pendingLogin.token);
      enterRemoteSession(
        pendingLogin.account,
        pendingLogin.token,
        remoteGameState,
        remoteVersion,
      );
    } catch (error) {
      console.error("계정 접속 실패", error);
      sessionStorage.removeItem(REMOTE_SESSION_KEY);
      elements.loginError.textContent =
        "계정에 접속하지 못했습니다. 다시 시도해 주세요.";
      confirmButton.disabled = false;
      confirmButton.textContent = originalLabel;
    }
  }

  async function tryRestoreRemoteSession() {
    const token = sessionStorage.getItem(REMOTE_SESSION_KEY);
    if (!token || !isRemoteConfigured()) return false;

    try {
      const result = await remoteApi("resume", {}, token);
      if (!result?.account || !result?.state)
        throw new Error("INVALID_SESSION");
      enterRemoteSession(result.account, token, result.state, result.version);
      return true;
    } catch (error) {
      sessionStorage.removeItem(REMOTE_SESSION_KEY);
      return false;
    }
  }

  function enterRemoteSession(account, token, remoteGameState, version) {
    remoteState.applying = true;
    try {
      state = ensureFeatureState(remoteGameState);
      remoteState.version = Number(version || 0);
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } finally {
      remoteState.applying = false;
    }

    if (account.type === "admin") {
      loginAsAdmin(token);
      return;
    }

    loginAsCharacter(Number(account.characterId), token);
  }

  function loginAsCharacter(id, token = null) {
    const character = getCharacter(id);
    if (!character) {
      elements.loginError.textContent = "등록된 캐릭터가 아닙니다.";
      return;
    }
    session = { type: "player", characterId: character.id, token };
    ui.themeMode = loadAccountTheme();
    ui.selectedCharacterId = character.id;
    ui.currentFloor = character.floor;
    ui.currentBuilding = buildingFromFloorKey(character.floor);
    ui.mapMode = "floor";
    ui.viewMode = character.role;
    ui.adminTool = null;
    ui.rightPanelTab = "inventory";
    ui.pendingLogin = null;
    ui.operationsOpen = false;
    elements.loginError.textContent = "";
    openApp();
  }

  function loginAsAdmin(token = null) {
    session = { type: "admin", token };
    ui.themeMode = loadAccountTheme();
    const selected =
      getCharacter(ui.selectedCharacterId) || state.characters[0];
    ui.selectedCharacterId = selected.id;
    ui.currentFloor = selected.floor;
    ui.currentBuilding = buildingFromFloorKey(selected.floor);
    ui.mapMode = "floor";
    ui.viewMode = "admin";
    ui.adminTool = null;
    ui.rightPanelTab = "manage";
    ui.operationsOpen = false;
    openApp();
    syncRemoteMapRules().catch((error) =>
      console.error("서버 지도 규칙 동기화 실패", error),
    );
  }

  function logout() {
    const token = session?.token;
    if (token) {
      remoteApi("logout", {}, token).catch(() => {});
    }
    sessionStorage.removeItem(REMOTE_SESSION_KEY);
    session = null;
    remoteState.version = 0;
    ui.adminTool = null;
    ui.operationsOpen = false;
    closeModal();
    showLogin();
  }

  function showLogin() {
    session = null;
    clearAccountThemeClasses();
    document.body.classList.add("login-theme");
    document.documentElement.style.colorScheme = "light";

    elements.appView?.classList.remove(
      "app-shell--admin",
      "app-shell--survivor",
      "app-shell--spirit",
      "theme-mode--light",
      "theme-mode--dark",
    );

    elements.loginView.classList.remove("is-hidden");
    elements.appView.classList.add("is-hidden");
    if (elements.accessPasswordInput) elements.accessPasswordInput.value = "";
    elements.loginSearchResult.innerHTML = "";
    elements.loginError.textContent = "";
    ui.pendingLogin = null;

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", "#0c2744");
  }

  function openApp() {
    elements.loginView.classList.add("is-hidden");
    elements.appView.classList.remove("is-hidden");
    resetSpiritActionPointsAt21IfNeeded();
    renderAll();
    maybeOpenFirstSurvivorTutorial();
  }

  function applySessionTheme() {
    if (!session) return;

    const accountType = getCurrentAccountType();
    const themeMode = ui.themeMode === "dark" ? "dark" : "light";

    clearAccountThemeClasses();
    document.body.classList.remove("login-theme");
    document.body.classList.add(`theme-${accountType}`);
    document.body.classList.add(`theme-mode-${themeMode}`);

    elements.appView?.classList.remove(
      "app-shell--admin",
      "app-shell--survivor",
      "app-shell--spirit",
      "theme-mode--light",
      "theme-mode--dark",
    );
    elements.appView?.classList.add(`app-shell--${accountType}`);
    elements.appView?.classList.add(`theme-mode--${themeMode}`);

    document.documentElement.style.colorScheme = themeMode;
    updateThemeToggleButton();

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute(
        "content",
        getThemeMetaColor(accountType, themeMode),
      );
    }
  }

  function getCurrentAccountType() {
    if (session?.type === "admin") return "admin";
    if (session?.type === "player") {
      return getCharacter(session.characterId)?.role === "spirit"
        ? "spirit"
        : "survivor";
    }
    return "admin";
  }

  function getCurrentThemeStorageKey() {
    if (session?.type === "admin") return `${THEME_STORAGE_PREFIX}:admin`;
    if (session?.type === "player") {
      return `${THEME_STORAGE_PREFIX}:character:${session.characterId}`;
    }
    return null;
  }

  function loadAccountTheme() {
    const storageKey = getCurrentThemeStorageKey();
    if (!storageKey) return DEFAULT_THEME_MODE;

    try {
      return localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
    } catch (error) {
      console.warn("계정 테마를 불러오지 못했습니다.", error);
      return DEFAULT_THEME_MODE;
    }
  }

  function saveAccountTheme(themeMode) {
    const storageKey = getCurrentThemeStorageKey();
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, themeMode);
    } catch (error) {
      console.warn("계정 테마를 저장하지 못했습니다.", error);
    }
  }

  function toggleThemeMode() {
    if (!session) return;
    ui.themeMode = ui.themeMode === "dark" ? "light" : "dark";
    saveAccountTheme(ui.themeMode);
    applySessionTheme();
  }

  function updateThemeToggleButton() {
    if (!elements.themeToggleButton) return;
    const isDarkMode = ui.themeMode === "dark";

    elements.themeToggleButton.classList.toggle("is-dark", isDarkMode);
    elements.themeToggleButton.setAttribute("aria-checked", String(isDarkMode));
    elements.themeToggleButton.setAttribute(
      "aria-label",
      isDarkMode ? "라이트모드로 전환" : "다크모드로 전환",
    );

    if (elements.themeToggleLabel) {
      elements.themeToggleLabel.textContent = isDarkMode ? "다크" : "라이트";
    }
  }

  function clearAccountThemeClasses() {
    document.body.classList.remove(
      "theme-admin",
      "theme-survivor",
      "theme-spirit",
      "theme-mode-light",
      "theme-mode-dark",
      "theme-mode--light",
      "theme-mode--dark",
    );
  }

  function getThemeMetaColor(accountType, themeMode) {
    const themeColors = {
      admin: { light: "#65bce8", dark: "#063b52" },
      spirit: { light: "#7b1f36", dark: "#12080b" },
      survivor: { light: "#112f55", dark: "#07182d" },
    };
    return themeColors[accountType]?.[themeMode] || "#0c2744";
  }

  function isSpiritThemeActive() {
    if (session?.type !== "player") return false;
    return getCharacter(session.characterId)?.role === "spirit";
  }

  function getRoleColor(role) {
    if (isSpiritThemeActive()) {
      return role === "spirit" ? "#c83f4f" : "#e1785e";
    }
    return role === "survivor" ? "#2d8e6d" : "#2d72c6";
  }

  function renderSessionBadge() {
    if (session.type === "admin") {
      elements.sessionBadge.innerHTML =
        "<strong>ADMIN</strong><span>운영진 계정</span>";
      return;
    }

    const character = getCharacter(session.characterId);
    elements.sessionBadge.innerHTML = `<strong>${escapeHtml(character.name)}</strong><span>${ROLE_LABELS[character.role]}</span>`;
  }

  function renderViewModeNav() {
    if (session.type !== "admin") return;
    elements.viewModeNav
      .querySelectorAll("[data-view-mode]")
      .forEach((button) => {
        button.classList.toggle(
          "is-active",
          button.dataset.viewMode === ui.viewMode,
        );
      });
  }

  function renderLeftSidebar() {
    if (session.type === "admin") {
      renderAdminRoster();
    } else {
      renderPlayerProfile();
    }
  }

  function renderRightSidebar() {
    if (session.type === "admin") {
      renderAdminPanel();
    } else {
      renderPlayerJournal();
    }
  }

  function renderAdminPanel() {
    const selected = getCharacter(ui.selectedCharacterId);
    const statusOptions = Object.entries(STATUS_DEFINITIONS)
      .map(
        ([id, status]) =>
          `<option value="${id}">${escapeHtml(status.name)}</option>`,
      )
      .join("");

    const tabs = [
      ["manage", "운영"],
      ["teams", "팀"],
      ["layers", "지도"],
      ["records", "기록"],
      ["board", "공동보드"],
    ]
      .map(
        ([id, label]) =>
          `<button type="button" class="panel-tab ${ui.rightPanelTab === id ? "is-active" : ""}" data-panel-tab="${id}">${label}</button>`,
      )
      .join("");

    elements.rightSidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>⚙ 운영진 패널</h2>
        <button type="button" class="button button--small button--ghost" data-admin-action="reset-demo">초기화</button>
      </div>
      <div class="sidebar-body">
        <div class="panel-tabs">${tabs}</div>
        <div class="panel-content">${adminPanelContent(ui.rightPanelTab, selected, statusOptions)}</div>
      </div>
    `;
  }

  function showTeamManagementModal() {
    const memberChecks = state.characters
      .map((character) => {
        const existingTeams = getTeamsForCharacter(character.id);
        return `
        <label class="team-checkbox">
          <input type="checkbox" name="memberIds" value="${character.id}" />
          ${avatarMarkup(character, true)}
          <span><strong>${escapeHtml(character.name)}</strong><small>${ROLE_LABELS[character.role]}${existingTeams.length ? ` · ${existingTeams.map((team) => escapeHtml(team.name)).join(", ")}` : " · 미편성"}</small></span>
        </label>`;
      })
      .join("");
    const teamCards = state.teams.length
      ? state.teams
          .map((team) => {
            const members = team.memberIds.map(getCharacter).filter(Boolean);
            const visible = team.visible !== false;
            return `
          <article class="team-admin-card ${visible ? "" : "is-visibility-off"}" style="--team-color:${team.color}">
            <header>
              <div><strong>${escapeHtml(team.name)}</strong><span>${members.length}명 · ${visible ? "위치 공유 중" : "공유 숨김"}</span></div>
              <button type="button" class="team-eye-button ${visible ? "is-on" : ""}" data-toggle-team-visibility="${team.id}" aria-label="${escapeHtml(team.name)} 위치 공유 ${visible ? "끄기" : "켜기"}">${visible ? "◉" : "○"}</button>
            </header>
            <div class="team-admin-card__members">${members.map((member) => `<span>${escapeHtml(member.name)}</span>`).join("")}</div>
            <button type="button" class="button button--small button--danger" data-dissolve-team="${team.id}">그룹 해제</button>
          </article>`;
          })
          .join("")
      : emptyStateMarkup("편성된 팀이 없습니다.");

    openModal({
      eyebrow: "TEAM CONTROL",
      title: "팀 편성 및 위치 공유",
      body: `
        <div class="team-modal-layout">
          <section class="panel-card">
            <div class="panel-card__header">새 표시 그룹 편성</div>
            <form class="panel-card__body form-stack" data-team-form>
              <input class="form-control" name="teamName" placeholder="예: A조, 임시 조사팀" maxlength="20" required />
              <div class="team-bulk-select" aria-label="팀원 일괄 선택">
                <button type="button" class="button button--small" data-team-bulk-select="all">모두 선택</button>
                <button type="button" class="button button--small" data-team-bulk-select="spirit">동결체만</button>
                <button type="button" class="button button--small" data-team-bulk-select="survivor">생존자만</button>
                <button
                  type="button"
                  class="button button--small team-bulk-select__clear"
                  data-team-bulk-select="clear"
                  aria-label="선택 전체 해제"
                  title="선택 전체 해제"
                >×</button>
              </div>
              <div class="team-checkbox-list team-checkbox-list--modal">${memberChecks}</div>
              <button class="button button--primary" type="submit">선택 인원 그룹화</button>
            </form>
          </section>
          <section class="panel-card">
            <div class="panel-card__header">현재 그룹 목록</div>
            <div class="panel-card__body team-admin-list">${teamCards}</div>
          </section>
        </div>
      `,
      footer: "",
    });
  }

  function showAdminHubModal(tab = "map") {
    ui.adminModalTab = tab;
    const selected = getCharacter(ui.selectedCharacterId);
    const statusOptions = Object.entries(STATUS_DEFINITIONS)
      .map(
        ([id, status]) =>
          `<option value="${id}">${escapeHtml(status.name)}</option>`,
      )
      .join("");
    const tabLabels = { map: "지도", records: "운영 기록", board: "단서 연결" };
    let content = "";

    if (tab === "map") {
      content = `
        <div class="admin-hub-grid">
          <section class="panel-card">
            <div class="panel-card__header">지도 레이어</div>
            <div class="panel-card__body layer-toggle-list">
              ${layerToggleMarkup("corpseRoute", "시신 경로")}
              ${layerToggleMarkup("entities", "동결체")}
            </div>
          </section>
          <section class="panel-card">
            <div class="panel-card__header">지도 편집</div>
            <div class="panel-card__body form-stack">
              <p class="login-card__footnote">편집을 켠 뒤 지도에서 공간을 선택합니다.</p>
            </div>
          </section>
          <section class="panel-card admin-hub-grid__wide">
            <div class="panel-card__header">학술원 부지</div>
            <div class="panel-card__body">${campusMiniMapMarkup()}</div>
          </section>
        </div>`;
    } else if (tab === "records") {
      content = adminPanelContent("records", selected, statusOptions);
    } else {
      content = adminPanelContent("board", selected, statusOptions);
    }

    openModal({
      eyebrow: "ADMINISTRATION",
      title: tabLabels[tab],
      body: `
        <nav class="admin-modal-tabs" aria-label="운영 관리 메뉴">
          ${Object.entries(tabLabels)
            .map(
              ([id, label]) =>
                `<button type="button" class="${tab === id ? "is-active" : ""}" data-admin-modal-tab="${id}">${label}</button>`,
            )
            .join("")}
        </nav>
        <div class="admin-modal-content">${content}</div>
      `,
      footer: `<button type="button" class="button button--danger button--small" data-admin-action="reset-demo">시제품 초기화</button><button type="button" class="button" data-modal-close>닫기</button>`,
    });
  }

  function adminPanelContent(tab, selected, statusOptions) {
    if (tab === "manage") {
      const statusList = selected.statuses.length
        ? selected.statuses
            .map((statusId) => {
              const status = STATUS_DEFINITIONS[statusId];
              return `<div class="status-list__item"><strong>${status.icon} ${escapeHtml(status.name)}</strong><button type="button" class="button button--small" data-remove-status="${statusId}">해제</button></div>`;
            })
            .join("")
        : emptyStateMarkup("상태이상 없음");
      const team = getTeamForCharacter(selected.id);
      const apPanel =
        selected.role === "spirit"
          ? `
          <section class="panel-card">
            <div class="panel-card__header">동결체 행동력</div>
            <div class="panel-card__body control-grid">
              <div class="control-row">
                <button type="button" class="button button--small" data-admin-action="ap-minus">−1</button>
                <button type="button" class="button button--small" data-admin-action="ap-plus-1">+1</button>
                <button type="button" class="button button--small" data-admin-action="ap-plus-3">+3</button>
                <button type="button" class="button button--small" data-admin-action="ap-max">최대</button>
              </div>
              <p class="login-card__footnote">현재 행동력 <span data-admin-live-ap="${selected.id}">${selected.ap} / ${selected.maxAp}</span> · 공간 변경 1회당 1 소모</p>
            </div>
          </section>`
          : `
          <section class="panel-card">
            <div class="panel-card__header">생존자 이동 규칙</div>
            <div class="panel-card__body"><div class="side-note"><strong>플레이어 이동 잠금</strong><p>생존자는 자신의 화면에서 이동할 수 없습니다. 아래 위치 지정 도구로 운영진이 이동시킵니다.</p></div></div>
          </section>`;

      return `
        <section class="panel-card">
          <div class="panel-card__header">선택 캐릭터</div>
          <div class="panel-card__body">
            <div class="selected-summary">
              ${avatarMarkup(selected)}
              <div>
                <h3>${escapeHtml(selected.name)}</h3>
                <p>${ROLE_LABELS[selected.role]} · ${selected.floor} ${escapeHtml(getRoomLabel(selected.floor, selected.x, selected.y))}</p>
                <p>${team ? `소속 팀 · ${escapeHtml(team.name)}` : "소속 팀 · 미편성"}</p>
              </div>
            </div>
          </div>
        </section>

        ${apPanel}

        <section class="panel-card">
          <div class="panel-card__header">역할 및 상태</div>
          <div class="panel-card__body form-stack">
            <label class="control-label">분류
              <select class="form-control" data-role-select>
                <option value="survivor" ${selected.role === "survivor" ? "selected" : ""}>생존자</option>
                <option value="spirit" ${selected.role === "spirit" ? "selected" : ""}>동결체</option>
              </select>
            </label>
            <div class="control-row">
              <select class="form-control" data-status-select><option value="">상태 선택</option>${statusOptions}</select>
              <button type="button" class="button" data-admin-action="apply-status">적용</button>
            </div>
            <div class="status-list">${statusList}</div>
          </div>
        </section>

        <section class="panel-card">
          <div class="panel-card__header">지도 직접 조작</div>
          <div class="panel-card__body control-grid">
            <button type="button" class="button ${ui.adminTool === "forceMove" ? "button--primary" : ""}" data-admin-action="toggle-force-move">${ui.adminTool === "forceMove" ? "개별 위치 지정 중 · 공간 선택" : "선택 캐릭터 이동"}</button>
            <button type="button" class="button ${ui.adminTool === "forceMoveGroup" ? "button--primary" : ""}" data-admin-action="toggle-force-move-group" ${team ? "" : "disabled"}>${ui.adminTool === "forceMoveGroup" ? "팀 이동 지정 중 · 공간 선택" : "소속 팀 전체 이동"}</button>
          </div>
        </section>

        <section class="panel-card">
          <div class="panel-card__header">조사 자료 지급</div>
          <form class="panel-card__body form-stack" data-evidence-form>
            <input class="form-control" name="title" placeholder="자료 이름" required />
            <textarea class="form-control" name="description" placeholder="자료 설명" required></textarea>
            <select class="form-control" name="certainty">
              <option value="unknown">미확인</option>
              <option value="guess">추측</option>
              <option value="likely">유력</option>
              <option value="confirmed">확정</option>
            </select>
            <input class="form-control" type="file" name="file" accept="image/*,.pdf,.txt" />
            <button class="button button--primary" type="submit">선택 캐릭터에게 지급</button>
          </form>
        </section>
      `;
    }

    if (tab === "teams") {
      const memberChecks = state.characters
        .map((character) => {
          const existingTeam = getTeamForCharacter(character.id);
          return `
          <label class="team-checkbox">
            <input type="checkbox" name="memberIds" value="${character.id}" />
            ${avatarMarkup(character, true)}
            <span><strong>${escapeHtml(character.name)}</strong><small>${ROLE_LABELS[character.role]}${existingTeam ? ` · 현재 ${escapeHtml(existingTeam.name)}` : " · 미편성"}</small></span>
          </label>`;
        })
        .join("");
      const teamCards = state.teams.length
        ? state.teams
            .map((team) => {
              const members = team.memberIds.map(getCharacter).filter(Boolean);
              return `
            <article class="team-admin-card" style="--team-color:${team.color}">
              <header><strong>${escapeHtml(team.name)}</strong><span>${members.length}명</span></header>
              <div class="team-admin-card__members">${members.map((member) => `<span>${escapeHtml(member.name)}</span>`).join("")}</div>
              <button type="button" class="button button--small button--danger" data-dissolve-team="${team.id}">그룹 해제</button>
            </article>`;
            })
            .join("")
        : emptyStateMarkup("편성된 팀이 없습니다.");

      return `
        <section class="panel-card">
          <div class="panel-card__header">새 팀 편성</div>
          <form class="panel-card__body form-stack" data-team-form>
            <input class="form-control" name="teamName" placeholder="예: A조, 의무실 조사팀" maxlength="20" required />
            <div class="team-checkbox-list">${memberChecks}</div>
            <button class="button button--primary" type="submit">선택 인원 그룹화</button>
            <p class="login-card__footnote">이미 다른 팀에 속한 인원을 선택하면 기존 팀에서 자동으로 빠집니다.</p>
          </form>
        </section>
        <section class="panel-card">
          <div class="panel-card__header">현재 팀 목록</div>
          <div class="panel-card__body team-admin-list">${teamCards}</div>
        </section>
      `;
    }

    if (tab === "layers") {
      return `
        <section class="panel-card">
          <div class="panel-card__header">지도 레이어</div>
          <div class="panel-card__body layer-toggle-list">
            ${layerToggleMarkup("corpseRoute", "시신 경로")}
            ${layerToggleMarkup("entities", "동결체")}
          </div>
        </section>
        <section class="panel-card">
          <div class="panel-card__header">학술원 부지</div>
          <div class="panel-card__body">
            ${campusMiniMapMarkup()}
            <p class="login-card__footnote">지도 구조는 모든 플레이어에게 공개되며 실제 캐릭터 위치는 자신과 같은 팀만 보입니다.</p>
          </div>
        </section>
        <section class="panel-card">
          <div class="panel-card__header">표시 규칙</div>
          <div class="panel-card__body">
            <div class="side-note"><strong>현재 공간</strong><p>자신이 들어와 있는 공간 전체가 푸른색으로 표시됩니다.</p></div>
            <div class="side-note" style="margin-top:8px"><strong>팀원 위치</strong><p>같은 팀에 편성된 인원의 토큰만 지도에서 확인할 수 있습니다.</p></div>
          </div>
        </section>
      `;
    }

    if (tab === "records") {
      const logs =
        state.logs
          .slice(0, 30)
          .map(
            (entry) => `
        <div class="log-item"><strong>${escapeHtml(entry.time)}</strong><p>${escapeHtml(entry.message)}</p></div>
      `,
          )
          .join("") || emptyStateMarkup("아직 기록이 없습니다.");
      return `
        <section class="panel-card">
          <div class="panel-card__header">실시간 운영 로그</div>
          <div class="panel-card__body log-list">${logs}</div>
        </section>
      `;
    }

    const allEvidence = collectAllEvidence();
    const evidenceOptions = allEvidence
      .map(
        (item) =>
          `<option value="${escapeHtml(item.uid)}">${escapeHtml(item.title)}</option>`,
      )
      .join("");
    const connections = state.connections.length
      ? state.connections
          .map(
            (connection) =>
              `<div class="connection-item"><strong>${escapeHtml(connection.fromTitle)} ↔ ${escapeHtml(connection.toTitle)}</strong><p>${escapeHtml(connection.note || "연결 근거 미작성")}</p></div>`,
          )
          .join("")
      : emptyStateMarkup("연결된 단서가 없습니다.");

    return `
      <section class="panel-card">
        <div class="panel-card__header">단서 연결</div>
        <form class="panel-card__body form-stack" data-connection-form>
          <select class="form-control" name="from" required><option value="">첫 번째 단서</option>${evidenceOptions}</select>
          <select class="form-control" name="to" required><option value="">두 번째 단서</option>${evidenceOptions}</select>
          <textarea class="form-control" name="note" placeholder="두 단서를 연결한 이유"></textarea>
          <button class="button button--primary" type="submit" ${allEvidence.length < 2 ? "disabled" : ""}>연결 저장</button>
        </form>
      </section>
      <section class="panel-card">
        <div class="panel-card__header">현재 연결</div>
        <div class="panel-card__body connection-list">${connections}</div>
      </section>
    `;
  }

  function appendMapMarkers(cellElement, floor, x, y, perspective) {
    const key = cellKey(x, y);
    const actor = getMovementActor();

    if (state.layers.entities) {
      const entity = floor.entities.find(
        (item) => item.x === x && item.y === y,
      );
      if (
        entity &&
        (perspective.mode === "admin" ||
          entity.visibleTo.includes(perspective.mode))
      ) {
        cellElement.insertAdjacentHTML(
          "beforeend",
          `<span class="map-cell__marker map-cell__marker--entity" title="동결체 출몰">❄</span>`,
        );
      }
    }

    if (state.layers.corpseRoute) {
      const routePoint = floor.corpseRoute.find(
        (item) => item.x === x && item.y === y,
      );
      if (routePoint && perspective.mode === "admin") {
        cellElement.insertAdjacentHTML(
          "beforeend",
          `<span class="map-cell__marker map-cell__marker--corpse" title="시신 이동 경로">${escapeHtml(routePoint.label)}</span>`,
        );
      }
    }

    if (!floor.cells[key]) {
      throw new Error(`Floor cell missing: ${floor.id} ${key}`);
    }
  }

  function renderMiniMap(container, mode, character) {
    const floor = FLOOR_DEFINITIONS[ui.currentFloor];
    const focusCharacter = mode === "admin" ? getMovementActor() : character;
    const activeRoomId =
      focusCharacter && focusCharacter.floor === floor.id
        ? getRoomId(focusCharacter.floor, focusCharacter.x, focusCharacter.y)
        : null;
    const warmth = getWarmthInfo(mode, character, floor.id);
    let html = "";

    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLUMNS; x += 1) {
        const cell = floor.cells[cellKey(x, y)];
        const classes = ["mini-cell", "is-visible"];
        if (cell.roomId === activeRoomId) classes.push("is-active-room");
        if (warmth.active && cell.roomId === warmth.roomId)
          classes.push("is-warm");
        const tokens = getVisibleCharactersAtCell(
          floor.id,
          x,
          y,
          { mode, character },
          true,
        )
          .map((token) => {
            const team = getTeamForCharacter(token.id);
            return `<span class="mini-token" style="--role-color:${getRoleColor(token.role)};--team-color:${team?.color || "var(--role-color)"}"></span>`;
          })
          .join("");
        html += `<div class="${classes.join(" ")}" style="--room-color:${cell.color}">${tokens}</div>`;
      }
    }

    container.innerHTML = html;
  }

  function updateMovementRule(actor) {
    const hideForSpiritPlayer =
      session?.type === "player" && actor?.role === "spirit";

    elements.movementRule.classList.toggle("is-hidden", hideForSpiritPlayer);

    if (hideForSpiritPlayer) {
      elements.movementRule.textContent = "";
      return;
    }

    const visibleTeams = getVisibleTeamsForCharacter(actor.id);
    const sharedText = visibleTeams.length
      ? ` · 표시 그룹 ${visibleTeams.map((team) => team.name).join(", ")}`
      : " · 원격 위치 공유 없음";

    elements.movementRule.textContent =
      actor.role === "spirit"
        ? `동결체 · 공간 이동 1회 = 행동력 1 · 층 이동 = 이동 층 수만큼 차감 · 건물 이동 = 행동력 5${sharedText}`
        : `생존자 · 직접 이동 불가 · 운영진 위치 제어${sharedText}`;
  }

  function handleViewModeClick(event) {
    if (session.type !== "admin") return;
    const button = event.target.closest("[data-view-mode]");
    if (!button) return;
    ui.viewMode = button.dataset.viewMode;
    ui.adminTool = null;
    renderAll();
  }

  function requestSpiritFloorMove(character, targetFloor, transition) {
    const destinationTransition = findMatchingTransition(
      targetFloor,
      transition.type,
    );
    const method = transition.type === "stairs" ? "계단" : "엘리베이터";
    openModal({
      eyebrow: "FLOOR MOVEMENT",
      title: "동결체 층 이동 확인",
      body: `
        <div class="movement-confirmation">
          <div class="movement-confirmation__route">
            <span>${escapeHtml(character.floor)}</span><strong>→</strong><span>${escapeHtml(targetFloor)}</span>
          </div>
          <div class="movement-confirmation__cost"><span>소모 행동력</span><strong>1</strong></div>
          <p>${method}을 이용해 층을 변경합니다.</p>
          <p><strong>행동력 1이 소모됩니다. 정말 진행하시겠습니까?</strong></p>
        </div>`,
      footer: `
        <button type="button" class="button" data-modal-close>취소</button>
        <button type="button" class="button button--primary" data-confirm-floor-move>층 이동</button>`,
    });
    elements.modalFooter
      .querySelector("[data-confirm-floor-move]")
      ?.addEventListener("click", async () => {
        if (session?.type === "player" && session?.token) {
          await performRemoteSpiritMove(
            character,
            targetFloor,
            destinationTransition.x,
            destinationTransition.y,
          );
          return;
        }

        if (character.ap < 1) {
          closeModal();
          showToast("행동력이 부족합니다.");
          return;
        }
        const fromFloor = character.floor;
        const fromRoom = getRoomLabel(
          character.floor,
          character.x,
          character.y,
        );
        character.ap -= 1;
        character.floor = targetFloor;
        character.x = destinationTransition.x;
        character.y = destinationTransition.y;
        ui.currentFloor = targetFloor;
        const toRoom = getRoomLabel(character.floor, character.x, character.y);
        recordSpiritMovement(character, {
          fromFloor,
          fromRoom,
          toFloor: targetFloor,
          toRoom,
          cost: 1,
          source: method,
        });
        addLog(
          `${character.name}이(가) ${method}을 이용해 ${targetFloor}으로 이동했습니다. 공간 변경 행동력 −1.`,
        );
        persistState();
        closeModal();
        renderAll();
        showToast("행동력 1을 사용해 층을 이동했습니다.");
      });
  }

  function showTeamDestinationModal(floor, x, y) {
    if (!state.teams.length) {
      showToast("먼저 왼쪽 팀 편성에서 이동시킬 그룹을 만들어 주세요.");
      return;
    }
    const roomLabel = getRoomLabel(floor, x, y);
    const teamOptions = state.teams
      .map((team) => {
        const members = team.memberIds.map(getCharacter).filter(Boolean);
        return `
        <label class="destination-team-option ${team.visible === false ? "is-visibility-off" : ""}" style="--team-color:${team.color}">
          <input type="checkbox" name="teamIds" value="${team.id}" />
          <span class="destination-team-option__mark"></span>
          <span>
            <strong>${escapeHtml(team.name)}</strong>
            <small>${members.map((member) => `${escapeHtml(member.name)} ${member.id}`).join(" · ")}</small>
          </span>
          <em>${team.visible === false ? "위치 공유 꺼짐" : "위치 공유 중"}</em>
        </label>`;
      })
      .join("");

    openModal({
      eyebrow: `${floor} · ${roomLabel}`,
      title: "이 위치로 팀 데려오기",
      body: `
        <form class="form-stack" data-team-destination-form data-floor="${floor}" data-x="${x}" data-y="${y}">
          <div class="destination-summary">
            <span>이동 목적지</span>
            <strong>${escapeHtml(floor)} · ${escapeHtml(roomLabel)}</strong>
            <p>선택한 그룹의 구성원 전원이 이 공간으로 이동합니다. 개인 이동에는 적용되지 않습니다.</p>
          </div>
          <div class="destination-team-list">${teamOptions}</div>
          <button type="submit" class="button button--primary button--full">선택한 팀 전체 이동</button>
        </form>`,
      footer: `<button type="button" class="button" data-modal-close>취소</button>`,
    });
  }

  function moveSelectedTeamsToDestination(form) {
    const formData = new FormData(form);
    const teamIds = [...new Set(formData.getAll("teamIds"))];
    if (!teamIds.length) {
      showToast("이동시킬 팀을 한 개 이상 선택해 주세요.");
      return;
    }
    const floor = form.dataset.floor;
    const x = Number(form.dataset.x);
    const y = Number(form.dataset.y);
    const teams = teamIds
      .map((id) => state.teams.find((team) => team.id === id))
      .filter(Boolean);
    const memberIds = [...new Set(teams.flatMap((team) => team.memberIds))];
    moveCharacterSetTo(memberIds, floor, x, y);
    addLog(
      `관리자가 ${teams.map((team) => team.name).join(", ")} 전원을 ${floor} ${getRoomLabel(floor, x, y)}로 이동했습니다.`,
    );
    persistState();
    closeModal();
    renderAll();
    showToast(
      `${teams.map((team) => team.name).join(", ")} 팀을 이동했습니다.`,
    );
  }

  function moveActorTo(actor, targetX, targetY) {
    if (actor.role !== "spirit" && session.type !== "admin") {
      showToast("직접 이동은 동결체만 가능합니다.");
      return;
    }

    if (actor.statuses.includes("immobilized")) {
      showToast("행동불능 상태라 이동할 수 없습니다.");
      return;
    }

    const reachable = getReachableCellCosts(actor, actor.floor);
    const targetKey = cellKey(targetX, targetY);
    if (!reachable.has(targetKey)) {
      showToast("현재 행동력으로 해당 공간까지 이동할 수 없습니다.");
      return;
    }

    const cost = reachable.get(targetKey);
    if (cost > actor.ap) {
      showToast("행동력이 부족합니다.");
      return;
    }

    const fromRoom = getRoomLabel(actor.floor, actor.x, actor.y);
    const toRoom = getRoomLabel(actor.floor, targetX, targetY);
    openModal({
      eyebrow: "SPIRIT MOVEMENT",
      title: "동결체 이동 확인",
      body: `
        <div class="movement-confirmation">
          <div class="movement-confirmation__route">
            <span>${escapeHtml(fromRoom)}</span><strong>→</strong><span>${escapeHtml(toRoom)}</span>
          </div>
          <div class="movement-confirmation__cost">
            <span>소모 행동력</span>
            <strong>${cost}</strong>
          </div>
          <p>${cost === 0 ? "같은 공간 안의 위치 조정이므로 행동력이 소모되지 않습니다." : `공간이 ${cost}회 변경되어 행동력 ${cost}이 소모됩니다.`}</p>
          <p><strong>정말 이동하시겠습니까?</strong></p>
        </div>`,
      footer: `
        <button type="button" class="button" data-modal-close>취소</button>
        <button type="button" class="button button--primary" data-confirm-spirit-move>이동 진행</button>`,
    });
    elements.modalFooter
      .querySelector("[data-confirm-spirit-move]")
      ?.addEventListener("click", () =>
        commitActorMove(actor, targetX, targetY, cost),
      );
  }

  async function commitActorMove(actor, targetX, targetY, cost) {
    if (session?.type === "player" && session?.token) {
      await performRemoteSpiritMove(actor, actor.floor, targetX, targetY);
      return;
    }

    if (actor.ap < cost) {
      closeModal();
      showToast("행동력이 변경되어 이동할 수 없습니다.");
      return;
    }
    settleAllSurvivorFreezeClocks();
    const fromFloor = actor.floor;
    const fromRoom = getRoomLabel(actor.floor, actor.x, actor.y);
    actor.ap -= cost;
    actor.x = targetX;
    actor.y = targetY;
    const toRoom = getRoomLabel(actor.floor, actor.x, actor.y);
    recordSpiritMovement(actor, {
      fromFloor,
      fromRoom,
      toFloor: actor.floor,
      toRoom,
      cost,
      source: "플레이어 이동",
    });
    const movementMessage =
      cost === 0
        ? `${actor.name}이(가) ${toRoom} 내부에서 위치를 조정했습니다. 행동력 미소모.`
        : `${actor.name}이(가) ${fromRoom}에서 ${toRoom}(으)로 이동했습니다. 공간 변경 ${cost}회, 행동력 −${cost}.`;
    addLog(movementMessage);
    persistState();
    closeModal();
    renderAll();

    showToast(
      cost === 0
        ? "같은 공간 안에서 이동했습니다."
        : `행동력 ${cost}을 사용해 이동했습니다.`,
    );
  }

  async function completeInvestigation(actor, investigation) {
    if (session?.type === "player" && session?.token) {
      await performRemoteInvestigation(investigation.id);
      return;
    }

    actor.investigations.push(investigation.id);
    const uid = `${actor.id}-${investigation.id}`;
    actor.inventory.push({
      uid,
      sourceId: investigation.id,
      title: investigation.evidenceTitle,
      description: investigation.result,
      certainty: investigation.certainty,
      floor: actor.floor,
      room: getRoomLabel(actor.floor, actor.x, actor.y),
      discoveredBy: actor.name,
      fileName: null,
    });
    actor.records.unshift({
      id: investigation.id,
      title: investigation.title,
      description: investigation.result,
      floor: actor.floor,
      room: getRoomLabel(actor.floor, actor.x, actor.y),
    });
    addLog(
      `${actor.name}이(가) ${investigation.title}을(를) 조사해 「${investigation.evidenceTitle}」을(를) 획득했습니다. 행동력 미소모.`,
    );
    persistState();
    closeModal();
    renderAll();
    showToast(`자료 「${investigation.evidenceTitle}」을(를) 획득했습니다.`);
  }

  function handleLeftSidebarClick(event) {
    if (session.type !== "admin") return;

    const rosterFilterButton = event.target.closest(
      "[data-sidebar-roster-filter]",
    );
    if (rosterFilterButton) {
      ui.adminRosterFilter = rosterFilterButton.dataset.sidebarRosterFilter;
      renderAdminRoster();
      return;
    }
    const teamManagerButton = event.target.closest("[data-open-team-manager]");
    if (teamManagerButton) {
      showTeamManagementModal();
      return;
    }
    const visibilityButton = event.target.closest(
      "[data-toggle-team-visibility]",
    );
    if (visibilityButton) {
      toggleTeamVisibility(visibilityButton.dataset.toggleTeamVisibility);
      return;
    }
    const dissolveButton = event.target.closest("[data-dissolve-team]");
    if (dissolveButton) {
      dissolveTeam(dissolveButton.dataset.dissolveTeam);
      return;
    }
    const manageButton = event.target.closest("[data-manage-character]");
    if (manageButton) {
      event.stopPropagation();
      const character = getCharacter(
        Number(manageButton.dataset.manageCharacter),
      );
      if (!character) return;
      ui.selectedCharacterId = character.id;
      ui.currentFloor = character.floor;
      ui.adminTool = null;
      renderAll();
      showCharacterManagementModal(character.id);
      return;
    }
    const selectButton = event.target.closest("[data-select-character]");
    if (!selectButton) return;
    const character = getCharacter(
      Number(selectButton.dataset.selectCharacter),
    );
    if (!character) return;
    ui.selectedCharacterId = character.id;
    ui.currentFloor = character.floor;
    ui.adminTool = null;
    renderAll();
  }

  function handleModalClick(event) {
    const closeButton = event.target.closest("[data-modal-close]");
    if (closeButton) {
      closeModal();
      return;
    }

    if (session?.type !== "admin") {
      const evidenceButton = event.target.closest("[data-evidence-id]");
      if (evidenceButton) {
        const evidence = collectAllEvidence().find(
          (item) => item.uid === evidenceButton.dataset.evidenceId,
        );
        if (evidence) showEvidenceModal(evidence);
      }
      return;
    }

    const modalTab = event.target.closest("[data-admin-modal-tab]");
    if (modalTab) {
      showAdminHubModal(modalTab.dataset.adminModalTab);
      return;
    }

    const teamBulkSelectButton = event.target.closest(
      "[data-team-bulk-select]",
    );
    if (teamBulkSelectButton) {
      const teamForm = teamBulkSelectButton.closest("[data-team-form]");
      if (!teamForm) return;

      const scope = teamBulkSelectButton.dataset.teamBulkSelect;
      teamForm.querySelectorAll('input[name="memberIds"]').forEach((input) => {
        const character = getCharacter(Number(input.value));
        if (!character) {
          input.checked = false;
          return;
        }

        input.checked =
          scope === "all" ||
          (scope === "survivor" && character.role === "survivor") ||
          (scope === "spirit" && character.role === "spirit");
      });
      return;
    }

    const mindNoteDelete = event.target.closest("[data-delete-player-note]");
    if (mindNoteDelete && session.type === "player") {
      const note = state.mindMap.notes.find(
        (item) => item.id === mindNoteDelete.dataset.deletePlayerNote,
      );
      if (note && note.authorId === session.characterId) {
        state.mindMap.notes = state.mindMap.notes.filter(
          (item) => item.id !== note.id,
        );
        persistState();
        renderRightSidebar();
      }
      return;
    }

    const resetClockButton = event.target.closest(
      "[data-reset-infection-clock]",
    );
    if (resetClockButton) {
      const character = getCharacter(
        Number(resetClockButton.dataset.resetInfectionClock),
      );
      if (character) {
        resetInfectionClock(character);
        addLog(
          `관리자가 ${character.name}의 감염 진행 시간을 120:00:00으로 초기화했습니다.`,
        );
        persistState();
        renderAll();
        showCharacterManagementModal(character.id);
        showToast(`${character.name}의 감염 시간을 초기화했습니다.`);
      }
      return;
    }

    const adminButton = event.target.closest("[data-admin-action]");
    if (adminButton) {
      const action = adminButton.dataset.adminAction;
      handleAdminAction(action);
      if (
        ["toggle-force-move", "toggle-force-move-group"].includes(action) &&
        ui.adminTool
      ) {
        closeModal();
      }
      return;
    }

    const visibilityButton = event.target.closest(
      "[data-toggle-team-visibility]",
    );
    if (visibilityButton) {
      toggleTeamVisibility(visibilityButton.dataset.toggleTeamVisibility);
      showTeamManagementModal();
      return;
    }

    const dissolveButton = event.target.closest("[data-dissolve-team]");
    if (dissolveButton) {
      dissolveTeam(dissolveButton.dataset.dissolveTeam);
      showTeamManagementModal();
      return;
    }

    const editManualStatusButton = event.target.closest(
      "[data-edit-manual-status]",
    );
    if (editManualStatusButton) {
      const character = getCharacter(ui.selectedCharacterId);
      if (!character) return;
      showCharacterStatusEditorModal(
        character.id,
        editManualStatusButton.dataset.editManualStatus,
      );
      return;
    }

    const removeManualStatusButton = event.target.closest(
      "[data-remove-manual-status]",
    );
    if (removeManualStatusButton) {
      const character = getCharacter(ui.selectedCharacterId);
      if (!character) return;
      character.manualStatuses = (character.manualStatuses || []).filter(
        (status) =>
          status.id !== removeManualStatusButton.dataset.removeManualStatus,
      );
      addLog(
        `관리자가 ${character.name}의 관리자 추가 상태이상을 삭제했습니다.`,
      );
      persistState();
      renderAll();
      if (ui.operationsOpen) renderAdminOperationsPage();
      showCharacterStatusEditorModal(character.id);
      return;
    }

    const removeStatusButton = event.target.closest("[data-remove-status]");
    if (removeStatusButton) {
      const character = getCharacter(ui.selectedCharacterId);
      character.statuses = character.statuses.filter(
        (id) => id !== removeStatusButton.dataset.removeStatus,
      );
      addLog(
        `관리자가 ${character.name}의 ${STATUS_DEFINITIONS[removeStatusButton.dataset.removeStatus].name} 상태를 해제했습니다.`,
      );
      persistState();
      renderAll();
      showCharacterManagementModal(character.id);
      return;
    }

    const layerButton = event.target.closest("[data-layer]");
    if (layerButton) {
      const layer = layerButton.dataset.layer;
      state.layers[layer] = !state.layers[layer];
      persistState();
      renderAll();
      showAdminHubModal("map");
      return;
    }

    const evidenceButton = event.target.closest("[data-evidence-id]");
    if (evidenceButton) {
      const evidence = collectAllEvidence().find(
        (item) => item.uid === evidenceButton.dataset.evidenceId,
      );
      if (evidence) showEvidenceModal(evidence);
    }
  }

  function handleRightSidebarClick(event) {
    const tabButton = event.target.closest("[data-panel-tab]");
    if (tabButton) {
      ui.rightPanelTab = tabButton.dataset.panelTab;
      renderRightSidebar();
      return;
    }

    const adminButton = event.target.closest("[data-admin-action]");
    if (adminButton && session.type === "admin") {
      handleAdminAction(adminButton.dataset.adminAction);
      return;
    }

    const dissolveButton = event.target.closest("[data-dissolve-team]");
    if (dissolveButton && session.type === "admin") {
      dissolveTeam(dissolveButton.dataset.dissolveTeam);
      return;
    }

    const removeStatusButton = event.target.closest("[data-remove-status]");
    if (removeStatusButton && session.type === "admin") {
      const character = getCharacter(ui.selectedCharacterId);
      character.statuses = character.statuses.filter(
        (id) => id !== removeStatusButton.dataset.removeStatus,
      );
      addLog(
        `관리자가 ${character.name}의 ${STATUS_DEFINITIONS[removeStatusButton.dataset.removeStatus].name} 상태를 해제했습니다.`,
      );
      persistState();
      renderAll();
      return;
    }

    const layerButton = event.target.closest("[data-layer]");
    if (layerButton && session.type === "admin") {
      const layer = layerButton.dataset.layer;
      state.layers[layer] = !state.layers[layer];
      persistState();
      renderAll();
      return;
    }

    const warmingUseButton = event.target.closest("[data-use-warming-item]");
    if (warmingUseButton) {
      useWarmingItem(
        Number(warmingUseButton.dataset.characterId),
        warmingUseButton.dataset.useWarmingItem,
      );
      return;
    }

    const evidenceButton = event.target.closest("[data-evidence-id]");
    if (evidenceButton) {
      const evidence = collectAllEvidence().find(
        (item) => item.uid === evidenceButton.dataset.evidenceId,
      );
      if (evidence) showEvidenceModal(evidence);
    }
  }

  function handleRightSidebarSubmit(event) {
    const characterStatusForm = event.target.closest(
      "[data-character-status-form]",
    );
    if (characterStatusForm) {
      event.preventDefault();
      if (session?.type !== "admin") return;
      const formData = new FormData(characterStatusForm);
      const character = getCharacter(Number(formData.get("characterId")));
      const bodyPart = String(formData.get("bodyPart") || "").trim();
      const severity = String(formData.get("severity") || "").trim();
      const detail = String(formData.get("detail") || "").trim();
      if (!character || !bodyPart || !severity) {
        showToast("다친 부위와 정도를 입력해 주세요.");
        return;
      }
      if (!Array.isArray(character.manualStatuses))
        character.manualStatuses = [];
      const statusId = String(formData.get("statusId") || "");
      const existingStatus = character.manualStatuses.find(
        (status) => status.id === statusId,
      );
      if (existingStatus) {
        existingStatus.bodyPart = bodyPart;
        existingStatus.severity = severity;
        existingStatus.detail = detail;
        existingStatus.updatedAt = new Date().toISOString();
        addLog(
          `관리자가 ${character.name}의 상태이상 「${bodyPart} · ${severity}」을(를) 수정했습니다.`,
        );
      } else {
        character.manualStatuses.push({
          id: `manual-status-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          bodyPart,
          severity,
          detail,
          createdAt: new Date().toISOString(),
        });
        addLog(
          `관리자가 ${character.name}에게 상태이상 「${bodyPart} · ${severity}」을(를) 추가했습니다.`,
        );
      }
      persistState();
      renderAll();
      if (ui.operationsOpen) renderAdminOperationsPage();
      showCharacterStatusEditorModal(character.id);
      showToast(`${character.name}의 상태이상을 적용했습니다.`);
      return;
    }

    const mindNoteForm = event.target.closest("[data-player-mind-note-form]");
    if (mindNoteForm) {
      event.preventDefault();
      createMindNote(new FormData(mindNoteForm));
      return;
    }

    const destinationForm = event.target.closest(
      "[data-team-destination-form]",
    );
    if (destinationForm) {
      event.preventDefault();
      moveSelectedTeamsToDestination(destinationForm);
      return;
    }

    const evidenceForm = event.target.closest("[data-evidence-form]");
    if (evidenceForm) {
      event.preventDefault();
      grantCustomEvidence(new FormData(evidenceForm));
      return;
    }

    const teamForm = event.target.closest("[data-team-form]");
    if (teamForm) {
      event.preventDefault();
      createTeamFromForm(new FormData(teamForm));
      return;
    }

    const connectionForm = event.target.closest("[data-connection-form]");
    if (connectionForm) {
      event.preventDefault();
      createEvidenceConnection(new FormData(connectionForm));
    }
  }

  function handleAdminAction(action) {
    const character = getCharacter(ui.selectedCharacterId);

    if (action === "ap-custom-minus" || action === "ap-custom-plus") {
      if (character.role !== "spirit") {
        showToast("행동력은 동결체에게만 적용됩니다.");
        return;
      }

      const input = elements.modal.querySelector("[data-ap-adjust-input]");
      const amount = Math.floor(Number(input?.value));

      if (!Number.isFinite(amount) || amount <= 0) {
        showToast("추가하거나 차감할 행동력을 1 이상 입력해 주세요.");
        input?.focus();
        return;
      }

      const before = Number(character.ap || 0);

      if (action === "ap-custom-minus") {
        character.ap = Math.max(0, before - amount);
      } else {
        character.ap = Math.min(character.maxAp, before + amount);
      }

      const actualChange = Math.abs(character.ap - before);

      if (actualChange === 0) {
        showToast(
          action === "ap-custom-minus"
            ? "행동력이 이미 0입니다."
            : "행동력이 이미 최대치입니다.",
        );
        return;
      }

      addLog(
        `관리자가 ${character.name}의 행동력을 ${actualChange} ${action === "ap-custom-minus" ? "차감" : "추가"}했습니다. (${character.ap} / ${character.maxAp})`,
      );
      persistState();
      renderAll();

      if (!elements.modalBackdrop.classList.contains("is-hidden")) {
        showCharacterManagementModal(character.id);
      }

      showToast(
        `${character.name} 행동력 ${character.ap} / ${character.maxAp}`,
      );
      return;
    }

    if (action === "apply-status") {
      const select =
        elements.modal.querySelector("[data-status-select]") ||
        elements.rightSidebar.querySelector("[data-status-select]");
      const statusId = select?.value;
      if (!statusId) return;
      if (!character.statuses.includes(statusId))
        character.statuses.push(statusId);
      addLog(
        `관리자가 ${character.name}에게 ${STATUS_DEFINITIONS[statusId].name} 상태를 적용했습니다.`,
      );
      persistState();
      renderAll();
      if (!elements.modalBackdrop.classList.contains("is-hidden"))
        showCharacterManagementModal(character.id);
      return;
    }

    if (action === "toggle-force-move") {
      ui.adminTool = ui.adminTool === "forceMove" ? null : "forceMove";
      showToast(
        ui.adminTool
          ? "지도에서 이동시킬 공간을 선택하세요."
          : "개별 위치 지정 모드를 종료했습니다.",
      );
      renderAll();
      return;
    }

    if (action === "toggle-force-move-group") {
      const team = getTeamForCharacter(character.id);
      if (!team) {
        showToast("선택 캐릭터가 팀에 편성되어 있지 않습니다.");
        return;
      }
      ui.adminTool =
        ui.adminTool === "forceMoveGroup" ? null : "forceMoveGroup";
      showToast(
        ui.adminTool
          ? `${team.name} 전원을 옮길 공간을 선택하세요.`
          : "팀 위치 지정 모드를 종료했습니다.",
      );
      renderAll();
      return;
    }

    if (action === "reset-demo") showResetConfirmation();
  }

  async function grantCustomEvidence(formData) {
    const character = getCharacter(ui.selectedCharacterId);
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const certainty = String(formData.get("certainty") || "unknown");
    const file = formData.get("file");
    if (!title || !description) return;

    let imageData = null;
    let fileName = null;
    if (file && file.size) {
      if (!file.type.startsWith("image/")) {
        showToast("다운로드 가능한 첨부는 사진 파일만 지원합니다.");
        return;
      }
      if (file.size > 1.5 * 1024 * 1024) {
        showToast("사진은 1.5MB 이하만 등록할 수 있습니다.");
        return;
      }
      imageData = await readFileAsDataUrl(file);
      fileName = file.name;
    }

    character.inventory.unshift({
      uid: `custom-${Date.now()}-${character.id}`,
      sourceId: null,
      title,
      description,
      certainty,
      floor: character.floor,
      room: getRoomLabel(character.floor, character.x, character.y),
      discoveredBy: "운영진 지급",
      fileName,
      imageData,
      grantedAt: new Date().toISOString(),
    });
    addLog(
      `관리자가 ${character.name}에게 자료 「${title}」을(를) 지급했습니다.`,
    );
    persistState();
    renderAll();
    if (!elements.modalBackdrop.classList.contains("is-hidden"))
      showCharacterManagementModal(character.id);
    showToast(`${character.name}에게 자료를 지급했습니다.`);
  }

  function createEvidenceConnection(formData) {
    const fromUid = String(formData.get("from") || "");
    const toUid = String(formData.get("to") || "");
    const note = String(formData.get("note") || "").trim();
    if (!fromUid || !toUid || fromUid === toUid) {
      showToast("서로 다른 두 단서를 선택해 주세요.");
      return;
    }
    const evidence = collectAllEvidence();
    const from = evidence.find((item) => item.uid === fromUid);
    const to = evidence.find((item) => item.uid === toUid);
    if (!from || !to) return;
    state.connections.unshift({
      id: `connection-${Date.now()}`,
      from: from.uid,
      to: to.uid,
      fromTitle: from.title,
      toTitle: to.title,
      note,
    });
    addLog(
      `운영진이 「${from.title}」과(와) 「${to.title}」을(를) 연결했습니다.`,
    );
    persistState();
    renderAll();
    showAdminHubModal("board");
    showToast("단서 연결을 저장했습니다.");
  }

  function toggleComparison() {
    if (session.type !== "admin") return;
    ui.comparisonOpen = !ui.comparisonOpen;
    elements.compareViewsButton.textContent = ui.comparisonOpen
      ? "3시점 접기"
      : "3시점 비교";
    renderComparison();
  }

  function getPerspective() {
    if (session.type === "player") {
      const character = getCharacter(session.characterId);
      return { mode: character.role, character };
    }

    if (ui.viewMode === "admin") return { mode: "admin", character: null };
    return {
      mode: ui.viewMode,
      character: getPerspectiveCharacterForMode(ui.viewMode, ui.currentFloor),
    };
  }

  function getPerspectiveCharacterForMode(mode, floor) {
    const selected = getCharacter(ui.selectedCharacterId);
    if (selected && selected.role === mode && selected.floor === floor)
      return selected;
    return (
      state.characters.find(
        (character) => character.role === mode && character.floor === floor,
      ) ||
      state.characters.find((character) => character.role === mode) ||
      null
    );
  }

  function getMovementActor() {
    if (session.type === "player") return getCharacter(session.characterId);
    return getCharacter(ui.selectedCharacterId) || state.characters[0];
  }

  function getVisibleCellKeys(mode, character, floorId) {
    const visible = new Set();
    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLUMNS; x += 1) visible.add(cellKey(x, y));
    }
    return visible;
  }

  function getReachableCellCosts(character, floorId) {
    const reachable = new Map();
    if (
      !character ||
      character.role !== "spirit" ||
      character.floor !== floorId ||
      character.statuses.includes("immobilized")
    )
      return reachable;

    const startKey = cellKey(character.x, character.y);
    const distances = new Map([[startKey, 0]]);
    const queue = [{ x: character.x, y: character.y, cost: 0 }];
    const directions = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];

    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift();
      if (current.cost !== distances.get(cellKey(current.x, current.y)))
        continue;

      directions.forEach(([dx, dy]) => {
        const x = current.x + dx;
        const y = current.y + dy;
        if (
          !isWithinGrid(x, y) ||
          !canStep(floorId, current.x, current.y, x, y)
        )
          return;
        const currentRoomId = getRoomId(floorId, current.x, current.y);
        const nextRoomId = getRoomId(floorId, x, y);
        const nextCost = current.cost + (currentRoomId === nextRoomId ? 0 : 1);
        if (nextCost > character.ap) return;
        const key = cellKey(x, y);
        if (distances.has(key) && distances.get(key) <= nextCost) return;
        distances.set(key, nextCost);
        queue.push({ x, y, cost: nextCost });
      });
    }

    distances.forEach((cost, key) => {
      if (key !== startKey) reachable.set(key, cost);
    });
    return reachable;
  }

  function canViewerSeeCharacterOnMap(viewer, character) {
    if (!viewer || !character) return false;
    if (Number(character.id) === Number(viewer.id)) return true;

    /*
     * 플레이어 지도에서는 서로 다른 역할의 캐릭터 신원을 공개하지 않습니다.
     * 생환자는 동결체를 볼 수 없고, 동결체도 생환자를 볼 수 없습니다.
     * 동결체는 같은 공간에 생환자가 있는지 여부만 '온기' 신호로 전달받습니다.
     */
    return character.role === viewer.role;
  }

  function getVisibleCharactersAtCell(floorId, x, y, perspective, visible) {
    if (!visible) return [];
    const characters = state.characters.filter(
      (character) =>
        character.floor === floorId && character.x === x && character.y === y,
    );
    if (perspective.mode === "admin") return characters;
    if (!perspective.character) return [];

    const viewer = perspective.character;
    const viewerRoomId =
      viewer.floor === floorId
        ? getRoomId(viewer.floor, viewer.x, viewer.y)
        : null;
    const visibleTeams = getVisibleTeamsForCharacter(viewer.id);
    const sharedIds = new Set([
      viewer.id,
      ...visibleTeams.flatMap((team) => team.memberIds),
    ]);

    return characters.filter((character) => {
      if (!canViewerSeeCharacterOnMap(viewer, character)) return false;
      if (character.id === viewer.id) return true;
      if (sharedIds.has(character.id)) return true;
      if (viewerRoomId === null) return false;
      return (
        getRoomId(character.floor, character.x, character.y) === viewerRoomId
      );
    });
  }

  function isHorizontalCirculationRoomCell(cell) {
    if (!cell) return false;

    const id = String(cell.roomId || "").toLowerCase();
    const label = String(cell.roomLabel || "");

    /*
     * 연구별관 1F의 '공용 출입구역'은 이름에 common이 들어가지만
     * 실제 지도 동선상 복도 허브가 아니다.
     *
     * 이 구역을 수평 공용 동선으로 취급하면
     * 공용 출입구역 ↔ 표본접수실 사이의 벽 경계에도 자동 doorway가 생겨
     * 전시 홀을 거치지 않고 벽을 뚫고 바로 이동할 수 있게 된다.
     *
     * 따라서 research_1f_common만 예외적으로 일반 방처럼 취급한다.
     * 전시 홀 ↔ 공용 출입구역은 전시 홀이 공용 동선이므로 그대로 통행 가능하고,
     * 공용 출입구역 → 표본접수실은 반드시 전시 홀을 거쳐야 한다.
     */
    if (id === "research_1f_common") {
      return false;
    }

    /*
     * 지하벙커 B의 중앙 '보안구역'은 안내도상 모든 실을 연결하는
     * 실제 공용 이동 공간입니다. 일반 방으로 취급하면 doorway가 생성되지 않아
     * 동결체가 각 칸으로 이동할 수 없으므로 이 공간만 수평 공용 동선으로 봅니다.
     */
    if (id === "bunker_b_security_zone") {
      return true;
    }

    return (
      /(corridor|hall|lobby|passage|link|common|entry|foyer)/.test(id) ||
      /(복도|통로|로비|홀|공용 출입구역|공용구역|전시 홀|통제구역)/.test(label)
    );
  }

  function isHorizontalCirculationCell(floorId, x, y) {
    const floor = FLOOR_DEFINITIONS[floorId];
    return isHorizontalCirculationRoomCell(floor?.cells?.[cellKey(x, y)]);
  }

  function canStep(floorId, fromX, fromY, toX, toY) {
    const floor = FLOOR_DEFINITIONS[floorId];
    const from = floor?.cells?.[cellKey(fromX, fromY)];
    const to = floor?.cells?.[cellKey(toX, toY)];

    if (!from || !to) return false;

    // 같은 공간 내부 이동은 자유롭게 허용한다.
    if (from.roomId === to.roomId) return true;

    // 서로 다른 공간은 실제 doorway가 있는 경계만 통과할 수 있다.
    if (!floor.doorways.has(edgeKey(fromX, fromY, toX, toY))) {
      return false;
    }

    /*
     * 방과 방 사이를 벽처럼 바로 관통하는 이동을 막는다.
     * 반드시 복도/통로/홀/로비/공용구역 같은 "수평 공용 동선"을
     * 한쪽에 끼고 있어야 다른 공간으로 넘어갈 수 있다.
     *
     * 따라서:
     * 계단 → 바로 옆 연구실 X
     * 계단 → 복도 O
     * 복도 → 연구실 O
     * 연구실 → 바로 옆 연구실 X
     */
    return (
      isHorizontalCirculationCell(floorId, fromX, fromY) ||
      isHorizontalCirculationCell(floorId, toX, toY)
    );
  }

  function getWarmthInfo(mode, character, floorId) {
    if (mode !== "spirit" || !character || character.floor !== floorId) {
      return { active: false, count: 0, roomId: null };
    }

    const roomId = getRoomId(character.floor, character.x, character.y);
    if (
      session?.type === "player" &&
      Number(state?._viewerSignals?.characterId) === Number(character.id)
    ) {
      const detected =
        state._viewerSignals.warmthDetected === true ||
        Number(state._viewerSignals.warmthCount || 0) > 0;
      return { active: detected, count: 0, roomId };
    }

    const survivors = state.characters.filter(
      (candidate) =>
        candidate.role === "survivor" &&
        candidate.floor === character.floor &&
        getRoomId(candidate.floor, candidate.x, candidate.y) === roomId,
    );
    return { active: survivors.length > 0, count: 0, roomId };
  }

  function showResetConfirmation() {
    openModal({
      eyebrow: "DEMO DATA",
      title: "시제품 데이터를 초기화할까요?",
      body: "<p>캐릭터 위치, 행동력, 조사 자료, 상태이상과 운영 로그가 최초 상태로 돌아갑니다.</p>",
      footer: `<button type="button" class="button" data-modal-close>취소</button><button type="button" class="button button--danger" data-confirm-reset>초기화</button>`,
    });
    elements.modalFooter
      .querySelector("[data-modal-close]")
      ?.addEventListener("click", closeModal);
    elements.modalFooter
      .querySelector("[data-confirm-reset]")
      ?.addEventListener("click", () => {
        state = createInitialState();
        persistState();
        ui.currentFloor = "1F";
        ui.selectedCharacterId = 104;
        ui.viewMode = "admin";
        ui.adminTool = null;
        closeModal();
        renderAll();
        showToast("시제품 데이터를 초기화했습니다.");
      });
  }

  function openModal({
    eyebrow = "",
    title,
    body,
    footer = "",
    hideHeaderClose = false,
  }) {
    elements.modalEyebrow.textContent = eyebrow;
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = body;
    elements.modalFooter.innerHTML = footer;
    elements.modalCloseButton.classList.toggle("is-hidden", hideHeaderClose);
    elements.modalBackdrop.classList.remove("is-hidden");
    elements.modalBackdrop.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    elements.modalBackdrop.classList.add("is-hidden");
    elements.modalBackdrop.setAttribute("aria-hidden", "true");
    elements.modalCloseButton.classList.remove("is-hidden");
    elements.modalBody.innerHTML = "";
    elements.modalFooter.innerHTML = "";
  }

  function showToast(message, duration = 2800) {
    window.clearTimeout(ui.toastTimer);
    elements.mapToast.textContent = message;
    elements.mapToast.classList.remove("is-hidden");
    const operationsToast =
      elements.adminOperationsView?.querySelector(".operations-toast");
    if (operationsToast) {
      operationsToast.textContent = message;
      operationsToast.classList.remove("is-hidden");
    }
    ui.toastTimer = window.setTimeout(() => {
      elements.mapToast.classList.add("is-hidden");
      operationsToast?.classList.add("is-hidden");
    }, duration);
  }

  function addLog(message) {
    const now = new Date();
    const time = new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    state.logs.unshift({ id: `log-${Date.now()}`, time, message });
    state.logs = state.logs.slice(0, 100);
  }

  function getCharacter(id) {
    return (
      state.characters.find((character) => character.id === Number(id)) || null
    );
  }

  function normalizeCharacterHealth(character) {
    if (!character) return;
    character.maxHealth = CHARACTER_MAX_HEALTH;
    const numericHealth = Number(character.health);
    character.health = Math.max(
      0,
      Math.min(
        character.maxHealth,
        Number.isFinite(numericHealth)
          ? Math.round(numericHealth)
          : character.maxHealth,
      ),
    );

    if (Array.isArray(character.manualStatuses)) {
      character.manualStatuses.forEach((status) => {
        if (status?.source !== "health-damage") return;
        status.severity = "부상";
        if (
          typeof status.detail === "string" &&
          /^.+ 부상으로 체력이 \d+ 감소했습니다\.$/.test(status.detail)
        ) {
          status.detail = `${status.bodyPart || "부위"} 부상`;
        }
      });
    }
  }

  function characterHealthText(character) {
    if (!character || character.role === "spirit") return "—";
    normalizeCharacterHealth(character);
    return `${character.health} / ${character.maxHealth}`;
  }

  function edgeKey(x1, y1, x2, y2) {
    const a = `${x1}:${y1}`;
    const b = `${x2}:${y2}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function mapKey(floor, x, y) {
    return `${floor}:${x}:${y}`;
  }

  function cellKey(x, y) {
    return `${x}:${y}`;
  }

  function isWithinGrid(x, y) {
    return x >= 0 && x < GRID_COLUMNS && y >= 0 && y < GRID_ROWS;
  }

  function createStorageAdapter() {
    const memory = new Map();
    try {
      const testKey = "__shu_storage_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    } catch (error) {
      return {
        getItem(key) {
          return memory.has(key) ? memory.get(key) : null;
        },
        setItem(key, value) {
          memory.set(key, String(value));
        },
        removeItem(key) {
          memory.delete(key);
        },
      };
    }
  }

  function persistState() {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    syncChannel?.postMessage({ type: "state-update", state });

    if (!session?.token || !isRemoteConfigured() || remoteState.applying)
      return;

    const snapshot = JSON.parse(JSON.stringify(state));
    remoteState.writeQueue = remoteState.writeQueue
      .then(async () => {
        try {
          if (session?.type === "admin") {
            const result = await remoteApi("save-state", {
              state: snapshot,
              mapRules: createServerMapRules(),
              expectedVersion: remoteState.version,
            });
            remoteState.version = Math.max(
              remoteState.version,
              Number(result.version || 0),
            );
            return;
          }

          const result = await remoteApi("save-player-state", {
            state: snapshot,
          });
          remoteState.version = Math.max(
            remoteState.version,
            Number(result.version || 0),
          );
        } catch (error) {
          console.error("서버 상태 저장 실패", error);
          if (error.status === 409) {
            await refreshRemoteState({ quiet: true });
            showToast(
              "다른 사용자의 변경이 먼저 반영되어 최신 상태를 다시 불러왔습니다. 방금 작업을 다시 확인해 주세요.",
              4500,
            );
            return;
          }
          showToast(
            "서버 저장에 실패했습니다. 네트워크 연결을 확인해 주세요.",
            4200,
          );
        }
      })
      .catch((error) => console.error("원격 저장 큐 오류", error));
  }

  async function refreshRemoteState({ quiet = false } = {}) {
    if (!session?.token) return false;

    const previousUnreadCount = session ? getUnreadEmergencyEvents().length : 0;

    try {
      const result = await remoteApi("get-state");
      if (!result?.state) return false;

      const incomingVersion = Number(result.version || 0);

      /*
       * 이미 더 최신 버전을 적용한 뒤 늦게 도착한 get-state 응답은 버립니다.
       * 이 검사가 없으면 층/건물 이동 직후 이전 위치가 잠깐 다시 적용되어
       * 첫 번째 다음 이동이 '같은 공간 이동'으로 잘못 계산될 수 있습니다.
       */
      if (incomingVersion < remoteState.version) {
        return false;
      }

      remoteState.applying = true;
      try {
        state = ensureFeatureState(result.state);
        remoteState.version = incomingVersion;
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
      } finally {
        remoteState.applying = false;
      }

      if (session) {
        renderAll();
        syncOpenAdminCharacterLiveFields();
        notifyNewEmergencyEvents(previousUnreadCount);
      }

      return true;
    } catch (error) {
      console.error("최신 서버 상태 조회 실패", error);
      if (!quiet) showToast("최신 서버 상태를 불러오지 못했습니다.");
      return false;
    }
  }

  async function performRemoteSpiritMove(
    character,
    targetFloor,
    x = null,
    y = null,
  ) {
    if (!session?.token || session.type !== "player") return false;

    if (remoteState.movementInFlight) {
      showToast("이동 처리 중입니다. 잠시만 기다려 주세요.");
      return false;
    }

    const previousFloor = String(character?.floor || "");
    remoteState.movementInFlight = true;

    try {
      const result = await remoteApi("move-spirit", {
        targetFloor,
        targetX: Number.isInteger(x) ? x : null,
        targetY: Number.isInteger(y) ? y : null,
      });
      if (!result?.state) throw new Error("MOVE_RESPONSE_INVALID");

      const incomingVersion = Number(result.version || 0);

      /*
       * 이동 응답은 서버가 확정한 위치이므로 같은 버전 이상일 때만 적용합니다.
       * 이미 더 최신 Realtime 상태가 적용되어 있다면 오래된 응답으로 되돌리지 않습니다.
       */
      if (incomingVersion >= remoteState.version) {
        remoteState.applying = true;
        try {
          state = ensureFeatureState(result.state);
          remoteState.version = incomingVersion;
          storage.setItem(STORAGE_KEY, JSON.stringify(state));
        } finally {
          remoteState.applying = false;
        }
      }

      const moved = getCharacter(session.characterId);
      if (moved) {
        ui.currentFloor = moved.floor;
        ui.currentBuilding = buildingFromFloorKey(moved.floor);
        ui.mapMode = "floor";
      }

      closeModal();
      renderAll();

      showToast(
        result.cost > 0
          ? `행동력 ${result.cost}을 사용해 이동했습니다.`
          : moved && String(moved.floor) !== previousFloor
            ? "이동했습니다. 행동력은 소모되지 않았습니다."
            : "같은 공간 안에서 이동했습니다.",
      );
      return true;
    } catch (error) {
      console.error("서버 이동 처리 실패", error);
      closeModal();

      if (error.status === 403) {
        showToast("이 계정으로는 해당 이동을 할 수 없습니다.");
      } else if (error.code === "NOT_ENOUGH_AP") {
        showToast("행동력이 부족합니다.");
      } else if (error.code === "INVALID_MOVE") {
        showToast("현재 위치에서는 해당 공간으로 이동할 수 없습니다.");
      } else {
        showToast("이동 처리에 실패했습니다. 최신 상태를 확인해 주세요.");
      }

      await refreshRemoteState({ quiet: true });
      return false;
    } finally {
      remoteState.movementInFlight = false;

      const pendingVersion = remoteState.pendingRealtimeVersion;
      remoteState.pendingRealtimeVersion = 0;

      if (pendingVersion > remoteState.version && session?.token) {
        window.setTimeout(() => {
          refreshRemoteState({ quiet: true }).catch((error) =>
            console.error("이동 후 Realtime 동기화 실패", error),
          );
        }, 0);
      }
    }
  }

  async function syncRemoteMapRules() {
    if (!session?.token || session.type !== "admin" || !isRemoteConfigured()) {
      return false;
    }

    const result = await remoteApi("sync-map-rules", {
      mapRules: createServerMapRules(),
    });
    remoteState.version = Math.max(
      remoteState.version,
      Number(result?.version || 0),
    );
    return true;
  }

  async function performRemoteSpiritBuildingMove(character, targetBuilding) {
    if (!session?.token || session.type !== "player") return false;

    const destination = buildingArrivalPoint(targetBuilding);
    if (!destination) {
      showToast("이동할 건물의 도착 지점을 찾지 못했습니다.");
      return false;
    }

    return performRemoteSpiritMove(
      character,
      destination.floor,
      destination.x,
      destination.y,
    );
  }

  async function performRemoteInvestigation(investigationId) {
    if (!session?.token || session.type !== "player") return false;
    try {
      const result = await remoteApi("investigate", { investigationId });
      if (!result?.state) throw new Error("INVESTIGATION_RESPONSE_INVALID");
      remoteState.applying = true;
      try {
        state = ensureFeatureState(result.state);
        remoteState.version = Number(result.version || 0);
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
      } finally {
        remoteState.applying = false;
      }
      closeModal();
      renderAll();
      showToast(
        `자료 「${result.evidenceTitle || "조사자료"}」을(를) 획득했습니다.`,
      );
      return true;
    } catch (error) {
      console.error("서버 조사 처리 실패", error);
      await refreshRemoteState({ quiet: true });
      closeModal();
      if (error.code === "INVALID_INVESTIGATION") {
        showToast("현재 위치에서는 이 조사를 진행할 수 없습니다.");
      } else if (error.code === "ALREADY_INVESTIGATED") {
        showToast("이미 완료한 조사입니다.");
      } else {
        showToast("조사 처리에 실패했습니다. 최신 상태를 확인해 주세요.");
      }
      return false;
    }
  }

  function createServerMapRules() {
    const floors = {};
    Object.entries(FLOOR_DEFINITIONS).forEach(([floorId, floor]) => {
      floors[floorId] = {
        cells: Object.fromEntries(
          Object.entries(floor.cells).map(([key, cell]) => [
            key,
            {
              roomId: cell.roomId,
              roomLabel: cell.roomLabel,
            },
          ]),
        ),
        doorways: [...floor.doorways],
        transitions: (floor.transitions || []).map((transition) => ({
          x: transition.x,
          y: transition.y,
          type: transition.type,
          destinations: [...(transition.destinations || [])],
        })),
        investigations: (floor.investigations || []).map((item) => ({
          id: item.id,
          floor: item.floor,
          x: item.x,
          y: item.y,
          title: item.title,
          evidenceTitle: item.evidenceTitle,
          result: item.result,
          certainty: item.certainty,
        })),
      };
    });

    const buildingArrivals = Object.fromEntries(
      ["main", "living", "research", "support"].map((buildingId) => [
        buildingId,
        buildingArrivalPoint(buildingId),
      ]),
    );

    return {
      schema: 3,
      columns: GRID_COLUMNS,
      rows: GRID_ROWS,
      buildingArrivals,
      floors,
    };
  }

  function createInitialState() {
    return {
      characters: [
        createCharacter(101, "박무진", "survivor", 0, 0, "1F", 2, 3, [], true),
        createCharacter(102, "강도겸", "spirit", 20, 20, "1F", 8, 4, [], true),
        createCharacter(103, "설하린", "spirit", 20, 20, "1F", 2, 4, [], true),
        createCharacter(
          104,
          "설하람",
          "survivor",
          0,
          0,
          "1F",
          3,
          3,
          ["hypothermia"],
          true,
        ),
        createCharacter(105, "백환", "survivor", 0, 0, "1F", 1, 6, [], false),
        createCharacter(
          106,
          "가득순",
          "spirit",
          20,
          20,
          "B1",
          9,
          6,
          ["unstable"],
          false,
        ),
        createCharacter(107, "우혜인", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(108, "도하나", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(109, "야차", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(110, "연호연", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(111, "이건하", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(112, "유수담", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(113, "유애호", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(114, "사공이진", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(115, "권신예", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(116, "하설유", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(117, "하도야", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(118, "여 명", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(119, "무묘진", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(120, "박재안", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(121, "오현주", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(122, "염원", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(123, "신 결", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(124, "제하연", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(125, "이루한", "survivor", 0, 0, "1F", 2, 3, [], false),
        createCharacter(126, "백우양", "survivor", 0, 0, "1F", 2, 3, [], false),
      ],
      teams: [
        {
          id: "team-alpha",
          name: "A조",
          color: "#6a8fb5",
          memberIds: [103, 104],
          visible: true,
        },
      ],
      layers: {
        corpseRoute: true,
        entities: true,
      },
      bunkerAccessByRole: {
        survivor: false,
        spirit: false,
      },
      connections: [],
      logs: [
        {
          id: "seed-1",
          time: "14:36:00",
          message: "B1 서비스 통로에서 온도 급강하가 감지되었습니다.",
        },
        {
          id: "seed-2",
          time: "14:31:00",
          message: "운영진이 설하린과 설하람을 A조로 편성했습니다.",
        },
        {
          id: "seed-3",
          time: "14:28:00",
          message: "공간 단위 이동 규칙이 적용되었습니다.",
        },
      ],
    };
  }

  function createCharacter(
    id,
    name,
    role,
    ap,
    maxAp,
    floor,
    x,
    y,
    statuses,
    online,
  ) {
    return {
      id,
      name,
      role,
      ap,
      maxAp,
      health: CHARACTER_MAX_HEALTH,
      maxHealth: CHARACTER_MAX_HEALTH,
      floor,
      x,
      y,
      statuses,
      inventory: [],
      investigations: [],
      records: [],
      tutorialSeen: false,
      online,
    };
  }

  function getTeamsForCharacter(characterId) {
    return (state.teams || []).filter((team) =>
      team.memberIds.includes(Number(characterId)),
    );
  }

  function getTeamForCharacter(characterId) {
    const teams = getTeamsForCharacter(characterId);
    return teams.find((team) => team.visible !== false) || teams[0] || null;
  }

  function getVisibleTeamsForCharacter(characterId) {
    return getTeamsForCharacter(characterId).filter(
      (team) => team.visible !== false,
    );
  }

  function teamChipsMarkup(characterId) {
    const teams = getTeamsForCharacter(characterId);
    if (!teams.length)
      return `<span class="team-chip team-chip--none">미편성</span>`;
    return teams
      .map(
        (team) =>
          `<span class="team-chip ${team.visible === false ? "is-hidden-team" : ""}" style="--team-color:${team.color}">${escapeHtml(team.name)}${team.visible === false ? " · 숨김" : ""}</span>`,
      )
      .join("");
  }

  function createTeamFromForm(formData) {
    const name = String(formData.get("teamName") || "").trim();
    const memberIds = [
      ...new Set(
        formData
          .getAll("memberIds")
          .map(Number)
          .filter((id) => getCharacter(id)),
      ),
    ];
    if (!name) {
      showToast("팀 이름을 입력해 주세요.");
      return;
    }
    if (memberIds.length < 2) {
      showToast("그룹화할 인원을 두 명 이상 선택해 주세요.");
      return;
    }

    const signature = [...memberIds].sort((a, b) => a - b).join(":");
    const duplicate = state.teams.find(
      (team) =>
        [...team.memberIds].sort((a, b) => a - b).join(":") === signature &&
        team.name === name,
    );
    if (duplicate) {
      showToast("같은 이름과 구성의 그룹이 이미 있습니다.");
      return;
    }

    const palette = [
      "#6a8fb5",
      "#8b78b5",
      "#4d9b87",
      "#b1845f",
      "#9c6678",
      "#667f9c",
    ];
    const team = {
      id: `team-${Date.now()}`,
      name,
      color: palette[state.teams.length % palette.length],
      memberIds,
      visible: true,
    };
    state.teams.push(team);
    addLog(
      `운영진이 ${memberIds.map((id) => getCharacter(id).name).join(", ")}을(를) ${name}(으)로 그룹화했습니다.`,
    );
    persistState();
    renderAll();
    showTeamManagementModal();
    showToast(`${name} 팀을 편성했습니다.`);
  }

  function dissolveTeam(teamId) {
    const team = state.teams.find((candidate) => candidate.id === teamId);
    if (!team) return;
    state.teams = state.teams.filter((candidate) => candidate.id !== teamId);
    addLog(`운영진이 ${team.name} 그룹을 해제했습니다.`);
    persistState();
    renderAll();
    showToast(`${team.name} 그룹을 해제했습니다.`);
  }

  function toggleTeamVisibility(teamId) {
    const team = state.teams.find((candidate) => candidate.id === teamId);
    if (!team) return;
    team.visible = team.visible === false;
    addLog(
      `운영진이 ${team.name}의 위치 공유를 ${team.visible ? "켰습니다" : "잠시 껐습니다"}.`,
    );
    persistState();
    renderAll();
    showToast(
      `${team.name} 위치 공유를 ${team.visible ? "켰습니다" : "껐습니다"}. 그룹 편성은 유지됩니다.`,
    );
  }

  function moveTeamTo(team, floor, x, y) {
    moveCharacterSetTo(team.memberIds, floor, x, y);
  }

  function collectAllEvidence() {
    const seen = new Set();
    const evidence = [];
    state.characters.forEach((character) => {
      character.inventory.forEach((item) => {
        if (!seen.has(item.uid)) {
          seen.add(item.uid);
          evidence.push(item);
        }
      });
    });
    return evidence;
  }

  function avatarMarkup(character, compact = false) {
    const colors = AVATAR_COLORS[character.id] || ["#53677a", "#263747"];
    const roleMark = character.role === "survivor" ? "人" : "霜";
    const initials = character.name.slice(0, compact ? 1 : 2);
    return `<span class="avatar ${compact ? "avatar--round" : ""}" style="--avatar-a:${colors[0]};--avatar-b:${colors[1]};--role-color:${getRoleColor(character.role)}">${escapeHtml(initials)}<span class="avatar__role-mark avatar__role-mark--${character.role}">${roleMark}</span></span>`;
  }

  function roleChipMarkup(role) {
    return `<span class="role-chip role-chip--${role}">${ROLE_LABELS[role]}</span>`;
  }

  function certaintyChipMarkup(certainty) {
    return `<span class="certainty-chip certainty-chip--${certainty}">${certaintyLabel(certainty)}</span>`;
  }

  function layerToggleMarkup(layer, label) {
    return `<button type="button" class="layer-toggle ${state.layers[layer] ? "is-active" : ""}" data-layer="${layer}"><span>${state.layers[layer] ? "✓" : "○"}</span>${label}</button>`;
  }

  function campusMiniMapMarkup() {
    return `
      <div class="campus-mini-map">
        <span class="campus-node campus-node--admin">관리지원동</span>
        <span class="campus-node campus-node--life">생활관</span>
        <span class="campus-node campus-node--research">연구별관</span>
        <span class="campus-node campus-node--center">중앙광장</span>
        <span class="campus-node campus-node--fusion is-current">융합학술동</span>
        <span class="campus-node campus-node--parking">주차장</span>
        <span class="campus-node campus-node--gate">정문</span>
      </div>
    `;
  }

  function emptyStateMarkup(message) {
    return `<div class="empty-state"><span>◇</span><p>${escapeHtml(message)}</p></div>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createFloorDefinitions() {
    const floorSpecs = {
      B1: {
        defaultRoom: {
          id: "b1_corridor",
          label: "지하 공용 복도",
          color: "#e6ebef",
        },
        rooms: [
          room("event_storage", "행사 물품창고", 0, 0, 2, 1, "#f7f8f8"),
          room("document_archive", "문서보관실", 3, 0, 5, 1, "#f7f8f8"),
          room("control_room", "관제실", 6, 0, 10, 1, "#f7eded"),
          room("stairs", "계단", 11, 0, 11, 1, "#eef1f4"),

          room("b1_corridor", "지하 공용 복도", 0, 2, 11, 4, "#e6ebef"),

          room(
            "crisis_sim",
            "위기대응 시뮬레이션 장비실",
            0,
            5,
            4,
            7,
            "#f8f8f6",
          ),
          room("emergency_room", "비상대피실", 5, 5, 10, 7, "#f8f8f6"),
          room("elevator", "엘리베이터", 11, 5, 11, 7, "#edf1f4"),
        ],
        doorways: [
          [1, 1, 1, 2],
          [4, 1, 4, 2],
          [6, 1, 6, 2],
          [9, 1, 9, 2],
          [11, 1, 11, 2],
          [2, 4, 2, 5],
          [7, 4, 7, 5],
          [11, 4, 11, 5],
        ],
        transitions: [
          { x: 11, y: 0, type: "stairs", destinations: ["1F"] },
          {
            x: 11,
            y: 6,
            type: "elevator",
            destinations: ["1F", "2F", "3F", "4F"],
          },
        ],
        investigations: [
          investigation(
            "b1-doc-log",
            "B1",
            4,
            0,
            "문서보관실 기록함",
            1,
            "체크되지 않은 명찰 반납표",
            "참가자 일부의 명찰이 반납되지 않았고 셔틀 탑승명단과 수가 맞지 않습니다.",
            "서류함을 열어 잔류 인원을 대조합니다.",
            "confirmed",
          ),
          investigation(
            "b1-service-frost",
            "B1",
            8,
            3,
            "지하 공용 복도의 서리 흔적",
            2,
            "동결체 이동 흔적",
            "서리가 복도 한쪽으로 끊겼다가 다시 나타납니다. 현재 경로는 유력 단계입니다.",
            "바닥과 벽의 결빙 방향을 정밀 조사합니다.",
            "likely",
          ),
        ],
        entities: [{ x: 9, y: 3, visibleTo: ["spirit"] }],
        corpseRoute: [
          { x: 4, y: 3, label: "1" },
          { x: 7, y: 5, label: "2" },
          { x: 9, y: 3, label: "?" },
        ],
      },

      "1F": {
        defaultRoom: {
          id: "lobby",
          label: "중앙로비",
          color: "#e6eff7",
        },
        rooms: [
          /* 왼쪽 전 높이 */
          room("auditorium", "대강당", 0, 0, 4, 7, "#f4f6f7"),

          /* 오른쪽 상단 */
          room("security", "경비데스크", 5, 0, 5, 1, "#f7f8f8"),
          room("storage", "물품보관소", 6, 0, 6, 1, "#f7f8f8"),
          room("main_gate", "정문", 7, 0, 9, 1, "#d9e8f5"),
          room("stairs", "계단", 10, 0, 11, 1, "#eef1f4"),

          /* 오른쪽 중앙 */
          room("lobby", "중앙로비", 5, 2, 11, 5, "#dfeef8"),

          /* 오른쪽 하단 */
          room("women_wc", "화장실(여)", 5, 6, 5, 7, "#fbefef"),
          room("men_wc", "화장실(남)", 6, 6, 6, 7, "#edf4fb"),
          room("clinic", "의무실", 7, 6, 8, 7, "#f8f7f5"),
          room("admin_office", "행정실", 9, 6, 10, 7, "#f7f7f5"),
          room("elevator", "엘리베이터", 11, 6, 11, 7, "#eef1f4"),
        ],
        doorways: [
          [4, 3, 5, 3],
          [5, 1, 5, 2],
          [6, 1, 6, 2],
          [8, 1, 8, 2],
          [11, 1, 11, 2],
          [5, 5, 5, 6],
          [6, 5, 6, 6],
          [7, 5, 7, 6],
          [9, 5, 9, 6],
          [11, 5, 11, 6],
        ],
        transitions: [
          { x: 11, y: 0, type: "stairs", destinations: ["B1", "2F"] },
          {
            x: 11,
            y: 6,
            type: "elevator",
            destinations: ["B1", "2F", "3F", "4F"],
          },
        ],
        investigations: [
          investigation(
            "1f-clinic-bed",
            "1F",
            7,
            6,
            "의무실 침대 아래",
            1,
            "의무실 야간 출입 명단",
            "폐회 후 연구원 한 명이 의무실에 들어간 기록이 남아 있습니다.",
            "침대 아래와 서랍에 남은 물건을 조사합니다.",
            "confirmed",
          ),
          investigation(
            "1f-security-log",
            "1F",
            5,
            0,
            "경비데스크 운영 PC",
            1,
            "차량 지연 메일",
            "연구진은 참가자들이 이미 셔틀을 타고 떠났다고 오인한 정황이 확인됩니다.",
            "운영 PC의 최근 수신 메일을 확인합니다.",
            "confirmed",
          ),
          investigation(
            "1f-auditorium-stage",
            "1F",
            3,
            4,
            "대강당 무대 뒤",
            2,
            "무대 뒤 혈흔 사진",
            "혈흔은 사람이 끌려간 방향과 일치하지만 아직 인물은 특정되지 않았습니다.",
            "무대 뒤 커튼과 바닥을 정밀 조사합니다.",
            "likely",
          ),
        ],
        entities: [],
        corpseRoute: [
          { x: 7, y: 6, label: "1" },
          { x: 7, y: 3, label: "2" },
          { x: 3, y: 4, label: "?" },
        ],
      },

      "2F": {
        defaultRoom: {
          id: "poster_hall",
          label: "포스터 전시장",
          color: "#eef1f3",
        },
        rooms: [
          room("seminar_1", "세미나실1", 0, 0, 2, 1, "#f7f8f8"),
          room("seminar_2", "세미나실2", 3, 0, 4, 1, "#f7f8f8"),
          room("breakout_1", "분과발표실1", 5, 0, 7, 1, "#f7f8f8"),
          room("breakout_2", "분과발표실2", 8, 0, 9, 1, "#f7f8f8"),
          room("wc_w", "화장실(여)", 10, 0, 10, 1, "#fbefef"),
          room("stairs", "계단", 11, 0, 11, 1, "#eef1f4"),

          room("poster_hall", "포스터 전시장", 0, 2, 11, 5, "#edf2f5"),

          room("group_1", "조별 토론실1", 0, 6, 2, 7, "#f7f8f8"),
          room("group_2", "조별 토론실2", 3, 6, 4, 7, "#f7f8f8"),
          room("print_room", "인쇄실", 5, 6, 6, 7, "#f7f8f8"),
          room("small_seminar", "소형 세미나실", 7, 6, 9, 7, "#f7f8f8"),
          room("wc_m", "화장실(남)", 10, 6, 10, 7, "#edf4fb"),
          room("elevator", "엘리베이터", 11, 6, 11, 7, "#eef1f4"),
        ],
        doorways: [
          [1, 1, 1, 2],
          [3, 1, 3, 2],
          [6, 1, 6, 2],
          [8, 1, 8, 2],
          [10, 1, 10, 2],
          [11, 1, 11, 2],
          [1, 5, 1, 6],
          [3, 5, 3, 6],
          [5, 5, 5, 6],
          [8, 5, 8, 6],
          [10, 5, 10, 6],
          [11, 5, 11, 6],
        ],
        transitions: [
          { x: 11, y: 0, type: "stairs", destinations: ["1F", "3F"] },
          {
            x: 11,
            y: 6,
            type: "elevator",
            destinations: ["B1", "1F", "3F", "4F"],
          },
        ],
        investigations: [
          investigation(
            "2f-poster-note",
            "2F",
            5,
            3,
            "철거되지 않은 포스터",
            1,
            "폐회 시각 수정 메모",
            "행사 종료 시각이 한 차례 변경됐지만 일부 운영 문서에는 반영되지 않았습니다.",
            "겹쳐 붙은 포스터와 뒤쪽 메모를 확인합니다.",
            "likely",
          ),
          investigation(
            "2f-print-fragment",
            "2F",
            5,
            6,
            "인쇄실 폐기함",
            1,
            "찢긴 비상경보 출력물",
            "연구별관 비상경보가 폐회 후 발생했다는 시간이 인쇄되어 있습니다.",
            "폐기된 출력물을 복원합니다.",
            "confirmed",
          ),
        ],
        entities: [{ x: 6, y: 4, visibleTo: ["survivor", "spirit"] }],
        corpseRoute: [],
      },

      "3F": {
        defaultRoom: {
          id: "archive_hall",
          label: "자료열람실",
          color: "#eef1f3",
        },
        rooms: [
          room("fusion_lab_1", "융합연구실1", 0, 0, 2, 1, "#f7f8f8"),
          room("fusion_lab_2", "융합연구실2", 3, 0, 4, 1, "#f7f8f8"),
          room("prof_wait", "교수 대기실", 5, 0, 6, 1, "#f7f8f8"),
          room("presenter_wait", "발표자 대기실", 7, 0, 9, 1, "#f7f8f8"),
          room("wc_w", "화장실(여)", 10, 0, 10, 1, "#fbefef"),
          room("stairs", "계단", 11, 0, 11, 1, "#eef1f4"),

          room("archive_hall", "자료열람실", 0, 2, 11, 5, "#edf2f5"),

          room("computer_room", "컴퓨터실", 0, 6, 2, 7, "#f7f8f8"),
          room("project_1", "학생 프로젝트실1", 3, 6, 5, 7, "#f7f8f8"),
          room("project_2", "학생 프로젝트실2", 6, 6, 9, 7, "#f7f8f8"),
          room("wc_m", "화장실(남)", 10, 6, 10, 7, "#edf4fb"),
          room("elevator", "엘리베이터", 11, 6, 11, 7, "#eef1f4"),
        ],
        doorways: [
          [1, 1, 1, 2],
          [3, 1, 3, 2],
          [5, 1, 5, 2],
          [8, 1, 8, 2],
          [10, 1, 10, 2],
          [11, 1, 11, 2],
          [1, 5, 1, 6],
          [4, 5, 4, 6],
          [7, 5, 7, 6],
          [10, 5, 10, 6],
          [11, 5, 11, 6],
        ],
        transitions: [
          { x: 11, y: 0, type: "stairs", destinations: ["2F", "4F"] },
          {
            x: 11,
            y: 6,
            type: "elevator",
            destinations: ["B1", "1F", "2F", "4F"],
          },
        ],
        investigations: [
          investigation(
            "3f-pc-backup",
            "3F",
            1,
            6,
            "컴퓨터실 백업 서버",
            2,
            "삭제된 출입 기록 백업",
            "삭제된 로그에 연구별관에서 융합학술동으로 이동한 카드키 기록이 남아 있습니다.",
            "백업 서버에서 삭제된 로그를 복구합니다.",
            "confirmed",
          ),
          investigation(
            "3f-archive-photo",
            "3F",
            6,
            3,
            "자료열람실 사진 파일",
            1,
            "폐회 직후 중앙광장 사진",
            "사진 구석에 셔틀에 타지 않은 인영이 찍혀 있지만 신원은 불명입니다.",
            "날짜가 같은 사진들을 시간순으로 정렬합니다.",
            "guess",
          ),
        ],
        entities: [],
        corpseRoute: [],
      },

      "4F": {
        defaultRoom: {
          id: "ops_corridor",
          label: "운영구역 공용 복도",
          color: "#eef1f3",
        },
        rooms: [
          room("director_office", "학술원장실", 0, 0, 2, 1, "#f7f8f8"),
          room("executive_meeting", "임원 회의실", 3, 0, 5, 1, "#f7f8f8"),
          room("official_records", "공식 기록실", 6, 0, 9, 1, "#f7f8f8"),
          room("wc", "화장실", 10, 0, 10, 1, "#f5f0f0"),
          room("stairs", "계단", 11, 0, 11, 1, "#eef1f4"),

          room("ops_corridor", "운영구역 공용 복도", 0, 2, 11, 5, "#e9edf0"),

          room("operations", "운영본부", 0, 6, 5, 7, "#f7f8f8"),
          room("disaster_room", "재난대응 상황실", 6, 6, 10, 7, "#f4f6f7"),
          room("elevator", "엘리베이터", 11, 6, 11, 7, "#eef1f4"),
        ],
        doorways: [
          [1, 1, 1, 2],
          [4, 1, 4, 2],
          [7, 1, 7, 2],
          [10, 1, 10, 2],
          [11, 1, 11, 2],
          [2, 5, 2, 6],
          [8, 5, 8, 6],
          [11, 5, 11, 6],
        ],
        transitions: [
          { x: 11, y: 0, type: "stairs", destinations: ["3F"] },
          {
            x: 11,
            y: 6,
            type: "elevator",
            destinations: ["B1", "1F", "2F", "3F"],
          },
        ],
        investigations: [
          investigation(
            "4f-ops-mail",
            "4F",
            2,
            6,
            "운영본부 공용 PC",
            1,
            "외부기관 발신 공문",
            "연구진이 참가자 전원 철수를 전제로 대응을 늦춘 정황이 확인됩니다.",
            "운영본부 공용 계정의 발신·수신 문서를 대조합니다.",
            "confirmed",
          ),
          investigation(
            "4f-disaster-call",
            "4F",
            8,
            6,
            "재난대응 상황실 통화 기록",
            2,
            "경보 직후 통화 녹취 요약",
            "누군가 비공개 연구구역의 출입을 먼저 통제하라고 지시했습니다.",
            "녹취 파일에서 지시 내용을 복원합니다.",
            "likely",
          ),
        ],
        entities: [],
        corpseRoute: [],
      },
    };
    const definitions = {};
    Object.entries(floorSpecs).forEach(([floorId, spec]) => {
      const cells = {};
      for (let y = 0; y < GRID_ROWS; y += 1) {
        for (let x = 0; x < GRID_COLUMNS; x += 1) {
          cells[cellKey(x, y)] = {
            x,
            y,
            roomId: spec.defaultRoom.id,
            roomLabel: spec.defaultRoom.label,
            color: spec.defaultRoom.color,
            labelHere: false,
            edgeRight: false,
            edgeBottom: false,
          };
        }
      }

      spec.rooms.forEach((roomSpec) => {
        for (let y = roomSpec.y1; y <= roomSpec.y2; y += 1) {
          for (let x = roomSpec.x1; x <= roomSpec.x2; x += 1) {
            cells[cellKey(x, y)] = {
              ...cells[cellKey(x, y)],
              roomId: roomSpec.id,
              roomLabel: roomSpec.label,
              color: roomSpec.color,
            };
          }
        }
        const labelX = Math.floor((roomSpec.x1 + roomSpec.x2) / 2);
        const labelY = Math.floor((roomSpec.y1 + roomSpec.y2) / 2);
        cells[cellKey(labelX, labelY)].labelHere = true;
      });

      for (let y = 0; y < GRID_ROWS; y += 1) {
        for (let x = 0; x < GRID_COLUMNS; x += 1) {
          const cell = cells[cellKey(x, y)];
          const right = x < GRID_COLUMNS - 1 ? cells[cellKey(x + 1, y)] : null;
          const bottom = y < GRID_ROWS - 1 ? cells[cellKey(x, y + 1)] : null;
          cell.edgeRight = Boolean(right && right.roomId !== cell.roomId);
          cell.edgeBottom = Boolean(bottom && bottom.roomId !== cell.roomId);
        }
      }

      definitions[floorId] = {
        id: floorId,
        cells,
        rooms: spec.rooms,
        transitions: spec.transitions,
        doorways: new Set(
          (spec.doorways || []).map((door) => edgeKey(...door)),
        ),
        investigations: spec.investigations,
        entities: spec.entities,
        corpseRoute: spec.corpseRoute,
      };
    });

    return definitions;
  }

  function room(id, label, x1, y1, x2, y2, color) {
    return { id, label, x1, y1, x2, y2, color };
  }

  function investigation(
    id,
    floor,
    x,
    y,
    title,
    cost,
    evidenceTitle,
    result,
    prompt,
    certainty,
  ) {
    return {
      id,
      floor,
      x,
      y,
      title,
      cost,
      evidenceTitle,
      result,
      prompt,
      certainty,
    };
  }

  const OPERATIONS_TABS = {
    overview: "인원 현황",
    inventory: "소지품 추가",
    burning: "공간 진행도",
    mindmap: "공동 마인드맵",
    movements: "동결 이동 기록",
    memos: "운영 메모",
    events: "긴급 이벤트",
    settings: "환경설정",
  };

  const SPIRIT_STATE_LABELS = {
    stable: "안정",
    unstable: "불안정",
    freezing: "동결 진행",
    dormant: "휴면",
  };

  const FEATURE_LABELS = {
    inventory: "소지품",
    records: "조사 기록",
    board: "공동 마인드맵",
    tracking: "추적 기록",
  };

  const MAP_INFO_LABELS = {
    roomLabels: "공간명",
    burning: "공간 버닝 진행도",
    teamPositions: "그룹 위치 공유",
    warmth: "온기 감지",
  };

  function migrateState(candidate) {
    const migrated =
      candidate && Array.isArray(candidate.characters)
        ? candidate
        : createInitialState();
    if (!Array.isArray(migrated.teams)) migrated.teams = [];
    if (!Array.isArray(migrated.logs)) migrated.logs = [];
    if (!Array.isArray(migrated.movementLogs)) migrated.movementLogs = [];
    if (!Array.isArray(migrated.adminMemos)) migrated.adminMemos = [];
    if (!migrated.exposure) migrated.exposure = {};

    const legacyBunkerAccess =
      typeof migrated.bunkerAccessEnabled === "boolean"
        ? migrated.bunkerAccessEnabled
        : false;
    if (
      !migrated.bunkerAccessByRole ||
      typeof migrated.bunkerAccessByRole !== "object"
    ) {
      migrated.bunkerAccessByRole = {
        survivor: legacyBunkerAccess,
        spirit: legacyBunkerAccess,
      };
    } else {
      if (typeof migrated.bunkerAccessByRole.survivor !== "boolean")
        migrated.bunkerAccessByRole.survivor = legacyBunkerAccess;
      if (typeof migrated.bunkerAccessByRole.spirit !== "boolean")
        migrated.bunkerAccessByRole.spirit = legacyBunkerAccess;
    }
    delete migrated.bunkerAccessEnabled;

    ["survivor", "spirit"].forEach((role) => {
      const defaults = defaultRoleExposure(role);
      const current = migrated.exposure[role] || {};
      migrated.exposure[role] = {
        floors: { ...defaults.floors, ...(current.floors || {}) },
        features: { ...defaults.features, ...(current.features || {}) },
        mapInfo: { ...defaults.mapInfo, ...(current.mapInfo || {}) },
      };
    });
    migrated.teams.forEach((team) => {
      if (typeof team.visible !== "boolean") team.visible = true;
    });
    migrated.characters.forEach((character, index) => {
      normalizeCharacterHealth(character);
      if (!Array.isArray(character.inventory)) character.inventory = [];
      if (!Array.isArray(character.investigations))
        character.investigations = [];
      if (!Array.isArray(character.records)) character.records = [];
      if (!Array.isArray(character.statuses)) character.statuses = [];
      character.inventory.forEach((item) => {
        if (!("imageData" in item)) item.imageData = null;
        if (!("fileName" in item)) item.fileName = null;
      });
      if (character.role === "survivor") {
        character.ap = 0;
        character.maxAp = 0;
        character.spiritState = null;
        character.spiritSince = null;
      } else {
        character.spiritState =
          character.spiritState ||
          (character.statuses.includes("unstable") ? "unstable" : "stable");
        character.spiritSince =
          character.spiritSince ||
          new Date(Date.now() - (index + 1) * 36e5).toISOString();
      }
    });
    return migrated;
  }

  function loadState() {
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) return migrateState(createInitialState());
    try {
      return migrateState(JSON.parse(stored));
    } catch (error) {
      console.warn("저장된 데이터를 읽지 못해 초기 상태를 사용합니다.", error);
      return migrateState(createInitialState());
    }
  }

  function openAdminOperationsPage() {
    if (session?.type !== "admin") return;
    ui.operationsOpen = !ui.operationsOpen;
    ui.adminTool = null;
    closeModal();
    renderAll();
  }

  function closeAdminOperationsPage() {
    ui.operationsOpen = false;
    renderAll();
  }

  function roleRosterMarkup(role, characters) {
    const rows = characters
      .map((character) => {
        const itemNames = character.inventory.length
          ? character.inventory
              .slice(0, 3)
              .map(
                (item) =>
                  `<button type="button" class="compact-item-link" data-evidence-id="${escapeHtml(item.uid)}">${escapeHtml(item.title)}</button>`,
              )
              .join("")
          : `<span class="muted-text">없음</span>`;
        const spiritInfo =
          role === "spirit"
            ? `<strong>${escapeHtml(SPIRIT_STATE_LABELS[character.spiritState] || "미설정")}</strong><small>${formatElapsed(character.spiritSince)}</small>`
            : `<span class="muted-text">해당 없음</span>`;
        return `
        <tr>
          <td><button type="button" class="operations-character-link" data-operations-character="${character.id}">${escapeHtml(character.name)}</button></td>
          <td>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</td>
          <td><div class="compact-item-list">${itemNames}</div></td>
          <td><div class="spirit-state-cell">${spiritInfo}</div></td>
          <td>${character.statuses.length ? character.statuses.map((statusId) => `<span class="status-icon" title="${escapeHtml(STATUS_DEFINITIONS[statusId]?.name || statusId)}">${STATUS_DEFINITIONS[statusId]?.icon || "·"}</span>`).join("") : "정상"}</td>
        </tr>`;
      })
      .join("");
    return `
      <section class="operations-card operations-card--roster">
        <header><div><p class="eyebrow">${role === "survivor" ? "SURVIVORS" : "SPIRITS"}</p><h2>${ROLE_LABELS[role]} 목록</h2></div><span>${characters.length}명</span></header>
        <div class="operations-table-wrap">
          <table class="operations-table">
            <thead><tr><th>이름</th><th>현재 위치</th><th>소지품</th><th>동결 상태 · 경과</th><th>상태이상</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5">해당 인원이 없습니다.</td></tr>`}</tbody>
          </table>
        </div>
      </section>`;
  }

  function movementOperationsMarkup() {
    const filters = state.characters
      .filter((character) => character.role === "spirit")
      .map(
        (character) =>
          `<option value="${character.id}">${escapeHtml(character.name)}</option>`,
      )
      .join("");
    const rows = state.movementLogs
      .map((entry) => {
        const character = getCharacter(entry.characterId);
        return `
        <tr data-movement-row="${entry.characterId}">
          <td>${escapeHtml(formatDateTime(entry.createdAt))}</td>
          <td>${character ? `${escapeHtml(character.name)}` : entry.characterId}</td>
          <td>${escapeHtml(entry.fromFloor)} · ${escapeHtml(entry.fromRoom)}</td>
          <td>${escapeHtml(entry.toFloor)} · ${escapeHtml(entry.toRoom)}</td>
          <td>${entry.cost}</td>
          <td>${escapeHtml(entry.source)}</td>
        </tr>`;
      })
      .join("");
    return `
      <section class="operations-card">
        <header class="operations-card__filter"><div><p class="eyebrow">SPIRIT MOVEMENT LOG</p><h2>동결체 움직임 기록</h2></div><select class="form-control" data-movement-filter><option value="all">전체 동결체</option>${filters}</select></header>
        <div class="operations-table-wrap"><table class="operations-table"><thead><tr><th>시간</th><th>동결체</th><th>이전 위치</th><th>도착 위치</th><th>소모 AP</th><th>구분</th></tr></thead><tbody>${rows || `<tr><td colspan="6">이동 기록이 없습니다.</td></tr>`}</tbody></table></div>
      </section>`;
  }

  function memoOperationsMarkup() {
    const memos = state.adminMemos
      .map(
        (memo) => `
      <article class="admin-memo">
        <header><strong>${escapeHtml(memo.author || "운영진")}</strong><time>${escapeHtml(formatDateTime(memo.createdAt))}</time></header>
        <p>${escapeHtml(memo.text)}</p>
        <button type="button" class="compact-icon-button" data-delete-memo="${memo.id}">삭제</button>
      </article>`,
      )
      .join("");
    return `
      <div class="operations-two-column operations-two-column--memo">
        <section class="operations-card">
          <header><div><p class="eyebrow">SHARED NOTE</p><h2>운영진 공유 메모 작성</h2></div></header>
          <form class="operations-form" data-admin-memo-form>
            <label>작성자<input class="form-control" name="author" maxlength="20" value="운영진" /></label>
            <label>메모<textarea class="form-control" name="text" required rows="8" placeholder="다른 운영진이 확인해야 할 진행 상황을 기록하세요."></textarea></label>
            <button type="submit" class="button button--primary">공유 메모 남기기</button>
          </form>
        </section>
        <section class="operations-card">
          <header><div><p class="eyebrow">LIVE MEMOS</p><h2>공유된 메모</h2></div><span>${state.adminMemos.length}건</span></header>
          <div class="admin-memo-list">${memos || emptyStateMarkup("공유 메모가 없습니다.")}</div>
        </section>
      </div>`;
  }

  function settingToggleMarkup(role, group, key, label, checked) {
    return `<label class="settings-toggle"><input type="checkbox" data-exposure-role="${role}" data-exposure-group="${group}" data-exposure-key="${key}" ${checked ? "checked" : ""} /><span></span><strong>${escapeHtml(label)}</strong></label>`;
  }

  function handleOperationsChange(event) {
    if (session?.type !== "admin") return;

    if (event.target.matches("[data-item-type-select]")) {
      const form = event.target.closest("[data-resource-library-form]");
      syncInventoryRegistrationFields(form);
      return;
    }

    if (event.target.matches("[data-resource-discovery-floor]")) {
      const form = event.target.closest("[data-resource-library-form]");
      syncResourceDiscoveryRoomSelect(form);
      return;
    }

    if (event.target.matches("[data-bunker-access-role]")) {
      const toggle = event.target;
      const row = toggle.closest("[data-bunker-role-setting]");
      const stateLabel = row?.querySelector("[data-bunker-access-state]");
      if (stateLabel) {
        stateLabel.textContent = toggle.checked ? "ON" : "OFF";
        stateLabel.dataset.enabled = toggle.checked ? "true" : "false";
      }
      return;
    }

    if (event.target.matches("[data-exposure-role]")) {
      return;
    }
    if (event.target.matches("[data-movement-filter]")) {
      const value = event.target.value;
      elements.adminOperationsView
        .querySelectorAll("[data-movement-row]")
        .forEach((row) => {
          row.classList.toggle(
            "is-hidden",
            value !== "all" && row.dataset.movementRow !== value,
          );
        });
    }
  }

  async function registerBulkItem(formData) {
    const characterIds = [
      ...new Set(
        formData
          .getAll("characterIds")
          .map(Number)
          .filter((id) => getCharacter(id)),
      ),
    ];
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const certainty = String(formData.get("certainty") || "unknown");
    const file = formData.get("image");
    if (!characterIds.length) {
      showToast("소지품을 등록할 인원을 선택해 주세요.");
      return;
    }
    if (!title || !description) return;
    let imageData = null;
    let fileName = null;
    if (file && file.size) {
      if (!file.type.startsWith("image/")) {
        showToast("사진 파일만 첨부할 수 있습니다.");
        return;
      }
      if (file.size > 1.5 * 1024 * 1024) {
        showToast("사진은 1.5MB 이하만 등록할 수 있습니다.");
        return;
      }
      imageData = await readFileAsDataUrl(file);
      fileName = file.name;
    }
    const sharedId = `admin-item-${Date.now()}`;
    characterIds.forEach((id) => {
      const character = getCharacter(id);
      character.inventory.unshift({
        uid: `${sharedId}-${id}`,
        sharedItemId: sharedId,
        sourceId: null,
        title,
        description,
        certainty,
        floor: character.floor,
        room: getRoomLabel(character.floor, character.x, character.y),
        discoveredBy: "운영진 등록",
        fileName,
        imageData,
        grantedAt: new Date().toISOString(),
      });
    });
    addLog(
      `운영진이 ${characterIds.map((id) => getCharacter(id).name).join(", ")}에게 소지품 「${title}」을(를) 등록했습니다.`,
    );
    persistState();
    renderAdminOperationsPage();
    showToast(`${characterIds.length}명에게 「${title}」을 등록했습니다.`);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () =>
        reject(reader.error || new Error("파일을 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
  }

  function getRoleExposure(role) {
    state.exposure = state.exposure || {};
    state.exposure[role] = state.exposure[role] || defaultRoleExposure(role);
    return state.exposure[role];
  }

  function formatElapsed(iso) {
    if (!iso) return "-";
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const minutes = Math.floor(diff / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    if (days) return `${days}일 ${hours}시간 경과`;
    if (hours) return `${hours}시간 ${mins}분 경과`;
    return `${mins}분 경과`;
  }

  function formatDateTime(iso) {
    if (!iso) return "-";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  }

  const LEGACY_SPACE_TIME_ADDITIONS = [0, 0.2, 0.5, 1.2, 2.0, 2.5];

  /*
   * 공간 진행도는 "기본 1.0배 + 추가 배속" 방식으로 관리한다.
   * 관리자 목록에는 +0.0 ~ +4.0을 0.1 단위로 노출한다.
   *
   * 예)
   * +0.0 = 실제 1.0배 진행
   * +0.1 = 실제 1.1배 진행
   * +1.5 = 실제 2.5배 진행
   * +4.0 = 실제 5.0배 진행
   */
  const SPACE_BURNING_ADD_MIN = 0.0;
  const SPACE_BURNING_ADD_MAX = 4.0;
  const SPACE_BURNING_ADD_STEP = 0.1;
  const SPACE_BURNING_MODE = "direct-addition-v3";
  const PREVIOUS_SPACE_MULTIPLIER_MODE = "direct-multiplier-v2";

  const SPACE_BURNING_OPTIONS = Array.from(
    {
      length:
        Math.round(
          (SPACE_BURNING_ADD_MAX - SPACE_BURNING_ADD_MIN) /
            SPACE_BURNING_ADD_STEP,
        ) + 1,
    },
    (_, index) =>
      Number(
        (
          SPACE_BURNING_ADD_MIN +
          index * SPACE_BURNING_ADD_STEP
        ).toFixed(1),
      ),
  );

  function spaceBurningKey(floor, roomId) {
    return `${floor}::${roomId}`;
  }

  function clampSpaceBurningAddition(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return SPACE_BURNING_ADD_MIN;
    return Number(
      Math.min(
        SPACE_BURNING_ADD_MAX,
        Math.max(SPACE_BURNING_ADD_MIN, numeric),
      ).toFixed(1),
    );
  }

  function getSpaceBurningAddition(floor, roomId) {
    const raw = Number(
      state.spaceBurning?.[spaceBurningKey(floor, roomId)] ?? 0,
    );

    if (state.spaceBurningMode === SPACE_BURNING_MODE) {
      return clampSpaceBurningAddition(raw);
    }

    /*
     * 직전 버전(direct-multiplier-v2)은 실제 총배율 1.0~4.0을
     * 저장했으므로 추가 배속으로 안전하게 환산한다.
     */
    if (state.spaceBurningMode === PREVIOUS_SPACE_MULTIPLIER_MODE) {
      return clampSpaceBurningAddition(Math.max(0, raw - 1));
    }

    /*
     * 더 이전 서버 상태는 0~5 단계값을 저장했으므로
     * 해당 단계의 추가 배속값을 그대로 이어받는다.
     */
    const legacyLevel = Math.max(
      0,
      Math.min(LEGACY_SPACE_TIME_ADDITIONS.length - 1, Math.round(raw || 0)),
    );

    return clampSpaceBurningAddition(
      Number(LEGACY_SPACE_TIME_ADDITIONS[legacyLevel] || 0),
    );
  }

  function getSpaceBurningMultiplier(floor, roomId) {
    return Number((1 + getSpaceBurningAddition(floor, roomId)).toFixed(1));
  }

  function getSpaceBurningVisualLevel(floor, roomId) {
    const multiplier = getSpaceBurningMultiplier(floor, roomId);
    if (multiplier <= 1.0) return 0;
    if (multiplier <= 1.5) return 1;
    if (multiplier <= 2.0) return 2;
    if (multiplier <= 2.5) return 3;
    if (multiplier <= 3.0) return 4;
    return 5;
  }

  function getUniqueRooms(floorId) {
    const floor = FLOOR_DEFINITIONS[floorId];
    const seen = new Map();
    floor.rooms.forEach((roomDefinition) =>
      seen.set(roomDefinition.id, {
        id: roomDefinition.id,
        label: roomDefinition.label,
      }),
    );
    Object.values(floor.cells).forEach((cell) => {
      if (!seen.has(cell.roomId))
        seen.set(cell.roomId, { id: cell.roomId, label: cell.roomLabel });
    });
    return [...seen.values()].sort((a, b) =>
      a.label.localeCompare(b.label, "ko"),
    );
  }

  function mindmapOperationsMarkup() {
    const mainCards = state.mindMap.publishedCards
      .map(
        (card) =>
          `<article class="mindmap-main-card"><div class="panel-card__body"><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p><button type="button" class="button button--small button--danger" data-delete-mind-main="${card.id}">삭제</button></div></article>`,
      )
      .join("");
    const notes = state.mindMap.notes
      .map(
        (note) =>
          `<article class="mindmap-note-card"><div class="panel-card__body"><strong>${note.type === "sticker" ? "스티커" : "메모지"} · ${escapeHtml(note.authorName)}</strong><p>${escapeHtml(note.text)}</p><button type="button" class="button button--small button--danger" data-delete-mind-note="${note.id}">삭제</button></div></article>`,
      )
      .join("");
    return `<div class="mindmap-admin-grid">
      <div>
        <section class="operations-card"><header><div><p class="eyebrow">PUBLISHED INFORMATION</p><h2>공개 정보 메인 게시</h2></div></header><form class="operations-form" data-mind-main-form><label>제목<input class="form-control" name="title" required maxlength="80" /></label><label>본문<textarea class="form-control" name="body" required rows="6"></textarea></label><button class="button button--primary" type="submit">대문 정보로 게시</button></form></section>
        <section class="operations-card"><header><h2>게시된 메인 정보</h2></header><div class="mindmap-main-list">${mainCards || emptyStateMarkup("게시된 메인 정보가 없습니다.")}</div></section>
      </div>
      <section class="operations-card"><header><div><p class="eyebrow">PARTICIPANT NOTES</p><h2>참여자 메모지 · 스티커</h2></div><span>${state.mindMap.notes.length}건</span></header><div class="mindmap-note-list">${notes || emptyStateMarkup("참여자가 붙인 메모가 없습니다.")}</div></section>
    </div>`;
  }

  function eventAudienceLabel(audience) {
    return (
      {
        all: "전체 공개",
        survivor: "생존자",
        spirit: "동결체",
        admin: "운영진",
      }[audience] || "전체 공개"
    );
  }

  function getVisibleEmergencyEvents() {
    const audience =
      session?.type === "admin"
        ? "admin"
        : getCharacter(session?.characterId)?.role;

    return (state.emergencyEvents || []).filter(
      (item) =>
        item.active && (item.audience === "all" || item.audience === audience),
    );
  }

  function emergencyEventReceiptKey() {
    if (!session) return null;

    const accountKey =
      session.type === "admin" ? "admin" : `player-${session.characterId}`;

    return `${EVENT_READ_STORAGE_PREFIX}:${accountKey}`;
  }

  function emergencyEventReceiptSignature(item) {
    return `${item.id}:${item.updatedAt || item.createdAt || ""}`;
  }

  function loadReadEmergencyEventReceipts() {
    const key = emergencyEventReceiptKey();
    if (!key) return new Set();

    try {
      const stored = JSON.parse(storage.getItem(key) || "[]");
      return new Set(Array.isArray(stored) ? stored : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveReadEmergencyEventReceipts(receipts) {
    const key = emergencyEventReceiptKey();
    if (!key) return;

    /*
     * 과거 이벤트가 계속 쌓이지 않도록 최근 항목만 보관한다.
     * 읽음 정보는 계정별 localStorage에만 저장되므로
     * 다른 캐릭터/관리자의 알림 상태에는 영향을 주지 않는다.
     */
    storage.setItem(key, JSON.stringify(Array.from(receipts).slice(-200)));
  }

  function getUnreadEmergencyEvents() {
    const readReceipts = loadReadEmergencyEventReceipts();

    return getVisibleEmergencyEvents().filter(
      (item) => !readReceipts.has(emergencyEventReceiptSignature(item)),
    );
  }

  function markVisibleEmergencyEventsRead() {
    const visibleEvents = getVisibleEmergencyEvents();
    if (!visibleEvents.length) return;

    const readReceipts = loadReadEmergencyEventReceipts();

    visibleEvents.forEach((item) => {
      readReceipts.add(emergencyEventReceiptSignature(item));
    });

    saveReadEmergencyEventReceipts(readReceipts);
  }

  function notifyNewEmergencyEvents(previousUnreadCount) {
    if (!session) return;

    const nextUnreadCount = getUnreadEmergencyEvents().length;
    if (nextUnreadCount <= previousUnreadCount) return;

    const addedCount = nextUnreadCount - previousUnreadCount;

    showToast(
      addedCount === 1
        ? "새 긴급 이벤트가 등록되었습니다."
        : `새 긴급 이벤트 ${addedCount}건이 등록되었습니다.`,
      3200,
    );
  }

  function renderEventButton() {
    if (!elements.eventButton) return;

    const events = getVisibleEmergencyEvents();
    const unreadCount = getUnreadEmergencyEvents().length;
    const badgeCount = unreadCount > 99 ? "99+" : String(unreadCount);

    elements.eventButton.innerHTML = `
      <span class="event-button__icon" aria-hidden="true">!</span>
      <span class="event-button__label">긴급 이벤트 ${events.length}건</span>
      ${
        unreadCount
          ? `<span class="event-button__notification" aria-hidden="true">${badgeCount}</span>`
          : ""
      }
    `;

    elements.eventButton.classList.toggle("is-empty", events.length === 0);
    elements.eventButton.classList.toggle(
      "has-active-event",
      events.length > 0,
    );
    elements.eventButton.classList.toggle("has-unread-event", unreadCount > 0);

    elements.eventButton.setAttribute(
      "aria-label",
      unreadCount
        ? `긴급 이벤트 ${events.length}건, 새 알림 ${unreadCount}건`
        : `긴급 이벤트 ${events.length}건`,
    );
  }

  function currentPlayerCharacter() {
    if (session?.type !== "player") return null;
    return getCharacter(session.characterId);
  }

  function isCurrentPlayerSurvivor() {
    return currentPlayerCharacter()?.role === "survivor";
  }

  function renderSurvivorTutorialSlide() {
    if (!elements.survivorTutorialBackdrop) return;

    const lastIndex = SURVIVOR_TUTORIAL_IMAGES.length - 1;
    ui.tutorialSlideIndex = Math.max(
      0,
      Math.min(lastIndex, Number(ui.tutorialSlideIndex || 0)),
    );

    const imageSrc = SURVIVOR_TUTORIAL_IMAGES[ui.tutorialSlideIndex];
    const pageNumber = ui.tutorialSlideIndex + 1;

    if (elements.survivorTutorialImage) {
      elements.survivorTutorialImage.classList.remove("is-hidden");
      elements.survivorTutorialImage.alt =
        `생존자 튜토리얼 ${pageNumber}번 사진`;
      elements.survivorTutorialImage.src = imageSrc;
    }

    if (elements.survivorTutorialPlaceholder) {
      elements.survivorTutorialPlaceholder.textContent = imageSrc;
      elements.survivorTutorialPlaceholder.classList.add("is-hidden");
    }

    if (elements.survivorTutorialCounter) {
      elements.survivorTutorialCounter.textContent =
        `${pageNumber} / ${SURVIVOR_TUTORIAL_IMAGES.length}`;
    }

    if (elements.survivorTutorialPrev) {
      elements.survivorTutorialPrev.disabled = ui.tutorialSlideIndex === 0;
    }

    if (elements.survivorTutorialNext) {
      elements.survivorTutorialNext.disabled =
        ui.tutorialSlideIndex === lastIndex;
    }

    if (elements.survivorTutorialClose) {
      elements.survivorTutorialClose.classList.toggle(
        "is-hidden",
        ui.tutorialSlideIndex !== lastIndex,
      );
    }
  }

  function showSurvivorTutorial() {
    if (!isCurrentPlayerSurvivor()) return;

    ui.tutorialSlideIndex = 0;
    renderSurvivorTutorialSlide();
    elements.survivorTutorialBackdrop?.classList.remove("is-hidden");
    elements.survivorTutorialBackdrop?.setAttribute("aria-hidden", "false");
  }

  function moveSurvivorTutorial(direction) {
    if (
      !isCurrentPlayerSurvivor() ||
      elements.survivorTutorialBackdrop?.classList.contains("is-hidden")
    ) {
      return;
    }

    const lastIndex = SURVIVOR_TUTORIAL_IMAGES.length - 1;
    const nextIndex = Math.max(
      0,
      Math.min(lastIndex, ui.tutorialSlideIndex + Number(direction || 0)),
    );

    if (nextIndex === ui.tutorialSlideIndex) return;
    ui.tutorialSlideIndex = nextIndex;
    renderSurvivorTutorialSlide();
  }

  async function completeAndCloseSurvivorTutorial() {
    const character = currentPlayerCharacter();
    const lastIndex = SURVIVOR_TUTORIAL_IMAGES.length - 1;

    if (
      !character ||
      character.role !== "survivor" ||
      ui.tutorialSlideIndex !== lastIndex
    ) {
      return;
    }

    elements.survivorTutorialBackdrop?.classList.add("is-hidden");
    elements.survivorTutorialBackdrop?.setAttribute("aria-hidden", "true");

    if (character.tutorialSeen === true) return;

    character.tutorialSeen = true;

    if (!session?.token || !isRemoteConfigured()) return;

    try {
      const result = await remoteApi("complete-tutorial");
      remoteState.version = Math.max(
        remoteState.version,
        Number(result?.version || 0),
      );
    } catch (error) {
      console.error("튜토리얼 완료 상태 저장 실패", error);
      character.tutorialSeen = false;
      showToast(
        "튜토리얼 확인 상태를 서버에 저장하지 못했습니다. 다음 로그인 때 다시 표시될 수 있습니다.",
        4200,
      );
    }
  }

  function maybeOpenFirstSurvivorTutorial() {
    const character = currentPlayerCharacter();
    if (!character || character.role !== "survivor") return;
    if (character.tutorialSeen === true) return;

    window.requestAnimationFrame(() => {
      showSurvivorTutorial();
    });
  }

  function showEmergencyEvent() {
    const events = getVisibleEmergencyEvents();

    /*
     * 긴급 이벤트는 "창을 연 순간" 확인한 것으로 처리한다.
     * 따라서 확인 버튼 / ESC / 모달 닫기 등 어떤 방식으로 닫아도
     * 상단의 새 이벤트 숫자 배지는 이미 제거된 상태를 유지한다.
     */
    markVisibleEmergencyEventsRead();
    renderEventButton();

    openModal({
      eyebrow: "EMERGENCY EVENT",
      title: events.length
        ? `긴급 이벤트 ${events.length}건`
        : "현재 긴급 이벤트 없음",
      body: events.length
        ? `<div class="event-manager-list">${events.map((item) => `<article class="event-manager-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.message)}</p><div class="event-manager-card__meta"><span>${eventAudienceLabel(item.audience)}</span><span>${formatDateTime(item.createdAt)}</span></div></article>`).join("")}</div>`
        : emptyStateMarkup("현재 노출 중인 긴급 이벤트가 없습니다."),
      footer: `<button type="button" class="button button--primary" data-confirm-emergency-events>확인</button>`,
      hideHeaderClose: true,
    });

    elements.modalFooter
      .querySelector("[data-confirm-emergency-events]")
      ?.addEventListener("click", closeModal);
  }

  function renderComparison() {}

  function playerJournalContent(character, tab) {
    if (tab === "inventory") {
      const items = character.inventory.length
        ? character.inventory
            .map((item) => {
              normalizeStoredInventoryItem(item);
              const meta =
                item.itemType === "resource" ||
                item.itemType === "basic" ||
                item.itemType === "warming"
                  ? inventoryItemBadgeMarkup(item)
                  : "";
              const badgeMarkup = meta
                ? `<span class="inventory-item__badges">${meta}</span>`
                : "";
              const itemClass =
                item.itemType === "resource" ? " inventory-item--resource" : "";
              const canConsumeWarming = item.itemType === "warming";
              return `<div class="inventory-item-row${canConsumeWarming ? " has-use-action" : ""}"><button type="button" class="inventory-item${itemClass}" data-evidence-id="${escapeHtml(item.uid)}"><span class="inventory-item__head"><strong>${escapeHtml(item.title)}</strong>${badgeMarkup}</span><p>${escapeHtml(item.description)}</p></button>${canConsumeWarming ? `<button type="button" class="button button--primary inventory-item__use" data-use-warming-item="${escapeHtml(item.uid)}" data-character-id="${character.id}">사용</button>` : ""}</div>`;
            })
            .join("")
        : emptyStateMarkup("현재 소지품이 없습니다.");
      return `<section class="panel-card"><div class="panel-card__header">소지품 ${character.inventory.length}건</div><div class="panel-card__body inventory-list">${items}</div></section>`;
    }
    if (tab === "records") {
      const records = character.records.length
        ? character.records
            .map(
              (record) =>
                `<div class="record-item"><span class="record-item__head"><strong>${escapeHtml(record.title)}</strong><span>${escapeHtml(record.floor)}</span></span><p>${escapeHtml(record.description)}</p></div>`,
            )
            .join("")
        : emptyStateMarkup("완료한 조사가 없습니다.");
      return `<section class="panel-card"><div class="panel-card__header">조사한 장소</div><div class="panel-card__body record-list">${records}</div></section>`;
    }
    if (tab === "board") return sharedMindMapMarkup(character);
    return `<section class="panel-card"><div class="panel-card__header">사라진 시신</div><div class="panel-card__body"><div class="stat-grid"><div class="stat-card"><span>최초 확인</span><strong>7구</strong></div><div class="stat-card"><span>현재 확인</span><strong>4구</strong></div><div class="stat-card"><span>사라진 시신</span><strong>3구</strong></div><div class="stat-card"><span>확정 경로</span><strong>2단계</strong></div></div></div></section><section class="panel-card"><div class="panel-card__header">동결체 출몰 기록</div><div class="panel-card__body record-list"><div class="record-item"><strong>B1 서비스 통로</strong><p>유력 · 마지막 확인 14:21 · 이동 방향 연구별관</p></div><div class="record-item"><strong>2F 포스터 전시장</strong><p>미확인 · 낮은 온도 흔적만 발견</p></div></div></section>`;
  }

  function sharedMindMapMarkup(character) {
    const main = state.mindMap.publishedCards
      .map(
        (card) =>
          `<article class="mindmap-published-card"><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p></article>`,
      )
      .join("");
    const notes = state.mindMap.notes
      .map(
        (note, index) =>
          `<article class="mindmap-user-note ${note.type === "sticker" ? "is-sticker" : ""}" style="--note-color:${escapeHtml(note.color)};--note-rotate:${(index % 5) - 2}deg"><strong>${note.type === "sticker" ? "◆" : "메모"}</strong><p>${escapeHtml(note.text)}</p><small>${escapeHtml(note.authorName)} · ${note.authorId}</small>${note.authorId === character.id ? `<button type="button" class="compact-icon-button" data-delete-player-note="${note.id}">삭제</button>` : ""}</article>`,
      )
      .join("");
    return `<div class="shared-mindmap"><section><p class="eyebrow">OFFICIAL INFORMATION</p><div class="mindmap-published-grid">${main || emptyStateMarkup("운영진이 게시한 공개 정보가 없습니다.")}</div></section><section class="mindmap-community-board"><p class="eyebrow">PARTICIPANT BOARD</p><div class="mindmap-note-grid">${notes || emptyStateMarkup("아직 붙은 메모지나 스티커가 없습니다.")}</div><form class="mindmap-note-form" data-player-mind-note-form><textarea class="form-control" name="text" required maxlength="240" rows="3" placeholder="공개 정보에 덧붙일 추측이나 메모를 적으세요."></textarea><div class="mindmap-note-form__row"><select class="form-control" name="type"><option value="note">메모지</option><option value="sticker">스티커</option></select><select class="form-control" name="color"><option value="#fff1a8">노랑</option><option value="#ccecff">파랑</option><option value="#ffd4dd">분홍</option><option value="#d8f2ce">초록</option></select><button class="button button--primary" type="submit">붙이기</button></div></form></section></div>`;
  }

  function createMindNote(formData) {
    if (session?.type !== "player") return;
    const character = getCharacter(session.characterId);
    const text = String(formData.get("text") || "").trim();
    if (!text) return;
    state.mindMap.notes.unshift({
      id: `mind-note-${Date.now()}`,
      authorId: character.id,
      authorName: character.name,
      type: String(formData.get("type") || "note"),
      color: String(formData.get("color") || "#fff1a8"),
      text,
      createdAt: new Date().toISOString(),
    });
    state.mindMap.notes = state.mindMap.notes.slice(0, 100);
    persistState();
    renderRightSidebar();
    showToast("공동 마인드맵에 붙였습니다.");
  }

  /* ===== 2026-08-02 규칙 개편 오버라이드 ===== */
  const FREEZE_STAGE_THRESHOLDS = [0, 18, 42, 66, 90, 120];
  const EXPOSURE_PRESETS = [
    { id: "cold", label: "동결체의 냉기에 노출", add: 0.2 },
    { id: "diluted_skin", label: "희석액 피부 접촉", add: 0.3 },
    { id: "concentrate_skin", label: "원액 피부 접촉", add: 0.5 },
    { id: "mucosa_wound", label: "눈·입·코 또는 열린 상처 노출", add: 0.8 },
    { id: "shallow_bite", label: "얕게 물림", add: 1.2 },
    { id: "deep_bite", label: "깊게 물림", add: 1.6 },
    { id: "ingestion", label: "액체 섭취·주입", add: 2.0 },
    { id: "fatal", label: "원액 침수·치명적 특수 공격", min: 4.0 },
    { id: "custom", label: "기타 직접 입력", custom: true },
  ];

  function getRoomIdByLabel(floorId, label) {
    const floor = FLOOR_DEFINITIONS[floorId];
    return (
      getUniqueRooms(floorId).find((room) => room.label === label)?.id ||
      floor.defaultRoom?.id ||
      null
    );
  }
  function freezeStage(hours) {
    if (hours >= 120) return 5;
    if (hours >= 90) return 4;
    if (hours >= 66) return 3;
    if (hours >= 42) return 2;
    if (hours >= 18) return 1;
    return 0;
  }
  function nextFreezeThreshold(stage) {
    return stage >= 5 ? 120 : FREEZE_STAGE_THRESHOLDS[stage + 1];
  }
  function freezeStageLabel(stage) {
    return (
      ["0단계", "1단계", "2단계", "3단계", "4단계", "5단계"][stage] || "0단계"
    );
  }
  function operationsTabContent(tab) {
    if (tab === "health") return healthOperationsMarkup();
    if (tab === "inventory") return inventoryOperationsMarkup();
    if (tab === "freeze") return freezeOperationsMarkup();
    if (tab === "burning") return burningOperationsMarkup();
    if (tab === "movements") return movementOperationsMarkup();
    if (tab === "memos") return memoOperationsMarkup();
    if (tab === "events") return eventsOperationsMarkup();
    if (tab === "settings") return settingsOperationsMarkup();
    return overviewOperationsMarkup();
  }

  function overviewOperationsMarkup() {
    const filter = ui.rosterFilter || "all";
    ui.rosterFilter = filter;
    const list = state.characters.filter(
      (c) => filter === "all" || c.role === filter,
    );
    return `<div class="operations-summary-grid"><article><span>전체</span><strong>${state.characters.length}</strong></article><article><span>생존자</span><strong>${state.characters.filter((c) => c.role === "survivor").length}</strong></article><article><span>동결체</span><strong>${state.characters.filter((c) => c.role === "spirit").length}</strong></article><article><span>등록 소지품</span><strong>${state.resourceLibrary.length}</strong></article></div><div class="roster-filter"><button type="button" data-roster-filter="all" class="${filter === "all" ? "is-active" : ""}">전체</button><button type="button" data-roster-filter="spirit" class="${filter === "spirit" ? "is-active" : ""}">동결체</button><button type="button" data-roster-filter="survivor" class="${filter === "survivor" ? "is-active" : ""}">생존자</button></div>${combinedRosterMarkup(list)}`;
  }

  function burningOperationsMarkup() {
    /*
     * 공간 진행도/배속은 융합학술동만이 아니라
     * 현재 지도에 존재하는 모든 건물의 모든 등록 층을 표시한다.
     *
     * EXPOSURE_FLOOR_OPTIONS는 현재 지도 전체 층 목록과 동일한 기준을
     * 사용하므로 연구별관 / 생활관 / 관리지원동도 자동으로 포함된다.
     */
    const groups = EXPOSURE_FLOOR_OPTIONS.filter(
      (floorOption) => FLOOR_DEFINITIONS[floorOption.key],
    )
      .map((floorOption) => {
        const floor = floorOption.key;
        const floorLabel = floorOption.label;

        const rows = getUniqueRooms(floor)
          .map((room) => {
            const addition = getSpaceBurningAddition(floor, room.id);

            /*
             * research:3F처럼 floor key 자체에 ':'가 포함될 수 있으므로
             * form field name에서는 floor/room id를 URI 인코딩한다.
             */
            const encodedFloor = encodeURIComponent(floor);
            const encodedRoomId = encodeURIComponent(room.id);

            return `<label class="burning-room-row">
              <span>
                <strong>${escapeHtml(room.label)}</strong>
                <small>${escapeHtml(floorLabel)} · 관리자 전용</small>
                <i class="burning-level-badge">
                  추가 배속 +${addition.toFixed(1)}
                </i>
              </span>
              <select
                class="form-control"
                name="burning:${encodedFloor}:${encodedRoomId}"
              >
                ${SPACE_BURNING_OPTIONS.map(
                  (option) =>
                    `<option value="${option.toFixed(1)}" ${
                      Math.abs(option - addition) < 0.001 ? "selected" : ""
                    }>+${option.toFixed(1)}배속</option>`,
                ).join("")}
              </select>
            </label>`;
          })
          .join("");

        return `<section class="operations-card">
          <header>
            <div>
              <p class="eyebrow">${escapeHtml(
                floorOption.building,
              )} PRIVATE PROGRESS</p>
              <h2>${escapeHtml(floorLabel)} 공간 진행도</h2>
            </div>
            <span>운영진만 열람</span>
          </header>
          <div class="burning-room-list">
            ${rows || emptyStateMarkup("등록된 구역이 없습니다.")}
          </div>
        </section>`;
      })
      .join("");

    return `<form data-burning-settings-form>
      <section class="operations-card settings-guide">
        <h3>공간 진행도 시간 적용</h3>
        <p>공간 진행 추가 배속을 +0.0부터 +4.0까지 0.1 단위로 직접 지정합니다. 생존자와 동결체 화면에는 배율이 노출되지 않습니다.</p>
      </section>
      <div class="burning-admin-grid">${groups}</div>
      <div class="settings-save-bar">
        <button type="submit" class="button button--primary">
          공간 진행도 저장
        </button>
      </div>
    </form>`;
  }

  function settingsOperationsMarkup() {
    return `<form data-exposure-settings-form>
      <div class="settings-role-grid">${roleSettingsMarkup("survivor")}${roleSettingsMarkup("spirit")}</div>
      <section class="operations-card settings-guide"><h3>노출 설정 원칙</h3><p>체크박스를 조정한 뒤 저장 버튼을 눌러야 적용됩니다. 공간 진행도와 동결 시간 배율은 운영진에게만 공개됩니다.</p></section>
      <div class="settings-save-bar"><span class="muted-text">변경사항은 저장 전까지 적용되지 않습니다.</span><button type="submit" class="button button--primary">환경설정 저장 및 적용</button></div>
    </form>`;
  }

  function eventsOperationsMarkup() {
    const events = state.emergencyEvents
      .map(
        (item) =>
          `<article class="event-manager-card ${item.active ? "" : "is-paused"}"><header><div><h3>${escapeHtml(item.title)}</h3><div class="event-manager-card__meta"><span>${eventAudienceLabel(item.audience)}</span><span>${formatDateTime(item.createdAt)}</span><strong>${item.active ? "노출 중" : "노출 중지"}</strong></div></div></header><p>${escapeHtml(item.message)}</p><div class="event-manager-card__actions"><button type="button" class="button button--small ${item.active ? "button--soft" : "button--primary"}" data-toggle-event="${item.id}">${item.active ? "노출 중지" : "노출 중"}</button><button type="button" class="button button--small button--danger" data-delete-event="${item.id}">삭제</button></div></article>`,
      )
      .join("");
    return `<div class="event-admin-grid"><section class="operations-card"><header><div><p class="eyebrow">EMERGENCY EVENT</p><h2>긴급 이벤트 추가</h2></div></header><form class="operations-form" data-emergency-event-form><label>이벤트 제목<input class="form-control" name="title" required maxlength="80"></label><label>안내 내용<textarea class="form-control" name="message" required rows="7"></textarea></label><label>노출 대상<select class="form-control" name="audience"><option value="all">전체</option><option value="survivor">생존자</option><option value="spirit">동결체</option><option value="admin">운영진</option></select></label><button type="submit" class="button button--danger">긴급 이벤트 등록</button></form></section><section class="operations-card"><header><div><p class="eyebrow">EVENT CONTROL</p><h2>이벤트 조정</h2></div><span>${state.emergencyEvents.filter((i) => i.active).length}건 노출</span></header><div class="event-manager-list">${events || emptyStateMarkup("등록된 긴급 이벤트가 없습니다.")}</div></section></div>`;
  }
  function renderWarmthBanner(warmth, perspective) {
    if (!elements.warmthBanner) return;
    const show = perspective.mode === "spirit" && warmth.active;
    elements.warmthBanner.classList.toggle("is-hidden", !show);
    if (show)
      elements.warmthBanner.innerHTML = `<span class="warmth-anonymous">온기가 느껴집니다.</span>`;
  }

  function recordSpiritMovement(
    character,
    { fromFloor, fromRoom, toFloor, toRoom, cost = 0, source = "이동" },
  ) {
    if (!character || character.role !== "spirit") return;
    const oldRoomId = getRoomIdByLabel(fromFloor, fromRoom);
    settleFreezeClock(character, fromFloor, oldRoomId);
    state.movementLogs.unshift({
      id: `movement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      characterId: character.id,
      fromFloor,
      fromRoom,
      toFloor,
      toRoom,
      cost,
      source,
      createdAt: new Date().toISOString(),
    });
    state.movementLogs = state.movementLogs.slice(0, 300);
  }

  async function imageFileToStoredData(file) {
    const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
    if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
    const raw = await readFileAsDataUrl(file);
    if (file.size <= 550 * 1024) return raw;
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth,
          h = img.naturalHeight;
        const max = 1400;
        if (Math.max(w, h) > max) {
          const r = max / Math.max(w, h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        let quality = 0.82,
          data = canvas.toDataURL("image/jpeg", quality);
        while (data.length > 700000 && quality > 0.45) {
          quality -= 0.08;
          data = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(data);
      };
      img.onerror = reject;
      img.src = raw;
    });
  }

  function handleOperationsClick(event) {
    if (session?.type !== "admin") return;

    const tab = event.target.closest("[data-operations-tab]");
    if (tab) {
      ui.operationsTab = tab.dataset.operationsTab;
      renderAdminOperationsPage();
      return;
    }
    const filter = event.target.closest("[data-roster-filter]");
    if (filter) {
      ui.rosterFilter = filter.dataset.rosterFilter;
      renderAdminOperationsPage();
      return;
    }
    const inventoryEditButton = event.target.closest(
      "[data-edit-character-inventory]",
    );
    if (inventoryEditButton) {
      renderCharacterInventoryEditor(
        getCharacter(
          Number(inventoryEditButton.dataset.editCharacterInventory),
        ),
        "current",
      );
      return;
    }

    const healingUseButton = event.target.closest("[data-use-healing-item]");
    if (healingUseButton) {
      useHealingItem(
        Number(healingUseButton.dataset.characterId),
        healingUseButton.dataset.useHealingItem,
      );
      return;
    }

    const warmingUseButton = event.target.closest("[data-use-warming-item]");
    if (warmingUseButton) {
      useWarmingItem(
        Number(warmingUseButton.dataset.characterId),
        warmingUseButton.dataset.useWarmingItem,
      );
      return;
    }

    const resetClock = event.target.closest("[data-reset-infection-clock]");
    if (resetClock) {
      const c = getCharacter(Number(resetClock.dataset.resetInfectionClock));
      if (c) {
        resetInfectionClock(c);
        addLog(
          `관리자가 ${c.name}의 감염 진행 시간을 120:00:00으로 초기화했습니다.`,
        );
        persistState();
        renderAdminOperationsPage();
        showToast(`${c.name}의 감염 시간을 초기화했습니다.`);
      }
      return;
    }
    const resetAll = event.target.closest("[data-reset-all-infection-clocks]");
    if (resetAll) {
      state.characters.forEach(resetInfectionClock);
      addLog(
        "관리자가 모든 캐릭터의 감염 진행 시간을 120:00:00으로 초기화했습니다.",
      );
      persistState();
      renderAdminOperationsPage();
      showToast("모든 캐릭터의 감염 시간을 초기화했습니다.");
      return;
    }
    const removeMod = event.target.closest("[data-remove-time-modifier]");
    if (removeMod) {
      const c = getCharacter(Number(removeMod.dataset.removeTimeModifier));
      if (c) {
        settleFreezeClock(c);
        c.freezeClock.modifiers = c.freezeClock.modifiers.filter(
          (m) => m.id !== removeMod.dataset.modifierId,
        );
        persistState();
        renderAdminOperationsPage();
      }
      return;
    }
    const preview = event.target.closest("[data-preview-resource]");
    if (preview)
      return previewResourceTemplate(preview.dataset.previewResource);
    const resourceDelete = event.target.closest("[data-delete-resource]");
    if (resourceDelete) {
      state.resourceLibrary = state.resourceLibrary.filter(
        (i) => i.id !== resourceDelete.dataset.deleteResource,
      );
      persistState();
      renderAdminOperationsPage();
      return;
    }
    const toggle = event.target.closest("[data-toggle-event]");
    if (toggle) {
      const item = state.emergencyEvents.find(
        (i) => i.id === toggle.dataset.toggleEvent,
      );
      if (item) {
        item.active = !item.active;

        if (item.active) {
          item.updatedAt = new Date().toISOString();
        }
      }
      persistState();
      renderAdminOperationsPage();
      renderEventButton();
      return;
    }
    const delEvent = event.target.closest("[data-delete-event]");
    if (delEvent) {
      state.emergencyEvents = state.emergencyEvents.filter(
        (i) => i.id !== delEvent.dataset.deleteEvent,
      );
      persistState();
      renderAdminOperationsPage();
      renderEventButton();
      return;
    }
    const statusEditButton = event.target.closest(
      "[data-edit-character-status]",
    );
    if (statusEditButton) {
      showCharacterStatusEditorModal(
        Number(statusEditButton.dataset.editCharacterStatus),
      );
      return;
    }
    const characterButton = event.target.closest("[data-operations-character]");
    if (characterButton)
      return showCharacterManagementModal(
        Number(characterButton.dataset.operationsCharacter),
      );
    const evidenceButton = event.target.closest("[data-evidence-id]");
    if (evidenceButton) {
      const evidence = collectAllEvidence().find(
        (i) => i.uid === evidenceButton.dataset.evidenceId,
      );
      if (evidence) showEvidenceModal(evidence);
      return;
    }
    const deleteMemo = event.target.closest("[data-delete-memo]");
    if (deleteMemo) {
      state.adminMemos = state.adminMemos.filter(
        (m) => m.id !== deleteMemo.dataset.deleteMemo,
      );
      persistState();
      renderAdminOperationsPage();
    }
  }

  async function handleOperationsSubmit(event) {
    if (session?.type !== "admin") return;
    const healthDamageForm = event.target.closest("[data-health-damage-form]");
    if (healthDamageForm) {
      event.preventDefault();
      const formData = new FormData(healthDamageForm);
      const character = getCharacter(Number(formData.get("characterId")));
      const bodyPart = String(formData.get("bodyPart") || "").trim();
      const requestedDamage = Math.round(Number(formData.get("damage")));
      const injuryNote = String(formData.get("injuryNote") || "").trim();

      if (!character || !bodyPart) {
        showToast("다친 부위를 입력해 주세요.");
        return;
      }
      if (character.role !== "survivor") {
        showToast("체력은 생존자에게만 적용됩니다.");
        return;
      }
      if (!(requestedDamage >= 1 && requestedDamage <= 100)) {
        showToast("차감할 체력은 1~100 사이로 입력해 주세요.");
        return;
      }

      normalizeCharacterHealth(character);
      const actualDamage = Math.min(character.health, requestedDamage);
      if (actualDamage <= 0) {
        showToast(`${character.name}의 체력이 이미 0입니다.`);
        return;
      }

      character.health -= actualDamage;
      if (!Array.isArray(character.manualStatuses))
        character.manualStatuses = [];
      character.manualStatuses.unshift({
        id: `health-injury-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        bodyPart,
        severity: "부상",
        detail: injuryNote || `${bodyPart} 부상`,
        source: "health-damage",
        healthDamage: actualDamage,
        createdAt: new Date().toISOString(),
      });

      addLog(
        `관리자가 ${character.name}의 ${bodyPart} 부상을 기록했습니다. 체력 -${actualDamage} (${character.health} / ${character.maxHealth})`,
      );
      persistState();
      renderAll();
      if (ui.operationsOpen) renderAdminOperationsPage();
      showToast(`${character.name} · ${bodyPart} 부상 · 체력 -${actualDamage}`);
      return;
    }

    const resourceForm = event.target.closest("[data-resource-library-form]");
    if (resourceForm) {
      event.preventDefault();
      await registerResourceTemplate(new FormData(resourceForm));
      return;
    }
    const delivery = event.target.closest("[data-resource-delivery-form]");
    if (delivery) {
      event.preventDefault();
      deliverResource(new FormData(delivery));
      return;
    }
    const timeForm = event.target.closest("[data-time-modifier-form]");
    if (timeForm) {
      event.preventDefault();
      const fd = new FormData(timeForm),
        c = getCharacter(Number(fd.get("characterId"))),
        preset = EXPOSURE_PRESETS.find((p) => p.id === fd.get("preset"));
      if (!c || !preset) return;
      settleFreezeClock(c);
      let mod;
      if (preset.custom) {
        const label = String(fd.get("customLabel") || "").trim(),
          add = Number(fd.get("customValue"));
        if (!label || !(add > 0))
          return showToast("기타 설명과 0보다 큰 배율을 입력해 주세요.");
        mod = { id: `mod-${Date.now()}`, label, add };
      } else
        mod = {
          id: `mod-${Date.now()}`,
          label: preset.label,
          add: preset.add || 0,
          min: preset.min || 0,
        };
      c.freezeClock.modifiers.push(mod);
      persistState();
      renderAdminOperationsPage();
      showToast(`${c.name}에게 시간 배율을 추가했습니다.`);
      return;
    }
    const burn = event.target.closest("[data-burning-settings-form]");
    if (burn) {
      event.preventDefault();
      state.characters.forEach((c) => settleFreezeClock(c));
      const fd = new FormData(burn);
      const nextSpaceBurning = {};
      for (const [name, value] of fd.entries()) {
        if (!name.startsWith("burning:")) continue;

        const parts = name.split(":");
        if (parts.length !== 3) continue;

        const floor = decodeURIComponent(parts[1]);
        const roomId = decodeURIComponent(parts[2]);

        if (!FLOOR_DEFINITIONS[floor]) continue;

        nextSpaceBurning[spaceBurningKey(floor, roomId)] =
          clampSpaceBurningAddition(value);
      }
      state.spaceBurning = nextSpaceBurning;
      state.spaceBurningMode = SPACE_BURNING_MODE;
      addLog("운영진이 공간별 체류 배속을 저장했습니다.");
      persistState();
      renderAdminOperationsPage();
      showToast("공간 체류 배속을 저장했습니다.");
      return;
    }
    const eventForm = event.target.closest("[data-emergency-event-form]");
    if (eventForm) {
      event.preventDefault();
      const fd = new FormData(eventForm),
        title = String(fd.get("title") || "").trim(),
        message = String(fd.get("message") || "").trim();
      if (!title || !message) return;
      const createdAt = new Date().toISOString();

      state.emergencyEvents.unshift({
        id: `event-${Date.now()}`,
        title,
        message,
        audience: String(fd.get("audience") || "all"),
        active: true,
        createdAt,
        updatedAt: createdAt,
      });
      persistState();
      renderAdminOperationsPage();
      renderEventButton();
      showToast("긴급 이벤트를 등록했습니다.");
      return;
    }
    const settings = event.target.closest("[data-exposure-settings-form]");
    if (settings) {
      event.preventDefault();
      state.bunkerAccessByRole = state.bunkerAccessByRole || {
        survivor: false,
        spirit: false,
      };
      ["survivor", "spirit"].forEach((role) => {
        const bunkerAccessToggle = settings.querySelector(
          `[data-bunker-access-role="${role}"]`,
        );
        state.bunkerAccessByRole[role] = Boolean(bunkerAccessToggle?.checked);

        settings
          .querySelectorAll(`[data-exposure-role="${role}"]`)
          .forEach((input) => {
            state.exposure[role][input.dataset.exposureGroup][
              input.dataset.exposureKey
            ] = input.checked;
          });
      });
      state.exposure.survivor.features.board = false;
      state.exposure.spirit.features.board = false;
      state.exposure.survivor.mapInfo.burning = false;
      state.exposure.spirit.mapInfo.burning = false;
      persistState();
      renderAdminOperationsPage();
      showToast("환경설정을 저장하고 적용했습니다.");
      return;
    }
    const memo = event.target.closest("[data-admin-memo-form]");
    if (memo) {
      event.preventDefault();
      const fd = new FormData(memo),
        text = String(fd.get("text") || "").trim();
      if (!text) return;
      state.adminMemos.unshift({
        id: `memo-${Date.now()}`,
        author: String(fd.get("author") || "운영진").trim() || "운영진",
        text,
        createdAt: new Date().toISOString(),
      });
      persistState();
      renderAdminOperationsPage();
      showToast("운영진 공유 메모를 저장했습니다.");
    }
  }

  /* ===== 2026-08-02 실시간 감염 시계 · 토큰 · 필터 오버라이드 ===== */
  const INFECTION_TOTAL_HOURS = 120;
  const INFECTION_CLOCK_SCHEMA = 2;

  function currentSpaceAddition(
    character,
    floorOverride = null,
    roomOverride = null,
  ) {
    if (!character) return 0;
    const floor = floorOverride || character.floor;
    const roomId = roomOverride || getRoomId(floor, character.x, character.y);
    return Math.max(0, getSpaceBurningMultiplier(floor, roomId) - 1);
  }

  function formatClockSeconds(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(3, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function localCalendarDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function latestSpiritApResetKey(now = new Date()) {
    const boundary = new Date(now);
    boundary.setHours(21, 0, 0, 0);

    // 현재 시각이 오늘 21:00 이전이면 가장 최근 리셋 시각은 전날 21:00.
    if (now.getTime() < boundary.getTime()) {
      boundary.setDate(boundary.getDate() - 1);
    }

    return localCalendarDateKey(boundary);
  }

  function nextSpiritApResetAt(now = new Date()) {
    const nextReset = new Date(now);
    nextReset.setHours(21, 0, 0, 0);

    if (now.getTime() >= nextReset.getTime()) {
      nextReset.setDate(nextReset.getDate() + 1);
    }

    return nextReset;
  }

  function spiritApResetCountdownText(now = new Date()) {
    const remainingMs = Math.max(
      0,
      nextSpiritApResetAt(now).getTime() - now.getTime(),
    );
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function resetSpiritActionPointsAt21IfNeeded() {
    if (!state || !Array.isArray(state.characters)) return false;

    const resetKey = latestSpiritApResetKey();
    if (state.lastSpiritApResetKey === resetKey) return false;

    const spirits = state.characters.filter(
      (character) => character.role === "spirit",
    );

    spirits.forEach((character) => {
      character.maxAp = 20;
      character.ap = 20;
    });

    state.lastSpiritApResetKey = resetKey;

    if (spirits.length) {
      addLog(
        `21:00 정기 충전으로 모든 동결체의 행동력이 20 / 20으로 초기화되었습니다.`,
      );
    }

    persistState();
    return spirits.length > 0;
  }

  function renderAdminOperationsPage() {
    if (session?.type !== "admin") return;
    const tabs = {
      overview: "캐릭터 현황",
      health: "체력 관리",
      inventory: "소지품 추가",
      freeze: "감염 시간",
      burning: "공간 진행도",
      movements: "동결 이동 기록",
      memos: "운영 메모",
      events: "긴급 이벤트",
      settings: "환경설정",
    };
    if (!tabs[ui.operationsTab]) ui.operationsTab = "overview";
    const tabButtons = Object.entries(tabs)
      .map(
        ([id, label]) =>
          `<button type="button" class="operations-tab ${ui.operationsTab === id ? "is-active" : ""}" data-operations-tab="${id}">${label}</button>`,
      )
      .join("");
    elements.adminOperationsContent.innerHTML = `<div class="operations-page__header"><div><p class="eyebrow">OPERATIONS CENTER</p><h1>운영진 통합 운영페이지</h1><p>인원·체력·소지품·모든 캐릭터 감염 시간·공간 진행·동결 이동 기록·긴급 이벤트를 관리합니다.</p></div></div><nav class="operations-tabs">${tabButtons}</nav><div class="operations-content">${operationsTabContent(ui.operationsTab)}</div><div class="operations-toast is-hidden" role="status"></div>`;
  }

  function renderPlayerJournal() {
    const character = getCharacter(session.characterId);
    const exposure = getRoleExposure(character.role);

    if (character.role === "spirit") {
      const inventoryVisible = exposure.features.inventory !== false;
      ui.rightPanelTab = inventoryVisible ? "inventory" : null;

      elements.rightSidebar.innerHTML = `
        <div class="sidebar-header">
          <h2>기록</h2>
        </div>
        <div class="sidebar-body">
          ${
            inventoryVisible
              ? `<div class="panel-tabs">
                  <button
                    type="button"
                    class="panel-tab is-active"
                    data-panel-tab="inventory"
                  >
                    소지품
                  </button>
                </div>
                <div class="panel-content">
                  ${playerJournalContent(character, "inventory")}
                </div>`
              : emptyStateMarkup("현재 공개된 소지품 기능이 없습니다.")
          }
        </div>`;
      return;
    }

    const available = [
      ["inventory", "소지품"],
      ["records", "조사"],
    ].filter(([id]) => exposure.features[id]);

    if (!available.some(([id]) => id === ui.rightPanelTab)) {
      ui.rightPanelTab = available[0]?.[0] || null;
    }

    elements.rightSidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>조사 기록</h2>
      </div>
      <div class="sidebar-body">
        ${
          available.length
            ? `<div class="panel-tabs">
                ${available
                  .map(
                    ([id, label]) =>
                      `<button
                        type="button"
                        class="panel-tab ${ui.rightPanelTab === id ? "is-active" : ""}"
                        data-panel-tab="${id}"
                      >
                        ${label}
                      </button>`,
                  )
                  .join("")}
              </div>
              <div class="panel-content">
                ${playerJournalContent(character, ui.rightPanelTab)}
              </div>`
            : emptyStateMarkup("현재 공개된 기록 기능이 없습니다.")
        }
      </div>`;
  }

  function appendMapMarkersWithExposure() {
    // 지도 위 조사/위험 마커 기능은 사용하지 않습니다.
  }

  function moveCharacterSetTo(memberIds, floor, x, y) {
    settleAllSurvivorFreezeClocks();
    const targetRoomId = getRoomId(floor, x, y);
    const roomCells = [];
    for (let row = 0; row < GRID_ROWS; row += 1)
      for (let column = 0; column < GRID_COLUMNS; column += 1)
        if (getRoomId(floor, column, row) === targetRoomId)
          roomCells.push({ x: column, y: row });
    roomCells.sort(
      (a, b) =>
        Math.abs(a.x - x) +
        Math.abs(a.y - y) -
        (Math.abs(b.x - x) + Math.abs(b.y - y)),
    );
    [...new Set(memberIds)]
      .map(getCharacter)
      .filter(Boolean)
      .forEach((member, index) => {
        const previous = {
          floor: member.floor,
          room: getRoomLabel(member.floor, member.x, member.y),
        };
        settleFreezeClock(
          member,
          previous.floor,
          getRoomIdByLabel(previous.floor, previous.room),
        );
        const position = roomCells[index % Math.max(1, roomCells.length)] || {
          x,
          y,
        };
        member.floor = floor;
        member.x = position.x;
        member.y = position.y;
        if (member.role === "spirit")
          recordSpiritMovement(member, {
            fromFloor: previous.floor,
            fromRoom: previous.room,
            toFloor: member.floor,
            toRoom: getRoomLabel(member.floor, member.x, member.y),
            cost: 0,
            source: "운영진 팀 이동",
          });
      });
  }

  /* ===== 2026-08-02 운영 규칙 보정 · 매체 저장소 · 감염 관리 V3 ===== */
  const INFECTION_CLOCK_SCHEMA_V3 = 3;
  const THUMBNAIL_MAX_BYTES_V3 = 5 * 1024 * 1024;
  const ORIGINAL_MAX_BYTES_V3 = 100 * 1024 * 1024;
  const MEDIA_DB_NAME_V3 = "shu-investigation-media-v3";
  const MEDIA_STORE_NAME_V3 = "files";
  const mediaObjectUrlCacheV3 = new Map();
  const NON_RED_TEAM_PALETTE_V3 = [
    "#245f9b",
    "#31766f",
    "#5a55a5",
    "#386987",
    "#7060a6",
    "#237d8a",
  ];

  function certaintyLabel(certainty) {
    return certainty === "confirmed" ? "확인" : "미확인";
  }

  function normalizeCertaintyV3(certainty, delivered = false) {
    if (delivered) return "confirmed";
    return certainty === "confirmed" ? "confirmed" : "unknown";
  }

  function defaultRoleExposure(role) {
    return {
      floors: Object.fromEntries(
        EXPOSURE_FLOOR_OPTIONS.map(({ key }) => [key, false]),
      ),
      features: { inventory: true, records: true, investigation: true },
      mapInfo: {
        roomLabels: true,
        burning: false,
        danger: false,
        teamPositions: true,
        warmth: role === "spirit",
      },
    };
  }

  function ensureFeatureState(candidate) {
    const next = candidate || createInitialState();
    if (!Array.isArray(next.resourceLibrary)) next.resourceLibrary = [];
    if (!next.spaceBurning || typeof next.spaceBurning !== "object")
      next.spaceBurning = {};
    if (!Array.isArray(next.emergencyEvents)) next.emergencyEvents = [];
    if (!Array.isArray(next.movementLogs)) next.movementLogs = [];
    if (!Array.isArray(next.adminMemos)) next.adminMemos = [];

    const legacyBunkerAccess =
      typeof next.bunkerAccessEnabled === "boolean"
        ? next.bunkerAccessEnabled
        : false;
    if (
      !next.bunkerAccessByRole ||
      typeof next.bunkerAccessByRole !== "object"
    ) {
      next.bunkerAccessByRole = {
        survivor: legacyBunkerAccess,
        spirit: legacyBunkerAccess,
      };
    } else {
      if (typeof next.bunkerAccessByRole.survivor !== "boolean")
        next.bunkerAccessByRole.survivor = legacyBunkerAccess;
      if (typeof next.bunkerAccessByRole.spirit !== "boolean")
        next.bunkerAccessByRole.spirit = legacyBunkerAccess;
    }
    delete next.bunkerAccessEnabled;

    if (!next.exposure) next.exposure = {};

    const resetPublishedFloors =
      Number(next.floorReleaseSchema || 0) < FLOOR_RELEASE_SCHEMA;

    ["survivor", "spirit"].forEach((role) => {
      const defaults = defaultRoleExposure(role);
      const current = next.exposure[role] || {};
      next.exposure[role] = {
        floors: { ...defaults.floors, ...(current.floors || {}) },
        features: { ...defaults.features, ...(current.features || {}) },
        mapInfo: { ...defaults.mapInfo, ...(current.mapInfo || {}) },
      };

      if (resetPublishedFloors) {
        EXPOSURE_FLOOR_OPTIONS.forEach(({ key }) => {
          next.exposure[role].floors[key] = false;
        });
      }

      delete next.exposure[role].features.board;
      delete next.exposure[role].features.tracking;
      next.exposure[role].mapInfo.burning = false;
      next.exposure[role].mapInfo.danger = false;
    });

    next.floorReleaseSchema = FLOOR_RELEASE_SCHEMA;

    next.resourceLibrary.forEach((item) => {
      normalizeStoredInventoryItem(item);
      item.certainty = normalizeCertaintyV3(item.certainty);
      if (!item.thumbnailName && item.fileName)
        item.thumbnailName = item.fileName;
    });

    next.characters.forEach((character) => {
      /*
       * 연구별관 지하 B1/B2/B3는 새 지도에서 완전히 제거되었습니다.
       * 예전 프리뷰 저장값에 해당 층 위치가 남아 있으면
       * 연구별관 1F 전시 홀로 안전하게 이동시킵니다.
       */
      if (
        character.floor === "research:B1" ||
        character.floor === "research:B2" ||
        character.floor === "research:B3"
      ) {
        character.floor = "research:1F";
        character.x = 5;
        character.y = 3;
      }

      normalizeCharacterHealth(character);
      if ("online" in character) delete character.online;
      if (!Array.isArray(character.inventory)) character.inventory = [];
      if (!Array.isArray(character.statuses)) character.statuses = [];
      if (!Array.isArray(character.manualStatuses))
        character.manualStatuses = [];
      if (!Array.isArray(character.records)) character.records = [];
      if (!Array.isArray(character.investigations))
        character.investigations = [];
      if (typeof character.tutorialSeen !== "boolean")
        character.tutorialSeen = false;
      character.inventory.forEach((item) => {
        normalizeStoredInventoryItem(item);
        if (item.itemType === "resource") item.certainty = "confirmed";
        if (!item.thumbnailName && item.fileName)
          item.thumbnailName = item.fileName;
      });

      if (character.role === "survivor") {
        character.ap = 0;
        character.maxAp = 0;
        if (!character.freezeClock) {
          character.freezeClock = {
            baseHours: 0,
            lastUpdated: new Date().toISOString(),
            modifiers: [],
          };
        }
        if (!Array.isArray(character.freezeClock.modifiers))
          character.freezeClock.modifiers = [];
        if (!character.freezeClock.lastUpdated)
          character.freezeClock.lastUpdated = new Date().toISOString();
        character.freezeClock.baseHours = Math.max(
          0,
          Math.min(120, Number(character.freezeClock.baseHours || 0)),
        );
      } else {
        if (Number(character.maxAp || 0) !== 20) {
          character.maxAp = 20;
          character.ap = 20;
        } else {
          character.maxAp = 20;
          character.ap = Math.max(0, Math.min(20, Number(character.ap ?? 20)));
        }
        character.freezeClock = {
          baseHours: 120,
          lastUpdated: new Date().toISOString(),
          modifiers: [],
        };
        character.spiritState = character.spiritState || "stable";
        character.spiritSince =
          character.spiritSince || new Date().toISOString();
      }
    });
    next.infectionClockSchema = 3;
    return next;
  }

  const COLD_CONTACT_MULTIPLIER_ADD = 0.2;

  function getColdContactInfo(
    character,
    floorOverride = null,
    roomOverride = null,
  ) {
    if (!character || character.role !== "survivor") {
      return { active: false, count: 0, roomId: null };
    }
    const floor = floorOverride || character.floor;
    const roomId = roomOverride || getRoomId(floor, character.x, character.y);
    if (!roomId) return { active: false, count: 0, roomId: null };

    if (
      session?.type === "player" &&
      Number(state?._viewerSignals?.characterId) === Number(character.id) &&
      floor === character.floor &&
      roomId === getRoomId(character.floor, character.x, character.y)
    ) {
      const count = Number(state._viewerSignals.coldContactCount || 0);
      return { active: count > 0, count, roomId };
    }

    const spirits = state.characters.filter(
      (candidate) =>
        candidate.role === "spirit" &&
        candidate.floor === floor &&
        getRoomId(candidate.floor, candidate.x, candidate.y) === roomId,
    );
    return {
      active: spirits.length > 0,
      count: spirits.length,
      roomId,
    };
  }

  function coldContactAddition(
    character,
    floorOverride = null,
    roomOverride = null,
  ) {
    return getColdContactInfo(character, floorOverride, roomOverride).active
      ? COLD_CONTACT_MULTIPLIER_ADD
      : 0;
  }

  function clockMultiplier(
    character,
    floorOverride = null,
    roomOverride = null,
  ) {
    if (!character || character.role === "spirit") return 1;

    const clock = character.freezeClock || { modifiers: [] };

    const environmentalMultiplier =
      1 +
      currentSpaceAddition(character, floorOverride, roomOverride) +
      coldContactAddition(character, floorOverride, roomOverride);

    let minimum = 1;
    let additiveMultiplier = 0;

    for (const modifier of clock.modifiers || []) {
      additiveMultiplier += Math.max(0, Number(modifier.add || 0));
      minimum = Math.max(minimum, Number(modifier.min || 1));
    }

    /*
     * 최소 배속(예: 치명적 노출 최소 4배)이 적용되더라도
     * 그 뒤에 들어오는 노출/직접 입력 배속은 계속 더해진다.
     * 예: 최소 4.0배 + 직접 입력 0.8배 = 4.8배
     */
    return Math.max(environmentalMultiplier, minimum) + additiveMultiplier;
  }

  function settleFreezeClock(
    character,
    floorOverride = null,
    roomOverride = null,
  ) {
    if (!character || character.role === "spirit") return;
    if (!character.freezeClock)
      character.freezeClock = {
        baseHours: 0,
        lastUpdated: new Date().toISOString(),
        modifiers: [],
      };
    const now = Date.now();
    const last = new Date(character.freezeClock.lastUpdated || now).getTime();
    const realHours = Math.max(0, (now - last) / 36e5);
    character.freezeClock.baseHours = Math.min(
      INFECTION_TOTAL_HOURS,
      Number(character.freezeClock.baseHours || 0) +
        realHours * clockMultiplier(character, floorOverride, roomOverride),
    );
    character.freezeClock.lastUpdated = new Date(now).toISOString();
  }

  function settleAllSurvivorFreezeClocks() {
    state.characters
      .filter((character) => character.role === "survivor")
      .forEach((character) => settleFreezeClock(character));
  }

  function effectiveFreezeHours(character) {
    if (!character) return 0;
    if (character.role === "spirit") return INFECTION_TOTAL_HOURS;
    const clock = character.freezeClock || {
      baseHours: 0,
      lastUpdated: new Date().toISOString(),
      modifiers: [],
    };
    const live =
      Math.max(0, (Date.now() - new Date(clock.lastUpdated).getTime()) / 36e5) *
      clockMultiplier(character);
    return Math.min(INFECTION_TOTAL_HOURS, Number(clock.baseHours || 0) + live);
  }

  function infectionRemainingSeconds(character) {
    if (!character || character.role === "spirit") return 0;
    return Math.max(
      0,
      Math.ceil(
        (INFECTION_TOTAL_HOURS - effectiveFreezeHours(character)) * 3600,
      ),
    );
  }

  function infectionClockText(character) {
    return character?.role === "spirit"
      ? "동결 완료"
      : formatClockSeconds(infectionRemainingSeconds(character));
  }

  function resetInfectionClock(character) {
    if (!character || character.role === "spirit") return;
    character.freezeClock = {
      baseHours: 0,
      lastUpdated: new Date().toISOString(),
      modifiers: [],
    };
  }

  function setCharacterInfectionStage(character, requestedStage) {
    if (!character) return null;

    const stage = Math.max(
      0,
      Math.min(5, Math.trunc(Number(requestedStage) || 0)),
    );
    const baseHours = FREEZE_STAGE_THRESHOLDS[stage];
    const changedAt = new Date().toISOString();
    const modifiers = Array.isArray(character.freezeClock?.modifiers)
      ? character.freezeClock.modifiers
      : [];

    character.freezeClock = {
      baseHours,
      lastUpdated: changedAt,
      modifiers,
    };

    if (stage >= 5) {
      character.role = "spirit";
      if (Number(character.maxAp || 0) !== 20) {
        character.maxAp = 20;
        character.ap = 20;
      } else {
        character.maxAp = 20;
      }
      character.ap = Math.min(
        character.maxAp,
        Math.max(1, Number(character.ap || 20)),
      );
      character.spiritState = character.spiritState || "stable";
      character.spiritSince = changedAt;
    } else {
      character.role = "survivor";
      character.ap = 0;
      character.maxAp = 0;
      character.spiritState = null;
      character.spiritSince = null;
    }

    return stage;
  }

  function openCompletedInfectionEditModal(characterId) {
    const character = getCharacter(characterId);
    if (!character || session?.type !== "admin") return;

    const currentStage = freezeStage(effectiveFreezeHours(character));
    const stageOptions = FREEZE_STAGE_THRESHOLDS.map(
      (_, stage) =>
        `<button type="button" class="infection-stage-dropdown__option${stage === currentStage ? " is-selected" : ""}" data-infection-stage-option="${stage}" role="option" aria-selected="${stage === currentStage ? "true" : "false"}"><span>${stage}단계</span><span class="infection-stage-dropdown__check" aria-hidden="true">✓</span></button>`,
    ).join("");

    openModal({
      eyebrow: "INFECTION STAGE CONTROL",
      title: `${character.name} · 감염 단계 수정`,
      body: `<form class="infection-stage-edit-form" data-infection-stage-edit-form><input type="hidden" name="characterId" value="${character.id}"><input type="hidden" name="stage" value="${currentStage}" data-infection-stage-value><div class="infection-stage-edit-summary">${avatarMarkup(character, true)}<span><strong>${escapeHtml(character.name)}</strong><small>${roleChipMarkup(character.role)} ${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</small></span></div><div class="infection-stage-selector"><span class="infection-stage-selector__label">적용할 감염 단계</span><div class="infection-stage-dropdown" data-infection-stage-dropdown><button type="button" class="infection-stage-dropdown__trigger" data-infection-stage-trigger aria-haspopup="listbox" aria-expanded="false"><span data-infection-stage-current>${currentStage}단계</span><span class="infection-stage-dropdown__chevron" aria-hidden="true"></span></button><div class="infection-stage-dropdown__menu" data-infection-stage-menu role="listbox" hidden>${stageOptions}</div></div></div><div class="infection-stage-edit-actions"><button class="button button--primary" type="submit">단계 적용</button></div></form>`,
      footer: `<button type="button" class="button" data-modal-close>취소</button>`,
    });
  }

  function infectionClockMarkup(character, compact = false) {
    if (!character) return "";
    if (character.role === "spirit") {
      return `<span class="${compact ? "character-card__clock" : "infection-summary-card__meta"} infection-complete"><strong>5단계 · 동결 완료</strong></span>`;
    }
    const stage = freezeStage(effectiveFreezeHours(character));
    const multiplierMarkup =
      session?.type === "admin"
        ? `<em data-infection-multiplier="${character.id}">×${clockMultiplier(character).toFixed(1)}</em>`
        : "";
    return `<span class="${compact ? "character-card__clock" : "infection-summary-card__meta"}"><strong data-infection-clock="${character.id}">${infectionClockText(character)}</strong>${multiplierMarkup}<span data-infection-stage="${character.id}">${freezeStageLabel(stage)}</span></span>`;
  }

  function convertExpiredSurvivorsToSpirits() {
    settleAllSurvivorFreezeClocks();
    const convertedCharacters = [];
    const convertedAt = new Date().toISOString();
    state.characters.forEach((character) => {
      if (
        character.role !== "survivor" ||
        infectionRemainingSeconds(character) > 0
      )
        return;
      settleFreezeClock(character);
      character.role = "spirit";
      character.freezeClock = {
        baseHours: INFECTION_TOTAL_HOURS,
        lastUpdated: convertedAt,
        modifiers: [],
      };
      if (Number(character.maxAp || 0) !== 20) {
        character.maxAp = 20;
        character.ap = 20;
      } else {
        character.maxAp = 20;
      }
      character.ap = Math.min(
        character.maxAp,
        Math.max(1, Number(character.ap || 20)),
      );
      character.spiritState = "stable";
      character.spiritSince = convertedAt;
      convertedCharacters.push(character);
      addLog(
        `${character.name}의 감염 잔여 시간이 종료되어 자동으로 동결체로 전환되었습니다.`,
      );
    });
    if (!convertedCharacters.length) return false;
    persistState();
    renderAll();
    if (
      session?.type === "player" &&
      convertedCharacters.some(
        (character) => character.id === session.characterId,
      )
    ) {
      showToast("감염 시간이 모두 소진되어 동결체로 전환되었습니다.");
    } else if (session?.type === "admin") {
      showToast(
        `${convertedCharacters.map((character) => character.name).join(", ")}이(가) 동결체로 자동 전환되었습니다.`,
      );
    }
    return true;
  }

  function refreshLiveInfectionClocks() {
    if (!session) return;

    // 매초 21:00 리셋 여부를 먼저 확인한다.
    if (resetSpiritActionPointsAt21IfNeeded()) {
      renderAll();
      showToast(
        "21시 정기 충전 · 동결체 행동력이 20 / 20으로 초기화되었습니다.",
      );
      return;
    }

    if (convertExpiredSurvivorsToSpirits()) return;

    // 관리자 캐릭터 현황의 동결체 행동력 리셋 카운트다운을
    // 새로고침 없이 1초마다 갱신한다.
    const resetCountdown = spiritApResetCountdownText();
    document
      .querySelectorAll("[data-spirit-ap-reset-countdown]")
      .forEach((node) => {
        node.textContent = resetCountdown;
      });

    document.querySelectorAll("[data-infection-clock]").forEach((node) => {
      const character = getCharacter(Number(node.dataset.infectionClock));
      if (character?.role === "survivor")
        node.textContent = infectionClockText(character);
    });

    if (session.type === "admin") {
      document
        .querySelectorAll("[data-infection-multiplier]")
        .forEach((node) => {
          const character = getCharacter(
            Number(node.dataset.infectionMultiplier),
          );
          if (character?.role === "survivor")
            node.textContent = `×${clockMultiplier(character).toFixed(1)}`;
        });
    }

    document.querySelectorAll("[data-infection-stage]").forEach((node) => {
      const character = getCharacter(Number(node.dataset.infectionStage));
      if (character)
        node.textContent =
          character.role === "spirit"
            ? "5단계"
            : freezeStageLabel(freezeStage(effectiveFreezeHours(character)));
    });

    document.querySelectorAll("[data-infection-progress]").forEach((node) => {
      const character = getCharacter(Number(node.dataset.infectionProgress));
      if (character?.role === "survivor") {
        node.style.width = `${Math.min(
          100,
          (effectiveFreezeHours(character) / INFECTION_TOTAL_HOURS) * 100,
        )}%`;
      }
    });
  }

  function isRedLikeColorV3(color) {
    const match = /^#([0-9a-f]{6})$/i.exec(String(color || ""));
    if (!match) return false;
    const value = match[1];
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return red > 105 && red > green * 1.18 && red > blue * 1.05;
  }

  function survivorTokenColorV3(character, team) {
    if (!team) return "#173957";
    if (!isRedLikeColorV3(team.color)) return team.color || "#173957";
    const index =
      Math.abs(
        String(team.id || character.id)
          .split("")
          .reduce((sum, char) => sum + char.charCodeAt(0), 0),
      ) % NON_RED_TEAM_PALETTE_V3.length;
    return NON_RED_TEAM_PALETTE_V3[index];
  }

  function tokenMarkup(character, selected) {
    /*
     * 플레이어 화면에서는 숨김 처리된 그룹의 존재 자체가
     * 토큰 색상으로도 추측되지 않게 한다.
     *
     * - 관리자: 기존처럼 숨김 그룹까지 관리용으로 확인 가능
     * - 플레이어: 공개 중인 그룹만 토큰 색상에 사용
     * - 공개 그룹이 없으면 해당 캐릭터의 기본 개별 토큰색 사용
     */
    const team =
      session?.type === "admin"
        ? getTeamForCharacter(character.id)
        : getVisibleTeamsForCharacter(character.id)[0] || null;

    const tokenColor =
      character.role === "spirit"
        ? "#a3263b"
        : survivorTokenColorV3(character, team);
    const tokenDark = character.role === "spirit" ? "#58121f" : "#0b2238";
    const teamTitle = team ? ` · ${escapeHtml(team.name)}` : "";
    const coldContact = getColdContactInfo(character);
    const canShowColdMarker =
      session?.type === "admin" ||
      (session?.type === "player" && session.characterId === character.id);
    const coldMarkup =
      character.role === "survivor" && coldContact.active && canShowColdMarker
        ? `<i class="character-token__cold-mark" title="한기" aria-label="한기">氷</i>`
        : "";
    return `<span class="character-token character-token--${character.role} ${team && character.role === "survivor" ? "is-team-colored" : ""} ${selected ? "is-selected" : ""} ${coldContact.active ? "has-cold-contact" : ""}" data-token-character="${character.id}" style="--token-color:${tokenColor};--token-dark:${tokenDark}" title="${escapeHtml(character.name)} · ${ROLE_LABELS[character.role]}${teamTitle}"><span class="character-token__name">${escapeHtml(character.name)}</span>${coldMarkup}</span>`;
  }

  function bunkerRoleSettingMarkup(role) {
    // 생존자는 지하벙커 이동 기능을 사용하지 않으므로 진입 설정을 노출하지 않습니다.
    if (role === "survivor") return "";

    state.bunkerAccessByRole = state.bunkerAccessByRole || {
      survivor: false,
      spirit: false,
    };
    const enabled = state.bunkerAccessByRole[role] === true;

    return `
      <div class="bunker-role-setting bunker-role-setting--${role}" data-bunker-role-setting>
        <div class="bunker-role-setting__copy">
          <strong>지하벙커 진입</strong>
          <small>지정된 진입 공간에서 내려가기 버튼을 노출합니다.</small>
        </div>
        <label class="settings-toggle bunker-role-setting__toggle">
          <input
            type="checkbox"
            data-bunker-access-role="${role}"
            ${enabled ? "checked" : ""}
          />
          <span></span>
          <strong>지하벙커</strong>
          <b class="bunker-role-setting__state" data-bunker-access-state data-enabled="${enabled ? "true" : "false"}">${enabled ? "ON" : "OFF"}</b>
        </label>
      </div>`;
  }

  function roleSettingsMarkup(role) {
    const exposure = getRoleExposure(role);

    const buildingOrder = [
      "융합학술동",
      "생활관",
      "연구별관",
      "관리지원동",
      "지하벙커",
    ];
    const floorGroups = buildingOrder
      .map((building) => {
        const toggles = EXPOSURE_FLOOR_OPTIONS.filter(
          (item) => item.building === building,
        )
          .map((item) =>
            settingToggleMarkup(
              role,
              "floors",
              item.key,
              item.label.replace(`${building} `, ""),
              exposure.floors[item.key] !== false,
            ),
          )
          .join("");

        return `
        <div class="settings-floor-group">
          <h4>${building}</h4>
          <div class="settings-toggle-grid settings-toggle-grid--floors">
            ${toggles}
          </div>
          ${building === "관리지원동" ? bunkerRoleSettingMarkup(role) : ""}
        </div>`;
      })
      .join("");

    const featureKeys = [
      ["inventory", "소지품"],
      ["records", "조사 기록"],
    ];
    const infoKeys = [
      ["roomLabels", "공간명"],
      ["teamPositions", "그룹 위치 공유"],
      ["warmth", "온기 감지"],
    ];

    return `
      <section class="operations-card role-settings-card role-settings-card--${role}">
        <header>
          <div>
            <p class="eyebrow">${role.toUpperCase()} EXPOSURE</p>
            <h2>${ROLE_LABELS[role]} 화면 설정</h2>
          </div>
          ${roleChipMarkup(role)}
        </header>

        <div class="settings-section">
          <h3>노출 층</h3>
          <div class="settings-floor-groups">${floorGroups}</div>
        </div>

        <div class="settings-section">
          <h3>노출 기능</h3>
          <div class="settings-toggle-grid">
            ${featureKeys.map(([key, label]) => settingToggleMarkup(role, "features", key, label, exposure.features[key])).join("")}
          </div>
        </div>

        <div class="settings-section">
          <h3>지도 정보</h3>
          <div class="settings-toggle-grid">
            ${infoKeys.map(([key, label]) => settingToggleMarkup(role, "mapInfo", key, label, exposure.mapInfo[key])).join("")}
          </div>
        </div>
      </section>`;
  }

  const INFECTION_STAGE_EFFECTS = [
    [],
    ["복통", "구토", "손발 저림"],
    ["체온 저하", "관절 경직", "조직 경화 및 결정화"],
    ["감각 둔화", "운동장애", "환청", "기억 혼선"],
    ["장기 기능 저하", "의식 단절", "생체활동 급감", "가사동결"],
    ["전신 경화 및 생체활동 정지"],
  ];

  function getInfectionStageEffects(character) {
    const stage = freezeStage(effectiveFreezeHours(character));
    return INFECTION_STAGE_EFFECTS[stage] || INFECTION_STAGE_EFFECTS[0];
  }

  function renderCharacterStatusEffects(character) {
    normalizeCharacterHealth(character);
    const statusLabels = [
      ...(character.role === "survivor"
        ? getInfectionStageEffects(character)
        : []),
      ...(character.manualStatuses || []).map((status) =>
        `${status.bodyPart} ${status.severity}`.trim(),
      ),
    ].filter(Boolean);

    if (!statusLabels.length) {
      return emptyStateMarkup("현재 적용된 상태이상이 없습니다.");
    }

    return `<div class="status-list__item"><strong>${statusLabels
      .map((label) => escapeHtml(label))
      .join(", ")}</strong></div>`;
  }

  function showCharacterStatusEditorModal(characterId, editStatusId = null) {
    const character = getCharacter(characterId);
    if (!character || session?.type !== "admin") return;
    normalizeCharacterHealth(character);
    ui.selectedCharacterId = character.id;
    if (!Array.isArray(character.manualStatuses)) character.manualStatuses = [];

    const editingStatus = editStatusId
      ? character.manualStatuses.find((status) => status.id === editStatusId) ||
        null
      : null;
    const currentStatuses = character.manualStatuses.length
      ? character.manualStatuses
          .map(
            (status) =>
              `<div class="status-list__item"><div><strong>${escapeHtml(status.bodyPart)} ${escapeHtml(status.severity)}</strong><p>${escapeHtml(status.detail || "상세 내용 없음")}</p></div><span class="control-row"><button type="button" class="button button--small" data-edit-manual-status="${escapeHtml(status.id)}">수정</button><button type="button" class="button button--small button--danger" data-remove-manual-status="${escapeHtml(status.id)}">삭제</button></span></div>`,
          )
          .join("")
      : emptyStateMarkup("관리자가 추가한 상태이상이 없습니다.");

    const infectionStatusSection =
      character.role === "survivor"
        ? `<div class="modal-control-card modal-control-card--wide"><div class="modal-control-card__title"><strong>감염 진행 자동 상태이상</strong><span>자동 적용</span></div><div class="status-list"><div class="status-list__item"><strong>${getInfectionStageEffects(
            character,
          )
            .map((effect) => escapeHtml(effect))
            .join(", ")}</strong></div></div></div>`
        : "";

    openModal({
      eyebrow: "STATUS EFFECT EDITOR",
      title: `${character.name} · 상태이상 수정`,
      body: `<div class="admin-modal-grid">${infectionStatusSection}<div class="modal-control-card modal-control-card--wide"><div class="modal-control-card__title"><strong>현재 관리자 추가 상태이상</strong><span>${character.manualStatuses.length}건</span></div><div class="status-list">${currentStatuses}</div></div><div class="modal-control-card modal-control-card--wide"><div class="modal-control-card__title"><strong>${editingStatus ? "상태이상 수정" : "상태이상 추가"}</strong><span>부위와 정도를 기록</span></div><form class="operations-form" data-character-status-form><input type="hidden" name="characterId" value="${character.id}"><input type="hidden" name="statusId" value="${escapeHtml(editingStatus?.id || "")}"><label>다친 부위<input class="form-control" name="bodyPart" required maxlength="50" value="${escapeHtml(editingStatus?.bodyPart || "")}" placeholder="예: 왼쪽 팔, 머리, 오른쪽 발목"></label><label>정도<input class="form-control" name="severity" required maxlength="50" value="${escapeHtml(editingStatus?.severity || "")}" placeholder="예: 경상, 중상, 골절, 출혈 심함"></label><label>상세 내용<textarea class="form-control" name="detail" rows="4" maxlength="240" placeholder="필요한 추가 상태나 주의사항을 입력하세요.">${escapeHtml(editingStatus?.detail || "")}</textarea></label><button type="submit" class="button button--primary">${editingStatus ? "수정 적용" : "상태이상 적용"}</button></form></div></div>`,
      footer: `<button type="button" class="button" data-modal-close>닫기</button>`,
    });
  }

  function renderPlayerProfile() {
    const character = getCharacter(session.characterId);
    const teams = getVisibleTeamsForCharacter(character.id);
    const visibleTeams = teams;
    const visibleMemberIds = new Set(
      visibleTeams.flatMap((team) => team.memberIds),
    );
    visibleMemberIds.delete(character.id);
    const visibleMembers = [...visibleMemberIds]
      .map(getCharacter)
      .filter((member) => member && member.role === character.role);
    const statuses = renderCharacterStatusEffects(character);
    const movementCard =
      character.role === "spirit"
        ? `<div class="stat-card"><span>행동력</span><strong>${character.ap} / ${character.maxAp}</strong></div>`
        : "";
    const apMeter =
      character.role === "spirit"
        ? `<div class="ap-meter" style="--ap-percent:${Math.max(0, Math.min(100, (character.ap / Math.max(1, character.maxAp)) * 100))}%"><span></span></div>`
        : "";
    const teamMarkup = teams.length
      ? teams
          .map((team) => {
            const members = team.memberIds
              .map(getCharacter)
              .filter((member) => member && member.role === character.role);
            const visible = team.visible !== false;
            return `<article class="team-summary-card ${visible ? "" : "is-visibility-off"}" style="--team-color:${team.color}"><div class="team-summary-card__head"><strong>${escapeHtml(team.name)}</strong><span>${visible ? "위치 공유 중" : "위치 공유 꺼짐"}</span></div><div class="team-member-list">${members.length ? members.map((member) => `<div class="team-member-row">${avatarMarkup(member, true)}<span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(characterLocationText(member))}</small></span></div>`).join("") : `<span class="muted-text">같은 분류의 공개 팀원이 없습니다.</span>`}</div></article>`;
          })
          .join("")
      : emptyStateMarkup("현재 편성된 팀이 없습니다.");
    const sharedMemberMarkup = visibleMembers.length
      ? visibleMembers
          .map(
            (member) =>
              `<span class="shared-member-chip">${escapeHtml(member.name)}</span>`,
          )
          .join("")
      : `<span class="shared-member-chip is-muted">공개 중인 같은 분류 팀원 없음</span>`;
    const spiritGuide =
      character.role === "spirit"
        ? `<div class="side-note"><strong>동결체 이동</strong><p>다른 공간으로 이동할 때 행동력 1이 차감됩니다. 같은 공간의 생존자는 신원 대신 온기와 인원수로만 감지합니다.</p></div>`
        : "";
    elements.leftSidebar.innerHTML = `<div class="sidebar-header"><h2>내 캐릭터</h2>${roleChipMarkup(character.role)}</div><div class="player-profile"><div class="player-profile__identity">${avatarMarkup(character)}<div class="player-profile__identity-copy"><h2>${escapeHtml(character.name)}</h2>${character.role === "survivor" ? `<div class="player-profile__health">${healthGaugeMarkup(character, true)}</div>` : ""}</div></div><div class="stat-grid"><div class="stat-card"><span>현재 위치</span><strong>${escapeHtml(characterLocationText(character))}</strong></div>${movementCard}</div>${apMeter}<section><p class="eyebrow">MY GROUPS</p><div class="team-summary-list">${teamMarkup}</div><div class="shared-member-list">${sharedMemberMarkup}</div></section><section><p class="eyebrow">STATUS EFFECTS</p><div class="status-list" data-character-status-effects="${character.id}">${statuses}</div></section>${spiritGuide}</div>`;
  }

  function syncOpenAdminCharacterLiveFields() {
    if (session?.type !== "admin") return;

    const selected = getCharacter(ui.selectedCharacterId);
    if (!selected) return;

    document
      .querySelectorAll(`[data-admin-live-ap="${selected.id}"]`)
      .forEach((node) => {
        node.textContent = `${selected.ap} / ${selected.maxAp}`;
      });
  }

  function showCharacterManagementModal(characterId = ui.selectedCharacterId) {
    const selected = getCharacter(characterId);
    if (!selected) return;
    ui.selectedCharacterId = selected.id;

    const isSurvivor = selected.role === "survivor";
    const isSpirit = selected.role === "spirit";

    const healthControls = isSurvivor
      ? `<div class="modal-control-card admin-character-control-card admin-character-control-card--health">
          <div class="modal-control-card__title">
            <strong>체력</strong>
            <span>${characterHealthText(selected)}</span>
          </div>
          ${healthGaugeMarkup(selected)}
          <p>부상으로 인한 체력 차감은 운영진 통합 운영페이지의 ‘체력 관리’에서 기록합니다. 체력 회복은 체력 회복 아이템 사용으로만 적용됩니다.</p>
        </div>`
      : "";

    const apControls = isSpirit
      ? `<div class="modal-control-card admin-character-control-card admin-character-control-card--ap">
          <div class="modal-control-card__title">
            <strong>행동력</strong>
            <span data-admin-live-ap="${selected.id}">${selected.ap} / ${selected.maxAp}</span>
          </div>
          <p>다른 공간으로 이동할 때마다 행동력 1이 차감됩니다.</p>
          <div class="ap-custom-adjust">
            <input
              class="form-control ap-custom-adjust__input"
              type="number"
              min="1"
              max="20"
              step="1"
              inputmode="numeric"
              placeholder="수량 입력"
              data-ap-adjust-input
            >
            <div class="ap-custom-adjust__actions">
              <button
                type="button"
                class="button button--small button--danger"
                data-admin-action="ap-custom-minus"
              >
                차감
              </button>
              <button
                type="button"
                class="button button--small button--primary"
                data-admin-action="ap-custom-plus"
              >
                추가
              </button>
            </div>
          </div>
        </div>`
      : "";

    /*
     * 생존자는 감염 진행 시간을 별도 카드로 아래에 두지 않고
     * 상단 캐릭터 요약 카드 오른쪽에 배치한다.
     * 사용 기능/데이터는 기존과 동일하다.
     */
    const survivorInfectionSummary = isSurvivor
      ? `<div class="admin-character-overview__infection">
          <div class="admin-character-overview__infection-top">
            <strong>감염 진행 시간</strong>
            <span data-infection-stage="${selected.id}">
              ${freezeStageLabel(freezeStage(effectiveFreezeHours(selected)))}
            </span>
          </div>
          <div
            class="infection-summary-card__time"
            data-infection-clock="${selected.id}"
          >
            ${infectionClockText(selected)}
          </div>
          <div class="infection-summary-card__meta">
            <span>관리자 확인 배속</span>
            <strong data-infection-multiplier="${selected.id}">
              ×${clockMultiplier(selected).toFixed(1)}
            </strong>
          </div>
        </div>`
      : "";

    const moveControls = `<div class="modal-control-card admin-character-control-card admin-character-control-card--move">
      <div class="modal-control-card__title">
        <strong>개별 위치 이동</strong>
        <span>선택 캐릭터만</span>
      </div>
      <p>버튼을 누른 뒤 지도에서 이동시킬 위치를 선택합니다.</p>
      <div class="control-row">
        <button
          type="button"
          class="button ${ui.adminTool === "forceMove" ? "button--primary" : ""}"
          data-admin-action="toggle-force-move"
        >
          선택 캐릭터 이동
        </button>
      </div>
    </div>`;

    const controlsMarkup = isSurvivor
      ? `${healthControls}${moveControls}`
      : `${apControls}${moveControls}`;

    openModal({
      eyebrow: "CHARACTER CONTROL",
      title: `${selected.name}`,
      body: `<div class="admin-character-overview ${isSurvivor ? "admin-character-overview--survivor" : "admin-character-overview--spirit"}">
        <div class="admin-character-overview__identity">
          ${avatarMarkup(selected)}
          <div class="admin-character-overview__identity-copy">
            <div class="admin-character-overview__title">
              ${roleChipMarkup(selected.role)}
              <span class="character-card__teams">
                ${teamChipsMarkup(selected.id)}
              </span>
            </div>
            <strong>
              ${escapeHtml(selected.floor)} ·
              ${escapeHtml(getRoomLabel(selected.floor, selected.x, selected.y))}
            </strong>
            <span>좌표 X${selected.x + 1}, Y${selected.y + 1}</span>
          </div>
        </div>
        ${survivorInfectionSummary}
      </div>
      <div class="admin-modal-grid admin-modal-grid--${selected.role}">
        ${controlsMarkup}
      </div>`,
      footer: `<button type="button" class="button" data-modal-close>닫기</button>`,
      hideHeaderClose: true,
    });
  }

  function combinedRosterMarkup(characters) {
    const rows = characters
      .map((character) => {
        const items = character.inventory.length
          ? character.inventory
              .map(
                (item) =>
                  `<button type="button" class="compact-item-link" data-evidence-id="${escapeHtml(item.uid)}">${escapeHtml(item.title)}</button>`,
              )
              .join("")
          : `<span class="muted-text">없음</span>`;
        const infectionCell =
          character.role === "survivor"
            ? `<div class="spirit-state-cell"><strong data-infection-clock="${character.id}">${infectionClockText(character)}</strong><small><span data-infection-stage="${character.id}">${freezeStageLabel(freezeStage(effectiveFreezeHours(character)))}</span> · <span data-infection-multiplier="${character.id}">×${clockMultiplier(character).toFixed(1)}</span></small></div>`
            : `<div class="spirit-state-cell infection-complete"><strong>5단계 · 동결 완료</strong><small>행동력 리셋까지 <span data-spirit-ap-reset-countdown>${spiritApResetCountdownText()}</span></small></div>`;
        const statusLabels = [
          ...(character.role === "survivor"
            ? getInfectionStageEffects(character)
            : []),
          ...(character.manualStatuses || []).map((status) =>
            `${status.bodyPart} ${status.severity}`.trim(),
          ),
        ].filter(Boolean);
        const statusSummary = statusLabels.length
          ? `<span>${statusLabels.map((label) => escapeHtml(label)).join(", ")}</span>`
          : `<span class="muted-text">없음</span>`;
        return `<tr><td><button type="button" class="operations-character-link" data-operations-character="${character.id}">${escapeHtml(character.name)}</button></td><td>${roleChipMarkup(character.role)}</td><td>${character.role === "survivor" ? `<strong>${characterHealthText(character)}</strong>` : `<span class="muted-text">—</span>`}</td><td>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</td><td><div class="compact-item-list">${items}</div></td><td>${infectionCell}</td><td><div class="compact-item-list">${statusSummary}<button type="button" class="button button--small" data-edit-character-status="${character.id}">수정</button></div></td></tr>`;
      })
      .join("");
    return `<section class="operations-card operations-card--roster"><header><div><p class="eyebrow">CHARACTER STATUS</p><h2>캐릭터 현황</h2></div><span>${characters.length}명</span></header><div class="operations-table-wrap"><table class="operations-table"><thead><tr><th>이름</th><th>분류</th><th>체력</th><th>현재 위치</th><th>소지품</th><th>감염 현황</th><th>상태이상</th></tr></thead><tbody>${rows || `<tr><td colspan="7">해당 인원이 없습니다.</td></tr>`}</tbody></table></div></section>`;
  }

  function healthOperationsMarkup() {
    const healthCharacters = state.characters.filter(
      (character) => character.role === "survivor",
    );
    const cards = healthCharacters
      .map((character) => {
        normalizeCharacterHealth(character);
        const injuries = (character.manualStatuses || []).length
          ? character.manualStatuses
              .map(
                (status) =>
                  `<span class="health-status-chip">${escapeHtml(`${status.bodyPart} ${status.severity}`.trim())}</span>`,
              )
              .join("")
          : `<span class="muted-text">관리자가 기록한 상태이상 없음</span>`;

        return `<article class="health-control-card">
          <header class="health-control-card__header">
            <div class="health-control-card__identity">
              ${avatarMarkup(character, true)}
              <span>
                <strong>${escapeHtml(character.name)}</strong>
                <small>${roleChipMarkup(character.role)} ${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</small>
              </span>
            </div>
            ${healthGaugeMarkup(character, true)}
          </header>
          <div class="health-control-card__statuses">
            <span class="health-control-card__label">현재 상태이상</span>
            <div class="health-status-list">${injuries}</div>
          </div>
          <form class="health-damage-form" data-health-damage-form>
            <input type="hidden" name="characterId" value="${character.id}">
            <div class="health-damage-form__grid">
              <label>다친 부위
                <input class="form-control" name="bodyPart" required maxlength="50" placeholder="예: 왼쪽 팔, 머리, 오른쪽 발목">
              </label>
              <label>차감할 체력
                <input class="form-control" type="number" name="damage" required min="1" max="100" step="1" placeholder="예: 15">
              </label>
            </div>
            <label>부상 메모 <span class="field-optional">선택</span>
              <input class="form-control" name="injuryNote" maxlength="160" placeholder="예: 넘어지며 유리 파편에 베임">
            </label>
            <button class="button button--danger" type="submit">부상 적용 · 체력 차감</button>
          </form>
        </article>`;
      })
      .join("");

    return `<section class="operations-card">
      <header>
        <div>
          <p class="eyebrow">HEALTH CONTROL</p>
          <h2>캐릭터 체력 관리</h2>
        </div>
        <span>${healthCharacters.length}명</span>
      </header>
    </section>
    <div class="health-control-grid">${cards || emptyStateMarkup("체력을 관리할 생존자가 없습니다.")}</div>`;
  }

  function freezeOperationsMarkup() {
    const survivors = state.characters.filter(
      (character) => character.role === "survivor",
    );
    const spirits = state.characters.filter(
      (character) => character.role === "spirit",
    );
    const presetOptions = EXPOSURE_PRESETS.filter((preset) => !preset.custom)
      .map(
        (preset) =>
          `<option value="${preset.id}">${escapeHtml(preset.label)}${preset.add ? ` (+${preset.add})` : preset.min ? ` (최소 ${preset.min}배)` : ""}</option>`,
      )
      .join("");
    const cards = survivors
      .map((character) => {
        const hours = effectiveFreezeHours(character);
        const stage = freezeStage(hours);
        const next = nextFreezeThreshold(stage);
        const percentage = Math.min(100, (hours / INFECTION_TOTAL_HOURS) * 100);
        const modifiers = (character.freezeClock?.modifiers || [])
          .map(
            (modifier) =>
              `<span class="freeze-modifier"><span>${escapeHtml(modifier.label)}${modifier.reason ? ` · ${escapeHtml(modifier.reason)}` : ""} · ${modifier.min ? `최소 ${Number(modifier.min).toFixed(1)}배` : `+${Number(modifier.add).toFixed(1)}`}</span><button type="button" data-remove-time-modifier="${character.id}" data-modifier-id="${modifier.id}" aria-label="제거">×</button></span>`,
          )
          .join("");
        return `<article class="freeze-card"><div class="freeze-card__head"><div><h3>${escapeHtml(character.name)}</h3><small>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</small></div><div class="freeze-card__actions">${roleChipMarkup(character.role)}<button type="button" class="button button--small button--danger" data-reset-infection-clock="${character.id}">시간 초기화</button></div></div><div class="freeze-card__metrics"><div><span>감염 잔여 시간</span><strong data-infection-clock="${character.id}">${infectionClockText(character)}</strong></div><div><span>현재 단계</span><strong data-infection-stage="${character.id}">${freezeStageLabel(stage)}</strong></div><div><span>현재 시간 배율</span><strong data-infection-multiplier="${character.id}">×${clockMultiplier(character).toFixed(1)}</strong></div></div><div class="freeze-progress"><i data-infection-progress="${character.id}" style="width:${percentage}%"></i></div><p class="space-multiplier-note">진행 경과: ${hours.toFixed(3)}시간 / 120시간<br>${stage >= 5 ? "최종 단계 도달" : `다음 단계 전환까지 감염 진행량 ${Math.max(0, next - hours).toFixed(2)}시간`}<br>현재 공간 체류 배속 ×${getSpaceBurningMultiplier(character.floor, getRoomId(character.floor, character.x, character.y)).toFixed(1)}</p><div class="freeze-modifiers">${modifiers || `<span class="muted-text">추가 노출 배율 없음</span>`}</div><div class="infection-control-stack">
          <form class="freeze-form freeze-form--preset" data-v3-time-modifier-form>
            <input type="hidden" name="characterId" value="${character.id}">
            <label>
              노출 선택
              <select class="form-control" name="preset">${presetOptions}</select>
            </label>
            <button class="button button--primary" type="submit">적용</button>
          </form>

          <form class="freeze-form freeze-form--custom-multiplier" data-v3-custom-multiplier-form>
            <input type="hidden" name="characterId" value="${character.id}">
            <label class="custom-label">
              배속 적용 사유
              <input
                class="form-control"
                name="reason"
                required
                maxlength="80"
                placeholder="예: 특수 상황 추가 배속"
              >
            </label>
            <label>
              배속 입력
              <input
                class="form-control"
                type="number"
                name="multiplier"
                min="0.1"
                step="0.1"
                inputmode="decimal"
                required
                placeholder="예: 0.5"
              >
            </label>
            <button class="button button--primary" type="submit">적용</button>
          </form>

          <form class="time-adjustment-form" data-v3-time-adjustment-form>
            <input type="hidden" name="characterId" value="${character.id}">
            <label>
              잔여 시간 조정
              <select class="form-control" name="direction">
                <option value="add">시간 추가</option>
                <option value="subtract">시간 차감</option>
              </select>
            </label>
            <div class="time-adjustment-fields">
              <label>시<input class="form-control" type="number" min="0" max="120" name="hours" value="0"></label>
              <label>분<input class="form-control" type="number" min="0" max="59" name="minutes" value="0"></label>
              <label>초<input class="form-control" type="number" min="0" max="59" name="seconds" value="0"></label>
            </div>
            <label class="custom-label">
              조정 사유
              <input class="form-control" name="reason" required maxlength="80" placeholder="시간 조정 사유를 입력">
            </label>
            <button class="button button--dark" type="submit">시간 적용</button>
          </form>
        </div></article>`;
      })
      .join("");
    const spiritRows = spirits
      .map(
        (character) =>
          `<div class="infection-complete-row">${avatarMarkup(character, true)}<span><strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</small></span><div class="infection-complete-actions"><em>5단계 · 동결 완료</em><button type="button" class="button button--small" data-edit-completed-infection="${character.id}">수정</button></div></div>`,
      )
      .join("");
    return `<section class="operations-card"><header><div><p class="eyebrow">INFECTION TIMELINE</p><h2>생존자 감염 진행 관리</h2></div><button type="button" class="button button--danger button--small" data-reset-all-infection-clocks>생존자 전체 120:00:00 초기화</button></header><table class="freeze-stage-table"><thead><tr><th>단계</th><th>감염 경과 기준</th></tr></thead><tbody><tr><td>1단계</td><td>18시간</td></tr><tr><td>2단계</td><td>42시간</td></tr><tr><td>3단계</td><td>66시간</td></tr><tr><td>4단계</td><td>90시간</td></tr><tr><td>5단계</td><td>120시간</td></tr></tbody></table></section><div class="freeze-grid">${cards || emptyStateMarkup("감염 시간을 관리할 생존자가 없습니다.")}</div><section class="operations-card"><header><div><p class="eyebrow">COMPLETED INFECTION</p><h2>동결 완료 인원</h2></div><span>${spirits.length}명</span></header><div class="infection-complete-list">${spiritRows || emptyStateMarkup("동결체가 없습니다.")}</div></section>`;
  }

  function copyInventoryTemplateToCharacter(template, character) {
    normalizeStoredInventoryItem(template);
    return {
      uid: `inventory-${Date.now()}-${character.id}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: template.id || null,
      itemType: template.itemType,
      healAmount: template.healAmount || 0,
      title: template.title,
      description: template.description,
      certainty: template.certainty || "confirmed",
      grantMode: "acquired",
      floor: character.floor,
      room: getRoomLabel(character.floor, character.x, character.y),
      discoveredBy: "운영진",
      thumbnailKey: template.thumbnailKey || null,
      thumbnailName: template.thumbnailName || template.fileName || null,
      thumbnailSize: template.thumbnailSize || 0,
      originalKey: template.originalKey || null,
      originalName: template.originalName || template.fileName || null,
      originalSize: template.originalSize || 0,
      originalType: template.originalType || null,
      imageData: template.imageData || null,
      fileName: template.fileName || template.originalName || null,
      grantedAt: new Date().toISOString(),
    };
  }

  function renderCharacterInventoryEditor(character, activeTab = "current") {
    if (!character) return;
    if (!Array.isArray(character.inventory)) character.inventory = [];
    character.inventory.forEach(normalizeStoredInventoryItem);

    const currentItems = character.inventory.length
      ? character.inventory
          .map(
            (item) => `<article class="inventory-editor-item">
              <div>
                <div class="inventory-editor-item__title"><strong>${escapeHtml(item.title)}</strong>${inventoryItemBadgeMarkup(item)}</div>
                <p>${escapeHtml(item.description || "설명 없음")}</p>
              </div>
              <div class="inventory-editor-item__actions">
                ${
                  item.itemType === "warming"
                    ? `<button type="button" class="button button--small button--primary" data-use-warming-item="${escapeHtml(item.uid)}" data-character-id="${character.id}">사용</button>`
                    : ""
                }
                <button type="button" class="button button--small button--danger" data-admin-inventory-delete="${escapeHtml(item.uid)}" data-character-id="${character.id}">삭제</button>
              </div>
            </article>`,
          )
          .join("")
      : `<div class="compact-empty">현재 소지품이 없습니다.</div>`;

    const registeredItems = state.resourceLibrary.length
      ? state.resourceLibrary
          .map((item) => {
            normalizeStoredInventoryItem(item);
            const unavailable =
              item.itemType === "healing" && character.role === "spirit";
            return `<article class="inventory-editor-item inventory-editor-item--catalog">
              <div>
                <div class="inventory-editor-item__title"><strong>${escapeHtml(item.title)}</strong>${inventoryItemBadgeMarkup(item)}</div>
                <p>${escapeHtml(item.description || "설명 없음")}</p>
              </div>
              <button type="button" class="button button--small button--primary" data-admin-inventory-add-template="${escapeHtml(item.id)}" data-character-id="${character.id}" ${unavailable ? 'disabled title="동결체에게는 체력 회복 아이템을 추가할 수 없습니다."' : ""}>추가</button>
            </article>`;
          })
          .join("")
      : `<div class="compact-empty">등록된 소지품이 없습니다.</div>`;

    openModal({
      eyebrow: "CHARACTER INVENTORY EDIT",
      title: `${character.name} · 소지품 수정`,
      body: `<div class="inventory-editor" data-inventory-editor="${character.id}">
        <nav class="inventory-editor-tabs" aria-label="소지품 수정 탭">
          <button type="button" class="${activeTab === "current" ? "is-active" : ""}" data-inventory-editor-tab="current">현재 소지품</button>
          <button type="button" class="${activeTab === "add" ? "is-active" : ""}" data-inventory-editor-tab="add">소지품 추가</button>
        </nav>
        <section class="inventory-editor-panel ${activeTab === "current" ? "is-active" : ""}" data-inventory-editor-panel="current" ${activeTab === "current" ? "" : "hidden"}>
          <div class="inventory-editor-list">${currentItems}</div>
        </section>
        <section class="inventory-editor-panel ${activeTab === "add" ? "is-active" : ""}" data-inventory-editor-panel="add" ${activeTab === "add" ? "" : "hidden"}>
          <div class="inventory-editor-subsection">
            <div class="inventory-editor-subsection__head"><strong>등록된 소지품에서 추가</strong><span>${state.resourceLibrary.length}건</span></div>
            <div class="inventory-editor-list">${registeredItems}</div>
          </div>
          <div class="inventory-editor-subsection">
            <div class="inventory-editor-subsection__head"><strong>일반 소지품 직접 추가</strong><span>기본 휴대품 등</span></div>
            <form class="operations-form inventory-basic-form" data-admin-basic-item-form>
              <input type="hidden" name="characterId" value="${character.id}">
              <label>소지품 이름<input class="form-control" name="title" required maxlength="60" placeholder="예: 학생증, 손전등, 개인 수첩"></label>
              <label>설명<textarea class="form-control" name="description" rows="3" maxlength="240" placeholder="플레이어에게 표시할 설명을 입력하세요."></textarea></label>
              <button type="submit" class="button button--primary">일반 소지품 추가</button>
            </form>
          </div>
        </section>
      </div>`,
      footer: `<button type="button" class="button" data-modal-close>닫기</button>`,
    });
  }

  function addRegisteredInventoryToCharacter(characterId, templateId) {
    if (session?.type !== "admin") return;
    const character = getCharacter(Number(characterId));
    const template = state.resourceLibrary.find(
      (item) => String(item.id) === String(templateId),
    );
    if (!character || !template)
      return showToast("소지품 정보를 찾지 못했습니다.");
    normalizeStoredInventoryItem(template);
    if (template.itemType === "healing" && character.role === "spirit") {
      return showToast("동결체에게는 체력 회복 아이템을 추가할 수 없습니다.");
    }
    if (!Array.isArray(character.inventory)) character.inventory = [];
    character.inventory.unshift(
      copyInventoryTemplateToCharacter(template, character),
    );
    addLog(
      `운영진이 ${character.name}에게 소지품 「${template.title}」을(를) 추가했습니다.`,
    );
    persistState();
    renderAll();
    if (ui.operationsOpen) renderAdminOperationsPage();
    renderCharacterInventoryEditor(character, "add");
    showToast(
      `${character.name}에게 「${template.title}」을(를) 추가했습니다.`,
    );
  }

  function deleteCharacterInventoryItem(characterId, itemUid) {
    if (session?.type !== "admin") return;
    const character = getCharacter(Number(characterId));
    if (!character || !Array.isArray(character.inventory)) return;
    const index = character.inventory.findIndex(
      (item) => String(item.uid) === String(itemUid),
    );
    if (index < 0) return showToast("삭제할 소지품을 찾지 못했습니다.");
    const [removed] = character.inventory.splice(index, 1);
    addLog(
      `운영진이 ${character.name}의 소지품 「${removed.title}」을(를) 삭제했습니다.`,
    );
    persistState();
    renderAll();
    if (ui.operationsOpen) renderAdminOperationsPage();
    renderCharacterInventoryEditor(character, "current");
    showToast(`「${removed.title}」을(를) 삭제했습니다.`);
  }

  function addBasicInventoryItem(formData) {
    if (session?.type !== "admin") return;
    const character = getCharacter(Number(formData.get("characterId")));
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    if (!character || !title) return showToast("소지품 이름을 입력해 주세요.");
    if (!Array.isArray(character.inventory)) character.inventory = [];
    character.inventory.unshift({
      uid: `basic-${Date.now()}-${character.id}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: null,
      itemType: "basic",
      healAmount: 0,
      title,
      description: description || "개인 소지품",
      certainty: "confirmed",
      grantMode: "acquired",
      floor: character.floor,
      room: getRoomLabel(character.floor, character.x, character.y),
      discoveredBy: "운영진",
      createdAt: new Date().toISOString(),
    });
    addLog(
      `운영진이 ${character.name}에게 일반 소지품 「${title}」을(를) 추가했습니다.`,
    );
    persistState();
    renderAll();
    if (ui.operationsOpen) renderAdminOperationsPage();
    renderCharacterInventoryEditor(character, "current");
    showToast(`${character.name}에게 「${title}」을(를) 추가했습니다.`);
  }

  function resourceDiscoveryFloorOptionsMarkup() {
    const options = [];

    Object.values(BUILDING_DEFINITIONS).forEach((building) => {
      if (building.hidden) return;
      (building.floors || []).forEach((floorId) => {
        if (!FLOOR_DEFINITIONS[floorId]) return;

        options.push(
          `<option value="${escapeHtml(floorId)}">${escapeHtml(
            `${building.name} ${floorLabelFromKey(floorId)}`,
          )}</option>`,
        );
      });
    });

    return options.join("");
  }

  function resourceDiscoveryRoomLabels(floorId) {
    const floor = FLOOR_DEFINITIONS[floorId];
    if (!floor?.cells) return [];

    const labels = [];
    const seen = new Set();

    Object.values(floor.cells).forEach((cell) => {
      const label = String(cell?.roomLabel || "").trim();
      if (!label || seen.has(label)) return;

      seen.add(label);
      labels.push(label);
    });

    return labels;
  }

  function syncResourceDiscoveryRoomSelect(form) {
    if (!(form instanceof HTMLFormElement)) return;

    const floorSelect = form.querySelector('[name="discoveryFloor"]');
    const roomSelect = form.querySelector('[name="discoveryRoom"]');

    if (
      !(floorSelect instanceof HTMLSelectElement) ||
      !(roomSelect instanceof HTMLSelectElement)
    ) {
      return;
    }

    const floorId = floorSelect.value;
    const roomLabels = resourceDiscoveryRoomLabels(floorId);

    roomSelect.innerHTML = [
      `<option value="">발견 장소 선택</option>`,
      ...roomLabels.map(
        (label) =>
          `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`,
      ),
    ].join("");

    roomSelect.disabled = !floorId;

    if (roomSelect.dataset.commonSelectReady === "true") {
      rebuildCommonSelectMenu(roomSelect);
    }
  }

  function resourceDiscoveryLocationText(item) {
    const floorId = String(item?.floor || "").trim();
    const room = String(item?.room || "").trim();

    if (!floorId && !room) return "미지정";

    const floorText = floorId
      ? `${buildingLabelFromFloor(floorId)} ${floorLabelFromKey(floorId)}`
      : "";

    return [floorText, room].filter(Boolean).join(" · ");
  }

  function inventoryOperationsMarkup() {
    state.resourceLibrary.forEach(normalizeStoredInventoryItem);
    state.characters.forEach((character) =>
      (character.inventory || []).forEach(normalizeStoredInventoryItem),
    );

    const characterChecks = state.characters
      .map(
        (character) =>
          `<label class="operations-check-card"><input type="checkbox" name="characterIds" value="${character.id}" />${avatarMarkup(character, true)}<span><strong>${escapeHtml(character.name)}</strong><small>${ROLE_LABELS[character.role]} · 현재 소지품 ${character.inventory.length}건</small></span></label>`,
      )
      .join("");

    const itemOptions = state.resourceLibrary
      .map((item) => {
        const prefix =
          item.itemType === "healing"
            ? `[회복 +${item.healAmount}]`
            : item.itemType === "warming"
              ? "[방한 아이템]"
              : item.itemType === "basic"
                ? "[소지품]"
                : "[조사 자료]";
        return `<option value="${escapeHtml(item.id)}">${escapeHtml(`${prefix} ${item.title}`)}</option>`;
      })
      .join("");

    const templateCard = (item) => {
      normalizeStoredInventoryItem(item);
      const thumb =
        item.itemType === "resource" && item.thumbnailKey
          ? `<img data-media-key="${escapeHtml(item.thumbnailKey)}" alt="${escapeHtml(item.title)} 썸네일" />`
          : item.itemType === "resource" && item.imageData
            ? `<img src="${item.imageData}" alt="${escapeHtml(item.title)} 썸네일" />`
            : item.itemType === "healing"
              ? `<span class="resource-template-card__symbol">HP</span>`
              : item.itemType === "warming"
                ? `<span class="resource-template-card__symbol">防</span>`
                : "▤";

      const meta =
        item.itemType === "healing"
          ? `<span class="inventory-type-badge inventory-type-badge--healing">체력 +${item.healAmount}</span>`
          : item.itemType === "warming"
            ? ""
            : `${certaintyChipMarkup(item.certainty)}<small class="resource-file-meta">발견 장소 · ${escapeHtml(resourceDiscoveryLocationText(item))}</small><small class="resource-file-meta">${item.originalName ? `${escapeHtml(item.originalName)} · ${formatFileSizeV3(item.originalSize || 0)}` : "원본 파일 없음"}</small>`;
      return `<article class="resource-template-card resource-template-card--${item.itemType}"><span class="resource-template-card__thumb">${thumb}</span><div class="resource-template-card__copy"><div class="resource-template-card__title-row"><strong>${escapeHtml(item.title)}</strong>${inventoryItemBadgeMarkup(item)}</div><p>${escapeHtml(item.description)}</p>${meta}</div><div class="resource-template-card__actions"><button type="button" class="button button--small" data-preview-resource="${escapeHtml(item.id)}">미리보기</button><button type="button" class="button button--small button--danger" data-delete-resource="${escapeHtml(item.id)}">삭제</button></div></article>`;
    };

    const resourceTemplates = state.resourceLibrary
      .filter((item) => item.itemType === "resource")
      .map(templateCard)
      .join("");
    const healingTemplates = state.resourceLibrary
      .filter((item) => item.itemType === "healing")
      .map(templateCard)
      .join("");

    const warmingTemplates = state.resourceLibrary
      .filter((item) => item.itemType === "warming")
      .map(templateCard)
      .join("");

    const inventoryCards = state.characters
      .map((character) => {
        const items = character.inventory.length
          ? character.inventory
              .map((item) => {
                normalizeStoredInventoryItem(item);
                const actions =
                  item.itemType === "healing"
                    ? `<button type="button" class="button button--small" data-evidence-id="${escapeHtml(item.uid)}">보기</button>${character.role === "survivor" ? `<button type="button" class="button button--small button--primary" data-use-healing-item="${escapeHtml(item.uid)}" data-character-id="${character.id}">사용</button>` : ""}`
                    : item.itemType === "warming"
                      ? `<button type="button" class="button button--small" data-evidence-id="${escapeHtml(item.uid)}">보기</button><button type="button" class="button button--small button--primary" data-use-warming-item="${escapeHtml(item.uid)}" data-character-id="${character.id}">사용</button>`
                      : `<button type="button" class="button button--small" data-evidence-id="${escapeHtml(item.uid)}">${item.itemType === "resource" ? "열람" : "보기"}</button>`;
                return `<div class="character-inventory-item"><div class="character-inventory-item__copy"><div class="character-inventory-item__title"><strong>${escapeHtml(item.title)}</strong>${inventoryItemBadgeMarkup(item)}</div><p>${escapeHtml(item.description)}</p></div><div class="character-inventory-item__actions">${actions}</div></div>`;
              })
              .join("")
          : `<div class="compact-empty">등록된 소지품이 없습니다.</div>`;
        const headerHealth =
          character.role === "survivor"
            ? healthGaugeMarkup(character, true)
            : "";
        return `<article class="character-inventory-card"><header><div>${avatarMarkup(character, true)}<span><strong>${escapeHtml(character.name)}</strong><small>${ROLE_LABELS[character.role]}</small></span></div><div class="character-inventory-card__header-actions">${headerHealth}<button type="button" class="button button--small" data-edit-character-inventory="${character.id}">수정</button></div></header><div class="character-inventory-list">${items}</div></article>`;
      })
      .join("");

    return `<div class="operations-library-grid">
      <div>
        <section class="operations-card">
          <header><div><p class="eyebrow">INVENTORY LIBRARY</p><h2>소지품 추가</h2></div><span>${state.resourceLibrary.length}건</span></header>
          <form class="operations-form" data-resource-library-form>
            <label>소지품 종류
              <select class="form-control" name="itemType" data-item-type-select>
                <option value="resource">조사 자료</option>
                <option value="healing">체력 회복 아이템</option>
                <option value="warming">방한 아이템</option>
              </select>
            </label>
            <label>이름<input class="form-control" name="title" required maxlength="60" placeholder="예: 의무실 출입 기록 / 응급 처치 키트" /></label>
            <label>설명<textarea class="form-control" name="description" required rows="4" placeholder="플레이어가 소지품을 열었을 때 볼 설명을 입력하세요."></textarea></label>

            <div data-resource-item-fields>
              <div class="operations-form-grid">
                <label>발견 층
                  <select
                    class="form-control"
                    name="discoveryFloor"
                    data-resource-discovery-floor
                    required
                  >
                    <option value="">층 선택</option>
                    ${resourceDiscoveryFloorOptionsMarkup()}
                  </select>
                </label>
                <label>발견 장소
                  <select
                    class="form-control"
                    name="discoveryRoom"
                    data-resource-discovery-room
                    required
                    disabled
                  >
                    <option value="">발견 장소 선택</option>
                  </select>
                </label>
              </div>

              <div class="operations-form-grid">
                <label>정보 상태
                  <select class="form-control" name="certainty">
                    <option value="unknown">미확인</option>
                    <option value="confirmed">확인</option>
                  </select>
                </label>
                <label>열람용 썸네일 이미지<input class="form-control" type="file" name="thumbnail" accept="image/*" /></label>
              </div>
              <label>다운로드용 원본 파일<input class="form-control" type="file" name="original" /></label>
              <p class="form-help">조사 자료는 플레이어가 열람하거나 원본 파일을 받을 수 있습니다.</p>
            </div>

            <div class="healing-item-fields" data-healing-item-fields hidden>
              <label>체력 회복량
                <input class="form-control" type="number" name="healAmount" min="1" max="100" step="1" placeholder="예: 20" disabled required>
              </label>
              <p class="form-help">회복 아이템은 운영진이 대신 사용할 수 있고, 생존자는 자신의 소지품에서 직접 사용할 수 있습니다. 사용하면 아이템 1개가 소모됩니다.</p>
            </div>
            <button type="submit" class="button button--primary">소지품 등록</button>
          </form>
        </section>

        <section class="operations-card">
          <header><div><p class="eyebrow">INVESTIGATION RESOURCES</p><h2>등록된 조사 자료</h2></div><span>${state.resourceLibrary.filter((item) => item.itemType === "resource").length}건</span></header>
          <div class="resource-library-list">${resourceTemplates || emptyStateMarkup("등록된 조사 자료가 없습니다.")}</div>
        </section>

        <section class="operations-card">
          <header><div><p class="eyebrow">HEALING ITEMS</p><h2>등록된 체력 회복 아이템</h2></div><span>${state.resourceLibrary.filter((item) => item.itemType === "healing").length}건</span></header>
          <div class="resource-library-list">${healingTemplates || emptyStateMarkup("등록된 체력 회복 아이템이 없습니다.")}</div>
        </section>

        <section class="operations-card">
          <header><div><p class="eyebrow">WARMING ITEMS</p><h2>등록된 방한 아이템</h2></div><span>${state.resourceLibrary.filter((item) => item.itemType === "warming").length}건</span></header>
          <div class="resource-library-list">${warmingTemplates || emptyStateMarkup("등록된 방한 아이템이 없습니다.")}</div>
        </section>
      </div>

      <section class="operations-card library-delivery-panel">
        <header><div><p class="eyebrow">INVENTORY DELIVERY</p><h2>소지품 지급</h2></div></header>
        <form class="operations-form" data-resource-delivery-form>
          <label>지급할 소지품
            <select class="form-control" name="resourceId" required>
              <option value="">소지품 선택</option>
              ${itemOptions}
            </select>
          </label>
          <fieldset><legend>지급 대상</legend><div class="operations-check-grid">${characterChecks}</div></fieldset>
          <button type="submit" class="button button--primary" ${state.resourceLibrary.length ? "" : "disabled"}>선택한 인원에게 추가</button>
        </form>
      </section>
    </div>

    <section class="operations-card character-inventory-section">
      <header><div><p class="eyebrow">CHARACTER INVENTORY</p><h2>캐릭터 소지품 현황</h2></div></header>
      <div class="character-inventory-grid">${inventoryCards}</div>
    </section>`;
  }

  function formatFileSizeV3(bytes) {
    const value = Number(bytes || 0);
    if (!value) return "0B";
    if (value < 1024) return `${value}B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
    return `${(value / 1024 / 1024).toFixed(1)}MB`;
  }

  function openMediaDbV3() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(MEDIA_DB_NAME_V3, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MEDIA_STORE_NAME_V3))
          db.createObjectStore(MEDIA_STORE_NAME_V3, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function putMediaBlobV3(key, file, name = file.name) {
    if (session?.token && supabaseClient) {
      const signed = await remoteApi("media-upload-token", {
        path: key,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      });
      const { error } = await supabaseClient.storage
        .from("game-media")
        .uploadToSignedUrl(signed.path, signed.uploadToken, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (error) throw error;
      return;
    }

    const db = await openMediaDbV3();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(MEDIA_STORE_NAME_V3, "readwrite");
      transaction.objectStore(MEDIA_STORE_NAME_V3).put({
        key,
        blob: file,
        name,
        type: file.type || "application/octet-stream",
        size: file.size,
        createdAt: new Date().toISOString(),
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }

  async function getMediaRecordV3(key) {
    if (!key) return null;
    const db = await openMediaDbV3();
    const record = await new Promise((resolve, reject) => {
      const request = db
        .transaction(MEDIA_STORE_NAME_V3, "readonly")
        .objectStore(MEDIA_STORE_NAME_V3)
        .get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return record;
  }

  async function mediaObjectUrlV3(key) {
    const cached = mediaObjectUrlCacheV3.get(key);
    if (cached) {
      if (typeof cached === "string") return cached;
      if (cached.url && cached.expiresAt > Date.now()) return cached.url;
    }

    if (session?.token) {
      const result = await remoteApi("media-url", {
        path: key,
        download: false,
      });
      if (!result?.signedUrl) return null;
      mediaObjectUrlCacheV3.set(key, {
        url: result.signedUrl,
        expiresAt: Date.now() + 8 * 60 * 1000,
      });
      return result.signedUrl;
    }

    const record = await getMediaRecordV3(key);
    if (!record?.blob) return null;
    const url = URL.createObjectURL(record.blob);
    mediaObjectUrlCacheV3.set(key, url);
    return url;
  }

  async function hydrateStoredMediaV3(root = document) {
    const images = [];
    if (root?.matches?.("img[data-media-key]:not([data-media-hydrated])"))
      images.push(root);
    if (root?.querySelectorAll)
      images.push(
        ...root.querySelectorAll(
          "img[data-media-key]:not([data-media-hydrated])",
        ),
      );
    await Promise.all(
      images.map(async (image) => {
        image.dataset.mediaHydrated = "loading";
        try {
          const url = await mediaObjectUrlV3(image.dataset.mediaKey);
          if (url) image.src = url;
          image.dataset.mediaHydrated = "true";
        } catch (error) {
          image.dataset.mediaHydrated = "error";
          image.alt = "이미지를 불러오지 못했습니다.";
        }
      }),
    );
  }

  function readImageDimensionsV3(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        resolve({ image, url });
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("IMAGE_DECODE_FAILED"));
      };
      image.src = url;
    });
  }

  async function createThumbnailBlobV3(file) {
    if (!file.type.startsWith("image/"))
      throw new Error("THUMBNAIL_IMAGE_REQUIRED");
    if (file.size <= THUMBNAIL_MAX_BYTES_V3) return file;
    const { image, url } = await readImageDimensionsV3(file);
    try {
      let width = image.naturalWidth;
      let height = image.naturalHeight;
      const maxDimension = 2400;
      if (Math.max(width, height) > maxDimension) {
        const ratio = maxDimension / Math.max(width, height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      let quality = 0.92;
      let blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      while (blob && blob.size > THUMBNAIL_MAX_BYTES_V3 && quality > 0.62) {
        quality -= 0.06;
        blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
      }
      if (!blob || blob.size > THUMBNAIL_MAX_BYTES_V3)
        throw new Error("THUMBNAIL_TOO_LARGE");
      return new File(
        [blob],
        `${file.name.replace(/\.[^.]+$/, "")}-thumbnail.jpg`,
        { type: "image/jpeg" },
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function registerResourceTemplate(formData) {
    const requestedItemType = String(formData.get("itemType") || "resource");

    const itemType =
      requestedItemType === "healing"
        ? "healing"
        : requestedItemType === "warming"
          ? "warming"
          : "resource";
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    if (!title || !description) return;

    const itemId = `inventory-template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (itemType === "healing") {
      const healAmount = Math.round(Number(formData.get("healAmount")));
      if (!(healAmount >= 1 && healAmount <= 100)) {
        return showToast("체력 회복량은 1~100 사이로 입력해 주세요.");
      }

      state.resourceLibrary.unshift({
        id: itemId,
        itemType: "healing",
        title,
        description,
        healAmount,
        certainty: "confirmed",
        thumbnailKey: null,
        thumbnailName: null,
        thumbnailSize: 0,
        originalKey: null,
        originalName: null,
        originalSize: 0,
        originalType: null,
        createdAt: new Date().toISOString(),
      });
      addLog(
        `운영진이 체력 회복 아이템 「${title}」(+${healAmount})을(를) 소지품 목록에 등록했습니다.`,
      );
      persistState();
      renderAdminOperationsPage();
      showToast(`체력 회복 아이템 「${title}」을(를) 등록했습니다.`);
      return;
    }

    if (itemType === "warming") {
      state.resourceLibrary.unshift({
        id: itemId,
        itemType: "warming",
        title,
        description,
        healAmount: 0,
        certainty: "confirmed",
        thumbnailKey: null,
        thumbnailName: null,
        thumbnailSize: 0,
        originalKey: null,
        originalName: null,
        originalSize: 0,
        originalType: null,
        createdAt: new Date().toISOString(),
      });

      addLog(
        `운영진이 방한 아이템 「${title}」을(를) 소지품 목록에 등록했습니다.`,
      );

      persistState();
      renderAdminOperationsPage();
      showToast(`방한 아이템 「${title}」을(를) 등록했습니다.`);
      return;
    }

    const discoveryFloor = String(formData.get("discoveryFloor") || "").trim();
    const discoveryRoom = String(formData.get("discoveryRoom") || "").trim();

    if (!FLOOR_DEFINITIONS[discoveryFloor]) {
      return showToast("조사 자료를 발견한 층을 선택해 주세요.");
    }

    if (
      !discoveryRoom ||
      !resourceDiscoveryRoomLabels(discoveryFloor).includes(discoveryRoom)
    ) {
      return showToast("조사 자료를 발견한 장소를 선택해 주세요.");
    }

    const certainty = normalizeCertaintyV3(
      String(formData.get("certainty") || "unknown"),
    );
    let thumbnail = formData.get("thumbnail");
    const original = formData.get("original");

    if (thumbnail && thumbnail.size && !thumbnail.type.startsWith("image/"))
      return showToast("썸네일은 이미지 파일만 등록할 수 있습니다.");
    if (thumbnail && thumbnail.size > THUMBNAIL_MAX_BYTES_V3)
      return showToast("썸네일 이미지는 5MB 이하만 등록할 수 있습니다.");
    if (original && original.size > ORIGINAL_MAX_BYTES_V3)
      return showToast(
        "브라우저 시제품에서는 원본 파일을 100MB 이하로 등록해 주세요.",
      );

    if (
      (!thumbnail || !thumbnail.size) &&
      original &&
      original.size &&
      original.type.startsWith("image/")
    ) {
      try {
        thumbnail = await createThumbnailBlobV3(original);
      } catch (error) {
        return showToast(
          "원본 이미지에서 5MB 이하 썸네일을 만들지 못했습니다.",
        );
      }
    }

    let thumbnailKey = null;
    let originalKey = null;
    try {
      if (thumbnail && thumbnail.size) {
        thumbnailKey = `thumbnail-${itemId}`;
        await putMediaBlobV3(thumbnailKey, thumbnail, thumbnail.name);
      }
      if (original && original.size) {
        originalKey = `original-${itemId}`;
        await putMediaBlobV3(originalKey, original, original.name);
      } else if (thumbnailKey) {
        originalKey = thumbnailKey;
      }
    } catch (error) {
      console.error(error);
      return showToast(
        "파일 저장에 실패했습니다. 브라우저 저장 권한과 남은 용량을 확인해 주세요.",
      );
    }

    state.resourceLibrary.unshift({
      id: itemId,
      itemType: "resource",
      title,
      description,
      healAmount: 0,
      certainty,
      floor: discoveryFloor,
      room: discoveryRoom,
      thumbnailKey,
      thumbnailName: thumbnail?.name || null,
      thumbnailSize: thumbnail?.size || 0,
      originalKey,
      originalName: original?.name || thumbnail?.name || null,
      originalSize: original?.size || thumbnail?.size || 0,
      originalType: original?.type || thumbnail?.type || null,
      createdAt: new Date().toISOString(),
    });
    addLog(
      `운영진이 조사 자료 「${title}」을(를) ${resourceDiscoveryLocationText({
        floor: discoveryFloor,
        room: discoveryRoom,
      })} 발견 자료로 등록했습니다.`,
    );
    persistState();
    renderAdminOperationsPage();
    showToast("조사 자료를 등록했습니다.");
  }

  function deliverResource(formData) {
    const template = state.resourceLibrary.find(
      (item) => item.id === String(formData.get("resourceId") || ""),
    );
    const characterIds = [
      ...new Set(
        formData
          .getAll("characterIds")
          .map(Number)
          .filter((id) => getCharacter(id)),
      ),
    ];
    const grantMode = "acquired";

    if (!template) return showToast("지급할 소지품을 선택해 주세요.");
    if (!characterIds.length)
      return showToast("소지품을 받을 인원을 선택해 주세요.");

    normalizeStoredInventoryItem(template);
    const deliveryId = `inventory-grant-${Date.now()}`;
    characterIds.forEach((id) => {
      const character = getCharacter(id);
      character.inventory.unshift({
        uid: `${deliveryId}-${id}-${Math.random().toString(36).slice(2, 6)}`,
        sourceId: template.id,
        itemType: template.itemType,
        healAmount: template.healAmount || 0,
        title: template.title,
        description: template.description,
        certainty: "confirmed",
        grantMode,
        floor:
          template.itemType === "resource" && template.floor
            ? template.floor
            : character.floor,
        room:
          template.itemType === "resource" && template.room
            ? template.room
            : getRoomLabel(character.floor, character.x, character.y),
        discoveredBy: "운영진 지급",
        thumbnailKey: template.thumbnailKey || null,
        thumbnailName: template.thumbnailName || template.fileName || null,
        thumbnailSize: template.thumbnailSize || 0,
        originalKey: template.originalKey || null,
        originalName: template.originalName || template.fileName || null,
        originalSize: template.originalSize || 0,
        originalType: template.originalType || null,
        imageData: template.imageData || null,
        fileName: template.fileName || template.originalName || null,
        grantedAt: new Date().toISOString(),
      });
    });

    addLog(
      `운영진이 ${characterIds.map((id) => getCharacter(id).name).join(", ")}에게 소지품 「${template.title}」을(를) 추가했습니다.`,
    );
    persistState();
    renderAdminOperationsPage();
    showToast(
      `${characterIds.length}명에게 「${template.title}」을(를) 추가했습니다.`,
    );
  }

  function showEvidenceModal(evidence, investigation = null) {
    if (!evidence && investigation) {
      evidence = {
        itemType: "resource",
        title: investigation.evidenceTitle,
        description: investigation.result,
        certainty: "confirmed",
        floor: investigation.floor,
        room: getRoomLabel(
          investigation.floor,
          investigation.x,
          investigation.y,
        ),
        discoveredBy: "조사 기록",
      };
    }
    if (!evidence) return;

    normalizeStoredInventoryItem(evidence);
    const isHealing = evidence.itemType === "healing";
    const isWarming = evidence.itemType === "warming";
    const isBasic = evidence.itemType === "basic";
    const imageMarkup = evidence.thumbnailKey
      ? `<figure class="evidence-image"><img data-media-key="${escapeHtml(evidence.thumbnailKey)}" alt="${escapeHtml(evidence.title)} 첨부 이미지" /></figure>`
      : evidence.imageData
        ? `<figure class="evidence-image"><img src="${evidence.imageData}" alt="${escapeHtml(evidence.title)} 첨부 이미지" /></figure>`
        : `<div class="evidence-detail__image evidence-detail__image--${isHealing && session?.type === "admin" ? "healing" : isWarming ? "warming" : isBasic ? "basic" : "resource"}">${isHealing && session?.type === "admin" ? "HP" : isHealing ? "◇" : isWarming ? "防" : isBasic ? "◇" : "▤"}</div>`;

    const originalKey =
      !isHealing &&
      !isBasic &&
      (evidence.originalKey || evidence.thumbnailKey || null);
    const downloadButton = originalKey
      ? `<button type="button" class="button button--primary" data-download-media-key="${escapeHtml(originalKey)}" data-download-name="${escapeHtml(evidence.originalName || evidence.thumbnailName || evidence.fileName || `${evidence.title}.bin`)}">원본 파일 다운로드</button>`
      : !isHealing && evidence.imageData
        ? `<a class="button button--primary" href="${evidence.imageData}" download="${escapeHtml(evidence.fileName || `${evidence.title}.png`)}">사진 다운로드</a>`
        : "";

    const isPlayerView = session?.type === "player";
    const isPlayerHealingItem = isHealing && isPlayerView;

    const details = isHealing
      ? session?.type === "admin"
        ? `<div><span>종류</span><strong>체력 회복 아이템</strong></div><div><span>회복량</span><strong>체력 +${evidence.healAmount}</strong></div><div><span>등록·지급자</span><strong>${escapeHtml(evidence.discoveredBy || "운영진")}</strong></div>`
        : ""
      : isWarming
        ? `<div><span>종류</span><strong>방한 아이템</strong></div>`
        : isBasic
          ? `<div><span>종류</span><strong>일반 소지품</strong></div>`
          : isPlayerView
            ? `<div><span>종류</span><strong>조사 자료</strong></div><div><span>발견 장소</span><strong>${escapeHtml(resourceDiscoveryLocationText(evidence))}</strong></div>`
            : `<div><span>종류</span><strong>조사 자료</strong></div><div><span>정보 상태</span><strong>${certaintyLabel(evidence.certainty)}</strong></div><div><span>등록·발견자</span><strong>${escapeHtml(evidence.discoveredBy || "미상")}</strong></div><div><span>발견 장소</span><strong>${escapeHtml(resourceDiscoveryLocationText(evidence))}</strong></div><div><span>열람용 썸네일</span><strong>${escapeHtml(evidence.thumbnailName || evidence.fileName || "없음")}</strong></div><div><span>다운로드 원본</span><strong>${escapeHtml(evidence.originalName || evidence.fileName || "없음")}${evidence.originalSize ? ` · ${formatFileSizeV3(evidence.originalSize)}` : ""}</strong></div>`;
    const typeRow = isPlayerHealingItem
      ? ""
      : `<div class="evidence-detail__type-row">${inventoryItemBadgeMarkup(evidence)}</div>`;
    const detailGrid = details
      ? `<div class="detail-grid">${details}</div>`
      : "";

    openModal({
      eyebrow: isPlayerHealingItem
        ? "ITEM"
        : isHealing
          ? "HEALING ITEM"
          : isWarming
            ? "WARMING ITEM"
            : isBasic
              ? "ITEM"
              : "ITEM / EVIDENCE",
      title: evidence.title,
      body: `<div class="evidence-detail">${imageMarkup}${typeRow}<p>${escapeHtml(evidence.description)}</p>${detailGrid}</div>`,
      footer: `${downloadButton}<button type="button" class="button" data-modal-close>닫기</button>`,
      hideHeaderClose: isPlayerView,
    });
    elements.modalFooter
      .querySelector("[data-modal-close]")
      ?.addEventListener("click", closeModal);
    hydrateStoredMediaV3(elements.modalBody);
  }

  function previewResourceTemplate(resourceId) {
    const item = state.resourceLibrary.find(
      (resource) => resource.id === resourceId,
    );
    if (!item) return;
    showEvidenceModal({
      ...item,
      uid: item.id,
      floor: "소지품 보관함",
      room: "등록 목록",
      discoveredBy: "운영진",
    });
  }

  function handleRightSidebarChange(event) {
    if (session.type !== "admin") return;
    if (event.target.matches("[data-spirit-state-select]")) {
      const character = getCharacter(ui.selectedCharacterId);
      if (!character || character.role !== "spirit") return;
      character.spiritState = event.target.value;
      character.spiritSince = new Date().toISOString();
      addLog(
        `관리자가 ${character.name}의 동결 상태를 ${SPIRIT_STATE_LABELS[character.spiritState]}(으)로 변경했습니다.`,
      );
      persistState();
      renderAll();
      if (!elements.modalBackdrop.classList.contains("is-hidden"))
        showCharacterManagementModal(character.id);
      return;
    }
    if (event.target.matches("[data-role-select]")) {
      const character = getCharacter(ui.selectedCharacterId);
      const nextRole = event.target.value;
      character.role = nextRole;
      if (nextRole === "survivor") {
        character.ap = 0;
        character.maxAp = 0;
        character.spiritState = null;
        character.spiritSince = null;
        character.freezeClock = {
          baseHours: 0,
          lastUpdated: new Date().toISOString(),
          modifiers: [],
        };
      } else {
        if (Number(character.maxAp || 0) !== 20) {
          character.maxAp = 20;
          character.ap = 20;
        } else {
          character.maxAp = 20;
        }
        character.ap = Math.min(
          character.maxAp,
          Math.max(1, Number(character.ap || 20)),
        );
        character.spiritState = character.spiritState || "stable";
        character.spiritSince = new Date().toISOString();
        character.freezeClock = {
          baseHours: INFECTION_TOTAL_HOURS,
          lastUpdated: new Date().toISOString(),
          modifiers: [],
        };
      }
      addLog(
        `관리자가 ${character.name}의 분류를 ${ROLE_LABELS[character.role]}(으)로 변경했습니다.`,
      );
      persistState();
      renderAll();
      if (!elements.modalBackdrop.classList.contains("is-hidden"))
        showCharacterManagementModal(character.id);
    }
  }

  async function downloadStoredMediaV3(key, requestedName) {
    try {
      if (session?.token) {
        const result = await remoteApi("media-url", {
          path: key,
          download: true,
        });
        if (!result?.signedUrl)
          return showToast("원본 파일을 찾지 못했습니다.");
        const anchor = document.createElement("a");
        anchor.href = result.signedUrl;
        anchor.download = requestedName || "download";
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        return;
      }

      const record = await getMediaRecordV3(key);
      if (!record?.blob) return showToast("원본 파일을 찾지 못했습니다.");
      const url = URL.createObjectURL(record.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = requestedName || record.name || "download";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      showToast("원본 파일 다운로드에 실패했습니다.");
    }
  }

  async function handleV3OperationsSubmit(event) {
    const basicItemForm = event.target.closest("[data-admin-basic-item-form]");
    if (basicItemForm) {
      event.preventDefault();
      event.stopImmediatePropagation();
      addBasicInventoryItem(new FormData(basicItemForm));
      return;
    }

    const stageEditForm = event.target.closest(
      "[data-infection-stage-edit-form]",
    );
    if (stageEditForm) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const formData = new FormData(stageEditForm);
      const character = getCharacter(Number(formData.get("characterId")));
      const requestedStage = Number(formData.get("stage"));
      if (!character || !Number.isInteger(requestedStage)) return;

      const appliedStage = setCharacterInfectionStage(
        character,
        requestedStage,
      );
      if (appliedStage === null) return;

      const targetRole = appliedStage >= 5 ? "동결체" : "생존자";
      const elapsedHours = FREEZE_STAGE_THRESHOLDS[appliedStage];
      addLog(
        `관리자가 ${character.name}의 감염 단계를 ${freezeStageLabel(appliedStage)}(으)로 수정했습니다. 경과 기준 ${elapsedHours}시간 · ${targetRole}`,
      );

      persistState();
      closeModal();
      renderAll();
      refreshLiveInfectionClocks();
      showToast(
        `${character.name}을(를) ${freezeStageLabel(appliedStage)} · ${targetRole}(으)로 조정했습니다.`,
      );
      return;
    }

    const multiplierForm = event.target.closest("[data-v3-time-modifier-form]");
    if (multiplierForm) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const formData = new FormData(multiplierForm);
      const character = getCharacter(Number(formData.get("characterId")));
      const preset = EXPOSURE_PRESETS.find(
        (item) => item.id === formData.get("preset") && !item.custom,
      );

      if (!character || character.role !== "survivor" || !preset) return;

      settleFreezeClock(character);

      character.freezeClock.modifiers.push({
        id: `mod-${Date.now()}`,
        label: preset.label,
        reason: "",
        add: preset.add || 0,
        min: preset.min || 0,
        createdAt: new Date().toISOString(),
      });

      addLog(
        `관리자가 ${character.name}에게 노출 배율 「${preset.label}」을(를) 적용했습니다.`,
      );

      persistState();
      renderAdminOperationsPage();
      showToast(`${character.name}에게 노출 배율을 적용했습니다.`);
      return;
    }

    const customMultiplierForm = event.target.closest(
      "[data-v3-custom-multiplier-form]",
    );

    if (customMultiplierForm) {
      event.preventDefault();
      event.stopImmediatePropagation();

      const formData = new FormData(customMultiplierForm);
      const character = getCharacter(Number(formData.get("characterId")));
      const reason = String(formData.get("reason") || "").trim();
      const add = Number(formData.get("multiplier"));

      if (!character || character.role !== "survivor") return;

      if (!reason) {
        return showToast("배속 적용 사유를 입력해 주세요.");
      }

      if (!Number.isFinite(add) || add <= 0) {
        return showToast("0보다 큰 배속을 입력해 주세요.");
      }

      settleFreezeClock(character);

      character.freezeClock.modifiers.push({
        id: `mod-custom-${Date.now()}`,
        label: `직접 배속 +${add}`,
        reason,
        add,
        min: 0,
        createdAt: new Date().toISOString(),
      });

      addLog(
        `관리자가 ${character.name}에게 직접 배속 +${add}를 적용했습니다. 사유: ${reason}`,
      );

      persistState();
      renderAdminOperationsPage();
      showToast(`${character.name}에게 +${add}배속을 추가했습니다.`);
      return;
    }

    const adjustmentForm = event.target.closest(
      "[data-v3-time-adjustment-form]",
    );
    if (adjustmentForm) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const formData = new FormData(adjustmentForm);
      const character = getCharacter(Number(formData.get("characterId")));
      if (!character || character.role !== "survivor") return;
      const hours = Math.max(0, Number(formData.get("hours") || 0));
      const minutes = Math.max(
        0,
        Math.min(59, Number(formData.get("minutes") || 0)),
      );
      const seconds = Math.max(
        0,
        Math.min(59, Number(formData.get("seconds") || 0)),
      );
      const totalSeconds = Math.round(hours * 3600 + minutes * 60 + seconds);
      const direction = String(formData.get("direction") || "add");
      const reason = String(formData.get("reason") || "").trim();
      if (!totalSeconds) return showToast("조정할 시간을 입력해 주세요.");
      if (!reason) return showToast("시간 조정 사유를 입력해 주세요.");
      settleFreezeClock(character);
      const deltaHours = totalSeconds / 3600;
      if (direction === "add")
        character.freezeClock.baseHours = Math.max(
          0,
          character.freezeClock.baseHours - deltaHours,
        );
      else
        character.freezeClock.baseHours = Math.min(
          INFECTION_TOTAL_HOURS,
          character.freezeClock.baseHours + deltaHours,
        );
      character.freezeClock.lastUpdated = new Date().toISOString();
      addLog(
        `관리자가 ${character.name}의 감염 잔여 시간을 ${direction === "add" ? "추가" : "차감"}했습니다: ${formatClockSeconds(totalSeconds)} · 사유: ${reason}`,
      );
      persistState();
      renderAdminOperationsPage();
      refreshLiveInfectionClocks();
      showToast(
        `${character.name}의 잔여 시간을 ${direction === "add" ? "추가" : "차감"}했습니다.`,
      );
    }
  }

  function installV3Enhancements() {
    elements.adminOperationsView.addEventListener(
      "submit",
      handleV3OperationsSubmit,
      true,
    );
    elements.modal.addEventListener("submit", handleV3OperationsSubmit, true);
    document.addEventListener(
      "click",
      (event) => {
        const inventoryTab = event.target.closest(
          "[data-inventory-editor-tab]",
        );
        if (inventoryTab) {
          event.preventDefault();
          const editor = inventoryTab.closest("[data-inventory-editor]");
          if (!editor) return;
          const tabName = inventoryTab.dataset.inventoryEditorTab;
          editor
            .querySelectorAll("[data-inventory-editor-tab]")
            .forEach((button) =>
              button.classList.toggle(
                "is-active",
                button.dataset.inventoryEditorTab === tabName,
              ),
            );
          editor
            .querySelectorAll("[data-inventory-editor-panel]")
            .forEach((panel) => {
              const active = panel.dataset.inventoryEditorPanel === tabName;
              panel.hidden = !active;
              panel.classList.toggle("is-active", active);
            });
          return;
        }

        const inventoryDeleteButton = event.target.closest(
          "[data-admin-inventory-delete]",
        );
        if (inventoryDeleteButton && session?.type === "admin") {
          event.preventDefault();
          event.stopImmediatePropagation();
          deleteCharacterInventoryItem(
            Number(inventoryDeleteButton.dataset.characterId),
            inventoryDeleteButton.dataset.adminInventoryDelete,
          );
          return;
        }

        const inventoryAddButton = event.target.closest(
          "[data-admin-inventory-add-template]",
        );
        if (inventoryAddButton && session?.type === "admin") {
          event.preventDefault();
          event.stopImmediatePropagation();
          addRegisteredInventoryToCharacter(
            Number(inventoryAddButton.dataset.characterId),
            inventoryAddButton.dataset.adminInventoryAddTemplate,
          );
          return;
        }

        const stageTrigger = event.target.closest(
          "[data-infection-stage-trigger]",
        );
        if (stageTrigger) {
          event.preventDefault();
          const dropdown = stageTrigger.closest(
            "[data-infection-stage-dropdown]",
          );
          const menu = dropdown?.querySelector("[data-infection-stage-menu]");
          if (!dropdown || !menu) return;

          const shouldOpen = menu.hidden;
          document
            .querySelectorAll("[data-infection-stage-menu]")
            .forEach((otherMenu) => {
              otherMenu.hidden = true;
              otherMenu
                .closest("[data-infection-stage-dropdown]")
                ?.classList.remove("is-open");
              otherMenu
                .closest("[data-infection-stage-dropdown]")
                ?.querySelector("[data-infection-stage-trigger]")
                ?.setAttribute("aria-expanded", "false");
            });

          menu.hidden = !shouldOpen;
          dropdown.classList.toggle("is-open", shouldOpen);
          stageTrigger.setAttribute(
            "aria-expanded",
            shouldOpen ? "true" : "false",
          );
          return;
        }

        const stageOption = event.target.closest(
          "[data-infection-stage-option]",
        );
        if (stageOption) {
          event.preventDefault();
          const dropdown = stageOption.closest(
            "[data-infection-stage-dropdown]",
          );
          const form = stageOption.closest("[data-infection-stage-edit-form]");
          const stageValue = form?.querySelector(
            "[data-infection-stage-value]",
          );
          const currentLabel = dropdown?.querySelector(
            "[data-infection-stage-current]",
          );
          const trigger = dropdown?.querySelector(
            "[data-infection-stage-trigger]",
          );
          const menu = dropdown?.querySelector("[data-infection-stage-menu]");
          const stage = Number(stageOption.dataset.infectionStageOption);
          if (
            !dropdown ||
            !stageValue ||
            !currentLabel ||
            !Number.isInteger(stage)
          )
            return;

          stageValue.value = String(stage);
          currentLabel.textContent = `${stage}단계`;
          dropdown
            .querySelectorAll("[data-infection-stage-option]")
            .forEach((option) => {
              const selected = option === stageOption;
              option.classList.toggle("is-selected", selected);
              option.setAttribute("aria-selected", selected ? "true" : "false");
            });
          if (menu) menu.hidden = true;
          dropdown.classList.remove("is-open");
          trigger?.setAttribute("aria-expanded", "false");
          return;
        }

        if (!event.target.closest("[data-infection-stage-dropdown]")) {
          document
            .querySelectorAll("[data-infection-stage-menu]")
            .forEach((menu) => {
              menu.hidden = true;
              const dropdown = menu.closest("[data-infection-stage-dropdown]");
              dropdown?.classList.remove("is-open");
              dropdown
                ?.querySelector("[data-infection-stage-trigger]")
                ?.setAttribute("aria-expanded", "false");
            });
        }

        const completedEditButton = event.target.closest(
          "[data-edit-completed-infection]",
        );
        if (completedEditButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          openCompletedInfectionEditModal(
            Number(completedEditButton.dataset.editCompletedInfection),
          );
          return;
        }

        const resetAllButton = event.target.closest(
          "[data-reset-all-infection-clocks]",
        );
        if (resetAllButton) {
          event.preventDefault();
          event.stopImmediatePropagation();
          state.characters
            .filter((character) => character.role === "survivor")
            .forEach(resetInfectionClock);
          addLog(
            "관리자가 모든 생존자의 감염 진행 시간을 120:00:00으로 초기화했습니다.",
          );
          persistState();
          renderAdminOperationsPage();
          showToast("모든 생존자의 감염 시간을 초기화했습니다.");
          return;
        }
        const downloadButton = event.target.closest(
          "[data-download-media-key]",
        );
        if (!downloadButton) return;
        event.preventDefault();
        downloadStoredMediaV3(
          downloadButton.dataset.downloadMediaKey,
          downloadButton.dataset.downloadName,
        );
      },
      true,
    );
    const mediaObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) hydrateStoredMediaV3(node);
        });
      }
    });
    mediaObserver.observe(document.body, { childList: true, subtree: true });
    hydrateStoredMediaV3(document);
  }

  document.addEventListener("DOMContentLoaded", installV3Enhancements);

  window.setTimeout(() => {
    try {
      persistState();
    } catch (error) {
      console.warn("초기 감염 시계를 저장하지 못했습니다.", error);
    }
  }, 0);
  window.setInterval(refreshLiveInfectionClocks, 1000);

  /* =====================================================================
     학술원 전체 부지 지도 + 건물별 층 지도
     ===================================================================== */

  let campusMapRenderSignature = "";

  function createBuildingDefinitions() {
    return {
      main: {
        id: "main",
        name: "융합학술동",
        short: "학술동",
        description: "심포지엄 본관 · 로비 · 대강당 · 연구/운영 공간",
        floors: ["B1", "1F", "2F", "3F", "4F"],
        className: "campus-building--main",
      },
      living: {
        id: "living",
        name: "생활관",
        short: "생활관",
        description: "숙박 · 학생식당 · 편의시설",
        floors: [
          "living:B1",
          "living:1F",
          "living:2F",
          "living:3F",
          "living:4F",
        ],
        className: "campus-building--living",
      },
      research: {
        id: "research",
        name: "연구별관",
        short: "연구별관",
        description: "전시 · 실험 · 연구 사무 공간",
        floors: ["research:1F", "research:2F", "research:3F"],
        className: "campus-building--research",
      },
      support: {
        id: "support",
        name: "관리지원동",
        short: "관리지원동",
        description: "행정 · CCTV · 통신 · 시설 제어",
        floors: ["support:1F"],
        className: "campus-building--support",
      },
      bunkerA: {
        id: "bunkerA",
        name: "지하벙커",
        short: "A",
        description: "지하벙커 A",
        floors: ["bunker:A"],
        className: "",
        hidden: true,
      },
      bunkerB: {
        id: "bunkerB",
        name: "지하벙커",
        short: "B",
        description: "지하벙커 B",
        floors: ["bunker:B"],
        className: "",
        hidden: true,
      },
      bunkerC: {
        id: "bunkerC",
        name: "지하벙커",
        short: "C",
        description: "지하벙커 C",
        floors: ["bunker:C"],
        className: "",
        hidden: true,
      },
      bunkerCenter: {
        id: "bunkerCenter",
        name: "지하벙커",
        short: "중앙",
        description: "지하벙커 중앙 구역",
        floors: [BUNKER_CENTER_FLOOR],
        className: "",
        hidden: true,
      },
    };
  }

  function buildFloorDefinition(floorId, spec) {
    const cells = {};

    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLUMNS; x += 1) {
        cells[cellKey(x, y)] = {
          x,
          y,
          roomId: spec.defaultRoom.id,
          roomLabel: spec.defaultRoom.label,
          color: spec.defaultRoom.color,
          labelHere: false,
          edgeRight: false,
          edgeBottom: false,
        };
      }
    }

    spec.rooms.forEach((roomSpec) => {
      for (let y = roomSpec.y1; y <= roomSpec.y2; y += 1) {
        for (let x = roomSpec.x1; x <= roomSpec.x2; x += 1) {
          const key = cellKey(x, y);
          cells[key] = {
            ...cells[key],
            roomId: roomSpec.id,
            roomLabel: roomSpec.label,
            color: roomSpec.color,
          };
        }
      }

      const labelX = Math.floor((roomSpec.x1 + roomSpec.x2) / 2);
      const labelY = Math.floor((roomSpec.y1 + roomSpec.y2) / 2);
      if (cells[cellKey(labelX, labelY)]) {
        cells[cellKey(labelX, labelY)].labelHere = true;
      }
    });

    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLUMNS; x += 1) {
        const cell = cells[cellKey(x, y)];
        const right = x < GRID_COLUMNS - 1 ? cells[cellKey(x + 1, y)] : null;
        const bottom = y < GRID_ROWS - 1 ? cells[cellKey(x, y + 1)] : null;
        cell.edgeRight = Boolean(right && right.roomId !== cell.roomId);
        cell.edgeBottom = Boolean(bottom && bottom.roomId !== cell.roomId);
      }
    }

    return {
      id: floorId,
      cells,
      rooms: spec.rooms,
      transitions: spec.transitions || [],
      doorways: new Set((spec.doorways || []).map((door) => edgeKey(...door))),
      investigations: spec.investigations || [],
      entities: spec.entities || [],
      corpseRoute: spec.corpseRoute || [],
    };
  }

  function additionalFloorSpec(
    id,
    label,
    defaultRoom,
    rooms,
    transitions = [],
  ) {
    const spec = {
      defaultRoom,
      rooms,
      doorways: [],
      transitions,
      investigations: [],
      entities: [],
      corpseRoute: [],
    };

    const floor = buildFloorDefinition(id, spec);

    /*
     * 추가 건물/층의 자동 doorway는 "복도/통로/홀/로비/공용구역"과
     * 맞닿은 경계에만 만든다.
     *
     * 계단·엘리베이터·승강기 자체는 doorway 생성 허브로 취급하지 않는다.
     * 그래서 계단 옆 연구실로 벽을 뚫고 바로 들어가는 경로가 생기지 않는다.
     */
    const isAdditionalHorizontalCirculation = (cell) =>
      isHorizontalCirculationRoomCell(cell);

    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLUMNS; x += 1) {
        const current = floor.cells[cellKey(x, y)];
        if (!current) continue;

        const right =
          x < GRID_COLUMNS - 1 ? floor.cells[cellKey(x + 1, y)] : null;

        if (
          right &&
          right.roomId !== current.roomId &&
          (isAdditionalHorizontalCirculation(current) ||
            isAdditionalHorizontalCirculation(right))
        ) {
          floor.doorways.add(edgeKey(x, y, x + 1, y));
        }

        const bottom =
          y < GRID_ROWS - 1 ? floor.cells[cellKey(x, y + 1)] : null;

        if (
          bottom &&
          bottom.roomId !== current.roomId &&
          (isAdditionalHorizontalCirculation(current) ||
            isAdditionalHorizontalCirculation(bottom))
        ) {
          floor.doorways.add(edgeKey(x, y, x, y + 1));
        }
      }
    }

    return floor;
  }

  function createAdditionalFloorDefinitions() {
    const floors = {};

    /* =======================================================
       연구별관 — 지하층 없음
       ======================================================= */

    floors["research:1F"] = additionalFloorSpec(
      "research:1F",
      "1F",
      { id: "research_1f_hall", label: "전시 홀", color: "#e4e7e9" },
      [
        room("research_1f_result", "연구성과 전시실", 0, 0, 3, 1, "#f4f5f6"),
        room("research_1f_wetlab", "실증실험실", 4, 0, 7, 1, "#f4f5f6"),
        room("research_1f_demo", "장비 시연실", 8, 0, 10, 1, "#f4f5f6"),
        room("research_1f_stairs", "계단", 11, 0, 11, 1, "#eceff1"),

        room("research_1f_hall", "전시 홀", 0, 2, 11, 5, "#e4e7e9"),

        room("research_1f_sample", "표본접수실", 0, 6, 3, 7, "#f4f5f6"),
        room("research_1f_common", "공용 출입구역", 4, 6, 8, 7, "#e4e7e9"),
        room("research_1f_wc_w", "화장실(여)", 9, 6, 9, 7, "#f5f2f2"),
        room("research_1f_wc_m", "화장실(남)", 10, 6, 10, 7, "#f0f3f5"),
        room("research_1f_elevator", "승강기", 11, 6, 11, 7, "#eceff1"),
      ],
      [
        {
          x: 11,
          y: 0,
          type: "stairs",
          destinations: ["research:2F", "research:3F"],
        },
        {
          x: 11,
          y: 6,
          type: "elevator",
          destinations: ["research:2F", "research:3F"],
        },
      ],
    );

    floors["research:2F"] = additionalFloorSpec(
      "research:2F",
      "2F",
      { id: "research_2f_corridor", label: "복도", color: "#e4e7e9" },
      [
        room("research_2f_bio", "생체재료 연구실", 0, 0, 3, 1, "#f4f5f6"),
        room("research_2f_cold", "저온보관실", 4, 0, 7, 1, "#f3f4f5"),
        room("research_2f_clean", "무균실", 8, 0, 10, 1, "#f3f4f5"),
        room("research_2f_stairs", "계단", 11, 0, 11, 1, "#eceff1"),

        room("research_2f_corridor", "복도", 0, 2, 11, 5, "#e4e7e9"),

        room("research_2f_precision", "정밀기기실", 0, 6, 8, 7, "#f4f5f6"),
        room("research_2f_wc_w", "화장실(여)", 9, 6, 9, 7, "#f5f2f2"),
        room("research_2f_wc_m", "화장실(남)", 10, 6, 10, 7, "#f0f3f5"),
        room("research_2f_elevator", "승강기", 11, 6, 11, 7, "#eceff1"),
      ],
      [
        {
          x: 11,
          y: 0,
          type: "stairs",
          destinations: ["research:1F", "research:3F"],
        },
        {
          x: 11,
          y: 6,
          type: "elevator",
          destinations: ["research:1F", "research:3F"],
        },
      ],
    );

    floors["research:3F"] = additionalFloorSpec(
      "research:3F",
      "3F",
      {
        id: "research_3f_staff_corridor",
        label: "직원 전용 복도",
        color: "#e4e7e9",
      },
      [
        room("research_3f_office", "연구원 사무실", 0, 0, 4, 1, "#f4f5f6"),
        room("research_3f_pi", "책임연구자실", 5, 0, 7, 1, "#f4f5f6"),
        room("research_3f_meeting", "회의실", 8, 0, 10, 1, "#f4f5f6"),
        room("research_3f_stairs", "계단", 11, 0, 11, 1, "#eceff1"),

        room(
          "research_3f_staff_corridor",
          "직원 전용 복도",
          0,
          2,
          11,
          5,
          "#e4e7e9",
        ),

        room("research_3f_records", "연구기록 보관실", 0, 6, 8, 7, "#f4f5f6"),
        room("research_3f_wc_w", "화장실(여)", 9, 6, 9, 7, "#f5f2f2"),
        room("research_3f_wc_m", "화장실(남)", 10, 6, 10, 7, "#f0f3f5"),
        room("research_3f_elevator", "승강기", 11, 6, 11, 7, "#eceff1"),
      ],
      [
        {
          x: 11,
          y: 0,
          type: "stairs",
          destinations: ["research:1F", "research:2F"],
        },
        {
          x: 11,
          y: 6,
          type: "elevator",
          destinations: ["research:1F", "research:2F"],
        },
      ],
    );

    /* =======================================================
       관리지원동 1F
       가운데는 실제 위치명 '복도'.
       '내부 서버, 전용 와이파이'는 decoration으로만 표시하며
       이동 셀/별도 공간으로 등록하지 않는다.
       ======================================================= */

    floors["support:1F"] = additionalFloorSpec(
      "support:1F",
      "1F",
      { id: "support_corridor", label: "복도", color: "#e3e6e8" },
      [
        /*
         * 사용자 제공 관리지원동 1F 안내도 기준.
         * 전체 12×8 격자 안에서 실제 방 비율을 그대로 맞춘다.
         *
         * 상단: 2 / 2 / 2 / 4 / 2칸
         * 중앙 복도: 12×4칸
         * 하단: 3 / 2 / 2 / 4 / 1칸
         */
        room("support_cctv", "중앙 CCTV실", 0, 0, 1, 1, "#f3f4f5"),
        room("support_access", "출입 관리실", 2, 0, 3, 1, "#f3f4f5"),
        room("support_broadcast", "방송실", 4, 0, 5, 1, "#f3f4f5"),
        room("support_management", "관리지원실", 6, 0, 9, 1, "#f3f4f5"),
        room("support_stairs", "비상계단", 10, 0, 11, 1, "#eceff1"),

        {
          ...room("support_corridor", "복도", 0, 2, 11, 5, "#e3e6e8"),
          hideLabel: true,
        },

        room("support_generator", "비상 발전기실", 0, 6, 2, 7, "#f3f4f5"),
        room("support_fuel", "연료 탱크실", 3, 6, 4, 7, "#f3f4f5"),
        room("support_water", "급수펌프 정수설비", 5, 6, 6, 7, "#f3f4f5"),
        room("support_hvac", "중앙 공조 제습 설비", 7, 6, 10, 7, "#f3f4f5"),
        room("support_elevator", "엘리베이터", 11, 6, 11, 7, "#eceff1"),
      ],
      [
        { x: 11, y: 0, type: "stairs", destinations: [] },
        { x: 11, y: 6, type: "elevator", destinations: [] },
      ],
    );

    floors["support:1F"].decorations = [
      {
        type: "dashed-info",
        label: "내부 서버, 전용 와이파이",
        x1: 2,
        y1: 3,
        x2: 9,
        y2: 4,
      },
    ];

    /* =======================================================
       생활관
       ======================================================= */

    floors["living:B1"] = additionalFloorSpec(
      "living:B1",
      "B1",
      { id: "living_b1_corridor", label: "복도", color: "#e4e7e9" },
      [
        room("living_b1_food", "식자재 창고", 0, 0, 2, 1, "#f4f5f6"),
        room(
          "living_b1_emergency_food",
          "비상식량 보관실",
          3,
          0,
          7,
          1,
          "#f4f5f6",
        ),
        room("living_b1_linen", "린넨실", 8, 0, 10, 1, "#f4f5f6"),
        room("living_b1_stairs", "보안계단", 11, 0, 11, 1, "#eceff1"),

        room("living_b1_corridor", "복도", 0, 2, 11, 5, "#e4e7e9"),

        room("living_b1_laundry", "세탁실", 0, 6, 5, 7, "#f4f5f6"),
        room("living_b1_cleaning", "청소용품 보관실", 6, 6, 10, 7, "#f4f5f6"),
        room("living_b1_elevator", "엘리베이터", 11, 6, 11, 7, "#eceff1"),
      ],
      [
        { x: 11, y: 0, type: "stairs", destinations: ["living:1F"] },
        {
          x: 11,
          y: 6,
          type: "elevator",
          destinations: ["living:1F", "living:2F", "living:3F", "living:4F"],
        },
      ],
    );

    floors["living:1F"] = additionalFloorSpec(
      "living:1F",
      "1F",
      { id: "living_1f_hall", label: "중앙 홀", color: "#e4e7e9" },
      [
        room("living_1f_kitchen", "주방", 0, 0, 4, 1, "#f4f5f6"),
        room("living_1f_cafeteria", "학생식당", 5, 0, 9, 1, "#f4f5f6"),
        room("living_1f_wc_w", "화장실(여)", 10, 0, 10, 1, "#f5f2f2"),
        room("living_1f_stairs", "보안계단", 11, 0, 11, 1, "#eceff1"),

        room("living_1f_hall", "중앙 홀", 0, 2, 11, 5, "#e4e7e9"),

        room("living_1f_lounge", "공용 라운지", 0, 6, 3, 7, "#f4f5f6"),
        room("living_1f_store", "편의점", 4, 6, 6, 7, "#f4f5f6"),
        room("living_1f_office", "생활관 행정실", 7, 6, 9, 7, "#f4f5f6"),
        room("living_1f_wc_m", "화장실(남)", 10, 6, 10, 7, "#f0f3f5"),
        room("living_1f_elevator", "엘리베이터", 11, 6, 11, 7, "#eceff1"),
      ],
      [
        {
          x: 11,
          y: 0,
          type: "stairs",
          destinations: ["living:B1", "living:2F", "living:3F", "living:4F"],
        },
        {
          x: 11,
          y: 6,
          type: "elevator",
          destinations: ["living:B1", "living:2F", "living:3F", "living:4F"],
        },
      ],
    );

    const residenceFloor = (floorId, prefix, previousFloor, nextFloor) => {
      const n = Number(prefix);
      const top = [];
      const bottom = [];

      for (let i = 1; i <= 5; i += 1) {
        top.push(
          room(
            `living_${prefix}0${i}`,
            `${prefix}0${i}호`,
            (i - 1) * 2,
            0,
            (i - 1) * 2 + 1,
            1,
            "#f4f5f6",
          ),
        );
      }

      for (let i = 6; i <= 10; i += 1) {
        bottom.push(
          room(
            `living_${prefix}${String(i).padStart(2, "0")}`,
            `${prefix}${String(i).padStart(2, "0")}호`,
            (i - 6) * 2,
            6,
            (i - 6) * 2 + 1,
            7,
            "#f4f5f6",
          ),
        );
      }

      return additionalFloorSpec(
        floorId,
        `${n}F`,
        {
          id: `${floorId.replace(":", "_")}_corridor`,
          label: "복도",
          color: "#e4e7e9",
        },
        [
          ...top,
          room(
            `${floorId.replace(":", "_")}_wc_w`,
            "화장실(여)",
            10,
            0,
            10,
            1,
            "#f5f2f2",
          ),
          room(
            `${floorId.replace(":", "_")}_stairs`,
            "보안계단",
            11,
            0,
            11,
            1,
            "#eceff1",
          ),

          room(
            `${floorId.replace(":", "_")}_corridor`,
            "복도",
            0,
            2,
            11,
            5,
            "#e4e7e9",
          ),
          room(
            `${floorId.replace(":", "_")}_lounge`,
            "휴게실",
            2,
            3,
            4,
            4,
            "#f4f5f6",
          ),
          room(
            `${floorId.replace(":", "_")}_water`,
            "정수기",
            5,
            3,
            5,
            4,
            "#f4f5f6",
          ),
          room(
            `${floorId.replace(":", "_")}_shower`,
            "공용 샤워실",
            6,
            3,
            9,
            4,
            "#f4f5f6",
          ),

          ...bottom,
          room(
            `${floorId.replace(":", "_")}_wc_m`,
            "화장실(남)",
            10,
            6,
            10,
            7,
            "#f0f3f5",
          ),
          room(
            `${floorId.replace(":", "_")}_elevator`,
            "엘리베이터",
            11,
            6,
            11,
            7,
            "#eceff1",
          ),
        ],
        [
          {
            x: 11,
            y: 0,
            type: "stairs",
            destinations: [previousFloor, nextFloor].filter(Boolean),
          },
          {
            x: 11,
            y: 6,
            type: "elevator",
            destinations: [
              "living:B1",
              "living:1F",
              "living:2F",
              "living:3F",
              "living:4F",
            ].filter((key) => key !== floorId),
          },
        ],
      );
    };

    floors["living:2F"] = residenceFloor(
      "living:2F",
      "2",
      "living:1F",
      "living:3F",
    );

    floors["living:3F"] = residenceFloor(
      "living:3F",
      "3",
      "living:2F",
      "living:4F",
    );

    floors["living:4F"] = additionalFloorSpec(
      "living:4F",
      "4F",
      { id: "living_4f_corridor", label: "복도", color: "#e4e7e9" },
      [
        room("living_401", "401호", 0, 0, 1, 1, "#f4f5f6"),
        room("living_402", "402호", 2, 0, 3, 1, "#f4f5f6"),
        room("living_403", "403호", 4, 0, 5, 1, "#f4f5f6"),
        room("living_404", "404호", 6, 0, 7, 1, "#f4f5f6"),
        room("living_405", "405호", 8, 0, 9, 1, "#f4f5f6"),
        room("living_4f_wc_w", "화장실(여)", 10, 0, 10, 1, "#f5f2f2"),
        room("living_4f_stairs", "보안계단", 11, 0, 11, 1, "#eceff1"),

        room("living_4f_corridor", "복도", 0, 2, 11, 5, "#e4e7e9"),
        room("living_4f_meeting", "소회의실", 3, 3, 7, 4, "#f4f5f6"),

        room("living_406", "406호", 0, 6, 1, 7, "#f4f5f6"),
        room("living_407", "407호", 2, 6, 3, 7, "#f4f5f6"),
        room("living_408", "408호", 4, 6, 5, 7, "#f4f5f6"),
        room("living_409", "409호", 6, 6, 7, 7, "#f4f5f6"),
        room("living_410", "410호", 8, 6, 9, 7, "#f4f5f6"),
        room("living_4f_wc_m", "화장실(남)", 10, 6, 10, 7, "#f0f3f5"),
        room("living_4f_elevator", "엘리베이터", 11, 6, 11, 7, "#eceff1"),
      ],
      [
        { x: 11, y: 0, type: "stairs", destinations: ["living:3F"] },
        {
          x: 11,
          y: 6,
          type: "elevator",
          destinations: ["living:B1", "living:1F", "living:2F", "living:3F"],
        },
      ],
    );

    /* =======================================================
       지하벙커 A / B / C
       관리자 환경설정의 지하벙커 기능이 켜졌을 때
       지정된 지상 진입 공간에서만 플레이어가 내려올 수 있다.
       ======================================================= */

    floors["bunker:A"] = additionalFloorSpec(
      "bunker:A",
      "A",
      {
        id: "bunker_a_staff_corridor",
        label: "직원 전용 복도",
        color: "#e4e7e9",
      },
      [
        /* 안내도 좌측/우측의 세로 이동문 */
        room("bunker_a_transfer_b", "B 벙커 이동문", 0, 0, 0, 7, "#eef1f4"),
        room("bunker_a_transfer_c", "C 벙커 이동문", 11, 0, 11, 7, "#eef1f4"),

        /* 상단 */
        room("bunker_a_machine", "기계실", 1, 0, 3, 1, "#f4f5f6"),
        room("bunker_a_reagent", "시약창고", 4, 0, 6, 1, "#f4f5f6"),
        room("bunker_a_waste", "폐기물 임시보관실", 7, 0, 9, 1, "#f4f5f6"),
        room("bunker_a_security_stairs", "보안계단", 10, 0, 10, 1, "#eceff1"),

        /* 중앙 */
        room(
          "bunker_a_staff_corridor",
          "직원 전용 복도",
          1,
          2,
          10,
          4,
          "#e4e7e9",
        ),

        /* 하단 — 융합학술동에서 내려오면 이쪽 보안계단에 도착 */
        room("bunker_a_emergency_stairs", "보안계단", 1, 5, 1, 7, "#eceff1"),
        room(
          "bunker_a_center_entry",
          "벙커 중앙 출입입구",
          2,
          5,
          10,
          7,
          "#f4f5f6",
        ),
      ],
    );

    floors["bunker:B"] = additionalFloorSpec(
      "bunker:B",
      "B",
      { id: "bunker_b_security_zone", label: "보안구역", color: "#e4e7e9" },
      [
        /* 안내도 좌측/우측의 세로 이동문 */
        room("bunker_b_transfer_a", "A 벙커 이동문", 0, 0, 0, 7, "#eef1f4"),
        room("bunker_b_transfer_c", "C 벙커 이동문", 11, 0, 11, 7, "#eef1f4"),

        /* 상단 */
        room("bunker_b_changing", "직원 탈의실", 1, 0, 2, 1, "#f4f5f6"),
        room("bunker_b_ice_bath", "제염실", 3, 0, 4, 1, "#f4f5f6"),
        room(
          "bunker_b_freezing_medium",
          "동결매질 조제실",
          5,
          0,
          7,
          1,
          "#f4f5f6",
        ),
        room(
          "bunker_b_spirit_model",
          "영체 모사체 실험실",
          8,
          0,
          9,
          1,
          "#f4f5f6",
        ),
        room("bunker_b_security_stairs", "보안계단", 10, 0, 10, 1, "#eceff1"),

        /* 중앙 */
        room("bunker_b_security_zone", "보안구역", 1, 2, 10, 4, "#e4e7e9"),

        /* 하단 — 융합학술동에서 내려오면 이쪽 보안계단에 도착 */
        room("bunker_b_emergency_stairs", "보안계단", 1, 5, 1, 7, "#eceff1"),
        room("bunker_b_conversion", "사기 변환 연구실", 2, 5, 4, 7, "#f4f5f6"),
        room("bunker_b_comms", "통신실", 5, 5, 6, 7, "#f4f5f6"),
        room("bunker_b_archive", "기밀자료 보관소", 7, 5, 9, 7, "#f4f5f6"),
        room("bunker_b_records", "기록 대조실", 10, 5, 10, 7, "#f4f5f6"),
      ],
    );

    floors["bunker:C"] = additionalFloorSpec(
      "bunker:C",
      "C",
      {
        id: "bunker_c_core_corridor",
        label: "핵심 설비 통로",
        color: "#e4e7e9",
      },
      [
        /* 안내도 좌측/우측의 세로 이동문 */
        room("bunker_c_transfer_b", "B 벙커 이동문", 0, 0, 0, 7, "#eef1f4"),
        room("bunker_c_transfer_a", "A 벙커 이동문", 11, 0, 11, 7, "#eef1f4"),

        /* 상단 */
        room(
          "bunker_c_medium_tank",
          "동결매질 저장탱크",
          1,
          0,
          2,
          1,
          "#f4f5f6",
        ),
        room(
          "bunker_c_transfer_sync",
          "이송, 저승 동기화실",
          3,
          0,
          5,
          1,
          "#f4f5f6",
        ),
        room("bunker_c_pressure", "압력조절실", 6, 0, 9, 1, "#f4f5f6"),
        room("bunker_c_security_stairs", "보안계단", 10, 0, 10, 1, "#eceff1"),

        /* 중앙 */
        room(
          "bunker_c_core_corridor",
          "핵심 설비 통로",
          1,
          2,
          10,
          4,
          "#e4e7e9",
        ),

        /* 하단 */
        room("bunker_c_recovery", "비상회수 장치", 1, 5, 2, 7, "#f4f5f6"),
        room("bunker_c_collection", "오염매질 집수조", 3, 5, 4, 7, "#f4f5f6"),
        room("bunker_c_control", "중앙 제어실", 5, 5, 10, 7, "#f4f5f6"),
      ],
    );

    // 지하벙커 중앙 구역. 실제 화면은 renderBunkerCenterMap()에서
    // 원형 안내도로 별도 렌더링하고, 위치 저장을 위해 단일 공간만 둔다.
    floors[BUNKER_CENTER_FLOOR] = additionalFloorSpec(
      BUNKER_CENTER_FLOOR,
      "중앙",
      { id: "bunker_center_chamber", label: "중앙 구역", color: "#f4f5f6" },
      [room("bunker_center_chamber", "중앙 구역", 0, 0, 11, 7, "#f4f5f6")],
    );

    /*
     * 이동문은 세로 공간 전체를 하나의 방으로 사용하지만,
     * 실제 출입은 중앙 통로와 맞닿은 가운데에서만 가능하게 연결합니다.
     * 각 방 ↔ 중앙 복도 doorway는 additionalFloorSpec의 기존 자동 규칙을 유지합니다.
     */
    [
      ["bunker:A", 0, 3, 1, 3],
      ["bunker:A", 10, 3, 11, 3],
      ["bunker:B", 0, 3, 1, 3],
      ["bunker:B", 10, 3, 11, 3],
      ["bunker:C", 0, 3, 1, 3],
      ["bunker:C", 10, 3, 11, 3],
    ].forEach(([floorId, x1, y1, x2, y2]) => {
      floors[floorId].doorways.add(edgeKey(x1, y1, x2, y2));
    });

    return floors;
  }

  function restrictedRoom(id, label, x1, y1, x2, y2, color = "#f4eaea") {
    return { ...room(id, label, x1, y1, x2, y2, color), restricted: true };
  }

  function installCrossBuildingTransitions() {
    /*
     * 현재 층별 지도에는 건물 간 직접 연결 통로를 사용하지 않는다.
     * 건물 이동은 캠퍼스 지도에서 다른 건물을 열람한 뒤
     * 해당 건물의 구역을 선택하는 기존 건물 이동 기능만 사용한다.
     */
  }

  function buildingFromFloorKey(floorKey) {
    const key = String(floorKey || "");
    if (key === "bunker:A") return "bunkerA";
    if (key === "bunker:B") return "bunkerB";
    if (key === "bunker:C") return "bunkerC";
    if (key === BUNKER_CENTER_FLOOR) return "bunkerCenter";
    if (key.startsWith("research:")) return "research";
    if (key.startsWith("living:")) return "living";
    if (key.startsWith("support:")) return "support";
    return "main";
  }

  function isBunkerFloor(floorKey) {
    return String(floorKey || "").startsWith("bunker:");
  }

  function floorLabelFromKey(floorKey) {
    const text = String(floorKey || "");
    if (text === BUNKER_CENTER_FLOOR) return "중앙";
    return text.includes(":") ? text.split(":").pop() : text;
  }

  function buildingLabelFromFloor(floorKey) {
    return (
      BUILDING_DEFINITIONS[buildingFromFloorKey(floorKey)]?.name || "융합학술동"
    );
  }

  function floorKeysForBuilding(buildingId) {
    return (
      BUILDING_DEFINITIONS[buildingId]?.floors ||
      BUILDING_DEFINITIONS.main.floors
    );
  }

  function firstFloorForBuilding(buildingId) {
    const floors = floorKeysForBuilding(buildingId);
    if (String(buildingId).startsWith("bunker")) return floors[0];
    if (buildingId === "research")
      return floors.includes("research:1F") ? "research:1F" : floors[0];
    if (buildingId === "living")
      return floors.includes("living:1F") ? "living:1F" : floors[0];
    if (buildingId === "support") return "support:1F";
    return "1F";
  }

  function characterLocationText(character) {
    if (!character) return "";
    return `${buildingLabelFromFloor(character.floor)} ${floorLabelFromKey(character.floor)} · ${getRoomLabel(character.floor, character.x, character.y)}`;
  }

  function exposedFloorKeysForBuilding(character, buildingId) {
    const exposure = getRoleExposure(character.role);
    return floorKeysForBuilding(buildingId).filter(
      (floorKey) => exposure.floors[floorKey] !== false,
    );
  }

  function hasAnyExposedBunkerMapForCurrentViewer() {
    if (session?.type === "admin") return true;

    const actor = getMovementActor();
    if (
      session?.type !== "player" ||
      !["survivor", "spirit"].includes(actor?.role)
    ) {
      return false;
    }

    const exposure = getRoleExposure(actor.role);
    return ["bunker:A", "bunker:B", "bunker:C", BUNKER_CENTER_FLOOR].some(
      (floorKey) => exposure.floors[floorKey] !== false,
    );
  }

  function canUseSiteMapLayerToggle() {
    return hasAnyExposedBunkerMapForCurrentViewer();
  }

  function ensureSiteMapLayerToggle() {
    const header = document.querySelector(
      "#campusMapPopup .campus-map-popup__header",
    );
    const closeButton = elements.campusMapCloseButton;
    if (!header || !closeButton) return;

    let toggle = header.querySelector("[data-site-map-layer-toggle]");

    if (!canUseSiteMapLayerToggle()) {
      toggle?.remove();
      return;
    }

    if (ui.siteMapLayer !== "underground") {
      ui.siteMapLayer = "surface";
    }

    if (!toggle) {
      toggle = document.createElement("div");
      toggle.className = "site-map-layer-toggle";
      toggle.dataset.siteMapLayerToggle = "";
      toggle.setAttribute("role", "group");
      toggle.setAttribute("aria-label", "지도 지상 지하 전환");
      toggle.innerHTML = `
        <button type="button" data-site-map-layer="surface">지상</button>
        <button type="button" data-site-map-layer="underground">지하</button>
      `;
      header.insertBefore(toggle, closeButton);
    }

    toggle.dataset.layer = ui.siteMapLayer;
    toggle.querySelectorAll("[data-site-map-layer]").forEach((button) => {
      const active = button.dataset.siteMapLayer === ui.siteMapLayer;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderSiteMapLayer() {
    if (ui.siteMapLayer === "underground" && !canUseSiteMapLayerToggle()) {
      ui.siteMapLayer = "surface";
    }

    if (ui.siteMapLayer === "underground") {
      renderBunkerOverview();
    } else {
      renderCampusOverview();
    }
    ensureSiteMapLayerToggle();
  }

  function setMapPopupHeader(mode = "campus") {
    const title = document.querySelector("#campusMapPopupTitle");
    const description = document.querySelector(
      "#campusMapPopup .campus-map-popup__header p:last-child",
    );

    if (mode === "bunker") {
      if (title) title.textContent = "지하벙커 구역 지도";
      if (description) {
        description.textContent = "";
        description.hidden = true;
      }
      return;
    }

    if (title) title.textContent = "학술원 전체 지도";
    if (description) {
      description.hidden = false;
      description.textContent =
        "건물을 선택하면 해당 건물의 층별 상세 지도로 이동합니다.";
    }
  }

  function isBunkerFloorExposedToCurrentViewer(floorId) {
    if (session?.type === "admin") return true;
    const actor = getMovementActor();
    if (!actor || session?.type !== "player") return false;
    return getRoleExposure(actor.role).floors[floorId] !== false;
  }

  function renderBunkerOverview() {
    if (!elements.campusMapCanvas) return;

    campusMapRenderSignature = "";
    const actor = getMovementActor();
    const actorFloor = actor?.floor || "";
    const currentFloor = isBunkerFloor(actorFloor)
      ? actorFloor
      : isBunkerFloor(ui.currentFloor)
        ? ui.currentFloor
        : "bunker:A";

    const zoneButton = (floorId, zone, linkText, className) => {
      const currentClass = currentFloor === floorId ? "is-current-zone" : "";
      const exposed = isBunkerFloorExposedToCurrentViewer(floorId);
      const positionMarker =
        actorFloor === floorId
          ? '<span class="bunker-selector__position-dot" title="현재 위치" aria-label="현재 위치"></span>'
          : "";

      // 구역 카드는 상세 지도 "열람"만 담당합니다.
      // 클릭해도 character.floor / x / y는 변경하지 않습니다.
      return `
        <button
          type="button"
          class="bunker-selector__zone ${className} ${currentClass} ${exposed ? "" : "is-unreleased-zone"}"
          data-bunker-map-zone="${floorId}"
          data-bunker-zone-exposed="${exposed ? "true" : "false"}"
          aria-label="${exposed ? `지하벙커 ${zone} 구역 상세 지도 보기` : `지하벙커 ${zone} 구역 미공개`}"
        >
          ${positionMarker}
          <strong>${zone} 구역</strong>
          <span>${exposed ? escapeHtml(linkText) : "미공개"}</span>
        </button>`;
    };

    setMapPopupHeader("bunker");
    elements.campusMapCanvas.classList.add("campus-site-map--bunker-selector");
    elements.campusMapCanvas.innerHTML = `
      <div class="bunker-selector" aria-label="지하벙커 A B C 구역 선택 지도">
        <div class="bunker-selector__disc" aria-hidden="true"></div>
        <div class="bunker-selector__divider bunker-selector__divider--left" aria-hidden="true"></div>
        <div class="bunker-selector__divider bunker-selector__divider--right" aria-hidden="true"></div>
        <div class="bunker-selector__divider bunker-selector__divider--bottom" aria-hidden="true"></div>

        ${zoneButton("bunker:C", "C", "관리지원동 연결", "bunker-selector__zone--c")}
        ${zoneButton("bunker:B", "B", "생활관 연결", "bunker-selector__zone--b")}
        ${zoneButton("bunker:A", "A", "융합학술동 · 연구별관 연결", "bunker-selector__zone--a")}

        <div class="bunker-selector__core-link bunker-selector__core-link--a" aria-hidden="true"></div>
        <button
          type="button"
          class="bunker-selector__core ${currentFloor === BUNKER_CENTER_FLOOR ? "is-current-zone" : ""} ${isBunkerFloorExposedToCurrentViewer(BUNKER_CENTER_FLOOR) ? "" : "is-unreleased-zone"}"
          data-bunker-map-zone="${BUNKER_CENTER_FLOOR}"
          data-bunker-zone-exposed="${isBunkerFloorExposedToCurrentViewer(BUNKER_CENTER_FLOOR) ? "true" : "false"}"
          aria-label="${isBunkerFloorExposedToCurrentViewer(BUNKER_CENTER_FLOOR) ? "지하벙커 중앙 구역 상세 지도 보기" : "지하벙커 중앙 구역 미공개"}"
        >
          ${actorFloor === BUNKER_CENTER_FLOOR ? '<span class="bunker-selector__position-dot" title="현재 위치" aria-label="현재 위치"></span>' : ""}
          <span>중앙 구역</span>
          <strong>${isBunkerFloorExposedToCurrentViewer(BUNKER_CENTER_FLOOR) ? "중앙" : "미공개"}</strong>
        </button>
      </div>
    `;
  }

  function renderCampusOverview() {
    if (!elements.campusMapCanvas) return;

    setMapPopupHeader("campus");
    elements.campusMapCanvas.classList.remove(
      "campus-site-map--bunker-selector",
    );

    const counts = Object.fromEntries(
      Object.keys(BUILDING_DEFINITIONS).map((id) => [id, 0]),
    );
    state.characters.forEach((character) => {
      const buildingId = buildingFromFloorKey(character.floor);
      if (counts[buildingId] !== undefined) counts[buildingId] += 1;
    });

    const movementActor = getMovementActor();
    const currentBuilding =
      ui.currentBuilding || buildingFromFloorKey(movementActor?.floor || "1F");
    const characterBuilding = movementActor
      ? buildingFromFloorKey(movementActor.floor)
      : "";

    const signature = `${currentBuilding}|character:${characterBuilding}|${Object.entries(
      counts,
    )
      .map(([key, value]) => `${key}:${value}`)
      .join("|")}`;

    if (
      signature === campusMapRenderSignature &&
      elements.campusMapCanvas.childElementCount
    ) {
      return;
    }
    campusMapRenderSignature = signature;

    const buildingButton = (id, extra = "") => {
      const building = BUILDING_DEFINITIONS[id];
      const currentClass = currentBuilding === id ? "is-current-building" : "";
      const characterClass =
        characterBuilding === id ? "is-character-building" : "";

      const playerCharacter =
        session.type === "player" ? getCharacter(session.characterId) : null;
      const visibleFloors = playerCharacter
        ? exposedFloorKeysForBuilding(playerCharacter, id)
        : floorKeysForBuilding(id);
      const isReleased = session.type !== "player" || visibleFloors.length > 0;
      const releaseClass = isReleased ? "" : "is-unreleased-building";
      const floorMeta = isReleased
        ? visibleFloors.map(floorLabelFromKey).join(" · ")
        : "미공개";

      const positionMarker =
        characterBuilding === id
          ? '<span class="campus-building__position-dot" title="현재 위치" aria-label="현재 위치"></span>'
          : "";

      return `
        <button
          type="button"
          class="campus-building ${building.className} ${currentClass} ${characterClass} ${releaseClass}"
          data-campus-building="${id}"
          aria-label="${escapeHtml(building.name)} 내부 지도 보기"
        >
          ${positionMarker}
          <span class="campus-building__name">${escapeHtml(building.name)}</span>
          <span class="campus-building__desc">${escapeHtml(building.description)}</span>
          <span class="campus-building__meta">${escapeHtml(floorMeta)}</span>
          <span class="campus-building__occupancy">${counts[id]}명</span>
          ${extra}
        </button>`;
    };

    elements.campusMapCanvas.innerHTML = `
      <div class="campus-site-map__ring" aria-hidden="true"></div>

      ${buildingButton("support")}
      ${buildingButton("living")}
      ${buildingButton("research", '<span class="campus-helipad" aria-hidden="true">H</span>')}
      ${buildingButton("main")}

      <div class="campus-plaza" aria-label="중앙광장">
        <strong>중앙광장</strong>
        <span>정원</span>
        <i aria-hidden="true"></i>
      </div>

      <div class="campus-parking" aria-label="주차장 및 셔틀 승강장">
        <strong>주차장 · 셔틀 승강장</strong>
      </div>
      <div class="campus-guard" aria-label="경비소"><strong>경비소</strong></div>
      <div class="campus-main-gate" aria-label="정문"><strong>정문</strong></div>
      <div class="campus-north" aria-hidden="true"><span>N</span><i>↑</i></div>
    `;
  }

  function spiritBuildingViewerFloor(actor, buildingId, visibleFloors) {
    const firstFloor = `${buildingId}:1F`;

    if (visibleFloors.includes(firstFloor)) {
      return firstFloor;
    }

    return visibleFloors[0] || firstFloorForBuilding(buildingId);
  }

  function requestSpiritBuildingMoveFromViewedZone(actor, buildingId) {
    if (
      session?.type !== "player" ||
      !actor ||
      actor.role !== "spirit" ||
      !BUILDING_DEFINITIONS[buildingId]
    ) {
      return;
    }

    const currentBuilding = buildingFromFloorKey(actor.floor);

    if (isBunkerFloor(actor.floor)) {
      return;
    }

    if (currentBuilding === buildingId) return;

    const visibleFloors = exposedFloorKeysForBuilding(actor, buildingId);
    const destination = buildingArrivalPoint(buildingId);

    if (!visibleFloors.includes(destination.floor)) {
      showToast("이 건물의 1층은 아직 공개되지 않았습니다.");
      return;
    }

    openModal({
      eyebrow: "건물 이동",
      title: "동결체 건물 이동 확인",
      body: `<div class="movement-confirmation">
        <div class="movement-confirmation__route">
          <span>${escapeHtml(BUILDING_DEFINITIONS[currentBuilding].name)}</span>
          <strong>→</strong>
          <span>${escapeHtml(BUILDING_DEFINITIONS[buildingId].name)} 1F</span>
        </div>
        <div class="movement-confirmation__cost">
          <span>소모 행동력</span>
          <strong>5</strong>
        </div>
        <p>다른 건물의 구역을 선택했습니다. 이동하면 행동력 5를 사용하며, 해당 건물 1층으로 이동합니다.</p>
      </div>`,
      footer: `<button type="button" class="button" data-modal-close>취소</button><button type="button" class="button button--primary" data-confirm-building-move>이동</button>`,
    });

    elements.modalFooter
      .querySelector("[data-confirm-building-move]")
      ?.addEventListener("click", async () => {
        if (actor.ap < 5) {
          showToast("행동력이 부족합니다. 5가 필요합니다.");
          return;
        }

        if (session?.type === "player" && session?.token) {
          await performRemoteSpiritBuildingMove(actor, buildingId);
          return;
        }

        settleAllSurvivorFreezeClocks();

        const fromFloor = actor.floor;
        const fromRoom = getRoomLabel(actor.floor, actor.x, actor.y);

        actor.ap -= 5;
        actor.floor = destination.floor;
        actor.x = destination.x;
        actor.y = destination.y;

        ui.currentBuilding = buildingId;
        ui.currentFloor = destination.floor;
        ui.mapMode = "floor";

        const toRoom = getRoomLabel(actor.floor, actor.x, actor.y);

        recordSpiritMovement(actor, {
          fromFloor,
          fromRoom,
          toFloor: destination.floor,
          toRoom,
          cost: 5,
          source: "건물 이동",
        });

        addLog(
          `${actor.name}이(가) ${BUILDING_DEFINITIONS[currentBuilding].name}에서 ${BUILDING_DEFINITIONS[buildingId].name} 1F로 이동했습니다. 행동력 −5.`,
        );

        persistState();
        closeModal();
        renderAll();

        showToast(
          `${BUILDING_DEFINITIONS[buildingId].name} 1F로 이동했습니다. 행동력 −5.`,
        );
      });
  }

  function openBuildingMap(buildingId) {
    if (!BUILDING_DEFINITIONS[buildingId]) return;

    const actor = getMovementActor();

    if (session.type === "player") {
      const visibleFloors = exposedFloorKeysForBuilding(actor, buildingId);

      if (!visibleFloors.length) {
        closeCampusMapPopup();
        openModal({
          eyebrow: "지도 접근",
          title: "아직 공개되지 않은 건물입니다.",
          body: `<div class="map-release-warning">
            <p>운영진이 이 건물의 층을 공개한 뒤 열람할 수 있습니다.</p>
          </div>`,
          footer: `<button type="button" class="button button--primary" data-modal-close>확인</button>`,
        });
        return;
      }

      const currentBuilding = buildingFromFloorKey(actor.floor);

      // 생존자는 항상 기존처럼 지도 열람만 한다.
      if (actor.role === "survivor") {
        ui.currentBuilding = buildingId;
        ui.currentFloor =
          currentBuilding === buildingId && visibleFloors.includes(actor.floor)
            ? actor.floor
            : visibleFloors[0];
        ui.mapMode = "floor";
        closeCampusMapPopup();
        renderAll();
        return;
      }

      /*
       * 동결체의 건물 버튼은 이제 "지도 열람"만 담당한다.
       *
       * - 현재 건물: 실제 현재 층을 보여줌
       * - 다른 건물: 그 건물의 공개된 1F 지도를 우선 보여줌
       * - 이 단계에서는 행동력 차감/건물 이동 확인창이 절대 뜨지 않음
       *
       * 실제 건물 이동 확인창은 다른 건물 지도 안의 구역을
       * 직접 클릭했을 때 handleMapClick()에서 표시한다.
       */
      ui.currentBuilding = buildingId;

      if (
        currentBuilding === buildingId &&
        visibleFloors.includes(actor.floor)
      ) {
        ui.currentFloor = actor.floor;
      } else {
        ui.currentFloor = spiritBuildingViewerFloor(
          actor,
          buildingId,
          visibleFloors,
        );
      }

      ui.mapMode = "floor";
      closeCampusMapPopup();
      renderAll();
      return;
    }

    // 관리자 지도 열람 동작은 기존과 동일
    ui.currentBuilding = buildingId;
    const actorFloor = actor?.floor;
    ui.currentFloor =
      actor && buildingFromFloorKey(actorFloor) === buildingId
        ? actorFloor
        : firstFloorForBuilding(buildingId);
    ui.mapMode = "floor";
    closeCampusMapPopup();
    renderAll();
  }

  function openSiteMap() {
    ui.adminTool = null;
    closeModal();

    const actor = getMovementActor();

    if (actor && isBunkerFloor(actor.floor) && canUseSiteMapLayerToggle()) {
      ui.siteMapLayer = "underground";
    } else if (
      !canUseSiteMapLayerToggle() ||
      ui.siteMapLayer !== "underground"
    ) {
      ui.siteMapLayer = "surface";
    }

    renderSiteMapLayer();

    elements.campusMapBackdrop?.classList.remove("is-hidden");
    elements.campusMapBackdrop?.setAttribute("aria-hidden", "false");
    document.body.classList.add("campus-map-open");
  }

  function closeCampusMapPopup() {
    elements.campusMapBackdrop?.classList.add("is-hidden");
    elements.campusMapBackdrop?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("campus-map-open");
  }

  function renderFloorTabs() {
    const actor = getMovementActor();

    if (ui.mapMode === "site") {
      elements.floorTabs.innerHTML = "";
      if (elements.currentFloorLabel) {
        elements.currentFloorLabel.textContent = "";
      }
      return;
    }

    const buildingId =
      ui.currentBuilding || buildingFromFloorKey(ui.currentFloor);
    const floors =
      session.type === "player"
        ? exposedFloorKeysForBuilding(actor, buildingId)
        : floorKeysForBuilding(buildingId);

    if (session.type === "player" && !floors.length) {
      elements.currentFloorLabel.textContent = "";
      elements.floorTabs.innerHTML = "";
      return;
    }

    if (!floors.includes(ui.currentFloor)) {
      ui.currentFloor = floors[0] || firstFloorForBuilding(buildingId);
    }

    elements.currentFloorLabel.textContent = floorLabelFromKey(ui.currentFloor);

    const viewerButtons = floors
      .map((floorId) => {
        const classes = [
          floorId === ui.currentFloor ? "is-active" : "",
          actor?.floor === floorId ? "is-character-floor" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return `<button type="button" data-floor="${floorId}" class="${classes}" aria-current="${actor?.floor === floorId ? "location" : "false"}">${floorLabelFromKey(floorId)}</button>`;
      })
      .join("");

    elements.floorTabs.innerHTML = viewerButtons;
  }

  function renderBunkerCenterMap(movementActor) {
    const perspective = getPerspective();
    const exposure =
      session.type === "player" && movementActor
        ? getRoleExposure(movementActor.role)
        : null;
    const visibleCharacters = getVisibleCharactersAtCell(
      BUNKER_CENTER_FLOOR,
      BUNKER_CENTER_POSITION.x,
      BUNKER_CENTER_POSITION.y,
      perspective,
      true,
    );

    const bunkerTokenSet = splitMapTokenCharacters(
      visibleCharacters,
      perspective,
      movementActor,
    );
    const tokens = bunkerTokenSet.visible
      .map((character) =>
        tokenMarkup(character, character.id === movementActor?.id),
      )
      .join("");
    const overflowTokens = mapTokenOverflowMarkup(bunkerTokenSet.hidden);

    const canReturnToA =
      session.type === "player" &&
      movementActor?.role === "spirit" &&
      movementActor?.floor === BUNKER_CENTER_FLOOR;

    elements.mapGrid.className = "map-grid map-grid--bunker-center";
    elements.mapGrid.dataset.floorId = BUNKER_CENTER_FLOOR;
    elements.mapGrid.style.setProperty("--columns", "1");
    elements.mapGrid.style.setProperty("--rows", "1");
    elements.mapGrid.innerHTML = `
      <div class="bunker-center-map" aria-label="지하벙커 중앙 안내도">
        <div class="bunker-center-map__chamber">
          <div class="bunker-center-map__device">
            <span>생체동결전이장치</span>
          </div>
          <div class="bunker-center-map__tokens">${tokens}${overflowTokens}</div>
        </div>
        <div class="bunker-center-map__connector" aria-label="A 구역 연결 통로">
          ${
            canReturnToA
              ? '<button type="button" class="bunker-center-map__move-button" data-open-bunker-center-return aria-label="A 구역으로 이동">이동</button>'
              : ""
          }
        </div>
      </div>
    `;

    elements.warmthBanner?.classList.add("is-hidden");
    updateMovementRule(movementActor);
  }

  /*
   * 지도 토큰은 x/y 셀이 아니라 최종 roomId를 기준으로 묶습니다.
   *
   * 중요한 점:
   * - floor.rooms에 직접 선언된 방뿐 아니라 defaultRoom/복도/로비처럼
   *   floor.cells에만 남는 공간도 동일하게 하나의 공간으로 취급합니다.
   * - 실제 x/y 좌표는 이동/AP/서버 저장용으로 그대로 유지합니다.
   * - 지도에 그릴 때만 같은 roomId의 캐릭터를 한 묶음으로 표시합니다.
   */
  function getFloorRoomTokenZones(floor) {
    if (!floor?.cells) return [];

    const groups = new Map();

    Object.values(floor.cells).forEach((cell) => {
      if (!cell?.roomId) return;
      if (!groups.has(cell.roomId)) {
        groups.set(cell.roomId, {
          roomId: cell.roomId,
          roomLabel: cell.roomLabel || cell.roomId,
          cells: [],
        });
      }
      groups.get(cell.roomId).cells.push(cell);
    });

    return [...groups.values()].map((group) => {
      const xs = group.cells.map((cell) => Number(cell.x));
      const ys = group.cells.map((cell) => Number(cell.y));
      const x1 = Math.min(...xs);
      const x2 = Math.max(...xs);
      const y1 = Math.min(...ys);
      const y2 = Math.max(...ys);

      return {
        ...group,
        x1,
        x2,
        y1,
        y2,
        columns: x2 - x1 + 1,
        rows: y2 - y1 + 1,
        // 실제 roomId에 속한 셀 수를 공간 면적으로 사용합니다.
        // bounding box 크기가 아니라 실제 칸 수이므로 꺾인 방/복도도 정확합니다.
        cellCount: group.cells.length,
      };
    });
  }

  /*
   * 공간 면적에 따른 지도 토큰 표시 수
   * - 1칸 공간: 1명 + N명
   * - 2칸 공간: 2명 + N명
   * - ...
   * - 6칸 이상: 최대 6명 + N명
   *
   * 본인(또는 관리자 선택 캐릭터)은 splitMapTokenCharacters에서
   * 항상 표시 인원 안에 우선 포함됩니다.
   */
  function mapVisibleTokenLimitForZone(zone) {
    const roomCells = Math.max(1, Number(zone?.cellCount || 1));
    return Math.min(MAX_MAP_VISIBLE_TOKENS, roomCells);
  }

  function getVisibleCharactersInRoomId(floorId, roomId, perspective) {
    if (!floorId || !roomId) return [];

    const characters = state.characters.filter(
      (character) =>
        character.floor === floorId &&
        getRoomId(character.floor, character.x, character.y) === roomId,
    );

    if (perspective.mode === "admin") return characters;
    if (!perspective.character) return [];

    const viewer = perspective.character;
    const viewerRoomId =
      viewer.floor === floorId
        ? getRoomId(viewer.floor, viewer.x, viewer.y)
        : null;
    const visibleTeams = getVisibleTeamsForCharacter(viewer.id);
    const sharedIds = new Set([
      viewer.id,
      ...visibleTeams.flatMap((team) => team.memberIds),
    ]);

    return characters.filter((character) => {
      if (!canViewerSeeCharacterOnMap(viewer, character)) return false;
      if (Number(character.id) === Number(viewer.id)) return true;
      if (sharedIds.has(character.id)) return true;
      return viewerRoomId === roomId;
    });
  }

  const MAX_MAP_VISIBLE_TOKENS = 6;

  function splitMapTokenCharacters(
    characters,
    perspective,
    movementActor,
    maxVisible = MAX_MAP_VISIBLE_TOKENS,
  ) {
    const ordered = [...characters].sort((a, b) => Number(a.id) - Number(b.id));
    const requiredId =
      perspective?.mode === "player"
        ? perspective.character?.id
        : movementActor?.id;

    if (requiredId != null) {
      const requiredIndex = ordered.findIndex(
        (character) => Number(character.id) === Number(requiredId),
      );

      if (requiredIndex >= maxVisible) {
        const [requiredCharacter] = ordered.splice(requiredIndex, 1);
        ordered.unshift(requiredCharacter);
      }
    }

    return {
      visible: ordered.slice(0, maxVisible),
      hidden: ordered.slice(maxVisible),
    };
  }

  function openAdminCharacterManagementFromMap(characterId) {
    if (session?.type !== "admin" || ui.adminTool) return false;

    const character = getCharacter(Number(characterId));
    if (!character) return false;

    document
      .querySelectorAll(".map-token-overflow-wrap.is-open")
      .forEach((element) => {
        element.classList.remove("is-open");
        element
          .querySelector("[data-token-overflow-toggle]")
          ?.setAttribute("aria-expanded", "false");
      });

    activeMapTokenOverflowWrapper = null;
    hideMapTokenOverflowPortal();

    ui.selectedCharacterId = character.id;
    ui.currentFloor = character.floor;
    ui.currentBuilding = buildingFromFloorKey(character.floor);
    ui.mapMode = "floor";

    renderAll();
    showCharacterManagementModal(character.id);
    return true;
  }

  function mapTokenOverflowMarkup(hiddenCharacters) {
    if (!hiddenCharacters.length) return "";

    const names = hiddenCharacters
      .map((character) => {
        const name = escapeHtml(character.name);

        if (session?.type === "admin") {
          return `<button
            type="button"
            class="map-token-overflow-list__name map-token-overflow-list__name--admin"
            data-admin-overflow-character="${character.id}"
            aria-label="${name} 캐릭터 관리 열기"
          >${name}</button>`;
        }

        return `<span class="map-token-overflow-list__name">${name}</span>`;
      })
      .join("");

    return `
      <span class="map-token-overflow-wrap">
        <span
          class="map-token-overflow"
          data-token-overflow-toggle
          role="button"
          tabindex="0"
          aria-expanded="false"
          aria-label="숨겨진 인원 ${hiddenCharacters.length}명 보기"
        >+${hiddenCharacters.length}명</span>
        <span class="map-token-overflow-list" role="tooltip">
          <strong>같은 위치 · ${hiddenCharacters.length}명</strong>
          <span class="map-token-overflow-list__names">${names}</span>
        </span>
      </span>
    `;
  }

  let activeMapTokenOverflowWrapper = null;
  let mapTokenOverflowPortal = null;
  let mapTokenOverflowHideTimer = 0;

  function ensureMapTokenOverflowPortal() {
    if (mapTokenOverflowPortal?.isConnected) return mapTokenOverflowPortal;

    const portal = document.createElement("div");
    portal.className = "map-token-overflow-portal";
    portal.setAttribute("role", "tooltip");
    portal.setAttribute("aria-hidden", "true");
    document.body.appendChild(portal);

    portal.addEventListener("pointerenter", () => {
      window.clearTimeout(mapTokenOverflowHideTimer);
    });
    portal.addEventListener("pointerleave", () => {
      if (!activeMapTokenOverflowWrapper?.classList.contains("is-open")) {
        hideMapTokenOverflowPortal();
      }
    });

    /*
     * +N명 팝업은 document.body 아래의 포털이므로 mapGrid 클릭 이벤트의
     * 범위 밖입니다. 관리자일 때만 이름을 눌러 캐릭터 관리창을 엽니다.
     */
    portal.addEventListener("click", (event) => {
      const characterButton = event.target.closest(
        "[data-admin-overflow-character]",
      );
      if (!characterButton || session?.type !== "admin") return;

      event.preventDefault();
      event.stopPropagation();
      openAdminCharacterManagementFromMap(
        Number(characterButton.dataset.adminOverflowCharacter),
      );
    });

    mapTokenOverflowPortal = portal;
    return portal;
  }

  function positionMapTokenOverflowList(wrapper) {
    if (!wrapper) return;
    const toggle = wrapper.querySelector("[data-token-overflow-toggle]");
    const source = wrapper.querySelector(".map-token-overflow-list");
    if (!toggle || !source) return;

    const portal = ensureMapTokenOverflowPortal();
    portal.innerHTML = source.innerHTML;
    portal.classList.add("is-visible");
    portal.setAttribute("aria-hidden", "false");
    activeMapTokenOverflowWrapper = wrapper;

    const toggleRect = toggle.getBoundingClientRect();
    const portalRect = portal.getBoundingClientRect();
    const gap = 10;
    const viewportPadding = 10;

    const clampLeft = (value) =>
      Math.max(
        viewportPadding,
        Math.min(
          value,
          window.innerWidth - portalRect.width - viewportPadding,
        ),
      );
    const clampTop = (value) =>
      Math.max(
        viewportPadding,
        Math.min(
          value,
          window.innerHeight - portalRect.height - viewportPadding,
        ),
      );

    const rightLeft = clampLeft(toggleRect.right + gap);
    const leftLeft = clampLeft(toggleRect.left - gap - portalRect.width);
    const centeredTop = clampTop(
      toggleRect.top + toggleRect.height / 2 - portalRect.height / 2,
    );

    const topCandidates = [
      centeredTop,
      clampTop(toggleRect.bottom + gap),
      clampTop(toggleRect.top - portalRect.height - gap),
    ];

    const tokenRects = [...document.querySelectorAll(".character-token")]
      .filter((token) => token.offsetParent !== null)
      .map((token) => token.getBoundingClientRect());

    const overlapArea = (a, b) => {
      const width = Math.max(
        0,
        Math.min(a.right, b.right) - Math.max(a.left, b.left),
      );
      const height = Math.max(
        0,
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
      );
      return width * height;
    };

    const candidates = [];
    for (const left of [rightLeft, leftLeft]) {
      for (const top of topCandidates) {
        const rect = {
          left,
          top,
          right: left + portalRect.width,
          bottom: top + portalRect.height,
        };
        const tokenOverlap = tokenRects.reduce(
          (sum, tokenRect) => sum + overlapArea(rect, tokenRect),
          0,
        );
        const distance =
          Math.abs(left - toggleRect.left) +
          Math.abs(top - centeredTop) * 0.15;
        candidates.push({ left, top, tokenOverlap, distance });
      }
    }

    candidates.sort(
      (a, b) =>
        a.tokenOverlap - b.tokenOverlap || a.distance - b.distance,
    );

    const best = candidates[0];
    portal.style.left = `${Math.round(best.left)}px`;
    portal.style.top = `${Math.round(best.top)}px`;
  }

  function hideMapTokenOverflowPortal() {
    window.clearTimeout(mapTokenOverflowHideTimer);
    if (mapTokenOverflowPortal) {
      mapTokenOverflowPortal.classList.remove("is-visible");
      mapTokenOverflowPortal.setAttribute("aria-hidden", "true");
    }
    if (!activeMapTokenOverflowWrapper?.classList.contains("is-open")) {
      activeMapTokenOverflowWrapper = null;
    }
  }

  function scheduleHideMapTokenOverflowPortal() {
    window.clearTimeout(mapTokenOverflowHideTimer);
    mapTokenOverflowHideTimer = window.setTimeout(() => {
      if (!activeMapTokenOverflowWrapper?.classList.contains("is-open")) {
        hideMapTokenOverflowPortal();
      }
    }, 120);
  }

  function positionMapTokenOverflowBadge(wrapper) {
    if (!wrapper) return;

    const zone = wrapper.closest(".map-room-token-zone");
    if (!zone) return;

    const tokenGroups = [
      ...zone.querySelectorAll(".map-room-token-zone__tokens"),
    ].filter((group) => group.querySelector(".character-token"));

    const tokenGroup = tokenGroups[tokenGroups.length - 1];
    if (!tokenGroup) return;

    const tokens = [...tokenGroup.querySelectorAll(".character-token")];
    const lastToken = tokens[tokens.length - 1];
    if (!lastToken) return;

    const zoneRect = zone.getBoundingClientRect();
    const lastRect = lastToken.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const gap = 9;

    let left = lastRect.right - zoneRect.left + gap;
    let top =
      lastRect.top -
      zoneRect.top +
      lastRect.height / 2 -
      wrapperRect.height / 2;

    wrapper.style.left = `${Math.round(left)}px`;
    wrapper.style.top = `${Math.round(top)}px`;
    wrapper.style.right = "auto";
    wrapper.style.bottom = "auto";
    wrapper.style.transform = "none";
    wrapper.classList.add("is-badge-positioned");
  }

  function positionAllMapTokenOverflowBadges() {
    document
      .querySelectorAll(".map-room-token-zone > .map-token-overflow-wrap")
      .forEach((wrapper) => positionMapTokenOverflowBadge(wrapper));
  }

  function positionAllOpenMapTokenOverflowLists() {
    if (activeMapTokenOverflowWrapper) {
      positionMapTokenOverflowList(activeMapTokenOverflowWrapper);
    }
  }

  function renderMap() {
    if (ui.mapMode === "site") {
      renderCampusOverview();
      return;
    }

    const movementActor = getMovementActor();
    const buildingId =
      ui.currentBuilding || buildingFromFloorKey(ui.currentFloor);

    if (session.type === "player") {
      const visibleFloors = exposedFloorKeysForBuilding(
        movementActor,
        buildingId,
      );

      if (!visibleFloors.length || !visibleFloors.includes(ui.currentFloor)) {
        elements.mapGrid.className = "map-grid map-grid--unreleased";
        delete elements.mapGrid.dataset.floorId;
        elements.mapGrid.style.setProperty("--columns", GRID_COLUMNS);
        elements.mapGrid.style.setProperty("--rows", GRID_ROWS);
        elements.mapGrid.innerHTML = `
          <div class="map-unreleased-message">
            <strong>아직 공개되지 않은 건물입니다.</strong>
            <span>운영진이 지도를 공개한 뒤 열람할 수 있습니다.</span>
          </div>
        `;
        elements.warmthBanner?.classList.add("is-hidden");
        updateMovementRule(movementActor);
        return;
      }
    }

    const floor = FLOOR_DEFINITIONS[ui.currentFloor];
    if (!floor) {
      ui.currentFloor = firstFloorForBuilding(ui.currentBuilding || "main");
      return renderMap();
    }

    if (floor.id === BUNKER_CENTER_FLOOR) {
      renderBunkerCenterMap(movementActor);
      return;
    }

    const perspective = getPerspective();
    const reachable = getReachableCellCosts(movementActor, floor.id);
    const exposure =
      session.type === "player" ? getRoleExposure(movementActor.role) : null;
    const warmthAllowed = !exposure || exposure.mapInfo.warmth;
    const warmth = warmthAllowed
      ? getWarmthInfo(perspective.mode, perspective.character, floor.id)
      : { active: false, count: 0, roomId: null };
    const focusCharacter =
      perspective.mode === "admin" ? movementActor : perspective.character;
    const activeRoomId =
      focusCharacter && focusCharacter.floor === floor.id
        ? getRoomId(focusCharacter.floor, focusCharacter.x, focusCharacter.y)
        : null;

    elements.mapGrid.className = "map-grid";
    elements.mapGrid.dataset.floorId = floor.id;
    elements.mapGrid.style.setProperty("--columns", GRID_COLUMNS);
    elements.mapGrid.style.setProperty("--rows", GRID_ROWS);
    elements.mapGrid.classList.toggle(
      "is-player-locked",
      session.type === "player" && movementActor.role === "survivor",
    );
    elements.mapGrid.innerHTML = "";

    const canShowPositions = !exposure || exposure.mapInfo.teamPositions;

    floor.rooms.forEach((roomDefinition) => {
      const roomElement = document.createElement("div");
      roomElement.className = `map-room${roomDefinition.restricted ? " is-restricted-room" : ""}`;
      roomElement.dataset.roomId = roomDefinition.id;
      roomElement.style.gridColumn = `${roomDefinition.x1 + 1} / ${roomDefinition.x2 + 2}`;
      roomElement.style.gridRow = `${roomDefinition.y1 + 1} / ${roomDefinition.y2 + 2}`;
      roomElement.style.setProperty("--room-color", roomDefinition.color);
      const spaceMultiplier = getSpaceBurningMultiplier(
        floor.id,
        roomDefinition.id,
      );
      const burningVisualLevel = getSpaceBurningVisualLevel(
        floor.id,
        roomDefinition.id,
      );
      roomElement.dataset.burningLevel = String(burningVisualLevel);

      if (roomDefinition.id === activeRoomId)
        roomElement.classList.add("is-active-room");
      if (warmth.active && roomDefinition.id === warmth.roomId)
        roomElement.classList.add("is-warm");
      if (floor.id === "1F" && roomDefinition.id === "auditorium")
        roomElement.classList.add("map-room--auditorium-token-layout");

      const roomLabelMarkup = roomDefinition.hideLabel
        ? ""
        : `<span class="map-room__label">${escapeHtml(roomDefinition.label)}</span>`;

      /*
       * 캐릭터 토큰은 아래의 공통 roomId 토큰 레이어에서 한 번만 렌더링합니다.
       * 이 방 DOM은 기존 지도 비율/방 모양/라벨만 담당합니다.
       */
      const roomTokenMarkup = "";

      /*
       * 공간 배속 정보는 오직 관리자 계정의 '관리자 시점'에서만 표시한다.
       * 관리자 계정이라도 생존자/동결체 시점을 선택하면 숨긴다.
       * 실제 생존자/동결체 플레이어 화면에도 절대 표시하지 않는다.
       */
      const canShowAdminSpaceMultiplier =
        session.type === "admin" &&
        perspective.mode === "admin" &&
        spaceMultiplier > 1.0;

      const adminSpaceMultiplierBadge = canShowAdminSpaceMultiplier
        ? `<span class="map-room__admin-space-multiplier" aria-label="공간 배속 ${spaceMultiplier.toFixed(1)}배">
              배속 ×${spaceMultiplier.toFixed(1)}
            </span>`
        : "";

      roomElement.innerHTML =
        roomLabelMarkup + adminSpaceMultiplierBadge + roomTokenMarkup;

      elements.mapGrid.appendChild(roomElement);
    });

    /*
     * 점선 정보 요소는 이동 셀/방이 아닌 순수 장식 오버레이입니다.
     * getRoomId / 이동 판정 / 공간 배속 구역 수에 포함되지 않습니다.
     */
    (floor.decorations || []).forEach((decoration) => {
      const decorationElement = document.createElement("div");
      decorationElement.className = `map-decoration map-decoration--${decoration.type || "info"}`;
      decorationElement.style.gridColumn = `${decoration.x1 + 1} / ${decoration.x2 + 2}`;
      decorationElement.style.gridRow = `${decoration.y1 + 1} / ${decoration.y2 + 2}`;
      decorationElement.textContent = decoration.label || "";
      decorationElement.setAttribute("role", "note");
      elements.mapGrid.appendChild(decorationElement);
    });

    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLUMNS; x += 1) {
        const cell = floor.cells[cellKey(x, y)];
        if (!cell) continue;
        const key = cellKey(x, y);
        const cellElement = document.createElement("button");
        cellElement.type = "button";
        cellElement.className = "map-cell is-visible";
        cellElement.dataset.x = String(x);
        cellElement.dataset.y = String(y);
        cellElement.dataset.roomId = cell.roomId;
        cellElement.style.gridColumn = String(x + 1);
        cellElement.style.gridRow = String(y + 1);
        cellElement.title = `${cell.roomLabel} · X${x + 1}, Y${y + 1}`;
        cellElement.setAttribute("role", "gridcell");
        cellElement.setAttribute("aria-label", cellElement.title);

        if (
          reachable.has(key) &&
          movementActor.floor === floor.id &&
          movementActor.role === "spirit"
        )
          cellElement.classList.add("is-reachable");
        if (
          movementActor.floor === floor.id &&
          movementActor.x === x &&
          movementActor.y === y
        )
          cellElement.classList.add("is-current");
        const cellTransition = getTransitionAt(floor.id, x, y);
        if (cellTransition) {
          cellElement.classList.add("is-transition");

          const transitionType = String(
            cellTransition.type || "",
          ).toLowerCase();

          if (transitionType.includes("stairs")) {
            cellElement.classList.add("is-transition-stairs");
          } else if (
            transitionType.includes("elevator") ||
            transitionType.includes("lift")
          ) {
            cellElement.classList.add("is-transition-elevator");
          } else if (transitionType.includes("freight")) {
            cellElement.classList.add("is-transition-freight");
          }
        }

        appendMapMarkersWithExposure(
          cellElement,
          floor,
          x,
          y,
          perspective,
          exposure,
        );

        /*
         * 캐릭터는 모든 지도에서 roomId 단위 공통 레이어로 렌더링합니다.
         * 셀 버튼에는 이동/조사/층 이동 UI만 남깁니다.
         */

        /*
         * 동결체 본인이 실제 계단/비상계단 방에 있을 때만
         * 토큰 오른쪽에 '층 이동' 버튼을 표시한다.
         *
         * 주의:
         * app.js 안에는 renderMap()이 여러 번 정의되어 있고
         * 브라우저에서는 가장 마지막 정의가 실제로 사용된다.
         * 이전 수정은 앞쪽 renderMap에 들어가 최종 함수에 덮여서
         * 버튼이 생성되지 않고 있었다.
         */
        const isCurrentSpiritTokenCell =
          session.type === "player" &&
          movementActor.role === "spirit" &&
          movementActor.floor === floor.id &&
          movementActor.x === x &&
          movementActor.y === y;

        if (
          isCurrentSpiritTokenCell &&
          getStairTransitionForCharacter(movementActor)
        ) {
          const floorMoveSideClass =
            x >= GRID_COLUMNS - 3 ? " is-left" : " is-right";

          cellElement.insertAdjacentHTML(
            "beforeend",
            `<span
              class="character-token__floor-move-button${floorMoveSideClass}"
              data-open-stair-floor-move
              role="button"
              tabindex="0"
              aria-label="층 이동"
            >층 이동</span>`,
          );
        }

        const isCurrentPlayerTokenCell =
          session.type === "player" &&
          movementActor.role === "spirit" &&
          movementActor.floor === floor.id &&
          movementActor.x === x &&
          movementActor.y === y;
        const bunkerAccess = isCurrentPlayerTokenCell
          ? getBunkerAccessForCharacter(movementActor)
          : null;
        const bunkerTransfer = isCurrentPlayerTokenCell
          ? getBunkerTransferForCharacter(movementActor)
          : null;
        const bunkerSurfaceExit = isCurrentPlayerTokenCell
          ? getBunkerSurfaceExitForCharacter(movementActor)
          : null;
        const bunkerCenterAccess = isCurrentPlayerTokenCell
          ? getBunkerCenterAccessForCharacter(movementActor)
          : null;

        if (bunkerAccess) {
          const bunkerMoveSideClass =
            x >= GRID_COLUMNS - 3 ? " is-left" : " is-right";

          cellElement.insertAdjacentHTML(
            "beforeend",
            `<span
              class="character-token__floor-move-button character-token__bunker-move-button${bunkerMoveSideClass}"
              data-open-bunker-descent
              role="button"
              tabindex="0"
              aria-label="지하벙커 내려가기"
            >내려가기</span>`,
          );
        }

        if (bunkerTransfer) {
          const bunkerMoveSideClass =
            x >= GRID_COLUMNS - 3 ? " is-left" : " is-right";
          cellElement.insertAdjacentHTML(
            "beforeend",
            `<span
              class="character-token__floor-move-button character-token__bunker-transfer-button${bunkerMoveSideClass}"
              data-open-bunker-transfer
              role="button"
              tabindex="0"
              aria-label="옆 지하벙커로 이동"
            >이동</span>`,
          );
        }

        if (bunkerSurfaceExit) {
          const bunkerMoveSideClass =
            x >= GRID_COLUMNS - 3 ? " is-left" : " is-right";
          cellElement.insertAdjacentHTML(
            "beforeend",
            `<span
              class="character-token__floor-move-button character-token__bunker-ascent-button${bunkerMoveSideClass}"
              data-open-bunker-ascent
              role="button"
              tabindex="0"
              aria-label="지상으로 올라가기"
            >올라가기</span>`,
          );
        }

        if (bunkerCenterAccess) {
          const bunkerMoveSideClass =
            x >= GRID_COLUMNS - 3 ? " is-left" : " is-right";
          cellElement.insertAdjacentHTML(
            "beforeend",
            `<span
              class="character-token__floor-move-button character-token__bunker-center-button${bunkerMoveSideClass}"
              data-open-bunker-center-entry
              role="button"
              tabindex="0"
              aria-label="지하벙커 중앙 구역으로 이동"
            >이동</span>`,
          );
        }

        elements.mapGrid.appendChild(cellElement);
      }
    }

    /*
     * 모든 층/모든 방의 캐릭터를 동일한 방식으로 표시합니다.
     * floor.rooms에 직접 선언되지 않은 defaultRoom도 floor.cells의 roomId를
     * 기준으로 포함되므로, 지도 개편 뒤 같은 공간이 여러 셀로 갈라져 보이는
     * 문제를 방지합니다.
     */
    getFloorRoomTokenZones(floor).forEach((zone) => {
      const roomCharacters = getVisibleCharactersInRoomId(
        floor.id,
        zone.roomId,
        perspective,
      ).filter(
        (character) =>
          Number(character.id) === Number(movementActor?.id) ||
          canShowPositions ||
          zone.roomId === activeRoomId,
      );

      if (!roomCharacters.length) return;

      const roomTokenLimit = mapVisibleTokenLimitForZone(zone);
      const tokenSet = splitMapTokenCharacters(
        roomCharacters,
        perspective,
        movementActor,
        roomTokenLimit,
      );

      const zoneElement = document.createElement("div");
      zoneElement.className = "map-room-token-zone";
      zoneElement.dataset.roomId = zone.roomId;
      zoneElement.dataset.roomColumns = String(zone.columns);
      zoneElement.dataset.roomRows = String(zone.rows);
      zoneElement.dataset.roomCells = String(zone.cellCount);
      zoneElement.dataset.tokenLimit = String(roomTokenLimit);
      zoneElement.style.gridColumn = `${zone.x1 + 1} / ${zone.x2 + 2}`;
      zoneElement.style.gridRow = `${zone.y1 + 1} / ${zone.y2 + 2}`;

      if (zone.columns >= 3) zoneElement.classList.add("is-wide");
      if (zone.columns <= 2 || zone.rows <= 2)
        zoneElement.classList.add("is-compact");
      if (floor.id === "1F" && zone.roomId === "auditorium")
        zoneElement.classList.add("is-auditorium");

      const tokenItems = tokenSet.visible
        .map((character) =>
          tokenMarkup(
            character,
            Number(character.id) === Number(movementActor?.id),
          ),
        )
        .join("");

      if (zoneElement.classList.contains("is-auditorium")) {
        const splitIndex = Math.ceil(tokenSet.visible.length / 2);
        const upper = tokenSet.visible.slice(0, splitIndex);
        const lower = tokenSet.visible.slice(splitIndex);
        zoneElement.innerHTML = `
          <div class="map-room-token-zone__tokens map-room-token-zone__tokens--upper">
            ${upper
              .map((character) =>
                tokenMarkup(
                  character,
                  Number(character.id) === Number(movementActor?.id),
                ),
              )
              .join("")}
          </div>
          <div class="map-room-token-zone__tokens map-room-token-zone__tokens--lower">
            ${lower
              .map((character) =>
                tokenMarkup(
                  character,
                  Number(character.id) === Number(movementActor?.id),
                ),
              )
              .join("")}
          </div>
          ${mapTokenOverflowMarkup(tokenSet.hidden)}
        `;
      } else {
        zoneElement.innerHTML = `
          <div class="map-room-token-zone__tokens">${tokenItems}</div>
          ${mapTokenOverflowMarkup(tokenSet.hidden)}
        `;
      }

      elements.mapGrid.appendChild(zoneElement);
    });

    window.requestAnimationFrame(() => {
      positionAllMapTokenOverflowBadges();
      positionAllOpenMapTokenOverflowLists();
    });

    renderWarmthBanner(warmth, perspective);
    updateMovementRule(movementActor);
  }

  function renderAdminRoster() {
    const filter = ui.adminRosterFilter || "all";
    ui.adminRosterFilter = filter;
    const filteredCharacters = state.characters.filter(
      (character) => filter === "all" || character.role === filter,
    );

    const cards = filteredCharacters
      .map((character) => {
        const movementText =
          character.role === "spirit"
            ? `행동력 ${character.ap} / ${character.maxAp}`
            : `체력 ${characterHealthText(character)}`;

        return `
        <article
          class="character-card ${character.id === ui.selectedCharacterId ? "is-selected" : ""}"
          data-select-character="${character.id}"
          tabindex="0"
          aria-label="${escapeHtml(character.name)} 선택"
        >
          ${avatarMarkup(character)}
          <span class="character-card__main">
            <span class="character-card__title">
              
              <strong>${escapeHtml(character.name)}</strong>
              ${roleChipMarkup(character.role)}
            </span>
            <span class="character-card__meta">${escapeHtml(characterLocationText(character))}</span>
            <span class="character-card__submeta">${movementText}</span>
            ${infectionClockMarkup(character, true)}
            <span class="character-card__teams">${teamChipsMarkup(character.id)}</span>
          </span>
          <span class="character-card__statuses">
            <button
              type="button"
              class="character-card__manage-button"
              data-manage-character="${character.id}"
            >
              관리
            </button>
          </span>
        </article>`;
      })
      .join("");

    const teamCards = state.teams.length
      ? state.teams
          .map((team) => {
            const members = team.memberIds.map(getCharacter).filter(Boolean);
            const visible = team.visible !== false;
            return `
            <article
              class="compact-team-card ${visible ? "" : "is-visibility-off"}"
              style="--team-color:${team.color}"
            >
              <div class="compact-team-card__head">
                <div>
                  <strong>${escapeHtml(team.name)}</strong>
                  <span>${members.length}명 · ${visible ? "위치 공유 중" : "공유 숨김"}</span>
                </div>
                <div class="compact-team-card__actions">
                  <button
                    type="button"
                    class="team-eye-button ${visible ? "is-on" : ""}"
                    data-toggle-team-visibility="${team.id}"
                    title="그룹은 유지하고 위치 공유만 ${visible ? "끕니다" : "켭니다"}"
                  >
                    ${visible ? "◉" : "○"}
                  </button>
                  <button type="button" class="compact-icon-button" data-dissolve-team="${team.id}">
                    해제
                  </button>
                </div>
              </div>
              <div class="compact-team-card__members">
                ${members.map((member) => `<button type="button" data-select-character="${member.id}">${escapeHtml(member.name)}</button>`).join("")}
              </div>
            </article>`;
          })
          .join("")
      : `<div class="compact-empty">편성된 팀이 없습니다.</div>`;

    elements.leftSidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>캐릭터 현황</h2>
        <span class="status-pill">${filteredCharacters.length} / ${state.characters.length}명</span>
      </div>
      <div class="sidebar-body">
        <div class="sidebar-roster-filter" aria-label="캐릭터 현황 필터">
          <button type="button" data-sidebar-roster-filter="all" class="${filter === "all" ? "is-active" : ""}">전체</button>
          <button type="button" data-sidebar-roster-filter="spirit" class="${filter === "spirit" ? "is-active" : ""}">동결체</button>
          <button type="button" data-sidebar-roster-filter="survivor" class="${filter === "survivor" ? "is-active" : ""}">생존자</button>
        </div>
        <div class="roster-list">
          ${cards || emptyStateMarkup("해당 분류의 캐릭터가 없습니다.")}
        </div>
        <section class="left-team-section">
          <div class="left-team-section__head">
            <div>
              <p class="eyebrow">TEAM CONTROL</p>
              <h3>팀 편성 · 위치 공유</h3>
            </div>
            <button type="button" class="button button--small button--primary" data-open-team-manager>
              편성·수정
            </button>
          </div>
          <div class="compact-team-list">${teamCards}</div>
        </section>
      </div>`;
  }

  function jumpToCurrentTokenLocation() {
    const actor = getMovementActor();
    if (!actor) {
      showToast("현재 위치를 확인할 캐릭터가 없습니다.");
      return;
    }

    ui.mapMode = "floor";
    ui.currentFloor = actor.floor;
    ui.currentBuilding = buildingFromFloorKey(actor.floor);

    closeCampusMapPopup();
    renderAll();

    /*
     * 건물/층 화면을 먼저 전환한 뒤,
     * 지도 안에서도 현재 토큰이 보이는 위치까지 자동으로 맞춥니다.
     * 관리자에서는 현재 선택된 캐릭터,
     * 플레이어에서는 본인 캐릭터가 기준입니다.
     */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const token = elements.mapGrid?.querySelector(
          `[data-token-character="${actor.id}"]`,
        );
        const currentCell =
          elements.mapGrid?.querySelector(".map-cell.is-current");
        const target = token || currentCell;

        if (target?.scrollIntoView) {
          target.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          });
          return;
        }

        const viewport = elements.mapGrid?.closest(".map-viewport");
        if (!viewport || !elements.mapGrid) return;

        viewport.scrollTo({
          left: Math.max(
            0,
            (elements.mapGrid.scrollWidth - viewport.clientWidth) / 2,
          ),
          top: Math.max(
            0,
            (elements.mapGrid.scrollHeight - viewport.clientHeight) / 2,
          ),
          behavior: "smooth",
        });
      });
    });
  }

  function renderSelectedSummary() {
    if (ui.mapMode === "site") {
      elements.selectedCharacterSummary.innerHTML = `
        <div class="campus-summary">
          <strong>학술원 전체 지도</strong>
          <span>건물을 선택하면 층별 상세 지도로 이동합니다.</span>
        </div>`;
      return;
    }

    const selected = getMovementActor();
    const visibleTeams = getVisibleTeamsForCharacter(selected.id);
    const allTeams =
      session.type === "admin"
        ? getTeamsForCharacter(selected.id)
        : visibleTeams;
    const teamText = allTeams.length
      ? ` · 그룹 ${allTeams.map((team) => `${team.name}${team.visible === false ? "(숨김)" : ""}`).join(", ")}`
      : " · 미편성";
    if (session.type === "admin") {
      const movement =
        selected.role === "spirit"
          ? `행동력 ${selected.ap} / ${selected.maxAp}`
          : "위치 이동은 운영진만 가능";
      const healthText =
        selected.role === "survivor"
          ? ` · 체력 ${characterHealthText(selected)}`
          : "";
      elements.selectedCharacterSummary.innerHTML = `${avatarMarkup(selected)}<div><h3>${escapeHtml(selected.name)} ${roleChipMarkup(selected.role)}</h3><p>${escapeHtml(characterLocationText(selected))}${healthText} · ${movement}${teamText}${visibleTeams.length ? "" : allTeams.length ? " · 원격 공유 없음" : ""}</p>${infectionClockMarkup(selected, true)}</div>`;
      return;
    }
    const playerDetail =
      selected.role === "spirit"
        ? ` · 행동력 ${selected.ap} / ${selected.maxAp}`
        : "";
    const playerHealthText =
      selected.role === "survivor"
        ? ` · 체력 ${characterHealthText(selected)}`
        : "";
    elements.selectedCharacterSummary.innerHTML = `${avatarMarkup(selected)}<div><h3>${escapeHtml(selected.name)} ${roleChipMarkup(selected.role)}</h3><p>${escapeHtml(characterLocationText(selected))}${playerHealthText}${playerDetail}${teamText}</p></div>`;
  }

  function renderAll() {
    if (!session) return;

    applySessionTheme();
    const isAdmin = session.type === "admin";
    document
      .querySelectorAll(".admin-only")
      .forEach((node) => node.classList.toggle("is-hidden", !isAdmin));

    elements.adminOperationsButton.classList.toggle(
      "is-active",
      isAdmin && ui.operationsOpen,
    );
    elements.adminOperationsButton.textContent = ui.operationsOpen
      ? "지도 페이지"
      : "관리 페이지";
    elements.adminOperationsButton.setAttribute(
      "aria-label",
      ui.operationsOpen ? "지도 페이지로 이동" : "관리 페이지로 이동",
    );

    elements.workspace.classList.toggle("workspace--admin", isAdmin);
    elements.workspace.classList.toggle(
      "is-hidden",
      isAdmin && ui.operationsOpen,
    );
    elements.adminOperationsView.classList.toggle(
      "is-hidden",
      !isAdmin || !ui.operationsOpen,
    );
    elements.rightSidebar.classList.toggle("is-hidden", isAdmin);

    renderSessionBadge();
    renderViewModeNav();
    renderEventButton();

    const showSurvivorHelp =
      session.type === "player" &&
      getCharacter(session.characterId)?.role === "survivor";
    elements.survivorHelpButton?.classList.toggle(
      "is-hidden",
      !showSurvivorHelp,
    );

    if (isAdmin && ui.operationsOpen) {
      renderAdminOperationsPage();
      return;
    }

    if (ui.mapMode === "site") ui.mapMode = "floor";
    const siteMode = false;
    elements.workspace.classList.remove("workspace--site-map");
    elements.siteMapButton?.classList.remove("is-hidden");
    elements.mapViewSection?.classList.toggle("is-hidden", !isAdmin);
    elements.viewModeNav?.classList.toggle("is-hidden", !isAdmin);

    const currentBuilding =
      BUILDING_DEFINITIONS[ui.currentBuilding] || BUILDING_DEFINITIONS.main;
    if (elements.mapEyebrow)
      elements.mapEyebrow.textContent = siteMode
        ? "학술원 부지 지도"
        : "층별 상세 지도";
    const mapTitle = document.querySelector("#mapTitle");
    if (mapTitle) {
      mapTitle.innerHTML = siteMode
        ? `학술원 부지 안내`
        : `${escapeHtml(currentBuilding.name)} <span id="currentFloorLabel">${escapeHtml(floorLabelFromKey(ui.currentFloor))}</span>`;
      elements.currentFloorLabel = document.querySelector("#currentFloorLabel");
    }

    document
      .querySelector(".map-floor-section")
      ?.classList.toggle("is-hidden", siteMode);
    document
      .querySelector(".map-panel__footer")
      ?.classList.toggle("is-site-mode", siteMode);

    renderLeftSidebar();
    if (!isAdmin) renderRightSidebar();
    renderFloorTabs();
    renderMap();
    renderSelectedSummary();
  }

  function bunkerAccessKey(floorId, roomId) {
    return `${floorId}:${roomId}`;
  }

  function getBunkerAccessForCharacter(character) {
    if (!character || character.role !== "spirit") return null;

    const bunkerEnabledForRole =
      character && state.bunkerAccessByRole?.[character.role] === true;

    if (!character || !bunkerEnabledForRole || isBunkerFloor(character.floor))
      return null;

    const roomId = getRoomId(character.floor, character.x, character.y);
    const destinations =
      BUNKER_ACCESS_POINTS[bunkerAccessKey(character.floor, roomId)] || null;

    if (!destinations?.length) return null;

    return {
      sourceFloor: character.floor,
      sourceRoomId: roomId,
      destinations: [...destinations],
    };
  }

  function bunkerDescentArrivalKey(access, targetFloor) {
    return `${access.sourceFloor}:${access.sourceRoomId}:${targetFloor}`;
  }

  function getBunkerDescentArrival(access, targetFloor) {
    return (
      BUNKER_DESCENT_ARRIVAL_POINTS[
        bunkerDescentArrivalKey(access, targetFloor)
      ] || null
    );
  }

  function getBunkerSurfaceExitForCharacter(character) {
    if (
      !character ||
      character.role !== "spirit" ||
      !isBunkerFloor(character.floor)
    )
      return null;
    const roomId = getRoomId(character.floor, character.x, character.y);
    return BUNKER_SURFACE_EXITS[`${character.floor}:${roomId}`] || null;
  }

  function getBunkerTransferForCharacter(character) {
    if (
      !character ||
      character.role !== "spirit" ||
      !isBunkerFloor(character.floor)
    )
      return null;
    const roomId = getRoomId(character.floor, character.x, character.y);
    return BUNKER_TRANSFER_ROOMS[`${character.floor}:${roomId}`] || null;
  }

  function getBunkerCenterAccessForCharacter(character) {
    if (
      !character ||
      character.role !== "spirit" ||
      character.floor !== "bunker:A"
    )
      return null;

    // 관리자 환경설정에서 동결체 화면의 '지하벙커 중앙'이 비공개라면
    // A 구역의 벙커 중앙 출입입구에 있어도 이동 버튼 자체를 노출하지 않는다.
    const centerExposed =
      getRoleExposure(character.role).floors[BUNKER_CENTER_FLOOR] !== false;
    if (!centerExposed) return null;

    const roomId = getRoomId(character.floor, character.x, character.y);
    if (roomId !== BUNKER_CENTER_ENTRY_ROOM) return null;
    return { targetFloor: BUNKER_CENTER_FLOOR };
  }

  function bunkerLabel(floorId) {
    if (floorId === BUNKER_CENTER_FLOOR) return "지하벙커 중앙";
    return `지하벙커 ${floorLabelFromKey(floorId)}`;
  }

  function requestBunkerDescent(character) {
    if (session?.type !== "player" || !character || character.role !== "spirit")
      return;

    const access = getBunkerAccessForCharacter(character);
    if (!access) return;

    if (access.destinations.length === 1) {
      const targetFloor = access.destinations[0];
      if (character.role === "spirit") {
        requestSpiritBunkerDescentConfirmation(character, targetFloor);
      } else {
        moveCharacterToBunker(character, targetFloor);
      }
      return;
    }

    openModal({
      eyebrow: "UNDERGROUND BUNKER",
      title: "이동할 지하벙커를 선택해 주세요.",
      body: `<div class="stair-floor-choice">
        <p class="stair-floor-choice__help">문서보관실에서 연결된 지하벙커를 선택합니다.</p>
        <div class="stair-floor-choice__grid">
          ${access.destinations
            .map(
              (floorId) =>
                `<button type="button" class="stair-floor-choice__button" data-bunker-destination="${floorId}"><strong>${escapeHtml(bunkerLabel(floorId))}</strong></button>`,
            )
            .join("")}
        </div>
        <p class="stair-floor-choice__note">${character.role === "spirit" ? `동결체는 내려갈 때 행동력 ${BUNKER_DESCENT_COST}가 차감됩니다.` : "생존자는 행동력 차감 없이 내려갑니다."}</p>
      </div>`,
      footer: `<button type="button" class="button" data-modal-close>취소</button>`,
    });

    elements.modalBody
      .querySelectorAll("[data-bunker-destination]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const targetFloor = button.dataset.bunkerDestination;
          if (character.role === "spirit") {
            requestSpiritBunkerDescentConfirmation(character, targetFloor);
          } else {
            moveCharacterToBunker(character, targetFloor);
          }
        });
      });
  }

  function requestSpiritBunkerDescentConfirmation(character, targetFloor) {
    const access = getBunkerAccessForCharacter(character);
    if (!access || !access.destinations.includes(targetFloor)) {
      closeModal();
      showToast("현재 위치에서는 지하벙커로 내려갈 수 없습니다.");
      return;
    }

    if (character.ap < BUNKER_DESCENT_COST) {
      closeModal();
      showToast(`행동력이 부족합니다. ${BUNKER_DESCENT_COST}가 필요합니다.`);
      return;
    }

    const fromRoom = getRoomLabel(character.floor, character.x, character.y);

    openModal({
      eyebrow: "SPIRIT MOVEMENT",
      title: "동결체 이동 확인",
      body: `
        <div class="movement-confirmation">
          <div class="movement-confirmation__route">
            <span>${escapeHtml(fromRoom)}</span><strong>→</strong><span>${escapeHtml(bunkerLabel(targetFloor))}</span>
          </div>
          <div class="movement-confirmation__cost">
            <span>소모 행동력</span>
            <strong>${BUNKER_DESCENT_COST}</strong>
          </div>
          <p>지상 진입구에서 지하벙커로 내려가며 행동력 ${BUNKER_DESCENT_COST}가 소모됩니다.</p>
          <p><strong>정말 이동하시겠습니까?</strong></p>
        </div>`,
      footer: `
        <button type="button" class="button" data-modal-close>취소</button>
        <button type="button" class="button button--primary" data-confirm-bunker-descent>이동 진행</button>`,
    });

    elements.modalFooter
      ?.querySelector("[data-confirm-bunker-descent]")
      ?.addEventListener("click", () =>
        moveCharacterToBunker(character, targetFloor),
      );
  }

  function moveCharacterToBunker(character, targetFloor) {
    if (!character || character.role !== "spirit") return;

    const access = getBunkerAccessForCharacter(character);
    if (!access || !access.destinations.includes(targetFloor)) {
      closeModal();
      showToast("현재 위치에서는 지하벙커로 내려갈 수 없습니다.");
      return;
    }

    const destination = getBunkerDescentArrival(access, targetFloor);
    if (!destination || !FLOOR_DEFINITIONS[targetFloor]) {
      closeModal();
      showToast("연결된 지하벙커 지도를 찾을 수 없습니다.");
      return;
    }

    const cost = character.role === "spirit" ? BUNKER_DESCENT_COST : 0;
    if (cost > 0 && character.ap < cost) {
      closeModal();
      showToast(`행동력이 부족합니다. ${BUNKER_DESCENT_COST}가 필요합니다.`);
      return;
    }

    // 원격 플레이에서는 위치/AP를 로컬에서 먼저 바꾸지 않습니다.
    // 서버 move-spirit가 지하벙커 진입을 검증하고 저장한 뒤 최신 상태를 돌려줍니다.
    if (session?.type === "player" && session?.token) {
      void performRemoteSpiritMove(
        character,
        targetFloor,
        destination.x,
        destination.y,
      );
      return;
    }

    settleAllSurvivorFreezeClocks();

    const fromFloor = character.floor;
    const fromRoom = getRoomLabel(character.floor, character.x, character.y);

    if (cost > 0) character.ap -= cost;
    character.floor = targetFloor;
    character.x = destination.x;
    character.y = destination.y;

    ui.currentFloor = targetFloor;
    ui.currentBuilding = buildingFromFloorKey(targetFloor);
    ui.mapMode = "floor";

    const toRoom = getRoomLabel(character.floor, character.x, character.y);

    if (character.role === "spirit") {
      recordSpiritMovement(character, {
        fromFloor,
        fromRoom,
        toFloor: targetFloor,
        toRoom,
        cost,
        source: "지하벙커 이동",
      });
    }

    addLog(
      `${character.name}이(가) ${fromRoom}에서 ${bunkerLabel(targetFloor)}(으)로 내려갔습니다.${cost ? ` 행동력 −${cost}.` : " 행동력 미소모."}`,
    );

    persistState();
    closeModal();
    renderAll();
    showToast(
      cost
        ? `${bunkerLabel(targetFloor)}로 내려갔습니다. 행동력 ${cost} 차감.`
        : `${bunkerLabel(targetFloor)}로 내려갔습니다.`,
    );
  }

  function moveCharacterToBunkerCenter(character) {
    if (!character || character.role !== "spirit") return;

    const access = getBunkerCenterAccessForCharacter(character);
    if (!access || !FLOOR_DEFINITIONS[BUNKER_CENTER_FLOOR]) {
      showToast("현재 위치에서는 중앙 구역으로 이동할 수 없습니다.");
      return;
    }

    if (session?.type === "player" && session?.token) {
      void performRemoteSpiritMove(
        character,
        BUNKER_CENTER_FLOOR,
        BUNKER_CENTER_POSITION.x,
        BUNKER_CENTER_POSITION.y,
      );
      return;
    }

    settleAllSurvivorFreezeClocks();
    const fromFloor = character.floor;
    const fromRoom = getRoomLabel(character.floor, character.x, character.y);

    character.floor = BUNKER_CENTER_FLOOR;
    character.x = BUNKER_CENTER_POSITION.x;
    character.y = BUNKER_CENTER_POSITION.y;
    ui.currentFloor = BUNKER_CENTER_FLOOR;
    ui.currentBuilding = buildingFromFloorKey(BUNKER_CENTER_FLOOR);
    ui.mapMode = "floor";

    if (character.role === "spirit") {
      recordSpiritMovement(character, {
        fromFloor,
        fromRoom,
        toFloor: BUNKER_CENTER_FLOOR,
        toRoom: "중앙 구역",
        cost: 0,
        source: "벙커 중앙 출입입구",
      });
    }

    addLog(
      `${character.name}이(가) 벙커 중앙 출입입구를 통해 지하벙커 중앙 구역으로 이동했습니다.`,
    );
    persistState();
    closeModal();
    renderAll();
  }

  function moveCharacterFromBunkerCenter(character) {
    if (!character || character.role !== "spirit") return;

    if (character.floor !== BUNKER_CENTER_FLOOR) {
      showToast("현재 위치에서는 A 구역으로 이동할 수 없습니다.");
      return;
    }

    if (session?.type === "player" && session?.token) {
      void performRemoteSpiritMove(
        character,
        "bunker:A",
        BUNKER_CENTER_RETURN_POSITION.x,
        BUNKER_CENTER_RETURN_POSITION.y,
      );
      return;
    }

    settleAllSurvivorFreezeClocks();
    const fromFloor = character.floor;
    const fromRoom = "중앙 구역";

    character.floor = "bunker:A";
    character.x = BUNKER_CENTER_RETURN_POSITION.x;
    character.y = BUNKER_CENTER_RETURN_POSITION.y;
    ui.currentFloor = "bunker:A";
    ui.currentBuilding = buildingFromFloorKey("bunker:A");
    ui.mapMode = "floor";

    if (character.role === "spirit") {
      recordSpiritMovement(character, {
        fromFloor,
        fromRoom,
        toFloor: "bunker:A",
        toRoom: getRoomLabel("bunker:A", character.x, character.y),
        cost: 0,
        source: "벙커 중앙 출입입구",
      });
    }

    addLog(
      `${character.name}이(가) 지하벙커 중앙 구역에서 A 구역의 벙커 중앙 출입입구로 이동했습니다.`,
    );
    persistState();
    closeModal();
    renderAll();
  }

  function requestBunkerTransfer(character) {
    if (!character || character.role !== "spirit") return;

    const transfer = getBunkerTransferForCharacter(character);
    if (!transfer) return;

    if (character.role !== "spirit") {
      moveCharacterBetweenBunkers(character, transfer);
      return;
    }

    if (character.ap < BUNKER_TRANSFER_COST) {
      closeModal();
      showToast(`행동력이 부족합니다. ${BUNKER_TRANSFER_COST}가 필요합니다.`);
      return;
    }

    openModal({
      eyebrow: "SPIRIT MOVEMENT",
      title: "동결체 이동 확인",
      body: `
        <div class="movement-confirmation">
          <div class="movement-confirmation__route">
            <span>${escapeHtml(bunkerLabel(character.floor))}</span><strong>→</strong><span>${escapeHtml(bunkerLabel(transfer.targetFloor))}</span>
          </div>
          <div class="movement-confirmation__cost">
            <span>소모 행동력</span>
            <strong>${BUNKER_TRANSFER_COST}</strong>
          </div>
          <p>벙커 이동문을 통과해 옆 구역으로 이동하며 행동력 ${BUNKER_TRANSFER_COST}이 소모됩니다.</p>
          <p><strong>정말 이동하시겠습니까?</strong></p>
        </div>`,
      footer: `
        <button type="button" class="button" data-modal-close>취소</button>
        <button type="button" class="button button--primary" data-confirm-bunker-transfer>이동 진행</button>`,
    });

    elements.modalFooter
      ?.querySelector("[data-confirm-bunker-transfer]")
      ?.addEventListener("click", () =>
        moveCharacterBetweenBunkers(character, transfer),
      );
  }

  function moveCharacterBetweenBunkers(character, transfer) {
    if (!character || character.role !== "spirit") return;

    const currentTransfer = getBunkerTransferForCharacter(character);
    if (
      !currentTransfer ||
      currentTransfer.targetFloor !== transfer.targetFloor ||
      currentTransfer.targetX !== transfer.targetX ||
      currentTransfer.targetY !== transfer.targetY
    ) {
      closeModal();
      showToast("현재 위치에서는 벙커 이동문을 사용할 수 없습니다.");
      return;
    }

    if (!FLOOR_DEFINITIONS[transfer.targetFloor]) {
      closeModal();
      showToast("연결된 벙커 지도를 찾을 수 없습니다.");
      return;
    }

    const cost = character.role === "spirit" ? BUNKER_TRANSFER_COST : 0;
    if (cost && character.ap < cost) {
      closeModal();
      showToast(`행동력이 부족합니다. ${BUNKER_TRANSFER_COST}가 필요합니다.`);
      return;
    }

    // 벙커 A/B/C 간 이동도 반드시 서버가 확정합니다.
    // 예전처럼 로컬 위치만 먼저 바꾸면 Realtime 갱신 때 서버의 지상 위치로 되돌아갑니다.
    if (session?.type === "player" && session?.token) {
      void performRemoteSpiritMove(
        character,
        transfer.targetFloor,
        transfer.targetX,
        transfer.targetY,
      );
      return;
    }

    settleAllSurvivorFreezeClocks();

    const fromFloor = character.floor;
    const fromRoom = getRoomLabel(character.floor, character.x, character.y);

    if (cost) character.ap -= cost;
    character.floor = transfer.targetFloor;
    character.x = transfer.targetX;
    character.y = transfer.targetY;

    ui.currentFloor = transfer.targetFloor;
    ui.currentBuilding = buildingFromFloorKey(transfer.targetFloor);
    ui.mapMode = "floor";

    const toRoom = getRoomLabel(character.floor, character.x, character.y);

    if (character.role === "spirit") {
      recordSpiritMovement(character, {
        fromFloor,
        fromRoom,
        toFloor: character.floor,
        toRoom,
        cost,
        source: "벙커 이동문",
      });
    }

    addLog(
      `${character.name}이(가) 벙커 이동문을 이용해 ${bunkerLabel(fromFloor)}에서 ${bunkerLabel(character.floor)}(으)로 이동했습니다.${cost ? ` 행동력 −${cost}.` : " 행동력 미소모."}`,
    );

    persistState();
    closeModal();
    renderAll();
    showToast(
      cost
        ? `${bunkerLabel(character.floor)}로 이동했습니다. 행동력 ${cost} 차감.`
        : `${bunkerLabel(character.floor)}로 이동했습니다.`,
    );
  }

  function requestBunkerAscent(character) {
    if (!character || character.role !== "spirit") return;

    const exit = getBunkerSurfaceExitForCharacter(character);
    if (!exit) return;

    if (character.role === "spirit") {
      openModal({
        eyebrow: "SPIRIT MOVEMENT",
        title: "동결체 이동 확인",
        body: `
          <div class="movement-confirmation">
            <div class="movement-confirmation__route">
              <span>${escapeHtml(bunkerLabel(character.floor))}</span><strong>→</strong><span>${escapeHtml(exit.label)}</span>
            </div>
            <div class="movement-confirmation__cost">
              <span>소모 행동력</span>
              <strong>0</strong>
            </div>
            <p>보안계단을 이용해 지상 연결 지점으로 올라갑니다. 행동력은 소모되지 않습니다.</p>
            <p><strong>정말 이동하시겠습니까?</strong></p>
          </div>`,
        footer: `
          <button type="button" class="button" data-modal-close>취소</button>
          <button type="button" class="button button--primary" data-confirm-bunker-ascent>이동 진행</button>`,
      });
    } else {
      openModal({
        eyebrow: "UNDERGROUND BUNKER",
        title: "지상으로 올라가시겠습니까?",
        body: `<div class="stair-floor-choice"><p class="stair-floor-choice__help">현재 계단은 <strong>${escapeHtml(exit.label)}</strong>으로 연결됩니다.</p></div>`,
        footer: `<button type="button" class="button" data-modal-close>취소</button><button type="button" class="button button--primary" data-confirm-bunker-ascent>올라가기</button>`,
      });
    }

    elements.modalFooter
      ?.querySelector("[data-confirm-bunker-ascent]")
      ?.addEventListener("click", () =>
        moveCharacterToSurface(character, exit),
      );
  }

  function moveCharacterToSurface(character, exit) {
    if (!character || character.role !== "spirit") return;

    const currentExit = getBunkerSurfaceExitForCharacter(character);
    if (
      !currentExit ||
      currentExit.floor !== exit.floor ||
      currentExit.x !== exit.x ||
      currentExit.y !== exit.y
    ) {
      closeModal();
      showToast("현재 위치에서는 지상으로 올라갈 수 없습니다.");
      return;
    }

    if (!FLOOR_DEFINITIONS[exit.floor]) {
      closeModal();
      showToast("연결된 지상 지도를 찾을 수 없습니다.");
      return;
    }

    if (session?.type === "player" && session?.token) {
      void performRemoteSpiritMove(
        character,
        exit.floor,
        exit.x,
        exit.y,
      );
      return;
    }

    settleAllSurvivorFreezeClocks();

    const fromFloor = character.floor;
    const fromRoom = getRoomLabel(character.floor, character.x, character.y);

    character.floor = exit.floor;
    character.x = exit.x;
    character.y = exit.y;

    ui.currentFloor = exit.floor;
    ui.currentBuilding = buildingFromFloorKey(exit.floor);
    ui.mapMode = "floor";

    const toRoom = getRoomLabel(character.floor, character.x, character.y);

    if (character.role === "spirit") {
      recordSpiritMovement(character, {
        fromFloor,
        fromRoom,
        toFloor: character.floor,
        toRoom,
        cost: 0,
        source: "벙커 계단",
      });
    }

    addLog(
      `${character.name}이(가) ${bunkerLabel(fromFloor)} 계단을 이용해 ${exit.label}(으)로 올라갔습니다. 행동력 미소모.`,
    );

    persistState();
    closeModal();
    renderAll();
    showToast(`${exit.label}(으)로 올라갔습니다.`);
  }

  function isStairTransition(transition) {
    return Boolean(
      transition &&
      String(transition.type || "")
        .toLowerCase()
        .includes("stairs"),
    );
  }

  function findMatchingStairTransition(targetFloor, sourceTransition) {
    const transitions = FLOOR_DEFINITIONS[targetFloor]?.transitions || [];
    const stairTransitions = transitions.filter(isStairTransition);

    if (!stairTransitions.length) return null;

    return (
      stairTransitions.find(
        (transition) => transition.type === sourceTransition?.type,
      ) || stairTransitions[0]
    );
  }

  function buildingArrivalPoint(buildingId) {
    const floor = firstFloorForBuilding(buildingId);

    // 각 건물 1층의 중앙 공용 공간으로 진입시킨다.
    // 건물 간 이동은 현재 좌표와 무관하게 고정 행동력 5를 사용한다.
    const preferred = { x: 5, y: 4 };
    const floorDefinition = FLOOR_DEFINITIONS[floor];

    if (floorDefinition?.cells?.[cellKey(preferred.x, preferred.y)]) {
      return { floor, ...preferred };
    }

    return { floor, x: 0, y: 0 };
  }

  function handleFloorTabClick(event) {
    const button = event.target.closest("[data-floor]");
    if (!button) return;

    const targetFloor = button.dataset.floor;
    if (targetFloor === ui.currentFloor) return;

    const targetBuilding = buildingFromFloorKey(targetFloor);

    if (session.type === "admin") {
      ui.currentBuilding = targetBuilding;
      ui.currentFloor = targetFloor;
      ui.mapMode = "floor";
      renderAll();
      return;
    }

    const character = getCharacter(session.characterId);
    if (!character) return;

    if (
      !exposedFloorKeysForBuilding(character, targetBuilding).includes(
        targetFloor,
      )
    ) {
      showToast("운영진이 아직 공개하지 않은 층입니다.");
      return;
    }

    // 일반 층 버튼은 생존자/동결체 모두 지도 열람 전용.
    // 동결체의 실제 층 이동은 계단 칸에 들어온 직후 자동으로 뜨는
    // '몇 층으로 이동하시겠습니까?' 창에서만 수행한다.
    ui.currentBuilding = targetBuilding;
    ui.currentFloor = targetFloor;
    ui.mapMode = "floor";
    renderAll();
  }

  function getStairTransitionForCharacter(character) {
    if (!character) return null;

    const exactTransition = getTransitionAt(
      character.floor,
      character.x,
      character.y,
    );
    if (isStairTransition(exactTransition)) return exactTransition;

    const floor = FLOOR_DEFINITIONS[character.floor];
    if (!floor) return null;

    const currentRoomId = getRoomId(character.floor, character.x, character.y);

    return (
      (floor.transitions || []).find((transition) => {
        if (!isStairTransition(transition)) return false;
        return (
          getRoomId(character.floor, transition.x, transition.y) ===
          currentRoomId
        );
      }) || null
    );
  }

  function availableStairDestinationFloors(character, transition) {
    if (!character || !isStairTransition(transition)) return [];

    const buildingId = buildingFromFloorKey(character.floor);

    return exposedFloorKeysForBuilding(character, buildingId).filter(
      (floorId) => {
        if (floorId === character.floor) return false;

        return (FLOOR_DEFINITIONS[floorId]?.transitions || []).some(
          isStairTransition,
        );
      },
    );
  }

  function showStairFloorChoiceModal(character) {
    if (
      session?.type !== "player" ||
      !character ||
      character.role !== "spirit"
    ) {
      return;
    }

    const transition = getStairTransitionForCharacter(character);

    if (!transition) return;

    const destinations = availableStairDestinationFloors(character, transition);

    if (!destinations.length) return;

    openModal({
      eyebrow: "STAIR MOVEMENT",
      title: "몇 층으로 이동하시겠습니까?",
      body: `<div class="stair-floor-choice">
        <p class="stair-floor-choice__help">
          현재 계단에서 이동할 층을 선택해 주세요.
        </p>
        <div class="stair-floor-choice__grid">
          ${destinations
            .map(
              (floorId) => `
                <button
                  type="button"
                  class="stair-floor-choice__button"
                  data-stair-floor-choice="${floorId}"
                >
                  <strong>${floorLabelFromKey(floorId)}</strong>
                </button>
              `,
            )
            .join("")}
        </div>
        <p class="stair-floor-choice__note">
          계단을 이용한 층 이동에는 행동력이 소모되지 않습니다.
        </p>
      </div>`,
      footer: `<button type="button" class="button" data-modal-close>취소</button>`,
    });

    elements.modalBody
      .querySelectorAll("[data-stair-floor-choice]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          moveSpiritThroughStairs(
            character,
            button.dataset.stairFloorChoice,
            transition,
          );
        });
      });
  }

  async function moveSpiritThroughStairs(
    character,
    targetFloor,
    sourceTransition,
  ) {
    if (!isStairTransition(sourceTransition)) {
      closeModal();
      showToast("층 이동은 계단에서만 가능합니다.");
      return;
    }

    if (
      !availableStairDestinationFloors(character, sourceTransition).includes(
        targetFloor,
      )
    ) {
      closeModal();
      showToast("현재 공개된 계단 이동 대상이 아닙니다.");
      return;
    }

    const destinationTransition = findMatchingStairTransition(
      targetFloor,
      sourceTransition,
    );

    if (!destinationTransition) {
      closeModal();
      showToast("연결된 계단 위치를 찾을 수 없습니다.");
      return;
    }

    // 서버 연결 상태의 플레이어는 층 이동도 반드시 서버에서 확정한다.
    // 화면에서만 먼저 층을 바꾸면 다음 서버 동기화 때 원래 층으로 되돌아간다.
    if (session?.type === "player" && session?.token) {
      await performRemoteSpiritMove(
        character,
        targetFloor,
        destinationTransition.x,
        destinationTransition.y,
      );
      return;
    }

    settleAllSurvivorFreezeClocks();

    const fromFloor = character.floor;
    const fromRoom = getRoomLabel(character.floor, character.x, character.y);
    const fromFloorLabel = floorLabelFromKey(character.floor);
    const toFloorLabel = floorLabelFromKey(targetFloor);

    // 로컬/비서버 미리보기에서도 계단 층 이동은 행동력을 차감하지 않는다.
    character.floor = targetFloor;
    character.x = destinationTransition.x;
    character.y = destinationTransition.y;

    ui.currentFloor = targetFloor;
    ui.currentBuilding = buildingFromFloorKey(targetFloor);
    ui.mapMode = "floor";

    const toRoom = getRoomLabel(character.floor, character.x, character.y);

    recordSpiritMovement(character, {
      fromFloor,
      fromRoom,
      toFloor: targetFloor,
      toRoom,
      cost: 0,
      source: "계단",
    });

    addLog(
      `${character.name}이(가) 계단을 이용해 ${fromFloorLabel}에서 ${toFloorLabel}(으)로 이동했습니다. 행동력 미소모.`,
    );

    persistState();
    closeModal();
    renderAll();
  }

  function requestSpiritMove(character, floorId, x, y) {
    if (!character || character.role !== "spirit") return;
    if (character.floor !== floorId) {
      showToast("현재 층에서만 직접 이동할 수 있습니다.");
      return;
    }
    moveActorTo(character, x, y);
  }

  function handleMapClick(event) {
    /*
     * 관리자 지도에서는 어떤 종류의 지도 토큰이든 클릭을 최우선 처리합니다.
     * 방 이동/건물 이동/계단 버튼보다 먼저 검사해 겹친 영역에서도
     * 캐릭터 관리창이 일관되게 열리도록 합니다.
     */
    const tokenElement = event.target.closest("[data-token-character]");
    if (tokenElement && session.type === "admin") {
      openAdminCharacterManagementFromMap(
        Number(tokenElement.dataset.tokenCharacter),
      );
      return;
    }

    const bunkerCenterEntryButton = event.target.closest(
      "[data-open-bunker-center-entry]",
    );
    if (bunkerCenterEntryButton && session.type === "player") {
      const character = getCharacter(session.characterId);
      moveCharacterToBunkerCenter(character);
      return;
    }

    const bunkerCenterReturnButton = event.target.closest(
      "[data-open-bunker-center-return]",
    );
    if (bunkerCenterReturnButton && session.type === "player") {
      const character = getCharacter(session.characterId);
      moveCharacterFromBunkerCenter(character);
      return;
    }

    const bunkerTransferButton = event.target.closest(
      "[data-open-bunker-transfer]",
    );
    if (bunkerTransferButton && session.type === "player") {
      const character = getCharacter(session.characterId);
      requestBunkerTransfer(character);
      return;
    }

    const bunkerAscentButton = event.target.closest(
      "[data-open-bunker-ascent]",
    );
    if (bunkerAscentButton && session.type === "player") {
      const character = getCharacter(session.characterId);
      requestBunkerAscent(character);
      return;
    }

    const bunkerDescentButton = event.target.closest(
      "[data-open-bunker-descent]",
    );
    if (bunkerDescentButton && session.type === "player") {
      const character = getCharacter(session.characterId);
      requestBunkerDescent(character);
      return;
    }

    const stairFloorMoveButton = event.target.closest(
      "[data-open-stair-floor-move]",
    );
    if (stairFloorMoveButton && session.type === "player") {
      const character = getCharacter(session.characterId);
      if (
        character?.role === "spirit" &&
        getStairTransitionForCharacter(character)
      ) {
        showStairFloorChoiceModal(character);
      }
      return;
    }

    const buildingButton = event.target.closest("[data-campus-building]");
    if (buildingButton) {
      openBuildingMap(buildingButton.dataset.campusBuilding);
      return;
    }

    const tokenOverflowToggle = event.target.closest(
      "[data-token-overflow-toggle]",
    );
    if (tokenOverflowToggle) {
      const wrapper = tokenOverflowToggle.closest(".map-token-overflow-wrap");
      const wasOpen = wrapper?.classList.contains("is-open");
      document
        .querySelectorAll(".map-token-overflow-wrap.is-open")
        .forEach((element) => {
          element.classList.remove("is-open");
          element
            .querySelector("[data-token-overflow-toggle]")
            ?.setAttribute("aria-expanded", "false");
        });
      if (wrapper && !wasOpen) {
        wrapper.classList.add("is-open");
        tokenOverflowToggle.setAttribute("aria-expanded", "true");
        positionMapTokenOverflowList(wrapper);
      } else if (wasOpen) {
        activeMapTokenOverflowWrapper = null;
        hideMapTokenOverflowPortal();
      }
      return;
    }

    document
      .querySelectorAll(".map-token-overflow-wrap.is-open")
      .forEach((element) => {
        element.classList.remove("is-open");
        element
          .querySelector("[data-token-overflow-toggle]")
          ?.setAttribute("aria-expanded", "false");
      });
    activeMapTokenOverflowWrapper = null;
    hideMapTokenOverflowPortal();

    const cellElement = event.target.closest(".map-cell");
    if (!cellElement || ui.mapMode === "site") return;
    const x = Number(cellElement.dataset.x);
    const y = Number(cellElement.dataset.y);
    const actor = getMovementActor();

    if (session.type === "admin" && ui.adminTool === "forceMove") {
      settleAllSurvivorFreezeClocks();
      const previous = {
        floor: actor.floor,
        room: getRoomLabel(actor.floor, actor.x, actor.y),
      };
      settleFreezeClock(
        actor,
        previous.floor,
        getRoomIdByLabel(previous.floor, previous.room),
      );
      actor.floor = ui.currentFloor;
      actor.x = x;
      actor.y = y;
      if (actor.role === "spirit")
        recordSpiritMovement(actor, {
          fromFloor: previous.floor,
          fromRoom: previous.room,
          toFloor: actor.floor,
          toRoom: getRoomLabel(actor.floor, actor.x, actor.y),
          cost: 0,
          source: "운영진 강제 이동",
        });
      ui.adminTool = null;
      addLog(
        `관리자가 ${actor.name}의 위치를 ${buildingLabelFromFloor(ui.currentFloor)} ${floorLabelFromKey(ui.currentFloor)} ${getRoomLabel(ui.currentFloor, x, y)}로 변경했습니다.`,
      );
      persistState();
      renderAll();
      showToast(
        `${actor.name}을(를) ${getRoomLabel(ui.currentFloor, x, y)}로 이동했습니다.`,
      );
      return;
    }

    if (session.type === "admin") {
      showTeamDestinationModal(ui.currentFloor, x, y);
      return;
    }

    /*
     * 지하벙커에 있는 동결체는 다른 벙커/지상 지도를 자유롭게 열람할 수 있다.
     * 다만 현재 위치가 아닌 지도에서 공간 칸을 눌러 실제 이동을 시도할 때만
     * 이동문을 이용해야 한다는 안내를 표시하고 위치 변경을 막는다.
     */
    if (
      actor.role === "spirit" &&
      isBunkerFloor(actor.floor) &&
      ui.currentFloor !== actor.floor
    ) {
      showToast("지하벙커는 이동문을 통해서만 이동이 가능합니다.");
      return;
    }

    /*
     * 동결체 전용 건물 이동 기준.
     *
     * 건물 버튼을 눌러 다른 건물 지도를 보는 것만으로는 이동하지 않는다.
     * 실제 현재 건물과 다른 건물의 "구역"을 클릭했을 때만
     * 행동력 5 소모 건물 이동 확인창을 띄운다.
     */
    if (
      actor.role === "spirit" &&
      buildingFromFloorKey(actor.floor) !==
        buildingFromFloorKey(ui.currentFloor)
    ) {
      requestSpiritBuildingMoveFromViewedZone(
        actor,
        buildingFromFloorKey(ui.currentFloor),
      );
      return;
    }

    if (actor.role === "survivor") {
      const isCurrentPosition =
        actor.floor === ui.currentFloor && actor.x === x && actor.y === y;
      if (isCurrentPosition) return;

      openModal({
        eyebrow: "이동 제한",
        title: "위치 이동 불가",
        body: `<div class="movement-warning">
          <p>생존자는 자신의 위치를 직접 옮길 수 없습니다.</p>
          <strong>운영진이 위치를 이동시킵니다.</strong>
        </div>`,
        footer: `<button type="button" class="button button--primary" data-modal-close>확인</button>`,
      });
      return;
    }

    requestSpiritMove(actor, ui.currentFloor, x, y);
  }

  function getRoomId(floorId, x, y) {
    return FLOOR_DEFINITIONS[floorId]?.cells[cellKey(x, y)]?.roomId || "";
  }

  function getRoomLabel(floorId, x, y) {
    return (
      FLOOR_DEFINITIONS[floorId]?.cells[cellKey(x, y)]?.roomLabel ||
      "미지정 공간"
    );
  }

  function getInvestigationAt(floorId, x, y) {
    return (
      FLOOR_DEFINITIONS[floorId]?.investigations.find(
        (item) => item.x === x && item.y === y,
      ) || null
    );
  }

  function getTransitionAt(floorId, x, y) {
    return (
      FLOOR_DEFINITIONS[floorId]?.transitions.find(
        (item) => item.x === x && item.y === y,
      ) || null
    );
  }

  function findMatchingTransition(floorId, type) {
    return (
      FLOOR_DEFINITIONS[floorId]?.transitions.find(
        (item) => item.type === type,
      ) ||
      FLOOR_DEFINITIONS[floorId]?.transitions[0] ||
      null
    );
  }

  function getPlayerExposedFloors(character) {
    return exposedFloorKeysForBuilding(
      character,
      ui.currentBuilding || buildingFromFloorKey(character.floor),
    );
  }

  function installCampusMapEnhancements() {
    elements.siteMapButton?.addEventListener("click", openSiteMap);

    elements.campusMapCloseButton?.addEventListener(
      "click",
      closeCampusMapPopup,
    );

    elements.campusMapBackdrop?.addEventListener("click", (event) => {
      if (event.target === elements.campusMapBackdrop) {
        closeCampusMapPopup();
      }
    });

    document
      .querySelector("#campusMapPopup")
      ?.addEventListener("click", (event) => {
        const layerButton = event.target.closest("[data-site-map-layer]");
        if (!layerButton || !canUseSiteMapLayerToggle()) return;

        const nextLayer = layerButton.dataset.siteMapLayer;
        if (nextLayer !== "surface" && nextLayer !== "underground") return;

        ui.siteMapLayer = nextLayer;
        renderSiteMapLayer();
      });

    elements.campusMapCanvas?.addEventListener("click", (event) => {
      const bunkerZoneButton = event.target.closest("[data-bunker-map-zone]");
      if (bunkerZoneButton) {
        const targetFloor = bunkerZoneButton.dataset.bunkerMapZone;
        if (!FLOOR_DEFINITIONS[targetFloor] || !isBunkerFloor(targetFloor))
          return;
        if (bunkerZoneButton.dataset.bunkerZoneExposed === "false") {
          showToast("아직 공개되지 않은 지하벙커 구역입니다.");
          return;
        }

        // 지도 카드 클릭은 상세 지도 열람만 수행합니다.
        // 실제 캐릭터 위치(character.floor / x / y)는 변경하지 않습니다.
        ui.currentBuilding = buildingFromFloorKey(targetFloor);
        ui.currentFloor = targetFloor;
        ui.mapMode = "floor";
        closeCampusMapPopup();
        renderAll();
        return;
      }

      const buildingButton = event.target.closest("[data-campus-building]");
      if (!buildingButton) return;
      openBuildingMap(buildingButton.dataset.campusBuilding);
    });

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        !elements.campusMapBackdrop?.classList.contains("is-hidden")
      ) {
        closeCampusMapPopup();
      }
    });

    const originalOperationsHandler = elements.adminOperationsButton;
    if (originalOperationsHandler) {
      originalOperationsHandler.addEventListener(
        "click",
        () => {
          if (ui.operationsOpen) {
            ui.mapMode = "floor";
          }
        },
        true,
      );
    }
  }

  /* =====================================================================
     공통 커스텀 드롭다운
     - 모든 select.form-control을 감염 단계 선택창과 같은 UI로 표시
     - 원래 select는 그대로 유지하여 기존 폼/이벤트 기능을 보존
     ===================================================================== */

  function normalizeStoredInventoryItem(item) {
    if (!item || typeof item !== "object") return item;
    item.itemType =
      item.itemType === "healing"
        ? "healing"
        : item.itemType === "warming"
          ? "warming"
          : item.itemType === "basic"
            ? "basic"
            : "resource";
    item.healAmount =
      item.itemType === "healing"
        ? Math.max(1, Math.min(100, Math.round(Number(item.healAmount) || 1)))
        : 0;
    item.grantMode =
      item.grantMode === "starting"
        ? "starting"
        : item.grantMode === "delivery"
          ? "delivery"
          : item.grantMode || "acquired";
    if (item.itemType === "healing") item.certainty = "confirmed";
    return item;
  }

  function inventoryItemTypeLabel(item) {
    normalizeStoredInventoryItem(item);
    if (item.itemType === "healing") return "체력 회복 아이템";
    if (item.itemType === "warming") return "방한 아이템";
    if (item.itemType === "basic") return "일반 소지품";
    return "조사 자료";
  }

  function inventoryGrantLabel(item) {
    normalizeStoredInventoryItem(item);
    if (item.grantMode === "starting") return "기본 소지품";
    if (item.grantMode === "delivery") return "운영진 지급";
    return "획득";
  }

  function inventoryItemBadgeMarkup(item) {
    normalizeStoredInventoryItem(item);

    if (item.itemType === "healing") {
      return `<span class="inventory-type-badge inventory-type-badge--healing">회복 +${item.healAmount}</span>`;
    }

    if (item.itemType === "warming") {
      return `<span class="inventory-type-badge inventory-type-badge--warming">방한 아이템</span>`;
    }

    if (item.itemType === "basic") {
      return `<span class="inventory-type-badge inventory-type-badge--basic">소지품</span>`;
    }

    return `<span class="inventory-type-badge inventory-type-badge--resource">조사 자료</span>`;
  }

  function healthGaugeMarkup(character, compact = false) {
    if (!character || character.role === "spirit") return "";
    normalizeCharacterHealth(character);
    const percent = Math.max(
      0,
      Math.min(100, Math.round((character.health / character.maxHealth) * 100)),
    );
    const tone =
      percent <= 25 ? "is-critical" : percent <= 50 ? "is-low" : "is-normal";
    return `<div class="health-meter-row ${tone} ${compact ? "health-meter-row--compact" : ""}"><div class="health-meter" role="meter" aria-label="${escapeHtml(character.name)} 체력" aria-valuemin="0" aria-valuemax="${character.maxHealth}" aria-valuenow="${character.health}"><i style="width:${percent}%"></i></div><strong class="health-meter__number">${character.health} / ${character.maxHealth}</strong></div>`;
  }

  function useWarmingItem(characterId, itemUid) {
    const character = getCharacter(Number(characterId));

    if (!character) {
      return showToast("캐릭터를 찾지 못했습니다.");
    }

    const adminUse = session?.type === "admin";
    const playerSelfUse =
      session?.type === "player" &&
      Number(session.characterId) === Number(character.id);

    if (!adminUse && !playerSelfUse) {
      return showToast("이 아이템을 사용할 권한이 없습니다.");
    }

    if (!Array.isArray(character.inventory)) {
      character.inventory = [];
    }

    const index = character.inventory.findIndex(
      (item) => String(item.uid) === String(itemUid),
    );

    if (index < 0) {
      return showToast("소지품을 찾지 못했습니다.");
    }

    const item = character.inventory[index];
    normalizeStoredInventoryItem(item);

    if (item.itemType !== "warming") {
      return showToast("방한 아이템만 사용할 수 있습니다.");
    }

    /*
     * 방한 아이템은 현재 프리뷰에서 별도 수치 효과를 주지 않는다.
     * '사용' 시 소지품에서 1개가 사라지는 소비형 아이템이다.
     */
    character.inventory.splice(index, 1);

    addLog(
      adminUse
        ? `관리자가 ${character.name}의 방한 아이템 「${item.title}」을(를) 사용 처리했습니다.`
        : `${character.name}이(가) 방한 아이템 「${item.title}」을(를) 사용했습니다.`,
    );

    persistState();
    renderAll();

    if (ui.operationsOpen) {
      renderAdminOperationsPage();
    }

    showToast(`「${item.title}」을(를) 사용했습니다.`);
  }

  function useHealingItem(characterId, itemUid) {
    const character = getCharacter(Number(characterId));
    if (!character) return showToast("캐릭터를 찾지 못했습니다.");
    if (character.role !== "survivor") {
      return showToast("체력과 체력 회복 아이템은 생존자에게만 적용됩니다.");
    }

    const adminUse = session?.type === "admin";
    const survivorSelfUse =
      session?.type === "player" &&
      Number(session.characterId) === Number(character.id) &&
      character.role === "survivor";
    if (!adminUse && !survivorSelfUse) {
      return showToast("이 아이템을 사용할 권한이 없습니다.");
    }

    normalizeCharacterHealth(character);
    if (!Array.isArray(character.inventory)) character.inventory = [];
    const index = character.inventory.findIndex(
      (item) => String(item.uid) === String(itemUid),
    );
    if (index < 0) return showToast("소지품을 찾지 못했습니다.");

    const item = character.inventory[index];
    normalizeStoredInventoryItem(item);
    if (item.itemType !== "healing") {
      return showToast("체력 회복 아이템만 사용할 수 있습니다.");
    }
    if (character.health >= character.maxHealth) {
      return showToast(`${character.name}의 체력이 이미 최대치입니다.`);
    }

    const before = character.health;
    character.health = Math.min(
      character.maxHealth,
      character.health + item.healAmount,
    );
    const recovered = character.health - before;
    character.inventory.splice(index, 1);

    addLog(
      adminUse
        ? `관리자가 ${character.name}의 소지품 「${item.title}」을(를) 사용했습니다. (${character.health} / ${character.maxHealth})`
        : `${character.name}이(가) 소지품 「${item.title}」을(를) 직접 사용했습니다. (${character.health} / ${character.maxHealth})`,
    );
    persistState();
    renderAll();
    if (ui.operationsOpen) renderAdminOperationsPage();
    showToast(
      `「${item.title}」을(를) 사용했습니다. 현재 체력 ${character.health} / ${character.maxHealth}`,
    );
  }

  function syncInventoryRegistrationFields(form) {
    if (!(form instanceof HTMLFormElement)) return;

    const typeSelect = form.querySelector('[name="itemType"]');
    const resourceFields = form.querySelector("[data-resource-item-fields]");
    const healingFields = form.querySelector("[data-healing-item-fields]");
    const itemType = String(typeSelect?.value || "resource");
    const isResource = itemType === "resource";
    const isHealing = itemType === "healing";

    if (resourceFields) {
      resourceFields.hidden = !isResource;
      resourceFields
        .querySelectorAll("input, select, textarea")
        .forEach((control) => {
          control.disabled = !isResource;
        });
    }

    if (healingFields) {
      healingFields.hidden = !isHealing;
      healingFields
        .querySelectorAll("input, select, textarea")
        .forEach((control) => {
          control.disabled = !isHealing;
        });
    }

    if (isResource) {
      syncResourceDiscoveryRoomSelect(form);
    }
  }

  const COMMON_SELECT_SELECTOR =
    "select.form-control:not([multiple]):not([data-native-select])";

  function commonSelectLabel(select) {
    const option = select.options[select.selectedIndex];
    return option ? option.textContent.trim() : "선택";
  }

  function closeCommonSelect(wrapper) {
    if (!wrapper) return;
    wrapper.classList.remove("is-open");
    const menu = wrapper.querySelector(".ui-select__menu");
    const trigger = wrapper.querySelector(".ui-select__trigger");
    if (menu) menu.hidden = true;
    trigger?.setAttribute("aria-expanded", "false");
  }

  function closeAllCommonSelects(except = null) {
    document.querySelectorAll(".ui-select.is-open").forEach((wrapper) => {
      if (wrapper !== except) closeCommonSelect(wrapper);
    });
  }

  function syncCommonSelect(select) {
    if (!(select instanceof HTMLSelectElement)) return;
    const wrapper = select.closest(".ui-select");
    if (!wrapper) return;

    const trigger = wrapper.querySelector(".ui-select__trigger");
    const label = wrapper.querySelector(".ui-select__value");
    if (label) label.textContent = commonSelectLabel(select);
    if (trigger) trigger.disabled = select.disabled;

    wrapper.querySelectorAll(".ui-select__option").forEach((button) => {
      const selected = button.dataset.value === select.value;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function rebuildCommonSelectMenu(select) {
    const wrapper = select.closest(".ui-select");
    const menu = wrapper?.querySelector(".ui-select__menu");
    if (!wrapper || !menu) return;

    menu.innerHTML = "";

    Array.from(select.options).forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ui-select__option";
      button.dataset.value = option.value;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", option.selected ? "true" : "false");
      button.disabled = option.disabled;
      button.classList.toggle("is-selected", option.selected);

      const text = document.createElement("span");
      text.textContent = option.textContent.trim();

      const dot = document.createElement("span");
      dot.className = "ui-select__dot";
      dot.setAttribute("aria-hidden", "true");

      button.append(text, dot);
      menu.appendChild(button);
    });

    syncCommonSelect(select);
  }

  function enhanceCommonSelect(select) {
    if (
      !(select instanceof HTMLSelectElement) ||
      select.dataset.commonSelectReady === "true"
    ) {
      return;
    }

    select.dataset.commonSelectReady = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "ui-select";

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.classList.add("ui-select__native");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "ui-select__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const value = document.createElement("span");
    value.className = "ui-select__value";

    const chevron = document.createElement("span");
    chevron.className = "ui-select__chevron";
    chevron.setAttribute("aria-hidden", "true");

    trigger.append(value, chevron);

    const menu = document.createElement("div");
    menu.className = "ui-select__menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    wrapper.append(trigger, menu);
    rebuildCommonSelectMenu(select);
  }

  function enhanceCommonSelects(root = document) {
    if (
      root instanceof HTMLSelectElement &&
      root.matches(COMMON_SELECT_SELECTOR)
    ) {
      enhanceCommonSelect(root);
      return;
    }

    if (!(root instanceof Document) && !(root instanceof Element)) return;
    root.querySelectorAll(COMMON_SELECT_SELECTOR).forEach(enhanceCommonSelect);
  }

  function installCommonSelectEnhancements() {
    enhanceCommonSelects(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          enhanceCommonSelects(node);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener(
      "click",
      (event) => {
        const optionButton = event.target.closest(".ui-select__option");
        if (optionButton) {
          const wrapper = optionButton.closest(".ui-select");
          const select = wrapper?.querySelector(":scope > select");
          if (!wrapper || !(select instanceof HTMLSelectElement)) return;

          event.preventDefault();
          select.value = optionButton.dataset.value ?? "";
          syncCommonSelect(select);
          closeCommonSelect(wrapper);

          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
          return;
        }

        const trigger = event.target.closest(".ui-select__trigger");
        if (trigger) {
          const wrapper = trigger.closest(".ui-select");
          const select = wrapper?.querySelector(":scope > select");
          const menu = wrapper?.querySelector(".ui-select__menu");
          if (
            !wrapper ||
            !(select instanceof HTMLSelectElement) ||
            !menu ||
            trigger.disabled
          ) {
            return;
          }

          event.preventDefault();
          const shouldOpen = !wrapper.classList.contains("is-open");
          closeAllCommonSelects(wrapper);

          if (shouldOpen) {
            rebuildCommonSelectMenu(select);
            wrapper.classList.add("is-open");
            menu.hidden = false;
            trigger.setAttribute("aria-expanded", "true");
          } else {
            closeCommonSelect(wrapper);
          }
          return;
        }

        if (!event.target.closest(".ui-select")) {
          closeAllCommonSelects();
        }
      },
      true,
    );

    document.addEventListener(
      "change",
      (event) => {
        if (
          event.target instanceof HTMLSelectElement &&
          event.target.dataset.commonSelectReady === "true"
        ) {
          syncCommonSelect(event.target);
        }
      },
      true,
    );

    document.addEventListener(
      "invalid",
      (event) => {
        if (
          event.target instanceof HTMLSelectElement &&
          event.target.dataset.commonSelectReady === "true"
        ) {
          const trigger = event.target
            .closest(".ui-select")
            ?.querySelector(".ui-select__trigger");
          window.setTimeout(() => trigger?.focus(), 0);
        }
      },
      true,
    );

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeAllCommonSelects();
    });
  }

  document.addEventListener(
    "DOMContentLoaded",
    installCommonSelectEnhancements,
  );

  document.addEventListener("pointerover", (event) => {
    const wrapper = event.target.closest?.(".map-token-overflow-wrap");
    if (!wrapper) return;
    if (event.relatedTarget && wrapper.contains(event.relatedTarget)) return;
    window.clearTimeout(mapTokenOverflowHideTimer);
    positionMapTokenOverflowList(wrapper);
  });

  document.addEventListener("pointerout", (event) => {
    const wrapper = event.target.closest?.(".map-token-overflow-wrap");
    if (!wrapper) return;
    if (event.relatedTarget && wrapper.contains(event.relatedTarget)) return;
    if (!wrapper.classList.contains("is-open")) {
      scheduleHideMapTokenOverflowPortal();
    }
  });

  document.addEventListener("focusin", (event) => {
    const wrapper = event.target.closest?.(".map-token-overflow-wrap");
    if (wrapper) {
      window.clearTimeout(mapTokenOverflowHideTimer);
      positionMapTokenOverflowList(wrapper);
    }
  });

  document.addEventListener("focusout", (event) => {
    const wrapper = event.target.closest?.(".map-token-overflow-wrap");
    if (wrapper && !wrapper.classList.contains("is-open")) {
      scheduleHideMapTokenOverflowPortal();
    }
  });

  window.addEventListener("resize", () => {
    positionAllMapTokenOverflowBadges();
    positionAllOpenMapTokenOverflowLists();
  });
  window.addEventListener("scroll", positionAllOpenMapTokenOverflowLists, true);

  document.addEventListener("DOMContentLoaded", installCampusMapEnhancements);
})();
