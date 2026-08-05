let mountGameEngineImpl;
(() => {
  "use strict";

  const STORAGE_KEY = "shu-investigation-prototype-v2";
  const FLOOR_ORDER = ["B1", "1F", "2F", "3F", "4F"];
  const GRID_COLUMNS = 12;
  const GRID_ROWS = 8;

  const ROLE_LABELS = {
    survivor: "생환자",
    spirit: "빙혼자",
  };

  const STATUS_DEFINITIONS = {
    hypothermia: { name: "저체온", icon: "❄", description: "차가운 환경에 장시간 노출된 상태입니다." },
    frostbite: { name: "동상", icon: "✣", description: "이동과 조사에 주의가 필요한 상태입니다." },
    injured: { name: "부상", icon: "＋", description: "외상을 입었습니다." },
    unstable: { name: "불안정", icon: "⌁", description: "빙혼 상태가 불안정합니다." },
    immobilized: { name: "행동불능", icon: "⊘", description: "관리자가 해제할 때까지 이동할 수 없습니다." },
    vision_limited: { name: "시야 제한", icon: "◌", description: "생환자라도 본인 중심 3×3만 볼 수 있습니다." },
    tracked: { name: "추적당함", icon: "◎", description: "동결체가 흔적을 따라오고 있습니다." },
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

  const storage = createStorageAdapter();
  const syncChannel = "BroadcastChannel" in window ? new BroadcastChannel("shu-investigation-sync") : null;

  let session = null;
  let state = ensureFeatureState(loadState());
  let ui = {
    currentFloor: "1F",
    selectedCharacterId: 104,
    viewMode: "admin",
    rightPanelTab: "manage",
    comparisonOpen: false,
    pendingLogin: null,
    adminTool: null,
    adminModalTab: "map",
    operationsOpen: false,
    operationsTab: "overview",
    toastTimer: null,
  };

  const elements = {};



  function init() {
    cacheElements();
    bindStaticEvents();
    bindRealtimeSync();
    state = ensureFeatureState(state);
    showLogin();
  }

  function cacheElements() {
    elements.loginView = document.querySelector("#loginView");
    elements.appView = document.querySelector("#appView");
    elements.workspace = document.querySelector("#workspace");
    elements.characterLoginForm = document.querySelector("#characterLoginForm");
    elements.characterIdInput = document.querySelector("#characterIdInput");
    elements.loginError = document.querySelector("#loginError");
    elements.loginSearchResult = document.querySelector("#loginSearchResult");
    elements.logoutButton = document.querySelector("#logoutButton");
    elements.sessionBadge = document.querySelector("#sessionBadge");
    elements.viewModeNav = document.querySelector("#viewModeNav");
    elements.eventButton = document.querySelector("#eventButton");
    elements.adminOperationsButton = document.querySelector("#adminOperationsButton");
    elements.adminOperationsView = document.querySelector("#adminOperationsView");
    elements.adminOperationsContent = document.querySelector("#adminOperationsContent");
    elements.leftSidebar = document.querySelector("#leftSidebar");
    elements.rightSidebar = document.querySelector("#rightSidebar");
    elements.floorTabs = document.querySelector("#floorTabs");
    elements.currentFloorLabel = document.querySelector("#currentFloorLabel");
    elements.mapGrid = document.querySelector("#mapGrid");
    elements.mapToast = document.querySelector("#mapToast");
    elements.warmthBanner = document.querySelector("#warmthBanner");
    elements.investigateButton = document.querySelector("#investigateButton");
    elements.adminManageButton = document.querySelector("#adminManageButton");
    elements.compareViewsButton = document.querySelector("#compareViewsButton");
    elements.selectedCharacterSummary = document.querySelector("#selectedCharacterSummary");
    elements.movementRule = document.querySelector("#movementRule");
    elements.comparisonSection = document.querySelector("#comparisonSection");
    elements.survivorMiniMap = document.querySelector("#survivorMiniMap");
    elements.spiritMiniMap = document.querySelector("#spiritMiniMap");
    elements.adminMiniMap = document.querySelector("#adminMiniMap");
    elements.survivorPreviewName = document.querySelector("#survivorPreviewName");
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
    elements.characterLoginForm.addEventListener("submit", handleCharacterLogin);
    elements.loginSearchResult.addEventListener("click", (event) => {
      const playerButton = event.target.closest("[data-confirm-character-login]");
      if (playerButton) {
        loginAsCharacter(Number(playerButton.dataset.confirmCharacterLogin));
        return;
      }
      if (event.target.closest("[data-confirm-admin-login]")) loginAsAdmin();
    });
    elements.logoutButton.addEventListener("click", logout);
    elements.eventButton.addEventListener("click", showEmergencyEvent);
    elements.adminOperationsButton.addEventListener("click", openAdminOperationsPage);
    elements.adminOperationsView.addEventListener("click", handleOperationsClick);
    elements.adminOperationsView.addEventListener("change", handleOperationsChange);
    elements.adminOperationsView.addEventListener("submit", handleOperationsSubmit);
    elements.viewModeNav.addEventListener("click", handleViewModeClick);
    elements.floorTabs.addEventListener("click", handleFloorTabClick);
    elements.mapGrid.addEventListener("click", handleMapClick);
    elements.investigateButton.addEventListener("click", handleInvestigateCurrent);
    elements.adminManageButton?.addEventListener("click", () => showAdminHubModal(ui.adminModalTab));
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
      if (event.key === "Escape" && !elements.modalBackdrop.classList.contains("is-hidden")) {
        closeModal();
      }
    });
  }

  function bindRealtimeSync() {
    syncChannel?.addEventListener("message", (event) => {
      if (event.data?.type !== "state-update" || !event.data.state) return;
      state = event.data.state;
      if (session) renderAll();
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        state = JSON.parse(event.newValue);
        if (session) renderAll();
      } catch (error) {
        console.warn("동기화 데이터를 읽지 못했습니다.", error);
      }
    });
  }

  function renderLoginSearchResult(code) {
    elements.loginError.textContent = "";
    if (code === "0000") {
      ui.pendingLogin = { type: "admin" };
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

    const character = getCharacter(Number(code));
    if (!character) {
      ui.pendingLogin = null;
      elements.loginSearchResult.innerHTML = "";
      elements.loginError.textContent = "등록된 ID를 찾을 수 없습니다.";
      return;
    }

    const teams = getTeamsForCharacter(character.id);
    ui.pendingLogin = { type: "player", characterId: character.id };
    elements.loginSearchResult.innerHTML = `
      <article class="login-result-card">
        ${avatarMarkup(character)}
        <div>
          <p class="eyebrow">CHARACTER FOUND</p>
          <h2>${escapeHtml(character.name)} · ID ${character.id}</h2>
          <p>${ROLE_LABELS[character.role]}${teams.length ? ` · ${teams.map((team) => escapeHtml(team.name)).join(" · ")}` : " · 미편성"}</p>
        </div>
        <button type="button" class="button button--primary" data-confirm-character-login="${character.id}">이 캐릭터로 접속</button>
      </article>`;
  }

  function handleCharacterLogin(event) {
    event.preventDefault();
    const code = elements.characterIdInput.value.trim();
    if (!/^\d{3,4}$/.test(code)) {
      elements.loginSearchResult.innerHTML = "";
      elements.loginError.textContent = "숫자로 된 접속 ID를 입력해 주세요.";
      return;
    }
    renderLoginSearchResult(code);
  }

  function loginAsCharacter(id) {
    const character = getCharacter(id);
    if (!character) {
      elements.loginError.textContent = "등록된 캐릭터가 아닙니다.";
      return;
    }
    session = { type: "player", characterId: character.id };
    ui.selectedCharacterId = character.id;
    ui.currentFloor = character.floor;
    ui.viewMode = character.role;
    ui.adminTool = null;
    ui.rightPanelTab = "inventory";
    ui.pendingLogin = null;
    ui.operationsOpen = false;
    elements.loginError.textContent = "";
    openApp();
  }

  function loginAsAdmin() {
    session = { type: "admin" };
    const selected = getCharacter(ui.selectedCharacterId) || state.characters[0];
    ui.selectedCharacterId = selected.id;
    ui.currentFloor = selected.floor;
    ui.viewMode = "admin";
    ui.adminTool = null;
    ui.rightPanelTab = "manage";
    ui.operationsOpen = false;
    openApp();
  }

  function logout() {
    session = null;
    ui.adminTool = null;
    ui.operationsOpen = false;
    closeModal();
    showLogin();
  }

  function showLogin() {
    applySessionTheme();
    elements.loginView.classList.remove("is-hidden");
    elements.appView.classList.add("is-hidden");
    elements.characterIdInput.value = "";
    elements.loginSearchResult.innerHTML = "";
    elements.loginError.textContent = "";
    ui.pendingLogin = null;
  }

  function openApp() {
    elements.loginView.classList.add("is-hidden");
    elements.appView.classList.remove("is-hidden");
    renderAll();
  }

  function renderAll() {
    if (!session) return;

    applySessionTheme();
    const isAdmin = session.type === "admin";
    document.querySelectorAll(".admin-only").forEach((node) => {
      node.classList.toggle("is-hidden", !isAdmin);
    });
    elements.viewModeNav.classList.toggle("is-hidden", !isAdmin || ui.operationsOpen);
    elements.adminOperationsButton.classList.toggle("is-active", isAdmin && ui.operationsOpen);
    elements.workspace.classList.toggle("workspace--admin", isAdmin);
    elements.workspace.classList.toggle("is-hidden", isAdmin && ui.operationsOpen);
    elements.adminOperationsView.classList.toggle("is-hidden", !isAdmin || !ui.operationsOpen);
    elements.rightSidebar.classList.toggle("is-hidden", isAdmin);

    renderSessionBadge();
    renderViewModeNav();
    if (isAdmin && ui.operationsOpen) {
      renderAdminOperationsPage();
      return;
    }
    renderLeftSidebar();
    if (!isAdmin) renderRightSidebar();
    renderFloorTabs();
    renderMap();
    renderSelectedSummary();
    renderEventButton();
    updateInvestigationButton();
  }

  function applySessionTheme() {
    const activeCharacter = session?.type === "player" ? getCharacter(session.characterId) : null;
    const spiritThemeActive = activeCharacter?.role === "spirit";
    document.body.classList.toggle("theme-spirit", Boolean(spiritThemeActive));
    elements.appView?.classList.toggle("app-shell--spirit", Boolean(spiritThemeActive));

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute("content", spiritThemeActive ? "#16090c" : "#0c2744");
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
      elements.sessionBadge.innerHTML = "<strong>ADMIN</strong><span>운영진 계정</span>";
      return;
    }

    const character = getCharacter(session.characterId);
    elements.sessionBadge.innerHTML = `<strong>${escapeHtml(character.name)} · ${character.id}</strong><span>${ROLE_LABELS[character.role]}</span>`;
  }

  function renderViewModeNav() {
    if (session.type !== "admin") return;
    elements.viewModeNav.querySelectorAll("[data-view-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.viewMode === ui.viewMode);
    });
  }

  function renderLeftSidebar() {
    if (session.type === "admin") {
      renderAdminRoster();
    } else {
      renderPlayerProfile();
    }
  }

  function renderAdminRoster() {
    const cards = state.characters
      .map((character) => {
        const statuses = character.statuses.slice(0, 2).map((statusId) => {
          const status = STATUS_DEFINITIONS[statusId];
          return `<span class="status-icon" title="${escapeHtml(status.name)}">${status.icon}</span>`;
        }).join("");
        const movementText = character.role === "spirit"
          ? `행동력 ${character.ap} / ${character.maxAp}`
          : "운영진 위치 제어";
        return `
          <button type="button" class="character-card ${character.id === ui.selectedCharacterId ? "is-selected" : ""}" data-select-character="${character.id}" aria-label="${escapeHtml(character.name)} 관리창 열기">
            ${avatarMarkup(character)}
            <span class="character-card__main">
              <span class="character-card__title">
                <span class="character-card__id">${character.id}</span>
                <strong>${escapeHtml(character.name)}</strong>
                ${roleChipMarkup(character.role)}
              </span>
              <span class="character-card__meta">
                ${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}
              </span>
              <span class="character-card__submeta">
                ${movementText}
              </span>
              <span class="character-card__teams">${teamChipsMarkup(character.id)}</span>
            </span>
            <span class="character-card__statuses">${statuses}<small class="character-card__manage-hint">관리</small></span>
          </button>
        `;
      })
      .join("");

    const teamCards = state.teams.length
      ? state.teams.map((team) => {
        const members = team.memberIds.map(getCharacter).filter(Boolean);
        const visible = team.visible !== false;
        return `
          <article class="compact-team-card ${visible ? "" : "is-visibility-off"}" style="--team-color:${team.color}">
            <div class="compact-team-card__head">
              <div><strong>${escapeHtml(team.name)}</strong><span>${members.length}명 · ${visible ? "위치 공유 중" : "공유 숨김"}</span></div>
              <div class="compact-team-card__actions">
                <button type="button" class="team-eye-button ${visible ? "is-on" : ""}" data-toggle-team-visibility="${team.id}" aria-label="${escapeHtml(team.name)} 위치 공유 ${visible ? "끄기" : "켜기"}" title="그룹은 유지하고 위치 공유만 ${visible ? "끕니다" : "켭니다"}">${visible ? "◉" : "○"}</button>
                <button type="button" class="compact-icon-button" data-dissolve-team="${team.id}" aria-label="${escapeHtml(team.name)} 그룹 해제">해제</button>
              </div>
            </div>
            <div class="compact-team-card__members">
              ${members.map((member) => `<button type="button" data-select-character="${member.id}">${escapeHtml(member.name)} <small>${member.id}</small></button>`).join("")}
            </div>
          </article>`;
      }).join("")
      : `<div class="compact-empty">편성된 팀이 없습니다.</div>`;

    elements.leftSidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>캐릭터 현황</h2>
        <span class="status-pill">${state.characters.length}명</span>
      </div>
      <div class="sidebar-body">
        <div class="roster-list">${cards}</div>

        <section class="left-team-section" aria-labelledby="leftTeamTitle">
          <div class="left-team-section__head">
            <div>
              <p class="eyebrow">TEAM CONTROL</p>
              <h3 id="leftTeamTitle">팀 편성 · 위치 공유</h3>
            </div>
            <button type="button" class="button button--small button--primary" data-open-team-manager>편성·수정</button>
          </div>
          <div class="compact-team-list">${teamCards}</div>
        </section>

        <div class="side-note">
          <strong>지도에서 팀 데려오기</strong>
          <p>지도 위치를 클릭한 뒤 이동시킬 팀을 선택하면 해당 팀원 전원이 같은 공간으로 이동합니다. 개인 이동은 캐릭터 관리창에서 지정합니다.</p>
        </div>
      </div>
    `;
  }

  function renderPlayerProfile() {
    const character = getCharacter(session.characterId);
    const teams = getTeamsForCharacter(character.id);
    const visibleTeams = teams.filter((team) => team.visible !== false);
    const visibleMemberIds = new Set(visibleTeams.flatMap((team) => team.memberIds));
    visibleMemberIds.delete(character.id);
    const visibleMembers = [...visibleMemberIds].map(getCharacter).filter(Boolean);
    const statuses = character.statuses.length
      ? character.statuses.map((statusId) => {
        const status = STATUS_DEFINITIONS[statusId];
        return `<div class="status-list__item"><strong>${status.icon} ${escapeHtml(status.name)}</strong><p>${escapeHtml(status.description)}</p></div>`;
      }).join("")
      : emptyStateMarkup("현재 적용된 상태이상이 없습니다.");

    const movementCard = character.role === "spirit"
      ? `<div class="stat-card"><span>행동력</span><strong>${character.ap} / ${character.maxAp}</strong></div>`
      : `<div class="stat-card"><span>이동 권한</span><strong>운영진 제어</strong></div>`;

    const apMeter = character.role === "spirit"
      ? `<div class="ap-meter" style="--ap-percent:${Math.max(0, Math.min(100, (character.ap / Math.max(1, character.maxAp)) * 100))}%"><span></span></div>`
      : "";

    const teamMarkup = teams.length
      ? teams.map((team) => {
          const members = team.memberIds.map(getCharacter).filter(Boolean);
          const visible = team.visible !== false;
          return `
            <article class="team-summary-card ${visible ? "" : "is-visibility-off"}" style="--team-color:${team.color}">
              <div class="team-summary-card__head">
                <strong>${escapeHtml(team.name)}</strong>
                <span>${visible ? "위치 공유 중" : "위치 공유 꺼짐"}</span>
              </div>
              <div class="team-member-list">
                ${members.map((member) => `
                  <div class="team-member-row">
                    ${avatarMarkup(member, true)}
                    <span><strong>${escapeHtml(member.name)} · ${member.id}</strong><small>${member.floor} · ${escapeHtml(getRoomLabel(member.floor, member.x, member.y))}</small></span>
                  </div>`).join("")}
              </div>
            </article>`;
        }).join("")
      : emptyStateMarkup("현재 편성된 팀이 없습니다.");

    const sharedMemberMarkup = visibleMembers.length
      ? visibleMembers.map((member) => `<span class="shared-member-chip">${escapeHtml(member.name)} · ${member.id}</span>`).join("")
      : `<span class="shared-member-chip is-muted">원격 위치 공유 중인 팀원 없음</span>`;

    elements.leftSidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>내 캐릭터</h2>
        ${roleChipMarkup(character.role)}
      </div>
      <div class="player-profile">
        <div class="player-profile__identity">
          ${avatarMarkup(character)}
          <div>
            <h2>${escapeHtml(character.name)}</h2>
            <span class="character-card__id">ID ${character.id}</span>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><span>현재 위치</span><strong>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</strong></div>
          ${movementCard}
        </div>
        ${apMeter}
        <section>
          <p class="eyebrow">MY GROUPS</p>
          <div class="team-summary-list">${teamMarkup}</div>
          <div class="shared-member-list">${sharedMemberMarkup}</div>
        </section>
        <section>
          <p class="eyebrow">STATUS EFFECTS</p>
          <div class="status-list">${statuses}</div>
        </section>
        <div class="side-note">
          <strong>${character.role === "spirit" ? "빙혼자 이동" : "생환자 위치"}</strong>
          <p>${character.role === "spirit" ? "다른 공간으로 이동할 때 행동력 1이 차감됩니다. 이동 전 소모 행동력을 확인하는 창이 표시됩니다." : "자신의 위치는 직접 바꿀 수 없으며 운영진이 이동시킵니다."} 같은 공간에 있는 생환자와 빙혼자는 그룹 여부와 관계없이 서로 보입니다.</p>
        </div>
      </div>
    `;
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
      .map(([id, status]) => `<option value="${id}">${escapeHtml(status.name)}</option>`)
      .join("");

    const tabs = [
      ["manage", "운영"],
      ["teams", "팀"],
      ["layers", "지도"],
      ["records", "기록"],
      ["board", "공동보드"],
    ].map(([id, label]) => `<button type="button" class="panel-tab ${ui.rightPanelTab === id ? "is-active" : ""}" data-panel-tab="${id}">${label}</button>`).join("");

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


  function showCharacterManagementModal(characterId = ui.selectedCharacterId) {
    const selected = getCharacter(characterId);
    if (!selected) return;
    ui.selectedCharacterId = selected.id;
    const teams = getTeamsForCharacter(selected.id);
    const statusOptions = Object.entries(STATUS_DEFINITIONS)
      .map(([id, status]) => `<option value="${id}">${escapeHtml(status.name)}</option>`)
      .join("");
    const statusList = selected.statuses.length
      ? selected.statuses.map((statusId) => {
        const status = STATUS_DEFINITIONS[statusId];
        return `<div class="status-list__item"><strong>${status.icon} ${escapeHtml(status.name)}</strong><button type="button" class="button button--small" data-remove-status="${statusId}">해제</button></div>`;
      }).join("")
      : emptyStateMarkup("상태이상 없음");

    const apControls = selected.role === "spirit"
      ? `
        <div class="modal-control-card">
          <div class="modal-control-card__title"><strong>행동력</strong><span>${selected.ap} / ${selected.maxAp}</span></div>
          <p>다른 공간으로 이동할 때마다 행동력 1이 차감됩니다.</p>
          <div class="control-row">
            <button type="button" class="button button--small" data-admin-action="ap-minus">−1</button>
            <button type="button" class="button button--small" data-admin-action="ap-plus-1">+1</button>
            <button type="button" class="button button--small" data-admin-action="ap-plus-3">+3</button>
            <button type="button" class="button button--small" data-admin-action="ap-max">최대</button>
          </div>
        </div>`
      : `
        <div class="modal-control-card">
          <div class="modal-control-card__title"><strong>이동 권한</strong><span>생환자</span></div>
          <p>플레이어 직접 이동은 잠겨 있습니다. 위치 변경은 옆의 위치 이동 메뉴에서 운영진이 지정합니다.</p>
          <div class="status-pill status-pill--online">행동력 미적용</div>
        </div>`;

    openModal({
      eyebrow: "CHARACTER CONTROL",
      title: `${selected.name} · ID ${selected.id}`,
      body: `
        <div class="admin-character-overview">
          ${avatarMarkup(selected)}
          <div>
            <div class="admin-character-overview__title">${roleChipMarkup(selected.role)} <span class="character-card__teams">${teamChipsMarkup(selected.id)}</span></div>
            <strong>${escapeHtml(selected.floor)} · ${escapeHtml(getRoomLabel(selected.floor, selected.x, selected.y))}</strong>
            <span>좌표 X${selected.x + 1}, Y${selected.y + 1}</span>
          </div>
        </div>

        <div class="admin-modal-grid">
          ${apControls}

          <div class="modal-control-card">
            <div class="modal-control-card__title"><strong>개별 위치 이동</strong><span>선택 캐릭터만</span></div>
            <p>아래 버튼을 누른 뒤 지도에서 이동시킬 위치를 선택합니다. 팀 이동은 지도 위치를 바로 클릭해 팀을 선택합니다.</p>
            <div class="control-row">
              <button type="button" class="button ${ui.adminTool === "forceMove" ? "button--primary" : ""}" data-admin-action="toggle-force-move">선택 캐릭터 이동</button>
            </div>
          </div>

          <div class="modal-control-card modal-control-card--wide">
            <div class="modal-control-card__title"><strong>역할 및 상태</strong><span>토큰에 즉시 반영</span></div>
            <div class="modal-form-grid">
              <label class="control-label">분류
                <select class="form-control" data-role-select>
                  <option value="survivor" ${selected.role === "survivor" ? "selected" : ""}>생환자</option>
                  <option value="spirit" ${selected.role === "spirit" ? "selected" : ""}>빙혼자</option>
                </select>
              </label>
              ${selected.role === "spirit" ? `<label class="control-label">빙혼 상태
                <select class="form-control" data-spirit-state-select>
                  <option value="stable" ${selected.spiritState === "stable" ? "selected" : ""}>안정</option>
                  <option value="unstable" ${selected.spiritState === "unstable" ? "selected" : ""}>불안정</option>
                  <option value="freezing" ${selected.spiritState === "freezing" ? "selected" : ""}>동결 진행</option>
                  <option value="dormant" ${selected.spiritState === "dormant" ? "selected" : ""}>휴면</option>
                </select>
                <small>현재 상태 시작: ${formatDateTime(selected.spiritSince)} · ${formatElapsed(selected.spiritSince)}</small>
              </label>` : ""}
              <label class="control-label">상태이상 추가
                <span class="control-row"><select class="form-control" data-status-select><option value="">상태 선택</option>${statusOptions}</select><button type="button" class="button" data-admin-action="apply-status">적용</button></span>
              </label>
            </div>
            <div class="status-list">${statusList}</div>
          </div>
        </div>
      `,
      footer: `<button type="button" class="button" data-modal-close>닫기</button>`,
    });
  }

  function showTeamManagementModal() {
    const memberChecks = state.characters.map((character) => {
      const existingTeams = getTeamsForCharacter(character.id);
      return `
        <label class="team-checkbox">
          <input type="checkbox" name="memberIds" value="${character.id}" />
          ${avatarMarkup(character, true)}
          <span><strong>${escapeHtml(character.name)} · ${character.id}</strong><small>${ROLE_LABELS[character.role]}${existingTeams.length ? ` · ${existingTeams.map((team) => escapeHtml(team.name)).join(", ")}` : " · 미편성"}</small></span>
        </label>`;
    }).join("");
    const teamCards = state.teams.length
      ? state.teams.map((team) => {
        const members = team.memberIds.map(getCharacter).filter(Boolean);
        const visible = team.visible !== false;
        return `
          <article class="team-admin-card ${visible ? "" : "is-visibility-off"}" style="--team-color:${team.color}">
            <header>
              <div><strong>${escapeHtml(team.name)}</strong><span>${members.length}명 · ${visible ? "위치 공유 중" : "공유 숨김"}</span></div>
              <button type="button" class="team-eye-button ${visible ? "is-on" : ""}" data-toggle-team-visibility="${team.id}" aria-label="${escapeHtml(team.name)} 위치 공유 ${visible ? "끄기" : "켜기"}">${visible ? "◉" : "○"}</button>
            </header>
            <div class="team-admin-card__members">${members.map((member) => `<span>${escapeHtml(member.name)} · ${member.id}</span>`).join("")}</div>
            <button type="button" class="button button--small button--danger" data-dissolve-team="${team.id}">그룹 해제</button>
          </article>`;
      }).join("")
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
              <div class="team-checkbox-list team-checkbox-list--modal">${memberChecks}</div>
              <button class="button button--primary" type="submit">선택 인원 그룹화</button>
              <p class="login-card__footnote">두 명 이상 선택합니다. 한 캐릭터가 여러 그룹에 동시에 속할 수 있습니다. 눈 버튼은 그룹을 해제하지 않고 원격 위치 공유만 잠시 끕니다.</p>
            </form>
          </section>
          <section class="panel-card">
            <div class="panel-card__header">현재 그룹 목록</div>
            <div class="panel-card__body team-admin-list">${teamCards}</div>
          </section>
        </div>
      `,
      footer: `<button type="button" class="button" data-modal-close>닫기</button>`,
    });
  }

  function showAdminHubModal(tab = "map") {
    ui.adminModalTab = tab;
    const selected = getCharacter(ui.selectedCharacterId);
    const statusOptions = Object.entries(STATUS_DEFINITIONS)
      .map(([id, status]) => `<option value="${id}">${escapeHtml(status.name)}</option>`)
      .join("");
    const tabLabels = { map: "지도", records: "운영 기록", board: "단서 연결" };
    let content = "";

    if (tab === "map") {
      content = `
        <div class="admin-hub-grid">
          <section class="panel-card">
            <div class="panel-card__header">지도 레이어</div>
            <div class="panel-card__body layer-toggle-list">
              ${layerToggleMarkup("investigations", "조사 지점")}
              ${layerToggleMarkup("danger", "위험구역")}
              ${layerToggleMarkup("corpseRoute", "시신 경로")}
              ${layerToggleMarkup("entities", "동결체")}
            </div>
          </section>
          <section class="panel-card">
            <div class="panel-card__header">지도 편집</div>
            <div class="panel-card__body form-stack">
              <button type="button" class="button ${ui.adminTool === "danger" ? "button--danger" : ""}" data-admin-action="toggle-danger">${ui.adminTool === "danger" ? "위험구역 편집 종료" : "위험구역 지정·해제"}</button>
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
          ${Object.entries(tabLabels).map(([id, label]) => `<button type="button" class="${tab === id ? "is-active" : ""}" data-admin-modal-tab="${id}">${label}</button>`).join("")}
        </nav>
        <div class="admin-modal-content">${content}</div>
      `,
      footer: `<button type="button" class="button button--danger button--small" data-admin-action="reset-demo">시제품 초기화</button><button type="button" class="button" data-modal-close>닫기</button>`,
    });
  }

  function adminPanelContent(tab, selected, statusOptions) {
    if (tab === "manage") {
      const statusList = selected.statuses.length
        ? selected.statuses.map((statusId) => {
          const status = STATUS_DEFINITIONS[statusId];
          return `<div class="status-list__item"><strong>${status.icon} ${escapeHtml(status.name)}</strong><button type="button" class="button button--small" data-remove-status="${statusId}">해제</button></div>`;
        }).join("")
        : emptyStateMarkup("상태이상 없음");
      const team = getTeamForCharacter(selected.id);
      const apPanel = selected.role === "spirit"
        ? `
          <section class="panel-card">
            <div class="panel-card__header">빙혼자 행동력</div>
            <div class="panel-card__body control-grid">
              <div class="control-row">
                <button type="button" class="button button--small" data-admin-action="ap-minus">−1</button>
                <button type="button" class="button button--small" data-admin-action="ap-plus-1">+1</button>
                <button type="button" class="button button--small" data-admin-action="ap-plus-3">+3</button>
                <button type="button" class="button button--small" data-admin-action="ap-max">최대</button>
              </div>
              <p class="login-card__footnote">현재 행동력 ${selected.ap} / ${selected.maxAp} · 공간 변경 1회당 1 소모</p>
            </div>
          </section>`
        : `
          <section class="panel-card">
            <div class="panel-card__header">생환자 이동 규칙</div>
            <div class="panel-card__body"><div class="side-note"><strong>플레이어 이동 잠금</strong><p>생환자는 자신의 화면에서 이동할 수 없습니다. 아래 위치 지정 도구로 운영진이 이동시킵니다.</p></div></div>
          </section>`;

      return `
        <section class="panel-card">
          <div class="panel-card__header">선택 캐릭터</div>
          <div class="panel-card__body">
            <div class="selected-summary">
              ${avatarMarkup(selected)}
              <div>
                <h3>${escapeHtml(selected.name)} · ID ${selected.id}</h3>
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
                <option value="survivor" ${selected.role === "survivor" ? "selected" : ""}>생환자</option>
                <option value="spirit" ${selected.role === "spirit" ? "selected" : ""}>빙혼자</option>
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
            <button type="button" class="button ${ui.adminTool === "danger" ? "button--danger" : ""}" data-admin-action="toggle-danger">${ui.adminTool === "danger" ? "위험구역 편집 중 · 위치 선택" : "위험구역 편집"}</button>
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
      const memberChecks = state.characters.map((character) => {
        const existingTeam = getTeamForCharacter(character.id);
        return `
          <label class="team-checkbox">
            <input type="checkbox" name="memberIds" value="${character.id}" />
            ${avatarMarkup(character, true)}
            <span><strong>${escapeHtml(character.name)} · ${character.id}</strong><small>${ROLE_LABELS[character.role]}${existingTeam ? ` · 현재 ${escapeHtml(existingTeam.name)}` : " · 미편성"}</small></span>
          </label>`;
      }).join("");
      const teamCards = state.teams.length
        ? state.teams.map((team) => {
          const members = team.memberIds.map(getCharacter).filter(Boolean);
          return `
            <article class="team-admin-card" style="--team-color:${team.color}">
              <header><strong>${escapeHtml(team.name)}</strong><span>${members.length}명</span></header>
              <div class="team-admin-card__members">${members.map((member) => `<span>${escapeHtml(member.name)} · ${member.id}</span>`).join("")}</div>
              <button type="button" class="button button--small button--danger" data-dissolve-team="${team.id}">그룹 해제</button>
            </article>`;
        }).join("")
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
            ${layerToggleMarkup("investigations", "조사 지점")}
            ${layerToggleMarkup("danger", "위험구역")}
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
      const logs = state.logs.slice(0, 30).map((entry) => `
        <div class="log-item"><strong>${escapeHtml(entry.time)}</strong><p>${escapeHtml(entry.message)}</p></div>
      `).join("") || emptyStateMarkup("아직 기록이 없습니다.");
      return `
        <section class="panel-card">
          <div class="panel-card__header">실시간 운영 로그</div>
          <div class="panel-card__body log-list">${logs}</div>
        </section>
      `;
    }

    const allEvidence = collectAllEvidence();
    const evidenceOptions = allEvidence.map((item) => `<option value="${escapeHtml(item.uid)}">${escapeHtml(item.title)}</option>`).join("");
    const connections = state.connections.length
      ? state.connections.map((connection) => `<div class="connection-item"><strong>${escapeHtml(connection.fromTitle)} ↔ ${escapeHtml(connection.toTitle)}</strong><p>${escapeHtml(connection.note || "연결 근거 미작성")}</p></div>`).join("")
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

  function renderPlayerJournal() {
    const character = getCharacter(session.characterId);
    const tabs = [
      ["inventory", "소지품"],
      ["records", "조사"],
      ["board", "공동보드"],
      ["tracking", "추적"],
    ];
    if (!["inventory", "records", "board", "tracking"].includes(ui.rightPanelTab)) {
      ui.rightPanelTab = "inventory";
    }

    elements.rightSidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>조사 기록</h2>
        <span class="status-pill status-pill--online">자동 저장</span>
      </div>
      <div class="sidebar-body">
        <div class="panel-tabs">${tabs.map(([id, label]) => `<button type="button" class="panel-tab ${ui.rightPanelTab === id ? "is-active" : ""}" data-panel-tab="${id}">${label}</button>`).join("")}</div>
        <div class="panel-content">${playerJournalContent(character, ui.rightPanelTab)}</div>
      </div>
    `;
  }

  function playerJournalContent(character, tab) {
    if (tab === "inventory") {
      const items = character.inventory.length
        ? character.inventory.map((item) => `
          <button type="button" class="inventory-item" data-evidence-id="${escapeHtml(item.uid)}">
            <span class="inventory-item__head"><strong>${escapeHtml(item.title)}</strong>${certaintyChipMarkup(item.certainty)}</span>
            <p>${escapeHtml(item.description)}</p>
          </button>
        `).join("")
        : emptyStateMarkup("조사로 획득한 자료가 없습니다.");
      return `<section class="panel-card"><div class="panel-card__header">획득 자료 ${character.inventory.length}건</div><div class="panel-card__body inventory-list">${items}</div></section>`;
    }

    if (tab === "records") {
      const records = character.records.length
        ? character.records.map((record) => `
          <div class="record-item">
            <span class="record-item__head"><strong>${escapeHtml(record.title)}</strong><span>${escapeHtml(record.floor)}</span></span>
            <p>${escapeHtml(record.description)}</p>
          </div>
        `).join("")
        : emptyStateMarkup("완료한 조사가 없습니다.");
      return `<section class="panel-card"><div class="panel-card__header">조사한 장소</div><div class="panel-card__body record-list">${records}</div></section>`;
    }

    if (tab === "board") {
      const ownedUids = new Set(character.inventory.map((item) => item.uid));
      const connections = state.connections.filter((connection) => ownedUids.has(connection.from) && ownedUids.has(connection.to));
      const content = connections.length
        ? connections.map((connection) => `<div class="connection-item"><strong>${escapeHtml(connection.fromTitle)} ↔ ${escapeHtml(connection.toTitle)}</strong><p>${escapeHtml(connection.note || "연결 근거 미작성")}</p></div>`).join("")
        : emptyStateMarkup("운영진이 연결한 단서가 아직 없습니다.");
      return `<section class="panel-card"><div class="panel-card__header">인물 · 장소 · 사건 연결</div><div class="panel-card__body connection-list">${content}</div></section>`;
    }

    return `
      <section class="panel-card">
        <div class="panel-card__header">사라진 시신</div>
        <div class="panel-card__body">
          <div class="stat-grid">
            <div class="stat-card"><span>최초 확인</span><strong>7구</strong></div>
            <div class="stat-card"><span>현재 확인</span><strong>4구</strong></div>
            <div class="stat-card"><span>사라진 시신</span><strong>3구</strong></div>
            <div class="stat-card"><span>확정 경로</span><strong>2단계</strong></div>
          </div>
        </div>
      </section>
      <section class="panel-card">
        <div class="panel-card__header">동결체 출몰 기록</div>
        <div class="panel-card__body record-list">
          <div class="record-item"><strong>B1 서비스 통로</strong><p>유력 · 마지막 확인 14:21 · 이동 방향 연구별관</p></div>
          <div class="record-item"><strong>2F 포스터 전시장</strong><p>미확인 · 낮은 온도 흔적만 발견</p></div>
        </div>
      </section>
    `;
  }

  function renderFloorTabs() {
    const actor = getMovementActor();
    elements.currentFloorLabel.textContent = ui.currentFloor;
    elements.floorTabs.innerHTML = FLOOR_ORDER.map((floorId) => {
      const canTransition = actor?.role === "spirit"
        && actor.floor !== floorId
        && getTransitionAt(actor.floor, actor.x, actor.y)?.destinations.includes(floorId);
      const suffix = canTransition ? `<small>이동</small>` : "";
      return `<button type="button" data-floor="${floorId}" class="${floorId === ui.currentFloor ? "is-active" : ""}">${floorId}${suffix}</button>`;
    }).join("");
  }

  function renderMap() {
    const floor = FLOOR_DEFINITIONS[ui.currentFloor];
    const perspective = getPerspective();
    const movementActor = getMovementActor();
    const reachable = getReachableCellCosts(movementActor, floor.id);
    const warmth = getWarmthInfo(perspective.mode, perspective.character, floor.id);
    const focusCharacter = perspective.mode === "admin" ? movementActor : perspective.character;
    const activeRoomId = focusCharacter && focusCharacter.floor === floor.id
      ? getRoomId(focusCharacter.floor, focusCharacter.x, focusCharacter.y)
      : null;

    elements.mapGrid.style.setProperty("--columns", GRID_COLUMNS);
    elements.mapGrid.style.setProperty("--rows", GRID_ROWS);
    elements.mapGrid.classList.toggle("is-player-locked", session.type === "player" && movementActor.role === "survivor");
    elements.mapGrid.innerHTML = "";

    floor.rooms.forEach((roomDefinition) => {
      const roomElement = document.createElement("div");
      roomElement.className = "map-room";
      roomElement.dataset.roomId = roomDefinition.id;
      roomElement.style.gridColumn = `${roomDefinition.x1 + 1} / ${roomDefinition.x2 + 2}`;
      roomElement.style.gridRow = `${roomDefinition.y1 + 1} / ${roomDefinition.y2 + 2}`;
      roomElement.style.setProperty("--room-color", roomDefinition.color);
      const burningLevel = getSpaceBurningLevel(floor.id, roomDefinition.id);
      roomElement.dataset.burningLevel = String(burningLevel);
      if (roomDefinition.id === activeRoomId) roomElement.classList.add("is-active-room");
      if (warmth.active && roomDefinition.id === warmth.roomId) roomElement.classList.add("is-warm");
      roomElement.innerHTML = `<span>${escapeHtml(roomDefinition.label)}</span>`;
      elements.mapGrid.appendChild(roomElement);
    });

    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLUMNS; x += 1) {
        const cell = floor.cells[cellKey(x, y)];
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

        if (reachable.has(key) && movementActor.floor === floor.id && movementActor.role === "spirit") cellElement.classList.add("is-reachable");
        if (movementActor.floor === floor.id && movementActor.x === x && movementActor.y === y) cellElement.classList.add("is-current");
        if (state.layers.danger && isDangerCell(floor.id, x, y)) cellElement.classList.add("is-danger");
        if (getTransitionAt(floor.id, x, y)) cellElement.classList.add("is-transition");

        const showRoomDetails = perspective.mode === "admin" || cell.roomId === activeRoomId;
        if (showRoomDetails) appendMapMarkers(cellElement, floor, x, y, perspective);

        const visibleCharacters = getVisibleCharactersAtCell(floor.id, x, y, perspective, true);
        visibleCharacters.forEach((character) => {
          cellElement.insertAdjacentHTML("beforeend", tokenMarkup(character, character.id === movementActor.id));
        });

        elements.mapGrid.appendChild(cellElement);
      }
    }

    renderWarmthBanner(warmth, perspective);
    updateMovementRule(movementActor);
  }

  function appendMapMarkers(cellElement, floor, x, y, perspective) {
    const key = cellKey(x, y);
    const investigation = floor.investigations.find((item) => item.x === x && item.y === y);
    const actor = getMovementActor();

    if (state.layers.investigations && investigation) {
      const done = actor.investigations.includes(investigation.id);
      cellElement.insertAdjacentHTML("beforeend", `<span class="map-cell__marker ${done ? "map-cell__marker--done" : "map-cell__marker--investigation"}" title="${done ? "조사 완료" : "조사 가능"}">${done ? "✓" : "⌕"}</span>`);
    }

    if (state.layers.entities) {
      const entity = floor.entities.find((item) => item.x === x && item.y === y);
      if (entity && (perspective.mode === "admin" || entity.visibleTo.includes(perspective.mode))) {
        cellElement.insertAdjacentHTML("beforeend", `<span class="map-cell__marker map-cell__marker--entity" title="동결체 출몰">❄</span>`);
      }
    }

    if (state.layers.corpseRoute) {
      const routePoint = floor.corpseRoute.find((item) => item.x === x && item.y === y);
      if (routePoint && perspective.mode === "admin") {
        cellElement.insertAdjacentHTML("beforeend", `<span class="map-cell__marker map-cell__marker--corpse" title="시신 이동 경로">${escapeHtml(routePoint.label)}</span>`);
      }
    }

    if (state.layers.danger && isDangerCell(floor.id, x, y) && perspective.mode === "admin") {
      cellElement.insertAdjacentHTML("beforeend", `<span class="map-cell__marker" title="운영진 지정 위험구역">!</span>`);
    }

    if (!floor.cells[key]) {
      throw new Error(`Floor cell missing: ${floor.id} ${key}`);
    }
  }

  function renderWarmthBanner(warmth, perspective) {
    if (perspective.mode !== "spirit" || !perspective.character || !warmth.active) {
      elements.warmthBanner.classList.add("is-hidden");
      elements.warmthBanner.textContent = "";
      return;
    }

    const intensity = warmth.count >= 3 ? "강한" : warmth.count === 2 ? "선명한" : "희미한";
    elements.warmthBanner.textContent = `${intensity} 온기가 느껴집니다. 이 공간에 살아 있는 존재가 ${warmth.count}명 있습니다.`;
    elements.warmthBanner.classList.remove("is-hidden");
  }

  function renderSelectedSummary() {
    const selected = getMovementActor();
    const visibleTeams = getVisibleTeamsForCharacter(selected.id);
    const allTeams = getTeamsForCharacter(selected.id);
    const movement = selected.role === "spirit"
      ? `행동력 ${selected.ap} / ${selected.maxAp}`
      : "위치 이동은 운영진만 가능";
    const teamText = allTeams.length
      ? ` · 그룹 ${allTeams.map((team) => `${team.name}${team.visible === false ? "(숨김)" : ""}`).join(", ")}`
      : " · 미편성";
    elements.selectedCharacterSummary.innerHTML = `
      ${avatarMarkup(selected)}
      <div>
        <h3>${escapeHtml(selected.name)} · ID ${selected.id} ${roleChipMarkup(selected.role)}</h3>
        <p>${escapeHtml(selected.floor)} ${escapeHtml(getRoomLabel(selected.floor, selected.x, selected.y))} · ${movement}${teamText}${visibleTeams.length ? "" : allTeams.length ? " · 원격 공유 없음" : ""}</p>
      </div>
    `;
  }

  function renderComparison() {
    if (session.type !== "admin") return;
    elements.comparisonSection.classList.toggle("is-collapsed", !ui.comparisonOpen);
    if (!ui.comparisonOpen) return;

    const survivor = getPerspectiveCharacterForMode("survivor", ui.currentFloor);
    const spirit = getPerspectiveCharacterForMode("spirit", ui.currentFloor);
    elements.survivorPreviewName.textContent = survivor ? `${survivor.name} · ${survivor.id}` : "해당 층 없음";
    elements.spiritPreviewName.textContent = spirit ? `${spirit.name} · ${spirit.id}` : "해당 층 없음";
    renderMiniMap(elements.survivorMiniMap, "survivor", survivor);
    renderMiniMap(elements.spiritMiniMap, "spirit", spirit);
    renderMiniMap(elements.adminMiniMap, "admin", null);
  }

  function renderMiniMap(container, mode, character) {
    const floor = FLOOR_DEFINITIONS[ui.currentFloor];
    const focusCharacter = mode === "admin" ? getMovementActor() : character;
    const activeRoomId = focusCharacter && focusCharacter.floor === floor.id
      ? getRoomId(focusCharacter.floor, focusCharacter.x, focusCharacter.y)
      : null;
    const warmth = getWarmthInfo(mode, character, floor.id);
    let html = "";

    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLUMNS; x += 1) {
        const cell = floor.cells[cellKey(x, y)];
        const classes = ["mini-cell", "is-visible"];
        if (cell.roomId === activeRoomId) classes.push("is-active-room");
        if (isDangerCell(floor.id, x, y)) classes.push("is-danger");
        if (warmth.active && cell.roomId === warmth.roomId) classes.push("is-warm");
        const tokens = getVisibleCharactersAtCell(floor.id, x, y, { mode, character }, true)
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

  function updateInvestigationButton() {
    const actor = getMovementActor();
    const investigation = getInvestigationAt(actor.floor, actor.x, actor.y);
    elements.investigateButton.disabled = !investigation || actor.floor !== ui.currentFloor;
    if (!investigation) {
      elements.investigateButton.textContent = "현재 위치 조사";
    } else if (actor.investigations.includes(investigation.id)) {
      elements.investigateButton.textContent = "조사 기록 보기";
    } else {
      elements.investigateButton.textContent = "조사하기 · 행동력 미소모";
    }
  }

  function updateMovementRule(actor) {
    const visibleTeams = getVisibleTeamsForCharacter(actor.id);
    const sharedText = visibleTeams.length ? ` · 표시 그룹 ${visibleTeams.map((team) => team.name).join(", ")}` : " · 원격 위치 공유 없음";
    elements.movementRule.textContent = actor.role === "spirit"
      ? `빙혼자 · 공간 변경 1회 = 행동력 1 · 이동 전 확인${sharedText}`
      : `생환자 · 직접 이동 불가 · 운영진 위치 제어${sharedText}`;
  }

  function handleViewModeClick(event) {
    if (session.type !== "admin") return;
    const button = event.target.closest("[data-view-mode]");
    if (!button) return;
    ui.viewMode = button.dataset.viewMode;
    ui.adminTool = null;
    renderAll();
  }

  function handleFloorTabClick(event) {
    const button = event.target.closest("[data-floor]");
    if (!button) return;
    const targetFloor = button.dataset.floor;
    if (targetFloor === ui.currentFloor) return;

    if (session.type === "admin") {
      ui.currentFloor = targetFloor;
      renderAll();
      return;
    }

    const character = getCharacter(session.characterId);
    if (character.role === "survivor") {
      ui.currentFloor = targetFloor;
      renderAll();
      showToast("생환자는 지도를 열람할 수 있지만 자신의 위치는 이동하지 않습니다.");
      return;
    }

    const transition = getTransitionAt(character.floor, character.x, character.y);
    if (!transition || !transition.destinations.includes(targetFloor)) {
      ui.currentFloor = targetFloor;
      renderAll();
      showToast("이 층은 열람 중입니다. 실제 층 이동은 계단이나 엘리베이터 위치에서 가능합니다.");
      return;
    }

    if (character.ap < 1) {
      showToast("층 이동에 필요한 행동력이 없습니다.");
      return;
    }

    requestSpiritFloorMove(character, targetFloor, transition);
  }

  function requestSpiritFloorMove(character, targetFloor, transition) {
    const destinationTransition = findMatchingTransition(targetFloor, transition.type);
    const method = transition.type === "stairs" ? "계단" : "엘리베이터";
    openModal({
      eyebrow: "FLOOR MOVEMENT",
      title: "빙혼자 층 이동 확인",
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
    elements.modalFooter.querySelector("[data-confirm-floor-move]")?.addEventListener("click", () => {
      if (character.ap < 1) {
        closeModal();
        showToast("행동력이 부족합니다.");
        return;
      }
      const fromFloor = character.floor;
      const fromRoom = getRoomLabel(character.floor, character.x, character.y);
      character.ap -= 1;
      character.floor = targetFloor;
      character.x = destinationTransition.x;
      character.y = destinationTransition.y;
      ui.currentFloor = targetFloor;
      const toRoom = getRoomLabel(character.floor, character.x, character.y);
      recordSpiritMovement(character, { fromFloor, fromRoom, toFloor: targetFloor, toRoom, cost: 1, source: method });
      addLog(`${character.name}이(가) ${method}을 이용해 ${targetFloor}으로 이동했습니다. 공간 변경 행동력 −1.`);
      persistState();
      closeModal();
      renderAll();
      showToast("행동력 1을 사용해 층을 이동했습니다.");
    });
  }

  function handleMapClick(event) {
    const tokenElement = event.target.closest("[data-token-character]");
    if (tokenElement && session.type === "admin" && !ui.adminTool) {
      const character = getCharacter(Number(tokenElement.dataset.tokenCharacter));
      if (character) {
        ui.selectedCharacterId = character.id;
        ui.currentFloor = character.floor;
        renderAll();
        showCharacterManagementModal(character.id);
      }
      return;
    }

    const cellElement = event.target.closest(".map-cell");
    if (!cellElement) return;
    const x = Number(cellElement.dataset.x);
    const y = Number(cellElement.dataset.y);
    const actor = getMovementActor();

    if (session.type === "admin" && ui.adminTool === "forceMove") {
      const previous = { floor: actor.floor, room: getRoomLabel(actor.floor, actor.x, actor.y) };
      settleFreezeClock(actor, previous.floor, getRoomIdByLabel(previous.floor, previous.room));
      actor.floor = ui.currentFloor;
      actor.x = x;
      actor.y = y;
      if (actor.role === "spirit") recordSpiritMovement(actor, { fromFloor: previous.floor, fromRoom: previous.room, toFloor: actor.floor, toRoom: getRoomLabel(actor.floor, actor.x, actor.y), cost: 0, source: "운영진 강제 이동" });
      ui.adminTool = null;
      addLog(`관리자가 ${actor.name}의 위치를 ${ui.currentFloor} ${getRoomLabel(ui.currentFloor, x, y)}로 변경했습니다.`);
      persistState();
      renderAll();
      showToast(`${actor.name}을(를) ${getRoomLabel(ui.currentFloor, x, y)}로 이동했습니다.`);
      return;
    }

    if (session.type === "admin" && ui.adminTool === "danger") {
      toggleDangerCell(ui.currentFloor, x, y);
      renderAll();
      return;
    }

    if (session.type === "admin") {
      showTeamDestinationModal(ui.currentFloor, x, y);
      return;
    }

    if (actor.role === "survivor") {
      showToast("생환자는 자신의 위치를 직접 옮길 수 없습니다. 운영진이 이동시킵니다.");
      return;
    }

    if (actor.floor !== ui.currentFloor) {
      showToast(`${actor.name}은(는) 현재 ${actor.floor}에 있습니다. 실제 위치가 있는 층에서 이동해 주세요.`);
      return;
    }

    if (actor.x === x && actor.y === y) {
      const investigation = getInvestigationAt(actor.floor, x, y);
      if (investigation) handleInvestigateCurrent();
      return;
    }

    moveActorTo(actor, x, y);
  }

  function showTeamDestinationModal(floor, x, y) {
    if (!state.teams.length) {
      showToast("먼저 왼쪽 팀 편성에서 이동시킬 그룹을 만들어 주세요.");
      return;
    }
    const roomLabel = getRoomLabel(floor, x, y);
    const teamOptions = state.teams.map((team) => {
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
    }).join("");

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
    const teams = teamIds.map((id) => state.teams.find((team) => team.id === id)).filter(Boolean);
    const memberIds = [...new Set(teams.flatMap((team) => team.memberIds))];
    moveCharacterSetTo(memberIds, floor, x, y);
    addLog(`관리자가 ${teams.map((team) => team.name).join(", ")} 전원을 ${floor} ${getRoomLabel(floor, x, y)}로 이동했습니다.`);
    persistState();
    closeModal();
    renderAll();
    showToast(`${teams.map((team) => team.name).join(", ")} 팀을 이동했습니다.`);
  }

  function moveActorTo(actor, targetX, targetY) {
    if (actor.role !== "spirit" && session.type !== "admin") {
      showToast("직접 이동은 빙혼자만 가능합니다.");
      return;
    }

    if (actor.statuses.includes("immobilized")) {
      showToast("행동불능 상태라 이동할 수 없습니다.");
      return;
    }

    if (isDangerCell(actor.floor, targetX, targetY) && session.type !== "admin") {
      showToast("운영진이 접근을 제한한 위험구역입니다.");
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
      title: "빙혼자 이동 확인",
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
    elements.modalFooter.querySelector("[data-confirm-spirit-move]")?.addEventListener("click", () => commitActorMove(actor, targetX, targetY, cost));
  }

  function commitActorMove(actor, targetX, targetY, cost) {
    if (actor.ap < cost) {
      closeModal();
      showToast("행동력이 변경되어 이동할 수 없습니다.");
      return;
    }
    const fromFloor = actor.floor;
    const fromRoom = getRoomLabel(actor.floor, actor.x, actor.y);
    actor.ap -= cost;
    actor.x = targetX;
    actor.y = targetY;
    const toRoom = getRoomLabel(actor.floor, actor.x, actor.y);
    recordSpiritMovement(actor, { fromFloor, fromRoom, toFloor: actor.floor, toRoom, cost, source: "플레이어 이동" });
    const movementMessage = cost === 0
      ? `${actor.name}이(가) ${toRoom} 내부에서 위치를 조정했습니다. 행동력 미소모.`
      : `${actor.name}이(가) ${fromRoom}에서 ${toRoom}(으)로 이동했습니다. 공간 변경 ${cost}회, 행동력 −${cost}.`;
    addLog(movementMessage);
    persistState();
    closeModal();
    renderAll();
    showToast(cost === 0 ? "같은 공간 안에서 이동했습니다." : `행동력 ${cost}을 사용해 이동했습니다.`);
  }

  function handleInvestigateCurrent() {
    const actor = getMovementActor();
    if (actor.floor !== ui.currentFloor) {
      showToast("캐릭터가 있는 층에서 조사해 주세요.");
      return;
    }

    const investigation = getInvestigationAt(actor.floor, actor.x, actor.y);
    if (!investigation) {
      showToast("현재 위치에는 조사 가능한 대상이 없습니다.");
      return;
    }

    if (actor.investigations.includes(investigation.id)) {
      const evidence = actor.inventory.find((item) => item.sourceId === investigation.id);
      showEvidenceModal(evidence, investigation);
      return;
    }

    openModal({
      eyebrow: `${actor.floor} · ${getRoomLabel(actor.floor, actor.x, actor.y)}`,
      title: investigation.title,
      body: `
        <div class="evidence-detail">
          <div class="evidence-detail__image">⌕</div>
          <p>${escapeHtml(investigation.prompt)}</p>
          <div class="detail-grid">
            <div><span>행동력</span><strong>미소모</strong></div>
            <div><span>획득 자료</span><strong>${escapeHtml(investigation.evidenceTitle)}</strong></div>
          </div>
        </div>
      `,
      footer: `
        <button type="button" class="button" data-modal-close>취소</button>
        <button type="button" class="button button--primary" data-confirm-investigation="${investigation.id}">조사하기</button>
      `,
    });

    elements.modalFooter.querySelector("[data-modal-close]")?.addEventListener("click", closeModal);
    elements.modalFooter.querySelector("[data-confirm-investigation]")?.addEventListener("click", () => completeInvestigation(actor, investigation));
  }

  function completeInvestigation(actor, investigation) {
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
    addLog(`${actor.name}이(가) ${investigation.title}을(를) 조사해 「${investigation.evidenceTitle}」을(를) 획득했습니다. 행동력 미소모.`);
    persistState();
    closeModal();
    renderAll();
    showToast(`자료 「${investigation.evidenceTitle}」을(를) 획득했습니다.`);
  }

  function handleLeftSidebarClick(event) {
    if (session.type !== "admin") return;

    const rosterFilterButton = event.target.closest("[data-sidebar-roster-filter]");
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
    const visibilityButton = event.target.closest("[data-toggle-team-visibility]");
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
      const character = getCharacter(Number(manageButton.dataset.manageCharacter));
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
    const character = getCharacter(Number(selectButton.dataset.selectCharacter));
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
        const evidence = collectAllEvidence().find((item) => item.uid === evidenceButton.dataset.evidenceId);
        if (evidence) showEvidenceModal(evidence);
      }
      return;
    }

    const modalTab = event.target.closest("[data-admin-modal-tab]");
    if (modalTab) {
      showAdminHubModal(modalTab.dataset.adminModalTab);
      return;
    }

    const mindNoteDelete = event.target.closest("[data-delete-player-note]");
    if (mindNoteDelete && session.type === "player") {
      const note = state.mindMap.notes.find((item) => item.id === mindNoteDelete.dataset.deletePlayerNote);
      if (note && note.authorId === session.characterId) {
        state.mindMap.notes = state.mindMap.notes.filter((item) => item.id !== note.id);
        persistState();
        renderRightSidebar();
      }
      return;
    }

    const resetClockButton = event.target.closest("[data-reset-infection-clock]");
    if (resetClockButton) {
      const character = getCharacter(Number(resetClockButton.dataset.resetInfectionClock));
      if (character) {
        resetInfectionClock(character);
        addLog(`관리자가 ${character.name}의 감염 진행 시간을 120:00:00으로 초기화했습니다.`);
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
      if (["toggle-force-move", "toggle-force-move-group", "toggle-danger"].includes(action) && ui.adminTool) {
        closeModal();
      }
      return;
    }

    const visibilityButton = event.target.closest("[data-toggle-team-visibility]");
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

    const removeStatusButton = event.target.closest("[data-remove-status]");
    if (removeStatusButton) {
      const character = getCharacter(ui.selectedCharacterId);
      character.statuses = character.statuses.filter((id) => id !== removeStatusButton.dataset.removeStatus);
      addLog(`관리자가 ${character.name}의 ${STATUS_DEFINITIONS[removeStatusButton.dataset.removeStatus].name} 상태를 해제했습니다.`);
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
      const evidence = collectAllEvidence().find((item) => item.uid === evidenceButton.dataset.evidenceId);
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
      character.statuses = character.statuses.filter((id) => id !== removeStatusButton.dataset.removeStatus);
      addLog(`관리자가 ${character.name}의 ${STATUS_DEFINITIONS[removeStatusButton.dataset.removeStatus].name} 상태를 해제했습니다.`);
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

    const evidenceButton = event.target.closest("[data-evidence-id]");
    if (evidenceButton) {
      const evidence = collectAllEvidence().find((item) => item.uid === evidenceButton.dataset.evidenceId);
      if (evidence) showEvidenceModal(evidence);
    }
  }

  function handleRightSidebarChange(event) {
    if (session.type !== "admin") return;
    if (event.target.matches("[data-spirit-state-select]")) {
      const character = getCharacter(ui.selectedCharacterId);
      if (!character || character.role !== "spirit") return;
      character.spiritState = event.target.value;
      character.spiritSince = new Date().toISOString();
      addLog(`관리자가 ${character.name}의 빙혼 상태를 ${SPIRIT_STATE_LABELS[character.spiritState]}(으)로 변경했습니다.`);
      persistState();
      renderAll();
      if (!elements.modalBackdrop.classList.contains("is-hidden")) showCharacterManagementModal(character.id);
      return;
    }
    if (event.target.matches("[data-role-select]")) {
      const character = getCharacter(ui.selectedCharacterId);
      character.role = event.target.value;
      if (character.role === "survivor") {
        character.ap = 0;
        character.maxAp = 0;
        character.spiritState = null;
        character.spiritSince = null;
        if (!character.freezeClock) character.freezeClock = { baseHours: 0, lastUpdated: new Date().toISOString(), modifiers: [] };
      } else {
        if (character.maxAp === 0) {
          character.maxAp = 5;
          character.ap = 3;
        }
        character.spiritState = character.spiritState || "stable";
        character.spiritSince = character.spiritSince || new Date().toISOString();
      }
      addLog(`관리자가 ${character.name}의 분류를 ${ROLE_LABELS[character.role]}(으)로 변경했습니다.`);
      persistState();
      renderAll();
      if (!elements.modalBackdrop.classList.contains("is-hidden")) showCharacterManagementModal(character.id);
    }
  }

  function handleRightSidebarSubmit(event) {
    const mindNoteForm = event.target.closest("[data-player-mind-note-form]");
    if (mindNoteForm) {
      event.preventDefault();
      createMindNote(new FormData(mindNoteForm));
      return;
    }

    const destinationForm = event.target.closest("[data-team-destination-form]");
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

    if (["ap-minus", "ap-plus-1", "ap-plus-3", "ap-max"].includes(action)) {
      if (character.role !== "spirit") {
        showToast("행동력은 빙혼자에게만 적용됩니다.");
        return;
      }
      if (action === "ap-minus") character.ap = Math.max(0, character.ap - 1);
      if (action === "ap-plus-1") character.ap = Math.min(character.maxAp, character.ap + 1);
      if (action === "ap-plus-3") character.ap = Math.min(character.maxAp, character.ap + 3);
      if (action === "ap-max") character.ap = character.maxAp;
      addLog(`관리자가 ${character.name}의 행동력을 ${character.ap} / ${character.maxAp}(으)로 조정했습니다.`);
      persistState();
      renderAll();
      if (!elements.modalBackdrop.classList.contains("is-hidden")) showCharacterManagementModal(character.id);
      return;
    }

    if (action === "apply-status") {
      const select = elements.modal.querySelector("[data-status-select]") || elements.rightSidebar.querySelector("[data-status-select]");
      const statusId = select?.value;
      if (!statusId) return;
      if (!character.statuses.includes(statusId)) character.statuses.push(statusId);
      addLog(`관리자가 ${character.name}에게 ${STATUS_DEFINITIONS[statusId].name} 상태를 적용했습니다.`);
      persistState();
      renderAll();
      if (!elements.modalBackdrop.classList.contains("is-hidden")) showCharacterManagementModal(character.id);
      return;
    }

    if (action === "toggle-force-move") {
      ui.adminTool = ui.adminTool === "forceMove" ? null : "forceMove";
      showToast(ui.adminTool ? "지도에서 이동시킬 공간을 선택하세요." : "개별 위치 지정 모드를 종료했습니다.");
      renderAll();
      return;
    }

    if (action === "toggle-force-move-group") {
      const team = getTeamForCharacter(character.id);
      if (!team) {
        showToast("선택 캐릭터가 팀에 편성되어 있지 않습니다.");
        return;
      }
      ui.adminTool = ui.adminTool === "forceMoveGroup" ? null : "forceMoveGroup";
      showToast(ui.adminTool ? `${team.name} 전원을 옮길 공간을 선택하세요.` : "팀 위치 지정 모드를 종료했습니다.");
      renderAll();
      return;
    }

    if (action === "toggle-danger") {
      ui.adminTool = ui.adminTool === "danger" ? null : "danger";
      showToast(ui.adminTool ? "지도에서 위험구역으로 지정하거나 해제할 위치를 선택하세요." : "위험구역 편집을 종료했습니다.");
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
    addLog(`관리자가 ${character.name}에게 자료 「${title}」을(를) 지급했습니다.`);
    persistState();
    renderAll();
    if (!elements.modalBackdrop.classList.contains("is-hidden")) showCharacterManagementModal(character.id);
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
    addLog(`운영진이 「${from.title}」과(와) 「${to.title}」을(를) 연결했습니다.`);
    persistState();
    renderAll();
    showAdminHubModal("board");
    showToast("단서 연결을 저장했습니다.");
  }

  function toggleComparison() {
    if (session.type !== "admin") return;
    ui.comparisonOpen = !ui.comparisonOpen;
    elements.compareViewsButton.textContent = ui.comparisonOpen ? "3시점 접기" : "3시점 비교";
    renderComparison();
  }

  function toggleDangerCell(floor, x, y) {
    const key = mapKey(floor, x, y);
    const index = state.dangerZones.indexOf(key);
    if (index >= 0) {
      state.dangerZones.splice(index, 1);
      addLog(`관리자가 ${floor} ${getRoomLabel(floor, x, y)}의 위험구역 지정을 해제했습니다.`);
    } else {
      state.dangerZones.push(key);
      addLog(`관리자가 ${floor} ${getRoomLabel(floor, x, y)}의 칸을 위험구역으로 지정했습니다.`);
    }
    persistState();
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
    if (selected && selected.role === mode && selected.floor === floor) return selected;
    return state.characters.find((character) => character.role === mode && character.floor === floor)
      || state.characters.find((character) => character.role === mode)
      || null;
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
    if (!character || character.role !== "spirit" || character.floor !== floorId || character.statuses.includes("immobilized")) return reachable;

    const startKey = cellKey(character.x, character.y);
    const distances = new Map([[startKey, 0]]);
    const queue = [{ x: character.x, y: character.y, cost: 0 }];
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];

    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift();
      if (current.cost !== distances.get(cellKey(current.x, current.y))) continue;

      directions.forEach(([dx, dy]) => {
        const x = current.x + dx;
        const y = current.y + dy;
        if (!isWithinGrid(x, y) || !canStep(floorId, current.x, current.y, x, y) || isDangerCell(floorId, x, y)) return;
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

  function getVisibleCharactersAtCell(floorId, x, y, perspective, visible) {
    if (!visible) return [];
    const characters = state.characters.filter((character) => character.floor === floorId && character.x === x && character.y === y);
    if (perspective.mode === "admin") return characters;
    if (!perspective.character) return [];

    const viewer = perspective.character;
    const viewerRoomId = viewer.floor === floorId ? getRoomId(viewer.floor, viewer.x, viewer.y) : null;
    const visibleTeams = getVisibleTeamsForCharacter(viewer.id);
    const sharedIds = new Set([viewer.id, ...visibleTeams.flatMap((team) => team.memberIds)]);

    return characters.filter((character) => {
      if (character.id === viewer.id) return true;
      if (character.role !== viewer.role) return false;
      if (sharedIds.has(character.id)) return true;
      if (viewerRoomId === null) return false;
      return getRoomId(character.floor, character.x, character.y) === viewerRoomId;
    });
  }

  function canStep(floorId, fromX, fromY, toX, toY) {
    const floor = FLOOR_DEFINITIONS[floorId];
    const from = floor.cells[cellKey(fromX, fromY)];
    const to = floor.cells[cellKey(toX, toY)];
    if (!from || !to) return false;
    if (from.roomId === to.roomId) return true;
    return floor.doorways.has(edgeKey(fromX, fromY, toX, toY));
  }

  function getWarmthInfo(mode, character, floorId) {
    if (mode !== "spirit" || !character || character.floor !== floorId) {
      return { active: false, count: 0, roomId: null };
    }

    const roomId = getRoomId(character.floor, character.x, character.y);
    const survivors = state.characters.filter((candidate) => candidate.role === "survivor" && candidate.floor === character.floor && getRoomId(candidate.floor, candidate.x, candidate.y) === roomId);
    return { active: survivors.length > 0, count: survivors.length, roomId };
  }

  function showEmergencyEvent() {
    openModal({
      eyebrow: "EMERGENCY EVENT",
      title: "B1 서비스 통로 온도 급강하",
      body: `
        <div class="evidence-detail">
          <div class="evidence-detail__image">❄</div>
          <p>14:36부터 B1 서비스 통로의 온도가 비정상적으로 하락하고 있습니다. 동결체 출몰 가능성이 있으며 운영진은 해당 구역을 위험구역으로 지정할 수 있습니다.</p>
          <div class="detail-grid">
            <div><span>발생 위치</span><strong>B1 서비스 통로</strong></div>
            <div><span>확정도</span><strong>유력</strong></div>
          </div>
        </div>
      `,
      footer: `<button type="button" class="button button--primary" data-modal-close>확인</button>`,
    });
    elements.modalFooter.querySelector("[data-modal-close]")?.addEventListener("click", closeModal);
  }

  function showResetConfirmation() {
    openModal({
      eyebrow: "DEMO DATA",
      title: "시제품 데이터를 초기화할까요?",
      body: "<p>캐릭터 위치, 행동력, 조사 자료, 상태이상, 위험구역과 운영 로그가 최초 상태로 돌아갑니다.</p>",
      footer: `<button type="button" class="button" data-modal-close>취소</button><button type="button" class="button button--danger" data-confirm-reset>초기화</button>`,
    });
    elements.modalFooter.querySelector("[data-modal-close]")?.addEventListener("click", closeModal);
    elements.modalFooter.querySelector("[data-confirm-reset]")?.addEventListener("click", () => {
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

  function showEvidenceModal(evidence, investigation = null) {
    if (!evidence && investigation) {
      evidence = {
        title: investigation.evidenceTitle,
        description: investigation.result,
        certainty: investigation.certainty,
        floor: investigation.floor,
        room: getRoomLabel(investigation.floor, investigation.x, investigation.y),
        discoveredBy: "조사 기록",
        fileName: null,
        imageData: null,
      };
    }
    if (!evidence) return;

    const imageMarkup = evidence.imageData
      ? `<figure class="evidence-image"><img src="${evidence.imageData}" alt="${escapeHtml(evidence.title)} 첨부 이미지" /></figure>`
      : `<div class="evidence-detail__image">▤</div>`;
    const downloadButton = evidence.imageData
      ? `<a class="button button--primary" href="${evidence.imageData}" download="${escapeHtml(evidence.fileName || `${evidence.title}.png`)}">사진 다운로드</a>`
      : "";

    openModal({
      eyebrow: "ITEM / EVIDENCE",
      title: evidence.title,
      body: `
        <div class="evidence-detail">
          ${imageMarkup}
          <p>${escapeHtml(evidence.description)}</p>
          <div class="detail-grid">
            <div><span>확정 상태</span><strong>${certaintyLabel(evidence.certainty)}</strong></div>
            <div><span>등록·발견자</span><strong>${escapeHtml(evidence.discoveredBy || "미상")}</strong></div>
            <div><span>등록 장소</span><strong>${escapeHtml(`${evidence.floor || "-"} ${evidence.room || ""}`)}</strong></div>
            <div><span>첨부 파일</span><strong>${escapeHtml(evidence.fileName || "없음")}</strong></div>
          </div>
        </div>
      `,
      footer: `${downloadButton}<button type="button" class="button" data-modal-close>닫기</button>`,
    });
    elements.modalFooter.querySelector("[data-modal-close]")?.addEventListener("click", closeModal);
  }

  function openModal({ eyebrow = "", title, body, footer = "" }) {
    elements.modalEyebrow.textContent = eyebrow;
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = body;
    elements.modalFooter.innerHTML = footer;
    elements.modalBackdrop.classList.remove("is-hidden");
    elements.modalBackdrop.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    elements.modalBackdrop.classList.add("is-hidden");
    elements.modalBackdrop.setAttribute("aria-hidden", "true");
    elements.modalBody.innerHTML = "";
    elements.modalFooter.innerHTML = "";
  }

  function showToast(message) {
    window.clearTimeout(ui.toastTimer);
    elements.mapToast.textContent = message;
    elements.mapToast.classList.remove("is-hidden");
    const operationsToast = elements.adminOperationsView?.querySelector(".operations-toast");
    if (operationsToast) {
      operationsToast.textContent = message;
      operationsToast.classList.remove("is-hidden");
    }
    ui.toastTimer = window.setTimeout(() => {
      elements.mapToast.classList.add("is-hidden");
      operationsToast?.classList.add("is-hidden");
    }, 2800);
  }

  function addLog(message) {
    const now = new Date();
    const time = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now);
    state.logs.unshift({ id: `log-${Date.now()}`, time, message });
    state.logs = state.logs.slice(0, 100);
  }

  function getCharacter(id) {
    return state.characters.find((character) => character.id === Number(id)) || null;
  }

  function getRoomId(floorId, x, y) {
    return FLOOR_DEFINITIONS[floorId].cells[cellKey(x, y)].roomId;
  }

  function getRoomLabel(floorId, x, y) {
    return FLOOR_DEFINITIONS[floorId].cells[cellKey(x, y)].roomLabel;
  }

  function getInvestigationAt(floorId, x, y) {
    return FLOOR_DEFINITIONS[floorId].investigations.find((item) => item.x === x && item.y === y) || null;
  }

  function getTransitionAt(floorId, x, y) {
    return FLOOR_DEFINITIONS[floorId].transitions.find((item) => item.x === x && item.y === y) || null;
  }

  function findMatchingTransition(floorId, type) {
    return FLOOR_DEFINITIONS[floorId].transitions.find((item) => item.type === type)
      || FLOOR_DEFINITIONS[floorId].transitions[0];
  }

  function isDangerCell(floorId, x, y) {
    return state.dangerZones.includes(mapKey(floorId, x, y));
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
        getItem(key) { return memory.has(key) ? memory.get(key) : null; },
        setItem(key, value) { memory.set(key, String(value)); },
        removeItem(key) { memory.delete(key); },
      };
    }
  }

  function persistState() {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    syncChannel?.postMessage({ type: "state-update", state });
  }

  function loadState() {
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) return createInitialState();
    try {
      const parsed = JSON.parse(stored);
      if (!parsed || !Array.isArray(parsed.characters)) throw new Error("Invalid state");
      if (!Array.isArray(parsed.teams)) parsed.teams = [];
      parsed.teams.forEach((team) => {
        if (typeof team.visible !== "boolean") team.visible = true;
      });
      parsed.characters.forEach((character) => {
        if (character.role === "survivor") {
          character.ap = 0;
          character.maxAp = 0;
        }
      });
      return parsed;
    } catch (error) {
      console.warn("저장된 데이터를 읽지 못해 초기 상태를 사용합니다.", error);
      return createInitialState();
    }
  }

  function createInitialState() {
    return {
      characters: [
        createCharacter(101, "무현", "survivor", 0, 0, "1F", 2, 3, [], true),
        createCharacter(102, "도현", "spirit", 3, 5, "1F", 8, 4, [], true),
        createCharacter(103, "까순", "spirit", 4, 5, "1F", 2, 4, [], true),
        createCharacter(104, "혜연", "survivor", 0, 0, "1F", 3, 3, ["hypothermia"], true),
        createCharacter(105, "혜진", "survivor", 0, 0, "1F", 1, 6, [], false),
        createCharacter(106, "태허", "spirit", 1, 5, "B1", 9, 6, ["unstable"], false),
      ],
      teams: [
        { id: "team-alpha", name: "A조", color: "#6a8fb5", memberIds: [103, 104], visible: true },
      ],
      dangerZones: [mapKey("1F", 9, 6), mapKey("1F", 10, 6), mapKey("B1", 9, 6), mapKey("B1", 10, 6)],
      layers: {
        danger: true,
        corpseRoute: true,
        entities: true,
      },
      connections: [],
      logs: [
        { id: "seed-1", time: "14:36:00", message: "B1 서비스 통로에서 온도 급강하가 감지되었습니다." },
        { id: "seed-2", time: "14:31:00", message: "운영진이 까순과 혜연을 A조로 편성했습니다." },
        { id: "seed-3", time: "14:28:00", message: "공간 단위 이동 규칙이 적용되었습니다." },
      ],
    };
  }

  function createCharacter(id, name, role, ap, maxAp, floor, x, y, statuses, online) {
    return {
      id,
      name,
      role,
      ap,
      maxAp,
      floor,
      x,
      y,
      statuses,
      inventory: [],
      investigations: [],
      records: [],
      online,
    };
  }

  function getTeamsForCharacter(characterId) {
    return (state.teams || []).filter((team) => team.memberIds.includes(Number(characterId)));
  }

  function getTeamForCharacter(characterId) {
    const teams = getTeamsForCharacter(characterId);
    return teams.find((team) => team.visible !== false) || teams[0] || null;
  }

  function getVisibleTeamsForCharacter(characterId) {
    return getTeamsForCharacter(characterId).filter((team) => team.visible !== false);
  }

  function teamChipsMarkup(characterId) {
    const teams = getTeamsForCharacter(characterId);
    if (!teams.length) return `<span class="team-chip team-chip--none">미편성</span>`;
    return teams.map((team) => `<span class="team-chip ${team.visible === false ? "is-hidden-team" : ""}" style="--team-color:${team.color}">${escapeHtml(team.name)}${team.visible === false ? " · 숨김" : ""}</span>`).join("");
  }

  function createTeamFromForm(formData) {
    const name = String(formData.get("teamName") || "").trim();
    const memberIds = [...new Set(formData.getAll("memberIds").map(Number).filter((id) => getCharacter(id)))];
    if (!name) {
      showToast("팀 이름을 입력해 주세요.");
      return;
    }
    if (memberIds.length < 2) {
      showToast("그룹화할 인원을 두 명 이상 선택해 주세요.");
      return;
    }

    const signature = [...memberIds].sort((a, b) => a - b).join(":");
    const duplicate = state.teams.find((team) => [...team.memberIds].sort((a, b) => a - b).join(":") === signature && team.name === name);
    if (duplicate) {
      showToast("같은 이름과 구성의 그룹이 이미 있습니다.");
      return;
    }

    const palette = ["#6a8fb5", "#8b78b5", "#4d9b87", "#b1845f", "#9c6678", "#667f9c"];
    const team = {
      id: `team-${Date.now()}`,
      name,
      color: palette[state.teams.length % palette.length],
      memberIds,
      visible: true,
    };
    state.teams.push(team);
    addLog(`운영진이 ${memberIds.map((id) => getCharacter(id).name).join(", ")}을(를) ${name}(으)로 그룹화했습니다.`);
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
    addLog(`운영진이 ${team.name}의 위치 공유를 ${team.visible ? "켰습니다" : "잠시 껐습니다"}.`);
    persistState();
    renderAll();
    showToast(`${team.name} 위치 공유를 ${team.visible ? "켰습니다" : "껐습니다"}. 그룹 편성은 유지됩니다.`);
  }

  function moveCharacterSetTo(memberIds, floor, x, y) {
    const targetRoomId = getRoomId(floor, x, y);
    const roomCells = [];
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let column = 0; column < GRID_COLUMNS; column += 1) {
        if (getRoomId(floor, column, row) === targetRoomId) roomCells.push({ x: column, y: row });
      }
    }
    roomCells.sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - (Math.abs(b.x - x) + Math.abs(b.y - y)));
    [...new Set(memberIds)].map(getCharacter).filter(Boolean).forEach((member, index) => {
      const previous = { floor: member.floor, room: getRoomLabel(member.floor, member.x, member.y) };
      settleFreezeClock(member, previous.floor, getRoomIdByLabel(previous.floor, previous.room));
      const position = roomCells[index % Math.max(1, roomCells.length)] || { x, y };
      member.floor = floor;
      member.x = position.x;
      member.y = position.y;
      if (member.role === "spirit") {
        recordSpiritMovement(member, {
          fromFloor: previous.floor,
          fromRoom: previous.room,
          toFloor: member.floor,
          toRoom: getRoomLabel(member.floor, member.x, member.y),
          cost: 0,
          source: "운영진 팀 이동",
        });
      }
    });
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
    return `<span class="avatar ${compact ? "avatar--round" : ""}" style="--avatar-a:${colors[0]};--avatar-b:${colors[1]};--role-color:${getRoleColor(character.role)}">${escapeHtml(initials)}<i class="avatar__role-mark">${roleMark}</i></span>`;
  }

  function tokenMarkup(character, selected) {
    const colors = AVATAR_COLORS[character.id] || ["#53677a", "#263747"];
    const status = character.statuses[0] ? STATUS_DEFINITIONS[character.statuses[0]] : null;
    const team = getTeamForCharacter(character.id);
    return `<span class="character-token ${selected ? "is-selected" : ""}" data-token-character="${character.id}" style="--avatar-a:${colors[0]};--avatar-b:${colors[1]};--role-color:${getRoleColor(character.role)};--team-color:${team?.color || getRoleColor(character.role)}" title="${escapeHtml(character.name)} · ${character.id}${team ? ` · ${escapeHtml(team.name)}` : ""}">${character.id}${status ? `<i class="character-token__status">${status.icon}</i>` : ""}</span>`;
  }

  function roleChipMarkup(role) {
    return `<span class="role-chip role-chip--${role}">${ROLE_LABELS[role]}</span>`;
  }

  function certaintyChipMarkup(certainty) {
    return `<span class="certainty-chip certainty-chip--${certainty}">${certaintyLabel(certainty)}</span>`;
  }

  function certaintyLabel(certainty) {
    return {
      unknown: "미확인",
      guess: "추측",
      likely: "유력",
      confirmed: "확정",
    }[certainty] || "미확인";
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
        defaultRoom: { id: "b1_corridor", label: "지하 공용 복도", color: "#eef1f3" },
        rooms: [
          room("event_storage", "행사 물품창고", 0, 0, 2, 1, "#f7f7f5"),
          room("document_archive", "문서보관실", 3, 0, 5, 1, "#f6f7f8"),
          room("stairs", "계단", 10, 0, 10, 1, "#edf1f4"),
          room("elevator", "엘리베이터", 11, 0, 11, 1, "#edf1f4"),
          room("b1_corridor", "지하 공용 복도", 0, 2, 11, 4, "#e9edf0"),
          room("crisis_sim", "위기대응 시뮬레이션 장비실", 0, 5, 3, 7, "#f8f8f6"),
          room("emergency_room", "비상대피실", 4, 5, 7, 7, "#f8f8f6"),
          room("service_tunnel", "서비스 통로", 8, 5, 10, 7, "#f7eded"),
          room("elevator", "엘리베이터", 11, 5, 11, 7, "#edf1f4"),
        ],
        doorways: [
          [1, 1, 1, 2], [4, 1, 4, 2], [10, 1, 10, 2], [11, 1, 11, 2],
          [1, 4, 1, 5], [5, 4, 5, 5], [9, 4, 9, 5], [11, 4, 11, 5],
        ],
        transitions: [
          { x: 10, y: 0, type: "stairs", destinations: ["1F"] },
          { x: 11, y: 0, type: "elevator", destinations: ["1F", "2F", "3F", "4F"] },
          { x: 11, y: 6, type: "elevator", destinations: ["1F", "2F", "3F", "4F"] },
        ],
        investigations: [
          investigation("b1-doc-log", "B1", 4, 0, "문서보관실 기록함", 1, "체크되지 않은 명찰 반납표", "참가자 일부의 명찰이 반납되지 않았고 셔틀 탑승명단과 수가 맞지 않습니다.", "서류함을 열어 잔류 인원을 대조합니다.", "confirmed"),
          investigation("b1-service-frost", "B1", 9, 6, "서비스 통로의 서리 흔적", 2, "동결체 이동 흔적", "서리가 연구별관 방향으로 끊겼다가 다시 나타납니다. 현재 경로는 유력 단계입니다.", "바닥과 벽의 결빙 방향을 정밀 조사합니다.", "likely"),
        ],
        entities: [{ x: 10, y: 6, visibleTo: ["spirit"] }],
        corpseRoute: [{ x: 4, y: 3, label: "1" }, { x: 8, y: 5, label: "2" }, { x: 10, y: 6, label: "?" }],
      },
      "1F": {
        defaultRoom: { id: "lobby", label: "중앙 로비", color: "#eef5fb" },
        rooms: [
          room("admin_office", "행정실", 0, 0, 2, 1, "#f7f7f5"),
          room("clinic", "의무실", 3, 0, 4, 1, "#f8f7f5"),
          room("auditorium", "대강당", 5, 0, 10, 5, "#f4f6f7"),
          room("women_wc", "화장실(여)", 11, 0, 11, 1, "#fbefef"),
          room("stairs", "계단", 11, 2, 11, 3, "#eef1f4"),
          room("men_wc", "화장실(남)", 11, 4, 11, 5, "#edf4fb"),
          room("lobby", "중앙 로비", 0, 2, 4, 5, "#edf5fb"),
          room("registration", "등록데스크", 0, 6, 2, 7, "#f7f8f8"),
          room("security", "경비데스크", 3, 6, 4, 7, "#f7f8f8"),
          room("storage", "물품보관소", 5, 6, 6, 7, "#f7f8f8"),
          room("south_lobby", "중앙 로비", 7, 6, 8, 7, "#edf5fb"),
          room("life_link", "생활관 연결통로", 9, 6, 10, 7, "#f8eaea"),
          room("elevator", "엘리베이터", 11, 6, 11, 7, "#eef1f4"),
        ],
        doorways: [
          [1, 1, 1, 2], [3, 1, 3, 2], [4, 3, 5, 3],
          [10, 1, 11, 1], [10, 2, 11, 2], [10, 4, 11, 4],
          [1, 5, 1, 6], [3, 5, 3, 6], [5, 5, 5, 6], [7, 5, 7, 6],
          [8, 6, 9, 6], [10, 6, 11, 6], [11, 3, 11, 4], [11, 5, 11, 6],
        ],
        transitions: [
          { x: 11, y: 2, type: "stairs", destinations: ["B1", "2F"] },
          { x: 11, y: 6, type: "elevator", destinations: ["B1", "2F", "3F", "4F"] },
        ],
        investigations: [
          investigation("1f-clinic-bed", "1F", 3, 1, "의무실 침대 아래", 1, "의무실 야간 출입 명단", "폐회 후 연구원 한 명이 의무실에 들어간 기록이 남아 있습니다.", "침대 아래와 서랍에 남은 물건을 조사합니다.", "confirmed"),
          investigation("1f-security-log", "1F", 3, 6, "경비데스크 운영 PC", 1, "차량 지연 메일", "연구진은 참가자들이 이미 셔틀을 타고 떠났다고 오인한 정황이 확인됩니다.", "운영 PC의 최근 수신 메일을 확인합니다.", "confirmed"),
          investigation("1f-auditorium-stage", "1F", 8, 4, "대강당 무대 뒤", 2, "무대 뒤 혈흔 사진", "혈흔은 사람이 끌려간 방향과 일치하지만 아직 인물은 특정되지 않았습니다.", "무대 뒤 커튼과 바닥을 정밀 조사합니다.", "likely"),
        ],
        entities: [],
        corpseRoute: [{ x: 3, y: 1, label: "1" }, { x: 2, y: 4, label: "2" }, { x: 9, y: 6, label: "?" }],
      },
      "2F": {
        defaultRoom: { id: "poster_hall", label: "포스터 전시장", color: "#eef1f3" },
        rooms: [
          room("seminar_1", "세미나실 1", 0, 0, 2, 1, "#f7f8f8"),
          room("seminar_2", "세미나실 2", 3, 0, 4, 1, "#f7f8f8"),
          room("breakout_1", "분과발표실 1", 5, 0, 7, 1, "#f7f8f8"),
          room("breakout_2", "분과발표실 2", 8, 0, 9, 1, "#f7f8f8"),
          room("wc", "화장실", 10, 0, 10, 1, "#f5f0f0"),
          room("stairs", "계단", 11, 0, 11, 1, "#eef1f4"),
          room("poster_hall", "포스터 전시장", 0, 2, 10, 5, "#edf2f5"),
          room("group_1", "조별 토론실 1", 0, 6, 2, 7, "#f7f8f8"),
          room("group_2", "조별 토론실 2", 3, 6, 4, 7, "#f7f8f8"),
          room("print_room", "인쇄실", 5, 6, 6, 7, "#f7f8f8"),
          room("small_seminar", "소형 세미나실", 7, 6, 9, 7, "#f7f8f8"),
          room("wc", "화장실", 10, 6, 10, 7, "#f5f0f0"),
          room("elevator", "엘리베이터", 11, 6, 11, 7, "#eef1f4"),
        ],
        doorways: [
          [1, 1, 1, 2], [3, 1, 3, 2], [6, 1, 6, 2], [8, 1, 8, 2], [10, 1, 10, 2], [11, 1, 11, 2],
          [1, 5, 1, 6], [3, 5, 3, 6], [5, 5, 5, 6], [8, 5, 8, 6], [10, 5, 10, 6], [11, 5, 11, 6],
        ],
        transitions: [
          { x: 11, y: 0, type: "stairs", destinations: ["1F", "3F"] },
          { x: 11, y: 6, type: "elevator", destinations: ["B1", "1F", "3F", "4F"] },
        ],
        investigations: [
          investigation("2f-poster-note", "2F", 5, 3, "철거되지 않은 포스터", 1, "폐회 시각 수정 메모", "행사 종료 시각이 한 차례 변경됐지만 일부 운영 문서에는 반영되지 않았습니다.", "겹쳐 붙은 포스터와 뒤쪽 메모를 확인합니다.", "likely"),
          investigation("2f-print-fragment", "2F", 5, 6, "인쇄실 폐기함", 1, "찢긴 비상경보 출력물", "연구별관 비상경보가 폐회 후 발생했다는 시간이 인쇄되어 있습니다.", "폐기된 출력물을 복원합니다.", "confirmed"),
        ],
        entities: [{ x: 6, y: 4, visibleTo: ["survivor", "spirit"] }],
        corpseRoute: [],
      },
      "3F": {
        defaultRoom: { id: "archive_hall", label: "자료열람실", color: "#eef1f3" },
        rooms: [
          room("fusion_lab_1", "융합연구실 1", 0, 0, 2, 1, "#f7f8f8"),
          room("fusion_lab_2", "융합연구실 2", 3, 0, 4, 1, "#f7f8f8"),
          room("prof_wait", "교수 대기실", 5, 0, 6, 1, "#f7f8f8"),
          room("presenter_wait", "발표자 대기실", 7, 0, 9, 1, "#f7f8f8"),
          room("wc", "화장실", 10, 0, 10, 1, "#f5f0f0"),
          room("stairs", "계단", 11, 0, 11, 1, "#eef1f4"),
          room("archive_hall", "자료열람실", 0, 2, 10, 5, "#edf2f5"),
          room("computer_room", "컴퓨터실", 0, 6, 2, 7, "#f7f8f8"),
          room("project_1", "학생 프로젝트실 1", 3, 6, 5, 7, "#f7f8f8"),
          room("project_2", "학생 프로젝트실 2", 6, 6, 8, 7, "#f7f8f8"),
          room("wc", "화장실", 9, 6, 10, 7, "#f5f0f0"),
          room("elevator", "엘리베이터", 11, 6, 11, 7, "#eef1f4"),
        ],
        doorways: [
          [1, 1, 1, 2], [3, 1, 3, 2], [5, 1, 5, 2], [8, 1, 8, 2], [10, 1, 10, 2], [11, 1, 11, 2],
          [1, 5, 1, 6], [4, 5, 4, 6], [7, 5, 7, 6], [9, 5, 9, 6], [11, 5, 11, 6],
        ],
        transitions: [
          { x: 11, y: 0, type: "stairs", destinations: ["2F", "4F"] },
          { x: 11, y: 6, type: "elevator", destinations: ["B1", "1F", "2F", "4F"] },
        ],
        investigations: [
          investigation("3f-pc-backup", "3F", 1, 6, "컴퓨터실 백업 서버", 2, "삭제된 출입 기록 백업", "삭제된 로그에 연구별관에서 융합학술동으로 이동한 카드키 기록이 남아 있습니다.", "백업 서버에서 삭제된 로그를 복구합니다.", "confirmed"),
          investigation("3f-archive-photo", "3F", 6, 3, "자료열람실 사진 파일", 1, "폐회 직후 중앙광장 사진", "사진 구석에 셔틀에 타지 않은 인영이 찍혀 있지만 신원은 불명입니다.", "날짜가 같은 사진들을 시간순으로 정렬합니다.", "guess"),
        ],
        entities: [],
        corpseRoute: [],
      },
      "4F": {
        defaultRoom: { id: "ops_corridor", label: "운영구역 공용 복도", color: "#eef1f3" },
        rooms: [
          room("director_office", "학술원장실", 0, 0, 2, 1, "#f7f8f8"),
          room("executive_meeting", "임원회의실", 3, 0, 5, 1, "#f7f8f8"),
          room("official_records", "공식 기록실", 6, 0, 8, 1, "#f7f8f8"),
          room("wc", "화장실", 9, 0, 9, 1, "#f5f0f0"),
          room("stairs", "계단", 10, 0, 10, 1, "#eef1f4"),
          room("elevator", "엘리베이터", 11, 0, 11, 1, "#eef1f4"),
          room("ops_corridor", "운영구역 공용 복도", 0, 2, 11, 4, "#e9edf0"),
          room("operations", "운영본부", 0, 5, 5, 7, "#f7f8f8"),
          room("disaster_room", "재난대응 상황실", 6, 5, 10, 7, "#f4f6f7"),
          room("elevator", "엘리베이터", 11, 5, 11, 7, "#eef1f4"),
        ],
        doorways: [
          [1, 1, 1, 2], [4, 1, 4, 2], [7, 1, 7, 2], [9, 1, 9, 2], [10, 1, 10, 2], [11, 1, 11, 2],
          [2, 4, 2, 5], [7, 4, 7, 5], [11, 4, 11, 5],
        ],
        transitions: [
          { x: 10, y: 0, type: "stairs", destinations: ["3F"] },
          { x: 11, y: 0, type: "elevator", destinations: ["B1", "1F", "2F", "3F"] },
          { x: 11, y: 6, type: "elevator", destinations: ["B1", "1F", "2F", "3F"] },
        ],
        investigations: [
          investigation("4f-ops-mail", "4F", 2, 6, "운영본부 공용 PC", 1, "외부기관 발신 공문", "연구진이 참가자 전원 철수를 전제로 대응을 늦춘 정황이 확인됩니다.", "운영본부 공용 계정의 발신·수신 문서를 대조합니다.", "confirmed"),
          investigation("4f-disaster-call", "4F", 7, 6, "재난대응 상황실 통화 기록", 2, "경보 직후 통화 녹취 요약", "누군가 비공개 연구구역의 출입을 먼저 통제하라고 지시했습니다.", "녹취 파일에서 지시 내용을 복원합니다.", "likely"),
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
        doorways: new Set((spec.doorways || []).map((door) => edgeKey(...door))),
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

  function investigation(id, floor, x, y, title, cost, evidenceTitle, result, prompt, certainty) {
    return { id, floor, x, y, title, cost, evidenceTitle, result, prompt, certainty };
  }

  const OPERATIONS_TABS = {
    overview: "인원 현황",
    inventory: "자료 보관함",
    burning: "공간 진행도",
    mindmap: "공동 마인드맵",
    movements: "빙혼 이동 기록",
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
    investigation: "현재 위치 조사",
  };

  const MAP_INFO_LABELS = {
    roomLabels: "공간명",
    burning: "공간 버닝 진행도",
    danger: "위험구역",
    teamPositions: "그룹 위치 공유",
    warmth: "온기 감지",
  };

  function defaultRoleExposure(role) {
    return {
      floors: Object.fromEntries(FLOOR_ORDER.map((floor) => [floor, role === "survivor" ? ["1F", "2F"].includes(floor) : true])),
      features: {
        inventory: true,
        records: true,
        board: role === "survivor",
        tracking: role === "spirit",
        investigation: true,
      },
      mapInfo: {
        roomLabels: true,
        burning: true,
        danger: true,
        teamPositions: true,
        warmth: role === "spirit",
      },
    };
  }

  function migrateState(candidate) {
    const migrated = candidate && Array.isArray(candidate.characters) ? candidate : createInitialState();
    if (!Array.isArray(migrated.teams)) migrated.teams = [];
    if (!Array.isArray(migrated.logs)) migrated.logs = [];
    if (!Array.isArray(migrated.movementLogs)) migrated.movementLogs = [];
    if (!Array.isArray(migrated.adminMemos)) migrated.adminMemos = [];
    if (!migrated.exposure) migrated.exposure = {};
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
      if (!Array.isArray(character.inventory)) character.inventory = [];
      if (!Array.isArray(character.investigations)) character.investigations = [];
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
        character.spiritState = character.spiritState || (character.statuses.includes("unstable") ? "unstable" : "stable");
        character.spiritSince = character.spiritSince || new Date(Date.now() - (index + 1) * 36e5).toISOString();
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

  function renderAdminOperationsPage() {
    if (session?.type !== "admin") return;
    const tabButtons = Object.entries(OPERATIONS_TABS).map(([id, label]) => `
      <button type="button" class="operations-tab ${ui.operationsTab === id ? "is-active" : ""}" data-operations-tab="${id}">${label}</button>
    `).join("");
    elements.adminOperationsContent.innerHTML = `
      <div class="operations-page__header">
        <div>
          <p class="eyebrow">OPERATIONS CENTER</p>
          <h1 id="operationsPageTitle">운영진 통합 운영페이지</h1>
          <p>인원·자료 보관함·공간 진행도·공동 마인드맵·긴급 이벤트·노출 정보를 한곳에서 관리합니다.</p>
        </div>
        <button type="button" class="button" data-close-operations>지도 화면으로 돌아가기</button>
      </div>
      <nav class="operations-tabs" aria-label="운영페이지 메뉴">${tabButtons}</nav>
      <div class="operations-content">${operationsTabContent(ui.operationsTab)}</div>
      <div class="operations-toast is-hidden" role="status"></div>
    `;
  }

  function operationsTabContent(tab) {
    if (tab === "inventory") return inventoryOperationsMarkup();
    if (tab === "burning") return burningOperationsMarkup();
    if (tab === "mindmap") return mindmapOperationsMarkup();
    if (tab === "movements") return movementOperationsMarkup();
    if (tab === "memos") return memoOperationsMarkup();
    if (tab === "events") return eventsOperationsMarkup();
    if (tab === "settings") return settingsOperationsMarkup();
    return overviewOperationsMarkup();
  }

  function overviewOperationsMarkup() {
    const survivors = state.characters.filter((character) => character.role === "survivor");
    const spirits = state.characters.filter((character) => character.role === "spirit");
    return `
      <div class="operations-summary-grid">
        <article><span>생환자</span><strong>${survivors.length}</strong></article>
        <article><span>빙혼자</span><strong>${spirits.length}</strong></article>
        <article><span>자료 보관함</span><strong>${state.resourceLibrary.length}</strong></article>
        <article><span>빙혼 이동 기록</span><strong>${state.movementLogs.length}</strong></article>
      </div>
      <div class="operations-roster-grid">
        ${roleRosterMarkup("survivor", survivors)}
        ${roleRosterMarkup("spirit", spirits)}
      </div>
    `;
  }

  function roleRosterMarkup(role, characters) {
    const rows = characters.map((character) => {
      const itemNames = character.inventory.length
        ? character.inventory.slice(0, 3).map((item) => `<button type="button" class="compact-item-link" data-evidence-id="${escapeHtml(item.uid)}">${escapeHtml(item.title)}</button>`).join("")
        : `<span class="muted-text">없음</span>`;
      const spiritInfo = role === "spirit"
        ? `<strong>${escapeHtml(SPIRIT_STATE_LABELS[character.spiritState] || "미설정")}</strong><small>${formatElapsed(character.spiritSince)}</small>`
        : `<span class="muted-text">해당 없음</span>`;
      return `
        <tr>
          <td><button type="button" class="operations-character-link" data-operations-character="${character.id}">${character.id} · ${escapeHtml(character.name)}</button></td>
          <td>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</td>
          <td><div class="compact-item-list">${itemNames}</div></td>
          <td><div class="spirit-state-cell">${spiritInfo}</div></td>
          <td>${character.statuses.length ? character.statuses.map((statusId) => `<span class="status-icon" title="${escapeHtml(STATUS_DEFINITIONS[statusId]?.name || statusId)}">${STATUS_DEFINITIONS[statusId]?.icon || "·"}</span>`).join("") : "정상"}</td>
        </tr>`;
    }).join("");
    return `
      <section class="operations-card operations-card--roster">
        <header><div><p class="eyebrow">${role === "survivor" ? "SURVIVORS" : "SPIRITS"}</p><h2>${ROLE_LABELS[role]} 목록</h2></div><span>${characters.length}명</span></header>
        <div class="operations-table-wrap">
          <table class="operations-table">
            <thead><tr><th>ID · 이름</th><th>현재 위치</th><th>소지품</th><th>빙혼 상태 · 경과</th><th>상태이상</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5">해당 인원이 없습니다.</td></tr>`}</tbody>
          </table>
        </div>
      </section>`;
  }

  function inventoryOperationsMarkup() {
    const characterChecks = state.characters.map((character) => `
      <label class="operations-check-card">
        <input type="checkbox" name="characterIds" value="${character.id}" />
        ${avatarMarkup(character, true)}
        <span><strong>${escapeHtml(character.name)} · ${character.id}</strong><small>${ROLE_LABELS[character.role]} · 현재 소지품 ${character.inventory.length}건</small></span>
      </label>`).join("");
    const resourceOptions = state.resourceLibrary.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("");
    const templates = state.resourceLibrary.map((item) => `
      <article class="resource-template-card">
        <span class="resource-template-card__thumb">${item.imageData ? `<img src="${item.imageData}" alt="" />` : "▤"}</span>
        <div class="resource-template-card__copy">
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.description)}</p>
          ${certaintyChipMarkup(item.certainty)}
        </div>
        <div class="resource-template-card__actions">
          <button type="button" class="button button--small" data-preview-resource="${escapeHtml(item.id)}">미리보기</button>
          <button type="button" class="button button--small button--danger" data-delete-resource="${escapeHtml(item.id)}">삭제</button>
        </div>
      </article>`).join("");
    return `
      <div class="operations-library-grid">
        <div>
          <section class="operations-card">
            <header><div><p class="eyebrow">RESOURCE LIBRARY</p><h2>조사 자료 사전 등록</h2></div><span>${state.resourceLibrary.length}건</span></header>
            <form class="operations-form" data-resource-library-form>
              <label>자료 이름<input class="form-control" name="title" required maxlength="60" placeholder="예: 의무실 출입 기록" /></label>
              <label>설명<textarea class="form-control" name="description" required rows="5" placeholder="플레이어가 클릭했을 때 볼 설명을 입력하세요."></textarea></label>
              <div class="operations-form-grid">
                <label>정보 상태<select class="form-control" name="certainty"><option value="unknown">미확인</option><option value="guess">추측</option><option value="likely">유력</option><option value="confirmed">확정</option></select></label>
                <label>이미지 첨부<input class="form-control" type="file" name="image" accept="image/*" /></label>
              </div>
              <p class="form-help">먼저 보관함에 등록합니다. 실제 지급은 오른쪽 전달 영역에서 자료와 인원을 선택해 진행합니다.</p>
              <button type="submit" class="button button--primary">자료 보관함에 등록</button>
            </form>
          </section>
          <section class="operations-card">
            <header><div><p class="eyebrow">REGISTERED RESOURCES</p><h2>등록된 자료</h2></div></header>
            <div class="resource-library-list">${templates || emptyStateMarkup("사전 등록된 자료가 없습니다.")}</div>
          </section>
        </div>
        <section class="operations-card library-delivery-panel">
          <header><div><p class="eyebrow">DELIVERY</p><h2>조사 물품 전달</h2></div></header>
          <form class="operations-form" data-resource-delivery-form>
            <label>전달할 자료<select class="form-control" name="resourceId" required><option value="">자료 선택</option>${resourceOptions}</select></label>
            <fieldset><legend>전달 대상</legend><div class="operations-check-grid">${characterChecks}</div></fieldset>
            <button type="submit" class="button button--primary" ${state.resourceLibrary.length ? "" : "disabled"}>선택한 인원에게 전달</button>
          </form>
        </section>
      </div>`;
  }

  function movementOperationsMarkup() {
    const filters = state.characters.filter((character) => character.role === "spirit").map((character) => `<option value="${character.id}">${escapeHtml(character.name)} · ${character.id}</option>`).join("");
    const rows = state.movementLogs.map((entry) => {
      const character = getCharacter(entry.characterId);
      return `
        <tr data-movement-row="${entry.characterId}">
          <td>${escapeHtml(formatDateTime(entry.createdAt))}</td>
          <td>${character ? `${escapeHtml(character.name)} · ${character.id}` : entry.characterId}</td>
          <td>${escapeHtml(entry.fromFloor)} · ${escapeHtml(entry.fromRoom)}</td>
          <td>${escapeHtml(entry.toFloor)} · ${escapeHtml(entry.toRoom)}</td>
          <td>${entry.cost}</td>
          <td>${escapeHtml(entry.source)}</td>
        </tr>`;
    }).join("");
    return `
      <section class="operations-card">
        <header class="operations-card__filter"><div><p class="eyebrow">SPIRIT MOVEMENT LOG</p><h2>빙혼자 움직임 기록</h2></div><select class="form-control" data-movement-filter><option value="all">전체 빙혼자</option>${filters}</select></header>
        <div class="operations-table-wrap"><table class="operations-table"><thead><tr><th>시간</th><th>빙혼자</th><th>이전 위치</th><th>도착 위치</th><th>소모 AP</th><th>구분</th></tr></thead><tbody>${rows || `<tr><td colspan="6">이동 기록이 없습니다.</td></tr>`}</tbody></table></div>
      </section>`;
  }

  function memoOperationsMarkup() {
    const memos = state.adminMemos.map((memo) => `
      <article class="admin-memo">
        <header><strong>${escapeHtml(memo.author || "운영진")}</strong><time>${escapeHtml(formatDateTime(memo.createdAt))}</time></header>
        <p>${escapeHtml(memo.text)}</p>
        <button type="button" class="compact-icon-button" data-delete-memo="${memo.id}">삭제</button>
      </article>`).join("");
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

  function settingsOperationsMarkup() {
    return `
      <form data-exposure-settings-form>
        <div class="settings-role-grid">
          ${roleSettingsMarkup("survivor")}
          ${roleSettingsMarkup("spirit")}
        </div>
        <section class="operations-card settings-guide">
          <h3>노출 설정 원칙</h3>
          <p>체크박스를 조정한 뒤 반드시 아래 저장 버튼을 눌러야 플레이어 화면에 반영됩니다. 꺼진 층과 기능은 해당 역할의 화면에서 버튼 자체가 나타나지 않으며, 캐릭터가 실제로 위치한 층은 진행 불능 방지를 위해 최소 표시됩니다.</p>
        </section>
        <div class="settings-save-bar">
          <span class="muted-text">변경사항은 저장 전까지 적용되지 않습니다.</span>
          <button type="submit" class="button button--primary">환경설정 저장 및 적용</button>
        </div>
      </form>`;
  }

  function roleSettingsMarkup(role) {
    const exposure = getRoleExposure(role);
    const floorToggles = FLOOR_ORDER.map((floor) => settingToggleMarkup(role, "floors", floor, floor, exposure.floors[floor])).join("");
    const featureToggles = Object.entries(FEATURE_LABELS).map(([key, label]) => settingToggleMarkup(role, "features", key, label, exposure.features[key])).join("");
    const infoToggles = Object.entries(MAP_INFO_LABELS).map(([key, label]) => settingToggleMarkup(role, "mapInfo", key, label, exposure.mapInfo[key])).join("");
    return `
      <section class="operations-card role-settings-card role-settings-card--${role}">
        <header><div><p class="eyebrow">${role.toUpperCase()} EXPOSURE</p><h2>${ROLE_LABELS[role]} 화면 설정</h2></div>${roleChipMarkup(role)}</header>
        <div class="settings-section"><h3>노출 층</h3><div class="settings-toggle-grid settings-toggle-grid--floors">${floorToggles}</div></div>
        <div class="settings-section"><h3>노출 기능</h3><div class="settings-toggle-grid">${featureToggles}</div></div>
        <div class="settings-section"><h3>지도 정보</h3><div class="settings-toggle-grid">${infoToggles}</div></div>
      </section>`;
  }

  function settingToggleMarkup(role, group, key, label, checked) {
    return `<label class="settings-toggle"><input type="checkbox" data-exposure-role="${role}" data-exposure-group="${group}" data-exposure-key="${key}" ${checked ? "checked" : ""} /><span></span><strong>${escapeHtml(label)}</strong></label>`;
  }

  function handleOperationsClick(event) {
    if (session?.type !== "admin") return;
    if (event.target.closest("[data-close-operations]")) {
      closeAdminOperationsPage();
      return;
    }
    const tab = event.target.closest("[data-operations-tab]");
    if (tab) {
      ui.operationsTab = tab.dataset.operationsTab;
      renderAdminOperationsPage();
      return;
    }
    const resourcePreview = event.target.closest("[data-preview-resource]");
    if (resourcePreview) {
      previewResourceTemplate(resourcePreview.dataset.previewResource);
      return;
    }
    const resourceDelete = event.target.closest("[data-delete-resource]");
    if (resourceDelete) {
      state.resourceLibrary = state.resourceLibrary.filter((item) => item.id !== resourceDelete.dataset.deleteResource);
      persistState();
      renderAdminOperationsPage();
      return;
    }
    const mainDelete = event.target.closest("[data-delete-mind-main]");
    if (mainDelete) {
      state.mindMap.publishedCards = state.mindMap.publishedCards.filter((item) => item.id !== mainDelete.dataset.deleteMindMain);
      persistState();
      renderAdminOperationsPage();
      return;
    }
    const noteDelete = event.target.closest("[data-delete-mind-note]");
    if (noteDelete) {
      state.mindMap.notes = state.mindMap.notes.filter((item) => item.id !== noteDelete.dataset.deleteMindNote);
      persistState();
      renderAdminOperationsPage();
      return;
    }
    const eventToggle = event.target.closest("[data-toggle-event]");
    if (eventToggle) {
      const item = state.emergencyEvents.find((entry) => entry.id === eventToggle.dataset.toggleEvent);
      if (item) item.active = !item.active;
      persistState();
      renderAdminOperationsPage();
      renderEventButton();
      return;
    }
    const eventDelete = event.target.closest("[data-delete-event]");
    if (eventDelete) {
      state.emergencyEvents = state.emergencyEvents.filter((item) => item.id !== eventDelete.dataset.deleteEvent);
      persistState();
      renderAdminOperationsPage();
      renderEventButton();
      return;
    }

    const characterButton = event.target.closest("[data-operations-character]");
    if (characterButton) {
      showCharacterManagementModal(Number(characterButton.dataset.operationsCharacter));
      return;
    }
    const evidenceButton = event.target.closest("[data-evidence-id]");
    if (evidenceButton) {
      const evidence = collectAllEvidence().find((item) => item.uid === evidenceButton.dataset.evidenceId);
      if (evidence) showEvidenceModal(evidence);
      return;
    }
    const deleteMemo = event.target.closest("[data-delete-memo]");
    if (deleteMemo) {
      state.adminMemos = state.adminMemos.filter((memo) => memo.id !== deleteMemo.dataset.deleteMemo);
      persistState();
      renderAdminOperationsPage();
    }
  }

  function handleOperationsChange(event) {
    if (session?.type !== "admin") return;
    if (event.target.matches("[data-exposure-role]")) {
      return;
    }
    if (event.target.matches("[data-movement-filter]")) {
      const value = event.target.value;
      elements.adminOperationsView.querySelectorAll("[data-movement-row]").forEach((row) => {
        row.classList.toggle("is-hidden", value !== "all" && row.dataset.movementRow !== value);
      });
    }
  }

  async function handleOperationsSubmit(event) {
    if (session?.type !== "admin") return;
    const resourceLibraryForm = event.target.closest("[data-resource-library-form]");
    if (resourceLibraryForm) {
      event.preventDefault();
      await registerResourceTemplate(new FormData(resourceLibraryForm));
      return;
    }
    const resourceDeliveryForm = event.target.closest("[data-resource-delivery-form]");
    if (resourceDeliveryForm) {
      event.preventDefault();
      deliverResource(new FormData(resourceDeliveryForm));
      return;
    }
    const burningForm = event.target.closest("[data-burning-settings-form]");
    if (burningForm) {
      event.preventDefault();
      const formData = new FormData(burningForm);
      for (const [name, value] of formData.entries()) {
        if (!name.startsWith("burning:")) continue;
        const [, floor, roomId] = name.split(":");
        state.spaceBurning[spaceBurningKey(floor, roomId)] = Math.max(0, Math.min(5, Number(value)));
      }
      addLog("운영진이 공간별 버닝 진행도를 저장했습니다.");
      persistState();
      renderAdminOperationsPage();
      showToast("공간 진행도를 저장했습니다.");
      return;
    }
    const mindMainForm = event.target.closest("[data-mind-main-form]");
    if (mindMainForm) {
      event.preventDefault();
      const formData = new FormData(mindMainForm);
      const title = String(formData.get("title") || "").trim();
      const body = String(formData.get("body") || "").trim();
      if (!title || !body) return;
      state.mindMap.publishedCards.unshift({ id: `mind-main-${Date.now()}`, title, body, createdAt: new Date().toISOString() });
      persistState();
      renderAdminOperationsPage();
      showToast("공개 정보 메인을 게시했습니다.");
      return;
    }
    const emergencyEventForm = event.target.closest("[data-emergency-event-form]");
    if (emergencyEventForm) {
      event.preventDefault();
      const formData = new FormData(emergencyEventForm);
      const title = String(formData.get("title") || "").trim();
      const message = String(formData.get("message") || "").trim();
      if (!title || !message) return;
      state.emergencyEvents.unshift({ id: `event-${Date.now()}`, title, message, audience: String(formData.get("audience") || "all"), active: true, createdAt: new Date().toISOString() });
      addLog(`운영진이 긴급 이벤트 「${title}」을(를) 등록했습니다.`);
      persistState();
      renderAdminOperationsPage();
      renderEventButton();
      showToast("긴급 이벤트를 등록했습니다.");
      return;
    }
    const exposureSettingsForm = event.target.closest("[data-exposure-settings-form]");
    if (exposureSettingsForm) {
      event.preventDefault();
      ["survivor", "spirit"].forEach((role) => {
        exposureSettingsForm.querySelectorAll(`[data-exposure-role="${role}"]`).forEach((input) => {
          const group = input.dataset.exposureGroup;
          const key = input.dataset.exposureKey;
          state.exposure[role][group][key] = input.checked;
        });
      });
      addLog("운영진이 생환자·빙혼자 노출 환경설정을 저장했습니다.");
      persistState();
      renderAdminOperationsPage();
      showToast("환경설정을 저장하고 적용했습니다.");
      return;
    }
    const bulkItemForm = event.target.closest("[data-bulk-item-form]");
    if (bulkItemForm) {
      event.preventDefault();
      await registerBulkItem(new FormData(bulkItemForm));
      return;
    }
    const memoForm = event.target.closest("[data-admin-memo-form]");
    if (memoForm) {
      event.preventDefault();
      const formData = new FormData(memoForm);
      const text = String(formData.get("text") || "").trim();
      if (!text) return;
      state.adminMemos.unshift({ id: `memo-${Date.now()}`, author: String(formData.get("author") || "운영진").trim() || "운영진", text, createdAt: new Date().toISOString() });
      state.adminMemos = state.adminMemos.slice(0, 100);
      persistState();
      renderAdminOperationsPage();
      showToast("운영진 공유 메모를 저장했습니다.");
    }
  }

  async function registerBulkItem(formData) {
    const characterIds = [...new Set(formData.getAll("characterIds").map(Number).filter((id) => getCharacter(id)))];
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
    addLog(`운영진이 ${characterIds.map((id) => getCharacter(id).name).join(", ")}에게 소지품 「${title}」을(를) 등록했습니다.`);
    persistState();
    renderAdminOperationsPage();
    showToast(`${characterIds.length}명에게 「${title}」을 등록했습니다.`);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("파일을 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
  }

  function recordSpiritMovement(character, { fromFloor, fromRoom, toFloor, toRoom, cost = 0, source = "이동" }) {
    if (!character || character.role !== "spirit") return;
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

  function getRoleExposure(role) {
    state.exposure = state.exposure || {};
    state.exposure[role] = state.exposure[role] || defaultRoleExposure(role);
    return state.exposure[role];
  }

  function getPlayerExposedFloors(character) {
    const exposure = getRoleExposure(character.role);
    const configured = FLOOR_ORDER.filter((floor) => exposure.floors[floor]);
    if (!configured.includes(character.floor)) configured.push(character.floor);
    return FLOOR_ORDER.filter((floor) => configured.includes(floor));
  }

  function renderFloorTabs() {
    const actor = getMovementActor();
    const floors = session.type === "player" ? getPlayerExposedFloors(actor) : FLOOR_ORDER;
    if (!floors.includes(ui.currentFloor)) ui.currentFloor = actor.floor;
    elements.currentFloorLabel.textContent = ui.currentFloor;
    elements.floorTabs.innerHTML = floors.map((floorId) => {
      const canTransition = actor?.role === "spirit"
        && actor.floor !== floorId
        && getTransitionAt(actor.floor, actor.x, actor.y)?.destinations.includes(floorId);
      const suffix = canTransition ? `<small>이동</small>` : "";
      return `<button type="button" data-floor="${floorId}" class="${floorId === ui.currentFloor ? "is-active" : ""}">${floorId}${suffix}</button>`;
    }).join("");
  }

  function renderPlayerJournal() {
    const character = getCharacter(session.characterId);
    const exposure = getRoleExposure(character.role);
    const allTabs = [["inventory", "소지품"], ["records", "조사"], ["board", "공동보드"], ["tracking", "추적"]];
    const tabs = allTabs.filter(([id]) => exposure.features[id]);
    if (!tabs.some(([id]) => id === ui.rightPanelTab)) ui.rightPanelTab = tabs[0]?.[0] || null;
    elements.rightSidebar.innerHTML = `
      <div class="sidebar-header"><h2>조사 기록</h2><span class="status-pill status-pill--online">자동 저장</span></div>
      <div class="sidebar-body">
        ${tabs.length ? `<div class="panel-tabs">${tabs.map(([id, label]) => `<button type="button" class="panel-tab ${ui.rightPanelTab === id ? "is-active" : ""}" data-panel-tab="${id}">${label}</button>`).join("")}</div><div class="panel-content">${playerJournalContent(character, ui.rightPanelTab)}</div>` : emptyStateMarkup("현재 공개된 기록 기능이 없습니다.")}
      </div>`;
  }

  function updateInvestigationButton() {
    const actor = getMovementActor();
    const exposed = session.type !== "player" || getRoleExposure(actor.role).features.investigation;
    elements.investigateButton.classList.toggle("is-hidden", !exposed);
    if (!exposed) return;
    const investigation = getInvestigationAt(actor.floor, actor.x, actor.y);
    elements.investigateButton.disabled = !investigation || actor.floor !== ui.currentFloor;
    if (!investigation) elements.investigateButton.textContent = "현재 위치 조사";
    else if (actor.investigations.includes(investigation.id)) elements.investigateButton.textContent = "조사 기록 보기";
    else elements.investigateButton.textContent = "조사하기 · 행동력 미소모";
  }

  function renderMap() {
    const floor = FLOOR_DEFINITIONS[ui.currentFloor];
    const perspective = getPerspective();
    const movementActor = getMovementActor();
    const reachable = getReachableCellCosts(movementActor, floor.id);
    const exposure = session.type === "player" ? getRoleExposure(movementActor.role) : null;
    const warmthAllowed = !exposure || exposure.mapInfo.warmth;
    const warmth = warmthAllowed ? getWarmthInfo(perspective.mode, perspective.character, floor.id) : { active: false, count: 0, roomId: null };
    const focusCharacter = perspective.mode === "admin" ? movementActor : perspective.character;
    const activeRoomId = focusCharacter && focusCharacter.floor === floor.id ? getRoomId(focusCharacter.floor, focusCharacter.x, focusCharacter.y) : null;

    elements.mapGrid.style.setProperty("--columns", GRID_COLUMNS);
    elements.mapGrid.style.setProperty("--rows", GRID_ROWS);
    elements.mapGrid.classList.toggle("is-player-locked", session.type === "player" && movementActor.role === "survivor");
    elements.mapGrid.innerHTML = "";

    floor.rooms.forEach((roomDefinition) => {
      const roomElement = document.createElement("div");
      roomElement.className = "map-room";
      roomElement.dataset.roomId = roomDefinition.id;
      roomElement.style.gridColumn = `${roomDefinition.x1 + 1} / ${roomDefinition.x2 + 2}`;
      roomElement.style.gridRow = `${roomDefinition.y1 + 1} / ${roomDefinition.y2 + 2}`;
      roomElement.style.setProperty("--room-color", roomDefinition.color);
      const burningLevel = getSpaceBurningLevel(floor.id, roomDefinition.id);
      roomElement.dataset.burningLevel = String(burningLevel);
      if (roomDefinition.id === activeRoomId) roomElement.classList.add("is-active-room");
      if (warmth.active && roomDefinition.id === warmth.roomId) roomElement.classList.add("is-warm");
      const showLabel = !exposure || exposure.mapInfo.roomLabels || roomDefinition.id === activeRoomId;
      roomElement.innerHTML = showLabel ? `<span>${escapeHtml(roomDefinition.label)}</span>` : "";
      const showBurning = perspective.mode === "admin" || !exposure || exposure.mapInfo.burning;
      if (showBurning && burningLevel > 0) roomElement.insertAdjacentHTML("beforeend", `<small class="map-room__burning">버닝 ${burningLevel} · ${escapeHtml(BURNING_LEVELS[burningLevel].label)}</small>`);
      elements.mapGrid.appendChild(roomElement);
    });

    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLUMNS; x += 1) {
        const cell = floor.cells[cellKey(x, y)];
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
        if (reachable.has(key) && movementActor.floor === floor.id && movementActor.role === "spirit") cellElement.classList.add("is-reachable");
        if (movementActor.floor === floor.id && movementActor.x === x && movementActor.y === y) cellElement.classList.add("is-current");
        if (state.layers.danger && (!exposure || exposure.mapInfo.danger) && isDangerCell(floor.id, x, y)) cellElement.classList.add("is-danger");
        if (getTransitionAt(floor.id, x, y)) cellElement.classList.add("is-transition");
        const showRoomDetails = perspective.mode === "admin" || cell.roomId === activeRoomId;
        if (showRoomDetails) appendMapMarkersWithExposure(cellElement, floor, x, y, perspective, exposure);
        const canShowPositions = !exposure || exposure.mapInfo.teamPositions;
        const visibleCharacters = getVisibleCharactersAtCell(floor.id, x, y, perspective, true).filter((character) => character.id === movementActor.id || canShowPositions || getRoomId(character.floor, character.x, character.y) === activeRoomId);
        visibleCharacters.forEach((character) => cellElement.insertAdjacentHTML("beforeend", tokenMarkup(character, character.id === movementActor.id)));
        elements.mapGrid.appendChild(cellElement);
      }
    }
    renderWarmthBanner(warmth, perspective);
    updateMovementRule(movementActor);
  }

  function appendMapMarkersWithExposure(cellElement, floor, x, y, perspective, exposure) {
    if (state.layers.entities) {
      const entity = floor.entities.find((item) => item.x === x && item.y === y);
      if (entity && (perspective.mode === "admin" || entity.visibleTo.includes(perspective.mode))) cellElement.insertAdjacentHTML("beforeend", `<span class="map-cell__marker map-cell__marker--entity" title="동결체 출몰">❄</span>`);
    }
    if (state.layers.corpseRoute) {
      const routePoint = floor.corpseRoute.find((item) => item.x === x && item.y === y);
      if (routePoint && perspective.mode === "admin") cellElement.insertAdjacentHTML("beforeend", `<span class="map-cell__marker map-cell__marker--corpse" title="시신 이동 경로">${escapeHtml(routePoint.label)}</span>`);
    }
    if (state.layers.danger && (!exposure || exposure.mapInfo.danger) && isDangerCell(floor.id, x, y) && perspective.mode === "admin") cellElement.insertAdjacentHTML("beforeend", `<span class="map-cell__marker" title="운영진 지정 위험구역">!</span>`);
  }

  function handleFloorTabClick(event) {
    const button = event.target.closest("[data-floor]");
    if (!button) return;
    const targetFloor = button.dataset.floor;
    if (targetFloor === ui.currentFloor) return;
    if (session.type === "admin") {
      ui.currentFloor = targetFloor;
      renderAll();
      return;
    }
    const character = getCharacter(session.characterId);
    if (!getPlayerExposedFloors(character).includes(targetFloor)) {
      showToast("운영진이 아직 공개하지 않은 층입니다.");
      return;
    }
    if (character.role === "survivor") {
      ui.currentFloor = targetFloor;
      renderAll();
      showToast("생환자는 공개된 지도를 열람할 수 있지만 자신의 위치는 이동하지 않습니다.");
      return;
    }
    const transition = getTransitionAt(character.floor, character.x, character.y);
    if (!transition || !transition.destinations.includes(targetFloor)) {
      ui.currentFloor = targetFloor;
      renderAll();
      showToast("이 층은 열람 중입니다. 실제 층 이동은 계단이나 엘리베이터 위치에서 가능합니다.");
      return;
    }
    if (character.ap < 1) {
      showToast("층 이동에 필요한 행동력이 없습니다.");
      return;
    }
    requestSpiritFloorMove(character, targetFloor, transition);
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
    return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso));
  }


  const BURNING_LEVELS = [
    { label: "안정", description: "진행 징후가 없습니다." },
    { label: "미세 진행", description: "공간의 이상 징후가 시작되었습니다." },
    { label: "상승", description: "진행 속도가 눈에 띄게 증가합니다." },
    { label: "과열", description: "위험 단계로 진입했습니다." },
    { label: "임계", description: "즉각적인 운영 개입이 필요합니다." },
    { label: "붕괴", description: "공간 진행도가 최종 단계에 도달했습니다." },
  ];

  function ensureFeatureState(candidate) {
    const next = candidate || createInitialState();
    if (!Array.isArray(next.resourceLibrary)) next.resourceLibrary = [];
    if (!next.spaceBurning || typeof next.spaceBurning !== "object") {
      next.spaceBurning = {
        [spaceBurningKey("B1", "service_tunnel")]: 4,
        [spaceBurningKey("1F", "lobby")]: 1,
        [spaceBurningKey("2F", "poster_hall")]: 2,
      };
    }
    if (!next.mindMap || typeof next.mindMap !== "object") next.mindMap = {};
    if (!Array.isArray(next.mindMap.publishedCards)) {
      next.mindMap.publishedCards = [{
        id: "mind-main-seed",
        title: "현재까지 확인된 핵심 정보",
        body: "사라진 시신과 B1 서비스 통로의 이상 현상은 서로 연관되어 있을 가능성이 높습니다. 운영진이 확정한 정보는 이 영역에 크게 게시됩니다.",
        createdAt: new Date().toISOString(),
      }];
    }
    if (!Array.isArray(next.mindMap.notes)) next.mindMap.notes = [];
    if (!Array.isArray(next.emergencyEvents)) {
      next.emergencyEvents = [{
        id: "event-seed-b1",
        title: "B1 서비스 통로 온도 급강하",
        message: "B1 서비스 통로의 온도가 비정상적으로 하락하고 있습니다. 동결체 출몰 가능성에 주의하십시오.",
        audience: "all",
        active: true,
        createdAt: new Date().toISOString(),
      }];
    }
    next.characters.forEach((character) => {
      if ("online" in character) delete character.online;
    });
    return next;
  }

  function spaceBurningKey(floor, roomId) {
    return `${floor}::${roomId}`;
  }

  function getSpaceBurningLevel(floor, roomId) {
    return Number(state.spaceBurning?.[spaceBurningKey(floor, roomId)] || 0);
  }

  function getUniqueRooms(floorId) {
    const floor = FLOOR_DEFINITIONS[floorId];
    const seen = new Map();
    floor.rooms.forEach((roomDefinition) => seen.set(roomDefinition.id, { id: roomDefinition.id, label: roomDefinition.label }));
    Object.values(floor.cells).forEach((cell) => {
      if (!seen.has(cell.roomId)) seen.set(cell.roomId, { id: cell.roomId, label: cell.roomLabel });
    });
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, "ko"));
  }

  function burningOperationsMarkup() {
    const groups = FLOOR_ORDER.map((floor) => {
      const rows = getUniqueRooms(floor).map((roomInfo) => {
        const level = getSpaceBurningLevel(floor, roomInfo.id);
        return `<label class="burning-room-row">
          <span><strong>${escapeHtml(roomInfo.label)}</strong><small>${floor} · ${escapeHtml(roomInfo.id)}</small><i class="burning-level-badge">현재 ${level}단계 · ${escapeHtml(BURNING_LEVELS[level].label)}</i></span>
          <select class="form-control" name="burning:${floor}:${roomInfo.id}">${BURNING_LEVELS.map((item, index) => `<option value="${index}" ${index === level ? "selected" : ""}>${index}단계 · ${escapeHtml(item.label)}</option>`).join("")}</select>
        </label>`;
      }).join("");
      return `<section class="operations-card"><header><div><p class="eyebrow">${floor} PROGRESS</p><h2>${floor} 공간 진행도</h2></div></header><div class="burning-room-list">${rows}</div></section>`;
    }).join("");
    return `<form data-burning-settings-form><div class="burning-admin-grid">${groups}</div><div class="settings-save-bar"><span class="muted-text">공간별 버닝 수준은 지도에 즉시 표시될 진행 단계입니다.</span><button type="submit" class="button button--primary">공간 진행도 저장</button></div></form>`;
  }

  function mindmapOperationsMarkup() {
    const mainCards = state.mindMap.publishedCards.map((card) => `<article class="mindmap-main-card"><div class="panel-card__body"><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p><button type="button" class="button button--small button--danger" data-delete-mind-main="${card.id}">삭제</button></div></article>`).join("");
    const notes = state.mindMap.notes.map((note) => `<article class="mindmap-note-card"><div class="panel-card__body"><strong>${note.type === "sticker" ? "스티커" : "메모지"} · ${escapeHtml(note.authorName)}</strong><p>${escapeHtml(note.text)}</p><button type="button" class="button button--small button--danger" data-delete-mind-note="${note.id}">삭제</button></div></article>`).join("");
    return `<div class="mindmap-admin-grid">
      <div>
        <section class="operations-card"><header><div><p class="eyebrow">PUBLISHED INFORMATION</p><h2>공개 정보 메인 게시</h2></div></header><form class="operations-form" data-mind-main-form><label>제목<input class="form-control" name="title" required maxlength="80" /></label><label>본문<textarea class="form-control" name="body" required rows="6"></textarea></label><button class="button button--primary" type="submit">대문 정보로 게시</button></form></section>
        <section class="operations-card"><header><h2>게시된 메인 정보</h2></header><div class="mindmap-main-list">${mainCards || emptyStateMarkup("게시된 메인 정보가 없습니다.")}</div></section>
      </div>
      <section class="operations-card"><header><div><p class="eyebrow">PARTICIPANT NOTES</p><h2>참여자 메모지 · 스티커</h2></div><span>${state.mindMap.notes.length}건</span></header><div class="mindmap-note-list">${notes || emptyStateMarkup("참여자가 붙인 메모가 없습니다.")}</div></section>
    </div>`;
  }

  function eventsOperationsMarkup() {
    const events = state.emergencyEvents.map((item) => `<article class="event-manager-card"><header><div><h3>${escapeHtml(item.title)}</h3><div class="event-manager-card__meta"><span>${eventAudienceLabel(item.audience)}</span><span>${formatDateTime(item.createdAt)}</span><strong>${item.active ? "노출 중" : "비활성"}</strong></div></div></header><p>${escapeHtml(item.message)}</p><div class="event-manager-card__actions"><button type="button" class="button button--small ${item.active ? "button--soft" : "button--primary"}" data-toggle-event="${item.id}">${item.active ? "노출 중지" : "다시 노출"}</button><button type="button" class="button button--small button--danger" data-delete-event="${item.id}">삭제</button></div></article>`).join("");
    return `<div class="event-admin-grid"><section class="operations-card"><header><div><p class="eyebrow">EMERGENCY EVENT</p><h2>긴급 이벤트 추가</h2></div></header><form class="operations-form" data-emergency-event-form><label>이벤트 제목<input class="form-control" name="title" required maxlength="80" /></label><label>안내 내용<textarea class="form-control" name="message" required rows="7"></textarea></label><label>노출 대상<select class="form-control" name="audience"><option value="all">전체</option><option value="survivor">생환자</option><option value="spirit">빙혼자</option><option value="admin">운영진</option></select></label><button type="submit" class="button button--danger">긴급 이벤트 등록</button></form></section><section class="operations-card"><header><div><p class="eyebrow">EVENT CONTROL</p><h2>이벤트 조정</h2></div><span>${state.emergencyEvents.filter((item) => item.active).length}건 노출</span></header><div class="event-manager-list">${events || emptyStateMarkup("등록된 긴급 이벤트가 없습니다.")}</div></section></div>`;
  }

  function eventAudienceLabel(audience) {
    return { all: "전체 공개", survivor: "생환자", spirit: "빙혼자", admin: "운영진" }[audience] || "전체 공개";
  }

  function getVisibleEmergencyEvents() {
    const audience = session?.type === "admin" ? "admin" : getCharacter(session?.characterId)?.role;
    return (state.emergencyEvents || []).filter((item) => item.active && (item.audience === "all" || item.audience === audience));
  }

  function renderEventButton() {
    if (!elements.eventButton) return;
    const events = getVisibleEmergencyEvents();
    elements.eventButton.innerHTML = `<span aria-hidden="true">!</span> 긴급 이벤트 ${events.length}건`;
    elements.eventButton.classList.toggle("is-empty", events.length === 0);
    elements.eventButton.classList.toggle("has-active-event", events.length > 0);
  }

  function showEmergencyEvent() {
    const events = getVisibleEmergencyEvents();
    openModal({
      eyebrow: "EMERGENCY EVENT",
      title: events.length ? `긴급 이벤트 ${events.length}건` : "현재 긴급 이벤트 없음",
      body: events.length ? `<div class="event-manager-list">${events.map((item) => `<article class="event-manager-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.message)}</p><div class="event-manager-card__meta"><span>${eventAudienceLabel(item.audience)}</span><span>${formatDateTime(item.createdAt)}</span></div></article>`).join("")}</div>` : emptyStateMarkup("현재 노출 중인 긴급 이벤트가 없습니다."),
      footer: `<button type="button" class="button button--primary" data-modal-close>확인</button>`,
    });
    elements.modalFooter.querySelector("[data-modal-close]")?.addEventListener("click", closeModal);
  }

  function renderComparison() {}

  function playerJournalContent(character, tab) {
    if (tab === "inventory") {
      const items = character.inventory.length ? character.inventory.map((item) => `<button type="button" class="inventory-item" data-evidence-id="${escapeHtml(item.uid)}"><span class="inventory-item__head"><strong>${escapeHtml(item.title)}</strong>${certaintyChipMarkup(item.certainty)}</span><p>${escapeHtml(item.description)}</p></button>`).join("") : emptyStateMarkup("전달받은 조사 자료가 없습니다.");
      return `<section class="panel-card"><div class="panel-card__header">획득 자료 ${character.inventory.length}건</div><div class="panel-card__body inventory-list">${items}</div></section>`;
    }
    if (tab === "records") {
      const records = character.records.length ? character.records.map((record) => `<div class="record-item"><span class="record-item__head"><strong>${escapeHtml(record.title)}</strong><span>${escapeHtml(record.floor)}</span></span><p>${escapeHtml(record.description)}</p></div>`).join("") : emptyStateMarkup("완료한 조사가 없습니다.");
      return `<section class="panel-card"><div class="panel-card__header">조사한 장소</div><div class="panel-card__body record-list">${records}</div></section>`;
    }
    if (tab === "board") return sharedMindMapMarkup(character);
    return `<section class="panel-card"><div class="panel-card__header">사라진 시신</div><div class="panel-card__body"><div class="stat-grid"><div class="stat-card"><span>최초 확인</span><strong>7구</strong></div><div class="stat-card"><span>현재 확인</span><strong>4구</strong></div><div class="stat-card"><span>사라진 시신</span><strong>3구</strong></div><div class="stat-card"><span>확정 경로</span><strong>2단계</strong></div></div></div></section><section class="panel-card"><div class="panel-card__header">동결체 출몰 기록</div><div class="panel-card__body record-list"><div class="record-item"><strong>B1 서비스 통로</strong><p>유력 · 마지막 확인 14:21 · 이동 방향 연구별관</p></div><div class="record-item"><strong>2F 포스터 전시장</strong><p>미확인 · 낮은 온도 흔적만 발견</p></div></div></section>`;
  }

  function sharedMindMapMarkup(character) {
    const main = state.mindMap.publishedCards.map((card) => `<article class="mindmap-published-card"><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.body)}</p></article>`).join("");
    const notes = state.mindMap.notes.map((note, index) => `<article class="mindmap-user-note ${note.type === "sticker" ? "is-sticker" : ""}" style="--note-color:${escapeHtml(note.color)};--note-rotate:${(index % 5) - 2}deg"><strong>${note.type === "sticker" ? "◆" : "메모"}</strong><p>${escapeHtml(note.text)}</p><small>${escapeHtml(note.authorName)} · ${note.authorId}</small>${note.authorId === character.id ? `<button type="button" class="compact-icon-button" data-delete-player-note="${note.id}">삭제</button>` : ""}</article>`).join("");
    return `<div class="shared-mindmap"><section><p class="eyebrow">OFFICIAL INFORMATION</p><div class="mindmap-published-grid">${main || emptyStateMarkup("운영진이 게시한 공개 정보가 없습니다.")}</div></section><section class="mindmap-community-board"><p class="eyebrow">PARTICIPANT BOARD</p><div class="mindmap-note-grid">${notes || emptyStateMarkup("아직 붙은 메모지나 스티커가 없습니다.")}</div><form class="mindmap-note-form" data-player-mind-note-form><textarea class="form-control" name="text" required maxlength="240" rows="3" placeholder="공개 정보에 덧붙일 추측이나 메모를 적으세요."></textarea><div class="mindmap-note-form__row"><select class="form-control" name="type"><option value="note">메모지</option><option value="sticker">스티커</option></select><select class="form-control" name="color"><option value="#fff1a8">노랑</option><option value="#ccecff">파랑</option><option value="#ffd4dd">분홍</option><option value="#d8f2ce">초록</option></select><button class="button button--primary" type="submit">붙이기</button></div></form></section></div>`;
  }

  async function registerResourceTemplate(formData) {
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const certainty = String(formData.get("certainty") || "unknown");
    const file = formData.get("image");
    if (!title || !description) return;
    let imageData = null;
    let fileName = null;
    if (file && file.size) {
      if (!file.type.startsWith("image/")) return showToast("이미지 파일만 등록할 수 있습니다.");
      if (file.size > 1.5 * 1024 * 1024) return showToast("이미지는 1.5MB 이하만 등록할 수 있습니다.");
      imageData = await readFileAsDataUrl(file);
      fileName = file.name;
    }
    state.resourceLibrary.unshift({ id: `resource-${Date.now()}`, title, description, certainty, imageData, fileName, createdAt: new Date().toISOString() });
    addLog(`운영진이 자료 보관함에 「${title}」을(를) 사전 등록했습니다.`);
    persistState();
    renderAdminOperationsPage();
    showToast("자료 보관함에 등록했습니다.");
  }

  function deliverResource(formData) {
    const template = state.resourceLibrary.find((item) => item.id === String(formData.get("resourceId") || ""));
    const characterIds = [...new Set(formData.getAll("characterIds").map(Number).filter((id) => getCharacter(id)))];
    if (!template) return showToast("전달할 자료를 선택해 주세요.");
    if (!characterIds.length) return showToast("자료를 받을 인원을 선택해 주세요.");
    const deliveryId = `delivery-${Date.now()}`;
    characterIds.forEach((id) => {
      const character = getCharacter(id);
      character.inventory.unshift({
        uid: `${deliveryId}-${id}`,
        sourceId: template.id,
        title: template.title,
        description: template.description,
        certainty: template.certainty,
        floor: character.floor,
        room: getRoomLabel(character.floor, character.x, character.y),
        discoveredBy: "운영진 전달",
        fileName: template.fileName,
        imageData: template.imageData,
        grantedAt: new Date().toISOString(),
      });
    });
    addLog(`운영진이 ${characterIds.map((id) => getCharacter(id).name).join(", ")}에게 자료 「${template.title}」을(를) 전달했습니다.`);
    persistState();
    renderAdminOperationsPage();
    showToast(`${characterIds.length}명에게 자료를 전달했습니다.`);
  }

  function createMindNote(formData) {
    if (session?.type !== "player") return;
    const character = getCharacter(session.characterId);
    const text = String(formData.get("text") || "").trim();
    if (!text) return;
    state.mindMap.notes.unshift({ id: `mind-note-${Date.now()}`, authorId: character.id, authorName: character.name, type: String(formData.get("type") || "note"), color: String(formData.get("color") || "#fff1a8"), text, createdAt: new Date().toISOString() });
    state.mindMap.notes = state.mindMap.notes.slice(0, 100);
    persistState();
    renderRightSidebar();
    showToast("공동 마인드맵에 붙였습니다.");
  }

  function previewResourceTemplate(resourceId) {
    const item = state.resourceLibrary.find((resource) => resource.id === resourceId);
    if (!item) return;
    showEvidenceModal({ ...item, uid: item.id, floor: "자료 보관함", room: "사전 등록", discoveredBy: "운영진" });
  }


  /* ===== 2026-08-02 규칙 개편 오버라이드 ===== */
  const FREEZE_STAGE_THRESHOLDS = [0, 18, 42, 66, 90, 120];
  const SPACE_TIME_ADDITIONS = [0, 0.2, 0.5, 1.2, 2.0, 2.5];
  const EXPOSURE_PRESETS = [
    { id:"cold", label:"빙혼체의 냉기에 노출", add:0.2 },
    { id:"diluted_skin", label:"희석액 피부 접촉", add:0.3 },
    { id:"concentrate_skin", label:"원액 피부 접촉", add:0.5 },
    { id:"mucosa_wound", label:"눈·입·코 또는 열린 상처 노출", add:0.8 },
    { id:"shallow_bite", label:"얕게 물림", add:1.2 },
    { id:"deep_bite", label:"깊게 물림", add:1.6 },
    { id:"ingestion", label:"액체 섭취·주입", add:2.0 },
    { id:"fatal", label:"원액 침수·치명적 특수 공격", min:4.0 },
    { id:"custom", label:"기타 직접 입력", custom:true },
  ];

  function ensureFeatureState(candidate) {
    const next = candidate || createInitialState();
    if (!Array.isArray(next.resourceLibrary)) next.resourceLibrary = [];
    if (!next.spaceBurning || typeof next.spaceBurning !== "object") next.spaceBurning = {};
    if (!Array.isArray(next.emergencyEvents)) next.emergencyEvents = [];
    if (!Array.isArray(next.movementLogs)) next.movementLogs = [];
    if (!Array.isArray(next.adminMemos)) next.adminMemos = [];
    if (!next.exposure) next.exposure = {};
    ["survivor","spirit"].forEach((role)=>{
      const defaults=defaultRoleExposure(role); const current=next.exposure[role]||{};
      next.exposure[role]={floors:{...defaults.floors,...(current.floors||{})},features:{...defaults.features,...(current.features||{})},mapInfo:{...defaults.mapInfo,...(current.mapInfo||{})}};
      next.exposure[role].features.board=false;
      next.exposure[role].mapInfo.burning=false;
    });
    next.characters.forEach((character,index)=>{
      if ("online" in character) delete character.online;
      if (!Array.isArray(character.inventory)) character.inventory=[];
      if (!Array.isArray(character.statuses)) character.statuses=[];
      if (!Array.isArray(character.records)) character.records=[];
      if (!Array.isArray(character.investigations)) character.investigations=[];
      if (character.role === "survivor") {
        character.ap=0; character.maxAp=0; character.freezeClock=null;
      } else {
        if (!character.freezeClock) {
          const legacyHours=character.spiritSince ? Math.max(0,(Date.now()-new Date(character.spiritSince).getTime())/36e5) : 0;
          character.freezeClock={baseHours:legacyHours,lastUpdated:new Date().toISOString(),modifiers:[]};
        }
        if (!Array.isArray(character.freezeClock.modifiers)) character.freezeClock.modifiers=[];
      }
    });
    return next;
  }

  function defaultRoleExposure(role) {
    return {
      floors:Object.fromEntries(FLOOR_ORDER.map((floor)=>[floor,role==="survivor"?["1F","2F"].includes(floor):true])),
      features:{inventory:true,records:true,board:false,tracking:role==="spirit",investigation:true},
      mapInfo:{roomLabels:true,burning:false,danger:true,teamPositions:true,warmth:role==="spirit"},
    };
  }

  function getRoomIdByLabel(floorId,label){
    const floor=FLOOR_DEFINITIONS[floorId];
    return getUniqueRooms(floorId).find((room)=>room.label===label)?.id || floor.defaultRoom?.id || null;
  }
  function currentSpaceAddition(character, floorOverride=null, roomOverride=null){
    if (!character || character.role!=="spirit") return 0;
    const floor=floorOverride || character.floor;
    const roomId=roomOverride || getRoomId(character.floor,character.x,character.y);
    return SPACE_TIME_ADDITIONS[getSpaceBurningLevel(floor,roomId)] || 0;
  }
  function clockMultiplier(character, floorOverride=null, roomOverride=null){
    const clock=character.freezeClock || {modifiers:[]};
    let multiplier=1 + currentSpaceAddition(character,floorOverride,roomOverride);
    let minimum=1;
    for (const mod of clock.modifiers || []) { multiplier += Number(mod.add||0); minimum=Math.max(minimum,Number(mod.min||1)); }
    return Math.max(multiplier,minimum);
  }
  function settleFreezeClock(character,floorOverride=null,roomOverride=null){
    if (!character || character.role!=="spirit") return;
    if (!character.freezeClock) character.freezeClock={baseHours:0,lastUpdated:new Date().toISOString(),modifiers:[]};
    const now=Date.now(); const last=new Date(character.freezeClock.lastUpdated||now).getTime();
    const realHours=Math.max(0,(now-last)/36e5);
    character.freezeClock.baseHours=Number(character.freezeClock.baseHours||0)+realHours*clockMultiplier(character,floorOverride,roomOverride);
    character.freezeClock.lastUpdated=new Date(now).toISOString();
  }
  function effectiveFreezeHours(character){
    if (!character || character.role!=="spirit") return 0;
    const clock=character.freezeClock||{baseHours:0,lastUpdated:new Date().toISOString(),modifiers:[]};
    return Number(clock.baseHours||0)+Math.max(0,(Date.now()-new Date(clock.lastUpdated).getTime())/36e5)*clockMultiplier(character);
  }
  function freezeStage(hours){
    if (hours>=120) return 5; if (hours>=90) return 4; if (hours>=66) return 3; if (hours>=42) return 2; if (hours>=18) return 1; return 0;
  }
  function nextFreezeThreshold(stage){ return stage>=5 ? 120 : FREEZE_STAGE_THRESHOLDS[stage+1]; }
  function freezeStageLabel(stage){ return ["0단계","1단계","2단계","3단계","4단계","5단계"][stage]||"0단계"; }

  function renderAdminOperationsPage(){
    if(session?.type!=="admin")return;
    const tabs={overview:"캐릭터 현황",inventory:"자료 보관함",freeze:"빙혼 시간",burning:"공간 진행도",movements:"빙혼 이동 기록",memos:"운영 메모",events:"긴급 이벤트",settings:"환경설정"};
    if(!tabs[ui.operationsTab]) ui.operationsTab="overview";
    const tabButtons=Object.entries(tabs).map(([id,label])=>`<button type="button" class="operations-tab ${ui.operationsTab===id?"is-active":""}" data-operations-tab="${id}">${label}</button>`).join("");
    elements.adminOperationsContent.innerHTML=`<div class="operations-page__header"><div><p class="eyebrow">OPERATIONS CENTER</p><h1>운영진 통합 운영페이지</h1><p>인원·자료·빙혼 시간·공간 진행·이동 기록·긴급 이벤트를 관리합니다.</p></div><button type="button" class="button" data-close-operations>지도 화면으로 돌아가기</button></div><nav class="operations-tabs">${tabButtons}</nav><div class="operations-content">${operationsTabContent(ui.operationsTab)}</div><div class="operations-toast is-hidden" role="status"></div>`;
  }
  function operationsTabContent(tab){
    if(tab==="inventory")return inventoryOperationsMarkup();
    if(tab==="freeze")return freezeOperationsMarkup();
    if(tab==="burning")return burningOperationsMarkup();
    if(tab==="movements")return movementOperationsMarkup();
    if(tab==="memos")return memoOperationsMarkup();
    if(tab==="events")return eventsOperationsMarkup();
    if(tab==="settings")return settingsOperationsMarkup();
    return overviewOperationsMarkup();
  }

  function overviewOperationsMarkup(){
    const filter=ui.rosterFilter||"all"; ui.rosterFilter=filter;
    const list=state.characters.filter((c)=>filter==="all"||c.role===filter);
    return `<div class="operations-summary-grid"><article><span>전체</span><strong>${state.characters.length}</strong></article><article><span>생환자</span><strong>${state.characters.filter(c=>c.role==="survivor").length}</strong></article><article><span>빙혼자</span><strong>${state.characters.filter(c=>c.role==="spirit").length}</strong></article><article><span>자료 보관함</span><strong>${state.resourceLibrary.length}</strong></article></div><div class="roster-filter"><button type="button" data-roster-filter="all" class="${filter==="all"?"is-active":""}">전체</button><button type="button" data-roster-filter="spirit" class="${filter==="spirit"?"is-active":""}">빙혼자</button><button type="button" data-roster-filter="survivor" class="${filter==="survivor"?"is-active":""}">생환자</button></div>${combinedRosterMarkup(list)}`;
  }
  function combinedRosterMarkup(characters){
    const rows=characters.map((c)=>{const items=c.inventory.length?c.inventory.slice(0,3).map(i=>`<button type="button" class="compact-item-link" data-evidence-id="${escapeHtml(i.uid)}">${escapeHtml(i.title)}</button>`).join(""):`<span class="muted-text">없음</span>`; const h=effectiveFreezeHours(c),st=freezeStage(h); const freeze=c.role==="spirit"?`<strong>${freezeStageLabel(st)} · ${h.toFixed(1)}시간</strong><small>현재 ${clockMultiplier(c).toFixed(1)}배속</small>`:`<span class="muted-text">해당 없음</span>`; return `<tr><td><button type="button" class="operations-character-link" data-operations-character="${c.id}">${c.id} · ${escapeHtml(c.name)}</button></td><td>${roleChipMarkup(c.role)}</td><td>${escapeHtml(c.floor)} · ${escapeHtml(getRoomLabel(c.floor,c.x,c.y))}</td><td><div class="compact-item-list">${items}</div></td><td><div class="spirit-state-cell">${freeze}</div></td><td>${c.statuses.length?c.statuses.map(id=>`<span class="status-icon">${STATUS_DEFINITIONS[id]?.icon||"·"}</span>`).join(""):"정상"}</td></tr>`}).join("");
    return `<section class="operations-card operations-card--roster"><header><div><p class="eyebrow">CHARACTER STATUS</p><h2>캐릭터 현황</h2></div><span>${characters.length}명</span></header><div class="operations-table-wrap"><table class="operations-table"><thead><tr><th>ID · 이름</th><th>분류</th><th>현재 위치</th><th>소지품</th><th>빙혼 시간</th><th>상태이상</th></tr></thead><tbody>${rows||`<tr><td colspan="6">해당 인원이 없습니다.</td></tr>`}</tbody></table></div></section>`;
  }

  function freezeOperationsMarkup(){
    const spirits=state.characters.filter(c=>c.role==="spirit");
    const cards=spirits.map(c=>{const hours=effectiveFreezeHours(c),stage=freezeStage(hours),next=nextFreezeThreshold(stage),pct=stage>=5?100:Math.min(100,(hours/FREEZE_STAGE_THRESHOLDS[5])*100); const mods=(c.freezeClock?.modifiers||[]).map(m=>`<span class="freeze-modifier">${escapeHtml(m.label)} · ${m.min?`최소 ${Number(m.min).toFixed(1)}배`:`+${Number(m.add).toFixed(1)}`}<button type="button" data-remove-time-modifier="${c.id}" data-modifier-id="${m.id}" aria-label="제거">×</button></span>`).join(""); const options=EXPOSURE_PRESETS.map(p=>`<option value="${p.id}">${escapeHtml(p.label)}${p.add?` (+${p.add})`:p.min?` (최소 ${p.min}배)`:""}</option>`).join(""); return `<article class="freeze-card"><div class="freeze-card__head"><div><h3>${c.id} · ${escapeHtml(c.name)}</h3><small>${escapeHtml(c.floor)} · ${escapeHtml(getRoomLabel(c.floor,c.x,c.y))}</small></div>${roleChipMarkup("spirit")}</div><div class="freeze-card__metrics"><div><span>누적 진행 시간</span><strong>${hours.toFixed(2)}시간</strong></div><div><span>현재 단계</span><strong>${freezeStageLabel(stage)}</strong></div><div><span>현재 시간 배율</span><strong>${clockMultiplier(c).toFixed(1)}배</strong></div></div><div class="freeze-progress"><i style="width:${pct}%"></i></div><p class="space-multiplier-note">다음 전환: ${stage>=5?"최종 단계 도달":`${next}시간 · ${(Math.max(0,next-hours)).toFixed(1)}시간 남음`}<br>현재 공간 진행도 ${getSpaceBurningLevel(c.floor,getRoomId(c.floor,c.x,c.y))}단계 → +${currentSpaceAddition(c).toFixed(1)}배속</p><div class="freeze-modifiers">${mods||`<span class="muted-text">추가 노출 배율 없음</span>`}</div><form class="freeze-form" data-time-modifier-form><input type="hidden" name="characterId" value="${c.id}"><label>노출 선택<select class="form-control" name="preset">${options}</select></label><label>기타 배율<input class="form-control" name="customValue" type="number" step="0.1" min="0" placeholder="+0.4"></label><button class="button button--primary" type="submit">배속 추가</button><label class="custom-label">기타 설명<input class="form-control" name="customLabel" maxlength="60" placeholder="기타 선택 시 노출 내용을 입력"></label></form></article>`}).join("");
    return `<section class="operations-card"><header><div><p class="eyebrow">FREEZING TIMELINE</p><h2>실제 단계 전환 기준</h2></div></header><table class="freeze-stage-table"><thead><tr><th>단계</th><th>전환 시점</th></tr></thead><tbody><tr><td>1단계</td><td>18시간</td></tr><tr><td>2단계</td><td>42시간</td></tr><tr><td>3단계</td><td>66시간</td></tr><tr><td>4단계</td><td>90시간</td></tr><tr><td>5단계</td><td>120시간</td></tr></tbody></table></section><div class="freeze-grid">${cards||emptyStateMarkup("빙혼자가 없습니다.")}</div>`;
  }

  function burningOperationsMarkup(){
    const groups=FLOOR_ORDER.map(floor=>{const rows=getUniqueRooms(floor).map(room=>{const level=getSpaceBurningLevel(floor,room.id);return `<label class="burning-room-row"><span><strong>${escapeHtml(room.label)}</strong><small>${floor} · 관리자 전용</small><i class="burning-level-badge">${level}단계 · 공간 체류 +${SPACE_TIME_ADDITIONS[level].toFixed(1)}배속</i></span><select class="form-control" name="burning:${floor}:${room.id}">${BURNING_LEVELS.map((item,index)=>`<option value="${index}" ${index===level?"selected":""}>${index}단계 · +${SPACE_TIME_ADDITIONS[index].toFixed(1)}배속</option>`).join("")}</select></label>`}).join("");return `<section class="operations-card"><header><div><p class="eyebrow">${floor} PRIVATE PROGRESS</p><h2>${floor} 공간 진행도</h2></div><span>운영진만 열람</span></header><div class="burning-room-list">${rows}</div></section>`}).join(""); return `<form data-burning-settings-form><section class="operations-card settings-guide"><h3>공간 진행도 시간 적용</h3><p>1단계 +0.2 · 2단계 +0.5 · 3단계 +1.2 · 4단계 +2.0 · 5단계 +2.5배속. 생환자와 빙혼자 화면에는 단계 및 배율이 노출되지 않습니다.</p></section><div class="burning-admin-grid">${groups}</div><div class="settings-save-bar"><button type="submit" class="button button--primary">공간 진행도 저장</button></div></form>`;
  }

  function settingsOperationsMarkup(){return `<form data-exposure-settings-form><div class="settings-role-grid">${roleSettingsMarkup("survivor")}${roleSettingsMarkup("spirit")}</div><section class="operations-card settings-guide"><h3>노출 설정 원칙</h3><p>체크박스를 조정한 뒤 저장 버튼을 눌러야 적용됩니다. 공간 진행도와 빙혼 시간 배율은 운영진에게만 공개됩니다.</p></section><div class="settings-save-bar"><span class="muted-text">변경사항은 저장 전까지 적용되지 않습니다.</span><button type="submit" class="button button--primary">환경설정 저장 및 적용</button></div></form>`}
  function roleSettingsMarkup(role){const exposure=getRoleExposure(role);const floors=FLOOR_ORDER.map(f=>settingToggleMarkup(role,"floors",f,f,exposure.floors[f])).join("");const featureKeys=[["inventory","소지품"],["records","조사 기록"],["tracking","추적 기록"],["investigation","현재 위치 조사"]];const infoKeys=[["roomLabels","공간명"],["danger","위험구역"],["teamPositions","그룹 위치 공유"],["warmth","온기 감지"]];return `<section class="operations-card role-settings-card role-settings-card--${role}"><header><div><p class="eyebrow">${role.toUpperCase()} EXPOSURE</p><h2>${ROLE_LABELS[role]} 화면 설정</h2></div>${roleChipMarkup(role)}</header><div class="settings-section"><h3>노출 층</h3><div class="settings-toggle-grid settings-toggle-grid--floors">${floors}</div></div><div class="settings-section"><h3>노출 기능</h3><div class="settings-toggle-grid">${featureKeys.map(([k,l])=>settingToggleMarkup(role,"features",k,l,exposure.features[k])).join("")}</div></div><div class="settings-section"><h3>지도 정보</h3><div class="settings-toggle-grid">${infoKeys.map(([k,l])=>settingToggleMarkup(role,"mapInfo",k,l,exposure.mapInfo[k])).join("")}</div></div></section>`}

  function eventsOperationsMarkup(){const events=state.emergencyEvents.map(item=>`<article class="event-manager-card ${item.active?"":"is-paused"}"><header><div><h3>${escapeHtml(item.title)}</h3><div class="event-manager-card__meta"><span>${eventAudienceLabel(item.audience)}</span><span>${formatDateTime(item.createdAt)}</span><strong>${item.active?"노출 중":"노출 중지"}</strong></div></div></header><p>${escapeHtml(item.message)}</p><div class="event-manager-card__actions"><button type="button" class="button button--small ${item.active?"button--soft":"button--primary"}" data-toggle-event="${item.id}">${item.active?"노출 중지":"노출 중"}</button><button type="button" class="button button--small button--danger" data-delete-event="${item.id}">삭제</button></div></article>`).join("");return `<div class="event-admin-grid"><section class="operations-card"><header><div><p class="eyebrow">EMERGENCY EVENT</p><h2>긴급 이벤트 추가</h2></div></header><form class="operations-form" data-emergency-event-form><label>이벤트 제목<input class="form-control" name="title" required maxlength="80"></label><label>안내 내용<textarea class="form-control" name="message" required rows="7"></textarea></label><label>노출 대상<select class="form-control" name="audience"><option value="all">전체</option><option value="survivor">생환자</option><option value="spirit">빙혼자</option><option value="admin">운영진</option></select></label><button type="submit" class="button button--danger">긴급 이벤트 등록</button></form></section><section class="operations-card"><header><div><p class="eyebrow">EVENT CONTROL</p><h2>이벤트 조정</h2></div><span>${state.emergencyEvents.filter(i=>i.active).length}건 노출</span></header><div class="event-manager-list">${events||emptyStateMarkup("등록된 긴급 이벤트가 없습니다.")}</div></section></div>`}

  function renderPlayerJournal(){const c=getCharacter(session.characterId),e=getRoleExposure(c.role);const all=[["inventory","소지품"],["records","조사"],["tracking","추적"]];const tabs=all.filter(([id])=>e.features[id]);if(!tabs.some(([id])=>id===ui.rightPanelTab))ui.rightPanelTab=tabs[0]?.[0]||null;elements.rightSidebar.innerHTML=`<div class="sidebar-header"><h2>조사 기록</h2></div><div class="sidebar-body">${tabs.length?`<div class="panel-tabs">${tabs.map(([id,l])=>`<button type="button" class="panel-tab ${ui.rightPanelTab===id?"is-active":""}" data-panel-tab="${id}">${l}</button>`).join("")}</div><div class="panel-content">${playerJournalContent(c,ui.rightPanelTab)}</div>`:emptyStateMarkup("현재 공개된 기록 기능이 없습니다.")}</div>`}

  function renderMap(){
    const floor=FLOOR_DEFINITIONS[ui.currentFloor],perspective=getPerspective(),movementActor=getMovementActor(),reachable=getReachableCellCosts(movementActor,floor.id),exposure=session.type==="player"?getRoleExposure(movementActor.role):null; const warmthAllowed=!exposure||exposure.mapInfo.warmth; const warmth=warmthAllowed?getWarmthInfo(perspective.mode,perspective.character,floor.id):{active:false,count:0,roomId:null}; const focus=perspective.mode==="admin"?movementActor:perspective.character; const activeRoomId=focus&&focus.floor===floor.id?getRoomId(focus.floor,focus.x,focus.y):null;
    elements.mapGrid.style.setProperty("--columns",GRID_COLUMNS);elements.mapGrid.style.setProperty("--rows",GRID_ROWS);elements.mapGrid.classList.toggle("is-player-locked",session.type==="player"&&movementActor.role==="survivor");elements.mapGrid.innerHTML="";
    floor.rooms.forEach(r=>{const el=document.createElement("div");el.className="map-room";el.dataset.roomId=r.id;el.style.gridColumn=`${r.x1+1} / ${r.x2+2}`;el.style.gridRow=`${r.y1+1} / ${r.y2+2}`;el.style.setProperty("--room-color",r.color);const level=getSpaceBurningLevel(floor.id,r.id);el.dataset.burningLevel=String(level);if(r.id===activeRoomId)el.classList.add("is-active-room");if(warmth.active&&r.id===warmth.roomId)el.classList.add("is-warm");const showLabel=!exposure||exposure.mapInfo.roomLabels||r.id===activeRoomId;el.innerHTML=showLabel?`<span>${escapeHtml(r.label)}</span>`:"";if(perspective.mode==="admin"&&level>0)el.insertAdjacentHTML("beforeend",`<small class="map-room__burning">진행 ${level} · +${SPACE_TIME_ADDITIONS[level].toFixed(1)}배속</small>`);elements.mapGrid.appendChild(el)});
    for(let y=0;y<GRID_ROWS;y++)for(let x=0;x<GRID_COLUMNS;x++){const cell=floor.cells[cellKey(x,y)],key=cellKey(x,y),el=document.createElement("button");el.type="button";el.className="map-cell is-visible";el.dataset.x=String(x);el.dataset.y=String(y);el.dataset.roomId=cell.roomId;el.style.gridColumn=String(x+1);el.style.gridRow=String(y+1);el.title=`${cell.roomLabel} · X${x+1}, Y${y+1}`;if(reachable.has(key)&&movementActor.floor===floor.id&&movementActor.role==="spirit")el.classList.add("is-reachable");if(movementActor.floor===floor.id&&movementActor.x===x&&movementActor.y===y)el.classList.add("is-current");if(state.layers.danger&&(!exposure||exposure.mapInfo.danger)&&isDangerCell(floor.id,x,y))el.classList.add("is-danger");if(getTransitionAt(floor.id,x,y))el.classList.add("is-transition");const details=perspective.mode==="admin"||cell.roomId===activeRoomId;if(details)appendMapMarkersWithExposure(el,floor,x,y,perspective,exposure);const canShow=!exposure||exposure.mapInfo.teamPositions;let chars=getVisibleCharactersAtCell(floor.id,x,y,perspective,true).filter(c=>c.id===movementActor.id||canShow||getRoomId(c.floor,c.x,c.y)===activeRoomId);if(perspective.mode==="spirit")chars=chars.filter(c=>c.role!=="survivor");chars.forEach(c=>el.insertAdjacentHTML("beforeend",tokenMarkup(c,c.id===movementActor.id)));elements.mapGrid.appendChild(el)}
    renderWarmthBanner(warmth,perspective);updateMovementRule(movementActor);
  }
  function renderWarmthBanner(warmth,perspective){if(!elements.warmthBanner)return;const show=perspective.mode==="spirit"&&warmth.active;elements.warmthBanner.classList.toggle("is-hidden",!show);if(show)elements.warmthBanner.innerHTML=`<span class="warmth-anonymous">온기가 느껴집니다.</span> 이 공간에 생환자가 ${warmth.count}명 있습니다. 누구인지는 알 수 없습니다.`}

  function recordSpiritMovement(character,{fromFloor,fromRoom,toFloor,toRoom,cost=0,source="이동"}){if(!character||character.role!=="spirit")return;const oldRoomId=getRoomIdByLabel(fromFloor,fromRoom);settleFreezeClock(character,fromFloor,oldRoomId);state.movementLogs.unshift({id:`movement-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,characterId:character.id,fromFloor,fromRoom,toFloor,toRoom,cost,source,createdAt:new Date().toISOString()});state.movementLogs=state.movementLogs.slice(0,300)}

  async function imageFileToStoredData(file){
    const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
    if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
    const raw=await readFileAsDataUrl(file); if(file.size<=550*1024)return raw;
    return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{let w=img.naturalWidth,h=img.naturalHeight;const max=1400;if(Math.max(w,h)>max){const r=max/Math.max(w,h);w=Math.round(w*r);h=Math.round(h*r)}const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;canvas.getContext("2d").drawImage(img,0,0,w,h);let quality=.82,data=canvas.toDataURL("image/jpeg",quality);while(data.length>700000&&quality>.45){quality-=.08;data=canvas.toDataURL("image/jpeg",quality)}resolve(data)};img.onerror=reject;img.src=raw});
  }
  async function registerResourceTemplate(formData){const title=String(formData.get("title")||"").trim(),description=String(formData.get("description")||"").trim(),certainty=String(formData.get("certainty")||"unknown"),file=formData.get("image");if(!title||!description)return;let imageData=null,fileName=null;if(file&&file.size){if(!file.type.startsWith("image/"))return showToast("이미지 파일만 등록할 수 있습니다.");try{imageData=await imageFileToStoredData(file);fileName=file.name}catch(e){return showToast(e?.message==="IMAGE_TOO_LARGE"?"원본 이미지는 8MB 이하만 등록할 수 있습니다.":"이미지를 처리하지 못했습니다.")}}state.resourceLibrary.unshift({id:`resource-${Date.now()}`,title,description,certainty,imageData,fileName,createdAt:new Date().toISOString()});addLog(`운영진이 자료 보관함에 「${title}」을(를) 사전 등록했습니다.`);try{persistState()}catch(e){state.resourceLibrary.shift();return showToast("브라우저 저장 공간이 부족합니다. 더 작은 이미지를 사용해 주세요.")}renderAdminOperationsPage();showToast("이미지를 포함해 자료 보관함에 등록했습니다.")}

  function handleOperationsClick(event){
    if(session?.type!=="admin")return;
    if(event.target.closest("[data-close-operations]"))return closeAdminOperationsPage();
    const tab=event.target.closest("[data-operations-tab]");if(tab){ui.operationsTab=tab.dataset.operationsTab;renderAdminOperationsPage();return}
    const filter=event.target.closest("[data-roster-filter]");if(filter){ui.rosterFilter=filter.dataset.rosterFilter;renderAdminOperationsPage();return}
    const resetClock=event.target.closest("[data-reset-infection-clock]");if(resetClock){const c=getCharacter(Number(resetClock.dataset.resetInfectionClock));if(c){resetInfectionClock(c);addLog(`관리자가 ${c.name}의 감염 진행 시간을 120:00:00으로 초기화했습니다.`);persistState();renderAdminOperationsPage();showToast(`${c.name}의 감염 시간을 초기화했습니다.`)}return}
    const resetAll=event.target.closest("[data-reset-all-infection-clocks]");if(resetAll){state.characters.forEach(resetInfectionClock);addLog("관리자가 모든 캐릭터의 감염 진행 시간을 120:00:00으로 초기화했습니다.");persistState();renderAdminOperationsPage();showToast("모든 캐릭터의 감염 시간을 초기화했습니다.");return}
    const removeMod=event.target.closest("[data-remove-time-modifier]");if(removeMod){const c=getCharacter(Number(removeMod.dataset.removeTimeModifier));if(c){settleFreezeClock(c);c.freezeClock.modifiers=c.freezeClock.modifiers.filter(m=>m.id!==removeMod.dataset.modifierId);persistState();renderAdminOperationsPage()}return}
    const preview=event.target.closest("[data-preview-resource]");if(preview)return previewResourceTemplate(preview.dataset.previewResource);
    const resourceDelete=event.target.closest("[data-delete-resource]");if(resourceDelete){state.resourceLibrary=state.resourceLibrary.filter(i=>i.id!==resourceDelete.dataset.deleteResource);persistState();renderAdminOperationsPage();return}
    const toggle=event.target.closest("[data-toggle-event]");if(toggle){const item=state.emergencyEvents.find(i=>i.id===toggle.dataset.toggleEvent);if(item)item.active=!item.active;persistState();renderAdminOperationsPage();renderEventButton();return}
    const delEvent=event.target.closest("[data-delete-event]");if(delEvent){state.emergencyEvents=state.emergencyEvents.filter(i=>i.id!==delEvent.dataset.deleteEvent);persistState();renderAdminOperationsPage();renderEventButton();return}
    const characterButton=event.target.closest("[data-operations-character]");if(characterButton)return showCharacterManagementModal(Number(characterButton.dataset.operationsCharacter));
    const evidenceButton=event.target.closest("[data-evidence-id]");if(evidenceButton){const evidence=collectAllEvidence().find(i=>i.uid===evidenceButton.dataset.evidenceId);if(evidence)showEvidenceModal(evidence);return}
    const deleteMemo=event.target.closest("[data-delete-memo]");if(deleteMemo){state.adminMemos=state.adminMemos.filter(m=>m.id!==deleteMemo.dataset.deleteMemo);persistState();renderAdminOperationsPage()}
  }

  async function handleOperationsSubmit(event){
    if(session?.type!=="admin")return;
    const resourceForm=event.target.closest("[data-resource-library-form]");if(resourceForm){event.preventDefault();await registerResourceTemplate(new FormData(resourceForm));return}
    const delivery=event.target.closest("[data-resource-delivery-form]");if(delivery){event.preventDefault();deliverResource(new FormData(delivery));return}
    const timeForm=event.target.closest("[data-time-modifier-form]");if(timeForm){event.preventDefault();const fd=new FormData(timeForm),c=getCharacter(Number(fd.get("characterId"))),preset=EXPOSURE_PRESETS.find(p=>p.id===fd.get("preset"));if(!c||!preset)return;settleFreezeClock(c);let mod;if(preset.custom){const label=String(fd.get("customLabel")||"").trim(),add=Number(fd.get("customValue"));if(!label||!(add>0))return showToast("기타 설명과 0보다 큰 배율을 입력해 주세요.");mod={id:`mod-${Date.now()}`,label,add}}else mod={id:`mod-${Date.now()}`,label:preset.label,add:preset.add||0,min:preset.min||0};c.freezeClock.modifiers.push(mod);persistState();renderAdminOperationsPage();showToast(`${c.name}에게 시간 배율을 추가했습니다.`);return}
    const burn=event.target.closest("[data-burning-settings-form]");if(burn){event.preventDefault();state.characters.forEach(c=>settleFreezeClock(c));const fd=new FormData(burn);for(const [name,value] of fd.entries()){if(!name.startsWith("burning:"))continue;const[,floor,roomId]=name.split(":");state.spaceBurning[spaceBurningKey(floor,roomId)]=Math.max(0,Math.min(5,Number(value)))}addLog("운영진이 공간별 진행도를 저장했습니다.");persistState();renderAdminOperationsPage();showToast("공간 진행도를 저장했습니다.");return}
    const eventForm=event.target.closest("[data-emergency-event-form]");if(eventForm){event.preventDefault();const fd=new FormData(eventForm),title=String(fd.get("title")||"").trim(),message=String(fd.get("message")||"").trim();if(!title||!message)return;state.emergencyEvents.unshift({id:`event-${Date.now()}`,title,message,audience:String(fd.get("audience")||"all"),active:true,createdAt:new Date().toISOString()});persistState();renderAdminOperationsPage();renderEventButton();showToast("긴급 이벤트를 등록했습니다.");return}
    const settings=event.target.closest("[data-exposure-settings-form]");if(settings){event.preventDefault();["survivor","spirit"].forEach(role=>settings.querySelectorAll(`[data-exposure-role="${role}"]`).forEach(input=>{state.exposure[role][input.dataset.exposureGroup][input.dataset.exposureKey]=input.checked}));state.exposure.survivor.features.board=false;state.exposure.spirit.features.board=false;state.exposure.survivor.mapInfo.burning=false;state.exposure.spirit.mapInfo.burning=false;persistState();renderAdminOperationsPage();showToast("환경설정을 저장하고 적용했습니다.");return}
    const memo=event.target.closest("[data-admin-memo-form]");if(memo){event.preventDefault();const fd=new FormData(memo),text=String(fd.get("text")||"").trim();if(!text)return;state.adminMemos.unshift({id:`memo-${Date.now()}`,author:String(fd.get("author")||"운영진").trim()||"운영진",text,createdAt:new Date().toISOString()});persistState();renderAdminOperationsPage();showToast("운영진 공유 메모를 저장했습니다.")}
  }


  /* ===== 2026-08-02 실시간 감염 시계 · 토큰 · 필터 오버라이드 ===== */
  const INFECTION_TOTAL_HOURS = 120;
  const INFECTION_CLOCK_SCHEMA = 2;

  function ensureFeatureState(candidate) {
    const next = candidate || createInitialState();
    if (!Array.isArray(next.resourceLibrary)) next.resourceLibrary = [];
    if (!next.spaceBurning || typeof next.spaceBurning !== "object") next.spaceBurning = {};
    if (!Array.isArray(next.emergencyEvents)) next.emergencyEvents = [];
    if (!Array.isArray(next.movementLogs)) next.movementLogs = [];
    if (!Array.isArray(next.adminMemos)) next.adminMemos = [];
    if (!next.exposure) next.exposure = {};

    ["survivor", "spirit"].forEach((role) => {
      const defaults = defaultRoleExposure(role);
      const current = next.exposure[role] || {};
      next.exposure[role] = {
        floors: { ...defaults.floors, ...(current.floors || {}) },
        features: { ...defaults.features, ...(current.features || {}) },
        mapInfo: { ...defaults.mapInfo, ...(current.mapInfo || {}) },
      };
      delete next.exposure[role].features.board;
      delete next.exposure[role].features.tracking;
      next.exposure[role].mapInfo.burning = false;
      next.exposure[role].mapInfo.danger = false;
    });

    const mustInitializeAllClocks = Number(next.infectionClockSchema || 0) < 2;
    next.characters.forEach((character) => {
      if ("online" in character) delete character.online;
      if (!Array.isArray(character.inventory)) character.inventory = [];
      if (!Array.isArray(character.statuses)) character.statuses = [];
      if (!Array.isArray(character.records)) character.records = [];
      if (!Array.isArray(character.investigations)) character.investigations = [];
      if (character.role === "survivor") {
        character.ap = 0;
        character.maxAp = 0;
      }
      if (mustInitializeAllClocks || !character.freezeClock) {
        character.freezeClock = { baseHours: 0, lastUpdated: new Date().toISOString(), modifiers: [] };
      }
      if (!Array.isArray(character.freezeClock.modifiers)) character.freezeClock.modifiers = [];
      if (!character.freezeClock.lastUpdated) character.freezeClock.lastUpdated = new Date().toISOString();
      character.freezeClock.baseHours = Math.max(0, Number(character.freezeClock.baseHours || 0));
    });
    next.infectionClockSchema = 2;
    return next;
  }

  function defaultRoleExposure(role) {
    return {
      floors: Object.fromEntries(FLOOR_ORDER.map((floor) => [floor, role === "survivor" ? ["1F", "2F"].includes(floor) : true])),
      features: { inventory: true, records: true, investigation: true },
      mapInfo: { roomLabels: true, burning: false, danger: true, teamPositions: true, warmth: role === "spirit" },
    };
  }

  function currentSpaceAddition(character, floorOverride = null, roomOverride = null) {
    if (!character) return 0;
    const floor = floorOverride || character.floor;
    const roomId = roomOverride || getRoomId(floor, character.x, character.y);
    return SPACE_TIME_ADDITIONS[getSpaceBurningLevel(floor, roomId)] || 0;
  }

  function clockMultiplier(character, floorOverride = null, roomOverride = null) {
    const clock = character?.freezeClock || { modifiers: [] };
    let multiplier = 1 + currentSpaceAddition(character, floorOverride, roomOverride);
    let minimum = 1;
    for (const modifier of clock.modifiers || []) {
      multiplier += Number(modifier.add || 0);
      minimum = Math.max(minimum, Number(modifier.min || 1));
    }
    return Math.max(multiplier, minimum);
  }

  function settleFreezeClock(character, floorOverride = null, roomOverride = null) {
    if (!character) return;
    if (!character.freezeClock) character.freezeClock = { baseHours: 0, lastUpdated: new Date().toISOString(), modifiers: [] };
    const now = Date.now();
    const last = new Date(character.freezeClock.lastUpdated || now).getTime();
    const realHours = Math.max(0, (now - last) / 36e5);
    character.freezeClock.baseHours = Math.min(INFECTION_TOTAL_HOURS, Number(character.freezeClock.baseHours || 0) + realHours * clockMultiplier(character, floorOverride, roomOverride));
    character.freezeClock.lastUpdated = new Date(now).toISOString();
  }

  function effectiveFreezeHours(character) {
    if (!character) return 0;
    const clock = character.freezeClock || { baseHours: 0, lastUpdated: new Date().toISOString(), modifiers: [] };
    const live = Math.max(0, (Date.now() - new Date(clock.lastUpdated).getTime()) / 36e5) * clockMultiplier(character);
    return Math.min(INFECTION_TOTAL_HOURS, Number(clock.baseHours || 0) + live);
  }

  function infectionRemainingSeconds(character) {
    return Math.max(0, Math.ceil((INFECTION_TOTAL_HOURS - effectiveFreezeHours(character)) * 3600));
  }

  function formatClockSeconds(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(3, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function infectionClockText(character) {
    return formatClockSeconds(infectionRemainingSeconds(character));
  }

  function resetInfectionClock(character) {
    if (!character) return;
    const modifiers = Array.isArray(character.freezeClock?.modifiers) ? character.freezeClock.modifiers : [];
    character.freezeClock = { baseHours: 0, lastUpdated: new Date().toISOString(), modifiers };
  }

  function infectionClockMarkup(character, compact = false) {
    const hours = effectiveFreezeHours(character);
    const stage = freezeStage(hours);
    const multiplier = clockMultiplier(character);
    return `<span class="${compact ? "character-card__clock" : "infection-summary-card__meta"}"><strong data-infection-clock="${character.id}">${infectionClockText(character)}</strong><em data-infection-multiplier="${character.id}">×${multiplier.toFixed(1)}</em><span data-infection-stage="${character.id}">${freezeStageLabel(stage)}</span></span>`;
  }

  function convertExpiredSurvivorsToSpirits() {
    const convertedCharacters = [];
    const convertedAt = new Date().toISOString();

    state.characters.forEach((character) => {
      if (character.role !== "survivor" || infectionRemainingSeconds(character) > 0) return;

      settleFreezeClock(character);
      character.freezeClock.baseHours = INFECTION_TOTAL_HOURS;
      character.freezeClock.lastUpdated = convertedAt;
      character.role = "spirit";
      character.maxAp = Math.max(5, Number(character.maxAp || 0));
      character.ap = Math.min(character.maxAp, Math.max(1, Number(character.ap || 3)));
      character.spiritState = "stable";
      character.spiritSince = convertedAt;
      convertedCharacters.push(character);
      addLog(`${character.name}의 감염 잔여 시간이 종료되어 자동으로 빙혼자로 전환되었습니다.`);
    });

    if (!convertedCharacters.length) return false;

    persistState();
    renderAll();

    const currentPlayerConverted = session?.type === "player"
      && convertedCharacters.some((character) => character.id === session.characterId);
    if (currentPlayerConverted) {
      showToast("감염 시간이 모두 소진되어 빙혼자로 전환되었습니다.");
    } else if (session?.type === "admin") {
      showToast(`${convertedCharacters.map((character) => character.name).join(", ")}이(가) 빙혼자로 자동 전환되었습니다.`);
    }
    return true;
  }

  function refreshLiveInfectionClocks() {
    if (!session) return;
    if (convertExpiredSurvivorsToSpirits()) return;
    document.querySelectorAll("[data-infection-clock]").forEach((node) => {
      const character = getCharacter(Number(node.dataset.infectionClock));
      if (character) node.textContent = infectionClockText(character);
    });
    document.querySelectorAll("[data-infection-multiplier]").forEach((node) => {
      const character = getCharacter(Number(node.dataset.infectionMultiplier));
      if (character) node.textContent = `×${clockMultiplier(character).toFixed(1)}`;
    });
    document.querySelectorAll("[data-infection-stage]").forEach((node) => {
      const character = getCharacter(Number(node.dataset.infectionStage));
      if (character) node.textContent = freezeStageLabel(freezeStage(effectiveFreezeHours(character)));
    });
    document.querySelectorAll("[data-infection-progress]").forEach((node) => {
      const character = getCharacter(Number(node.dataset.infectionProgress));
      if (character) node.style.width = `${Math.min(100, (effectiveFreezeHours(character) / INFECTION_TOTAL_HOURS) * 100)}%`;
    });
  }

  function renderAdminRoster() {
    const filter = ui.adminRosterFilter || "all";
    ui.adminRosterFilter = filter;
    const filteredCharacters = state.characters.filter((character) => filter === "all" || character.role === filter);
    const cards = filteredCharacters.map((character) => {
      const statuses = character.statuses.slice(0, 2).map((statusId) => {
        const status = STATUS_DEFINITIONS[statusId];
        return `<span class="status-icon" title="${escapeHtml(status?.name || statusId)}">${status?.icon || "·"}</span>`;
      }).join("");
      const movementText = character.role === "spirit" ? `행동력 ${character.ap} / ${character.maxAp}` : "운영진 위치 제어";
      return `<button type="button" class="character-card ${character.id === ui.selectedCharacterId ? "is-selected" : ""}" data-select-character="${character.id}" aria-label="${escapeHtml(character.name)} 관리창 열기">
        ${avatarMarkup(character)}
        <span class="character-card__main">
          <span class="character-card__title"><span class="character-card__id">${character.id}</span><strong>${escapeHtml(character.name)}</strong>${roleChipMarkup(character.role)}</span>
          <span class="character-card__meta">${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</span>
          <span class="character-card__submeta">${movementText}</span>
          ${infectionClockMarkup(character, true)}
          <span class="character-card__teams">${teamChipsMarkup(character.id)}</span>
        </span>
        <span class="character-card__statuses">${statuses}<small class="character-card__manage-hint">관리</small></span>
      </button>`;
    }).join("");

    const teamCards = state.teams.length ? state.teams.map((team) => {
      const members = team.memberIds.map(getCharacter).filter(Boolean);
      const visible = team.visible !== false;
      return `<article class="compact-team-card ${visible ? "" : "is-visibility-off"}" style="--team-color:${team.color}">
        <div class="compact-team-card__head"><div><strong>${escapeHtml(team.name)}</strong><span>${members.length}명 · ${visible ? "위치 공유 중" : "공유 숨김"}</span></div><div class="compact-team-card__actions"><button type="button" class="team-eye-button ${visible ? "is-on" : ""}" data-toggle-team-visibility="${team.id}" title="그룹은 유지하고 위치 공유만 ${visible ? "끕니다" : "켭니다"}">${visible ? "◉" : "○"}</button><button type="button" class="compact-icon-button" data-dissolve-team="${team.id}">해제</button></div></div>
        <div class="compact-team-card__members">${members.map((member) => `<button type="button" data-select-character="${member.id}">${escapeHtml(member.name)} <small>${member.id}</small></button>`).join("")}</div>
      </article>`;
    }).join("") : `<div class="compact-empty">편성된 팀이 없습니다.</div>`;

    elements.leftSidebar.innerHTML = `<div class="sidebar-header"><h2>캐릭터 현황</h2><span class="status-pill">${filteredCharacters.length} / ${state.characters.length}명</span></div><div class="sidebar-body">
      <div class="sidebar-roster-filter" aria-label="캐릭터 현황 필터"><button type="button" data-sidebar-roster-filter="all" class="${filter === "all" ? "is-active" : ""}">전체</button><button type="button" data-sidebar-roster-filter="spirit" class="${filter === "spirit" ? "is-active" : ""}">빙혼자</button><button type="button" data-sidebar-roster-filter="survivor" class="${filter === "survivor" ? "is-active" : ""}">생환자</button></div>
      <div class="roster-list">${cards || emptyStateMarkup("해당 분류의 캐릭터가 없습니다.")}</div>
      <section class="left-team-section"><div class="left-team-section__head"><div><p class="eyebrow">TEAM CONTROL</p><h3>팀 편성 · 위치 공유</h3></div><button type="button" class="button button--small button--primary" data-open-team-manager>편성·수정</button></div><div class="compact-team-list">${teamCards}</div></section>
      <div class="side-note"><strong>지도에서 팀 데려오기</strong><p>지도 위치를 클릭한 뒤 이동시킬 팀을 선택하면 해당 팀원 전원이 같은 공간으로 이동합니다. 개인 이동은 캐릭터 관리창에서 지정합니다.</p></div>
    </div>`;
  }

  function renderPlayerProfile() {
    const character = getCharacter(session.characterId);
    const teams = getTeamsForCharacter(character.id);
    const visibleTeams = teams.filter((team) => team.visible !== false);
    const visibleMemberIds = new Set(visibleTeams.flatMap((team) => team.memberIds));
    visibleMemberIds.delete(character.id);
    const visibleMembers = [...visibleMemberIds].map(getCharacter).filter(Boolean);
    const statuses = character.statuses.length ? character.statuses.map((statusId) => {
      const status = STATUS_DEFINITIONS[statusId];
      return `<div class="status-list__item"><strong>${status.icon} ${escapeHtml(status.name)}</strong><p>${escapeHtml(status.description)}</p></div>`;
    }).join("") : emptyStateMarkup("현재 적용된 상태이상이 없습니다.");
    const movementCard = character.role === "spirit" ? `<div class="stat-card"><span>행동력</span><strong>${character.ap} / ${character.maxAp}</strong></div>` : `<div class="stat-card"><span>이동 권한</span><strong>운영진 제어</strong></div>`;
    const apMeter = character.role === "spirit" ? `<div class="ap-meter" style="--ap-percent:${Math.max(0, Math.min(100, (character.ap / Math.max(1, character.maxAp)) * 100))}%"><span></span></div>` : "";
    const teamMarkup = teams.length ? teams.map((team) => {
      const members = team.memberIds.map(getCharacter).filter(Boolean);
      const visible = team.visible !== false;
      return `<article class="team-summary-card ${visible ? "" : "is-visibility-off"}" style="--team-color:${team.color}"><div class="team-summary-card__head"><strong>${escapeHtml(team.name)}</strong><span>${visible ? "위치 공유 중" : "위치 공유 꺼짐"}</span></div><div class="team-member-list">${members.map((member) => `<div class="team-member-row">${avatarMarkup(member, true)}<span><strong>${escapeHtml(member.name)} · ${member.id}</strong><small>${member.floor} · ${escapeHtml(getRoomLabel(member.floor, member.x, member.y))}</small></span></div>`).join("")}</div></article>`;
    }).join("") : emptyStateMarkup("현재 편성된 팀이 없습니다.");
    const sharedMemberMarkup = visibleMembers.length ? visibleMembers.map((member) => `<span class="shared-member-chip">${escapeHtml(member.name)} · ${member.id}</span>`).join("") : `<span class="shared-member-chip is-muted">원격 위치 공유 중인 팀원 없음</span>`;
    elements.leftSidebar.innerHTML = `<div class="sidebar-header"><h2>내 캐릭터</h2>${roleChipMarkup(character.role)}</div><div class="player-profile"><div class="player-profile__identity">${avatarMarkup(character)}<div><h2>${escapeHtml(character.name)}</h2><span class="character-card__id">ID ${character.id}</span></div></div>
      <div class="infection-summary-card"><div class="infection-summary-card__top"><span>감염 잔여 시간</span><strong class="infection-summary-card__time" data-infection-clock="${character.id}">${infectionClockText(character)}</strong></div><div class="infection-summary-card__meta"><span data-infection-stage="${character.id}">${freezeStageLabel(freezeStage(effectiveFreezeHours(character)))}</span><span class="infection-multiplier-chip" data-infection-multiplier="${character.id}">×${clockMultiplier(character).toFixed(1)}</span></div></div>
      <div class="stat-grid"><div class="stat-card"><span>현재 위치</span><strong>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</strong></div>${movementCard}</div>${apMeter}
      <section><p class="eyebrow">MY GROUPS</p><div class="team-summary-list">${teamMarkup}</div><div class="shared-member-list">${sharedMemberMarkup}</div></section>
      <section><p class="eyebrow">STATUS EFFECTS</p><div class="status-list">${statuses}</div></section>
      <div class="side-note"><strong>${character.role === "spirit" ? "빙혼자 이동" : "생환자 위치"}</strong><p>${character.role === "spirit" ? "다른 공간으로 이동할 때 행동력 1이 차감됩니다. 이동 전 소모 행동력을 확인하는 창이 표시됩니다." : "자신의 위치는 직접 바꿀 수 없으며 운영진이 이동시킵니다."} 빙혼자는 같은 공간의 생환자 신원 대신 온기와 인원수만 감지합니다.</p></div>
    </div>`;
  }

  function tokenMarkup(character, selected) {
    const colors = AVATAR_COLORS[character.id] || ["#53677a", "#263747"];
    const status = character.statuses[0] ? STATUS_DEFINITIONS[character.statuses[0]] : null;
    const team = getTeamForCharacter(character.id);
    return `<span class="character-token character-token--${character.role} ${selected ? "is-selected" : ""}" data-token-character="${character.id}" style="--avatar-a:${colors[0]};--avatar-b:${colors[1]};--role-color:${getRoleColor(character.role)};--team-color:${team?.color || getRoleColor(character.role)}" title="${escapeHtml(character.name)} · ${character.id} · ${ROLE_LABELS[character.role]}${team ? ` · ${escapeHtml(team.name)}` : ""}"><span class="character-token__name">${escapeHtml(character.name)}</span>${status ? `<i class="character-token__status">${status.icon}</i>` : ""}</span>`;
  }

  function renderSelectedSummary() {
    const selected = getMovementActor();
    const visibleTeams = getVisibleTeamsForCharacter(selected.id);
    const allTeams = getTeamsForCharacter(selected.id);
    const movement = selected.role === "spirit" ? `행동력 ${selected.ap} / ${selected.maxAp}` : "위치 이동은 운영진만 가능";
    const teamText = allTeams.length ? ` · 그룹 ${allTeams.map((team) => `${team.name}${team.visible === false ? "(숨김)" : ""}`).join(", ")}` : " · 미편성";
    elements.selectedCharacterSummary.innerHTML = `${avatarMarkup(selected)}<div><h3>${escapeHtml(selected.name)} · ID ${selected.id} ${roleChipMarkup(selected.role)}</h3><p>${escapeHtml(selected.floor)} ${escapeHtml(getRoomLabel(selected.floor, selected.x, selected.y))} · ${movement}${teamText}${visibleTeams.length ? "" : allTeams.length ? " · 원격 공유 없음" : ""}</p>${infectionClockMarkup(selected, true)}</div>`;
  }

  function showCharacterManagementModal(characterId = ui.selectedCharacterId) {
    const selected = getCharacter(characterId);
    if (!selected) return;
    ui.selectedCharacterId = selected.id;
    const statusOptions = Object.entries(STATUS_DEFINITIONS).map(([id, status]) => `<option value="${id}">${escapeHtml(status.name)}</option>`).join("");
    const statusList = selected.statuses.length ? selected.statuses.map((statusId) => { const status = STATUS_DEFINITIONS[statusId]; return `<div class="status-list__item"><strong>${status.icon} ${escapeHtml(status.name)}</strong><button type="button" class="button button--small" data-remove-status="${statusId}">해제</button></div>`; }).join("") : emptyStateMarkup("상태이상 없음");
    const apControls = selected.role === "spirit" ? `<div class="modal-control-card"><div class="modal-control-card__title"><strong>행동력</strong><span>${selected.ap} / ${selected.maxAp}</span></div><p>다른 공간으로 이동할 때마다 행동력 1이 차감됩니다.</p><div class="control-row"><button type="button" class="button button--small" data-admin-action="ap-minus">−1</button><button type="button" class="button button--small" data-admin-action="ap-plus-1">+1</button><button type="button" class="button button--small" data-admin-action="ap-plus-3">+3</button><button type="button" class="button button--small" data-admin-action="ap-max">최대</button></div></div>` : `<div class="modal-control-card"><div class="modal-control-card__title"><strong>이동 권한</strong><span>생환자</span></div><p>플레이어 직접 이동은 잠겨 있으며 운영진만 위치를 변경할 수 있습니다.</p><div class="status-pill status-pill--online">행동력 미적용</div></div>`;
    openModal({ eyebrow: "CHARACTER CONTROL", title: `${selected.name} · ID ${selected.id}`, body: `<div class="admin-character-overview">${avatarMarkup(selected)}<div><div class="admin-character-overview__title">${roleChipMarkup(selected.role)} <span class="character-card__teams">${teamChipsMarkup(selected.id)}</span></div><strong>${escapeHtml(selected.floor)} · ${escapeHtml(getRoomLabel(selected.floor, selected.x, selected.y))}</strong><span>좌표 X${selected.x + 1}, Y${selected.y + 1}</span></div></div>
      <div class="admin-modal-grid">${apControls}
        <div class="modal-control-card"><div class="modal-control-card__title"><strong>감염 진행 시간</strong><span data-infection-stage="${selected.id}">${freezeStageLabel(freezeStage(effectiveFreezeHours(selected)))}</span></div><div class="infection-summary-card__time" data-infection-clock="${selected.id}">${infectionClockText(selected)}</div><div class="infection-summary-card__meta"><span>현재 배속</span><strong data-infection-multiplier="${selected.id}">×${clockMultiplier(selected).toFixed(1)}</strong></div><button type="button" class="button button--danger button--small" data-reset-infection-clock="${selected.id}">120:00:00으로 초기화</button></div>
        <div class="modal-control-card"><div class="modal-control-card__title"><strong>개별 위치 이동</strong><span>선택 캐릭터만</span></div><p>버튼을 누른 뒤 지도에서 이동시킬 위치를 선택합니다.</p><div class="control-row"><button type="button" class="button ${ui.adminTool === "forceMove" ? "button--primary" : ""}" data-admin-action="toggle-force-move">선택 캐릭터 이동</button></div></div>
        <div class="modal-control-card modal-control-card--wide"><div class="modal-control-card__title"><strong>역할 및 상태</strong><span>토큰에 즉시 반영</span></div><div class="modal-form-grid"><label class="control-label">분류<select class="form-control" data-role-select><option value="survivor" ${selected.role === "survivor" ? "selected" : ""}>생환자</option><option value="spirit" ${selected.role === "spirit" ? "selected" : ""}>빙혼자</option></select></label>${selected.role === "spirit" ? `<label class="control-label">빙혼 상태<select class="form-control" data-spirit-state-select><option value="stable" ${selected.spiritState === "stable" ? "selected" : ""}>안정</option><option value="unstable" ${selected.spiritState === "unstable" ? "selected" : ""}>불안정</option><option value="freezing" ${selected.spiritState === "freezing" ? "selected" : ""}>동결 진행</option><option value="dormant" ${selected.spiritState === "dormant" ? "selected" : ""}>휴면</option></select><small>현재 상태 시작: ${formatDateTime(selected.spiritSince)} · ${formatElapsed(selected.spiritSince)}</small></label>` : ""}<label class="control-label">상태이상 추가<span class="control-row"><select class="form-control" data-status-select><option value="">상태 선택</option>${statusOptions}</select><button type="button" class="button" data-admin-action="apply-status">적용</button></span></label></div><div class="status-list">${statusList}</div></div>
      </div>`, footer: `<button type="button" class="button" data-modal-close>닫기</button>` });
  }

  function renderAdminOperationsPage() {
    if (session?.type !== "admin") return;
    const tabs = { overview: "캐릭터 현황", inventory: "자료 보관함", freeze: "감염 시간", burning: "공간 진행도", movements: "빙혼 이동 기록", memos: "운영 메모", events: "긴급 이벤트", settings: "환경설정" };
    if (!tabs[ui.operationsTab]) ui.operationsTab = "overview";
    const tabButtons = Object.entries(tabs).map(([id, label]) => `<button type="button" class="operations-tab ${ui.operationsTab === id ? "is-active" : ""}" data-operations-tab="${id}">${label}</button>`).join("");
    elements.adminOperationsContent.innerHTML = `<div class="operations-page__header"><div><p class="eyebrow">OPERATIONS CENTER</p><h1>운영진 통합 운영페이지</h1><p>인원·자료·모든 캐릭터 감염 시간·공간 진행·빙혼 이동 기록·긴급 이벤트를 관리합니다.</p></div><button type="button" class="button" data-close-operations>지도 화면으로 돌아가기</button></div><nav class="operations-tabs">${tabButtons}</nav><div class="operations-content">${operationsTabContent(ui.operationsTab)}</div><div class="operations-toast is-hidden" role="status"></div>`;
  }

  function combinedRosterMarkup(characters) {
    const rows = characters.map((character) => {
      const items = character.inventory.length ? character.inventory.slice(0, 3).map((item) => `<button type="button" class="compact-item-link" data-evidence-id="${escapeHtml(item.uid)}">${escapeHtml(item.title)}</button>`).join("") : `<span class="muted-text">없음</span>`;
      const hours = effectiveFreezeHours(character);
      return `<tr><td><button type="button" class="operations-character-link" data-operations-character="${character.id}">${character.id} · ${escapeHtml(character.name)}</button></td><td>${roleChipMarkup(character.role)}</td><td>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</td><td><div class="compact-item-list">${items}</div></td><td><div class="spirit-state-cell"><strong data-infection-clock="${character.id}">${infectionClockText(character)}</strong><small><span data-infection-stage="${character.id}">${freezeStageLabel(freezeStage(hours))}</span> · <span data-infection-multiplier="${character.id}">×${clockMultiplier(character).toFixed(1)}</span></small></div></td><td>${character.statuses.length ? character.statuses.map((id) => `<span class="status-icon">${STATUS_DEFINITIONS[id]?.icon || "·"}</span>`).join("") : "정상"}</td></tr>`;
    }).join("");
    return `<section class="operations-card operations-card--roster"><header><div><p class="eyebrow">CHARACTER STATUS</p><h2>캐릭터 현황</h2></div><span>${characters.length}명</span></header><div class="operations-table-wrap"><table class="operations-table"><thead><tr><th>ID · 이름</th><th>분류</th><th>현재 위치</th><th>소지품</th><th>감염 잔여 · 배속</th><th>상태이상</th></tr></thead><tbody>${rows || `<tr><td colspan="6">해당 인원이 없습니다.</td></tr>`}</tbody></table></div></section>`;
  }

  function freezeOperationsMarkup() {
    const cards = state.characters.map((character) => {
      const hours = effectiveFreezeHours(character);
      const stage = freezeStage(hours);
      const next = nextFreezeThreshold(stage);
      const percentage = Math.min(100, (hours / INFECTION_TOTAL_HOURS) * 100);
      const modifiers = (character.freezeClock?.modifiers || []).map((modifier) => `<span class="freeze-modifier">${escapeHtml(modifier.label)} · ${modifier.min ? `최소 ${Number(modifier.min).toFixed(1)}배` : `+${Number(modifier.add).toFixed(1)}`}<button type="button" data-remove-time-modifier="${character.id}" data-modifier-id="${modifier.id}" aria-label="제거">×</button></span>`).join("");
      const options = EXPOSURE_PRESETS.map((preset) => `<option value="${preset.id}">${escapeHtml(preset.label)}${preset.add ? ` (+${preset.add})` : preset.min ? ` (최소 ${preset.min}배)` : ""}</option>`).join("");
      return `<article class="freeze-card"><div class="freeze-card__head"><div><h3>${character.id} · ${escapeHtml(character.name)}</h3><small>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</small></div><div class="freeze-card__actions">${roleChipMarkup(character.role)}<button type="button" class="button button--small button--danger" data-reset-infection-clock="${character.id}">시간 초기화</button></div></div>
        <div class="freeze-card__metrics"><div><span>감염 잔여 시간</span><strong data-infection-clock="${character.id}">${infectionClockText(character)}</strong></div><div><span>현재 단계</span><strong data-infection-stage="${character.id}">${freezeStageLabel(stage)}</strong></div><div><span>현재 시간 배율</span><strong data-infection-multiplier="${character.id}">×${clockMultiplier(character).toFixed(1)}</strong></div></div>
        <div class="freeze-progress"><i data-infection-progress="${character.id}" style="width:${percentage}%"></i></div>
        <p class="space-multiplier-note">진행 경과: ${hours.toFixed(3)}시간 / 120시간<br>${stage >= 5 ? "최종 단계 도달" : `다음 단계 전환까지 감염 진행량 ${Math.max(0, next - hours).toFixed(2)}시간`}<br>현재 공간 진행도 ${getSpaceBurningLevel(character.floor, getRoomId(character.floor, character.x, character.y))}단계 → +${currentSpaceAddition(character).toFixed(1)}배속</p>
        <div class="freeze-modifiers">${modifiers || `<span class="muted-text">추가 노출 배율 없음</span>`}</div>
        <form class="freeze-form" data-time-modifier-form><input type="hidden" name="characterId" value="${character.id}"><label>노출 선택<select class="form-control" name="preset">${options}</select></label><label>기타 배율<input class="form-control" name="customValue" type="number" step="0.1" min="0" placeholder="+0.4"></label><button class="button button--primary" type="submit">배속 추가</button><label class="custom-label">기타 설명<input class="form-control" name="customLabel" maxlength="60" placeholder="기타 선택 시 노출 내용을 입력"></label></form>
      </article>`;
    }).join("");
    return `<section class="operations-card"><header><div><p class="eyebrow">INFECTION TIMELINE</p><h2>모든 캐릭터 감염 진행 시간</h2></div><button type="button" class="button button--danger button--small" data-reset-all-infection-clocks>전체 120:00:00 초기화</button></header><p class="form-help">모든 캐릭터는 120:00:00에서 시작해 실시간으로 감소합니다. 배속과 공간 진행도는 중첩되어 실제 진행 속도에 적용됩니다.</p><table class="freeze-stage-table"><thead><tr><th>단계</th><th>감염 경과 기준</th></tr></thead><tbody><tr><td>1단계</td><td>18시간</td></tr><tr><td>2단계</td><td>42시간</td></tr><tr><td>3단계</td><td>66시간</td></tr><tr><td>4단계</td><td>90시간</td></tr><tr><td>5단계</td><td>120시간</td></tr></tbody></table></section><div class="freeze-grid">${cards}</div>`;
  }

  function roleSettingsMarkup(role) {
    const exposure = getRoleExposure(role);
    const floors = FLOOR_ORDER.map((floor) => settingToggleMarkup(role, "floors", floor, floor, exposure.floors[floor])).join("");
    const featureKeys = [["inventory", "소지품"], ["records", "조사 기록"], ["investigation", "현재 위치 조사"]];
    const infoKeys = [["roomLabels", "공간명"], ["danger", "위험구역"], ["teamPositions", "그룹 위치 공유"], ["warmth", "온기 감지"]];
    return `<section class="operations-card role-settings-card role-settings-card--${role}"><header><div><p class="eyebrow">${role.toUpperCase()} EXPOSURE</p><h2>${ROLE_LABELS[role]} 화면 설정</h2></div>${roleChipMarkup(role)}</header><div class="settings-section"><h3>노출 층</h3><div class="settings-toggle-grid settings-toggle-grid--floors">${floors}</div></div><div class="settings-section"><h3>노출 기능</h3><div class="settings-toggle-grid">${featureKeys.map(([key, label]) => settingToggleMarkup(role, "features", key, label, exposure.features[key])).join("")}</div></div><div class="settings-section"><h3>지도 정보</h3><div class="settings-toggle-grid">${infoKeys.map(([key, label]) => settingToggleMarkup(role, "mapInfo", key, label, exposure.mapInfo[key])).join("")}</div></div></section>`;
  }

  function renderPlayerJournal() {
    const character = getCharacter(session.characterId);
    const exposure = getRoleExposure(character.role);
    const available = [["inventory", "소지품"], ["records", "조사"]].filter(([id]) => exposure.features[id]);
    if (!available.some(([id]) => id === ui.rightPanelTab)) ui.rightPanelTab = available[0]?.[0] || null;
    elements.rightSidebar.innerHTML = `<div class="sidebar-header"><h2>조사 기록</h2></div><div class="sidebar-body">${available.length ? `<div class="panel-tabs">${available.map(([id, label]) => `<button type="button" class="panel-tab ${ui.rightPanelTab === id ? "is-active" : ""}" data-panel-tab="${id}">${label}</button>`).join("")}</div><div class="panel-content">${playerJournalContent(character, ui.rightPanelTab)}</div>` : emptyStateMarkup("현재 공개된 기록 기능이 없습니다.")}</div>`;
  }

  function appendMapMarkersWithExposure(cellElement, floor, x, y, perspective, exposure) {
    if (state.layers.danger && (!exposure || exposure.mapInfo.danger) && isDangerCell(floor.id, x, y) && perspective.mode === "admin") {
      cellElement.insertAdjacentHTML("beforeend", `<span class="map-cell__marker" title="운영진 지정 위험구역">!</span>`);
    }
  }

  function moveCharacterSetTo(memberIds, floor, x, y) {
    const targetRoomId = getRoomId(floor, x, y);
    const roomCells = [];
    for (let row = 0; row < GRID_ROWS; row += 1) for (let column = 0; column < GRID_COLUMNS; column += 1) if (getRoomId(floor, column, row) === targetRoomId) roomCells.push({ x: column, y: row });
    roomCells.sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - (Math.abs(b.x - x) + Math.abs(b.y - y)));
    [...new Set(memberIds)].map(getCharacter).filter(Boolean).forEach((member, index) => {
      const previous = { floor: member.floor, room: getRoomLabel(member.floor, member.x, member.y) };
      settleFreezeClock(member, previous.floor, getRoomIdByLabel(previous.floor, previous.room));
      const position = roomCells[index % Math.max(1, roomCells.length)] || { x, y };
      member.floor = floor;
      member.x = position.x;
      member.y = position.y;
      if (member.role === "spirit") recordSpiritMovement(member, { fromFloor: previous.floor, fromRoom: previous.room, toFloor: member.floor, toRoom: getRoomLabel(member.floor, member.x, member.y), cost: 0, source: "운영진 팀 이동" });
    });
  }


  /* ===== 2026-08-02 운영 규칙 보정 · 매체 저장소 · 감염 관리 V3 ===== */
  const INFECTION_CLOCK_SCHEMA_V3 = 3;
  const THUMBNAIL_MAX_BYTES_V3 = 5 * 1024 * 1024;
  const ORIGINAL_MAX_BYTES_V3 = 100 * 1024 * 1024;
  const MEDIA_DB_NAME_V3 = "shu-investigation-media-v3";
  const MEDIA_STORE_NAME_V3 = "files";
  const mediaObjectUrlCacheV3 = new Map();
  const NON_RED_TEAM_PALETTE_V3 = ["#245f9b", "#31766f", "#5a55a5", "#386987", "#7060a6", "#237d8a"];

  function certaintyLabel(certainty) {
    return certainty === "confirmed" ? "확인" : "미확인";
  }

  function normalizeCertaintyV3(certainty, delivered = false) {
    if (delivered) return "confirmed";
    return certainty === "confirmed" ? "confirmed" : "unknown";
  }

  function defaultRoleExposure(role) {
    return {
      floors: Object.fromEntries(FLOOR_ORDER.map((floor) => [floor, role === "survivor" ? ["1F", "2F"].includes(floor) : true])),
      features: { inventory: true, records: true, investigation: true },
      mapInfo: { roomLabels: true, burning: false, danger: false, teamPositions: true, warmth: role === "spirit" },
    };
  }

  function ensureFeatureState(candidate) {
    const next = candidate || createInitialState();
    if (!Array.isArray(next.resourceLibrary)) next.resourceLibrary = [];
    if (!next.spaceBurning || typeof next.spaceBurning !== "object") next.spaceBurning = {};
    if (!Array.isArray(next.emergencyEvents)) next.emergencyEvents = [];
    if (!Array.isArray(next.movementLogs)) next.movementLogs = [];
    if (!Array.isArray(next.adminMemos)) next.adminMemos = [];
    if (!next.exposure) next.exposure = {};

    ["survivor", "spirit"].forEach((role) => {
      const defaults = defaultRoleExposure(role);
      const current = next.exposure[role] || {};
      next.exposure[role] = {
        floors: { ...defaults.floors, ...(current.floors || {}) },
        features: { ...defaults.features, ...(current.features || {}) },
        mapInfo: { ...defaults.mapInfo, ...(current.mapInfo || {}) },
      };
      delete next.exposure[role].features.board;
      delete next.exposure[role].features.tracking;
      next.exposure[role].mapInfo.burning = false;
      next.exposure[role].mapInfo.danger = false;
    });

    next.resourceLibrary.forEach((item) => {
      item.certainty = normalizeCertaintyV3(item.certainty);
      if (!item.thumbnailName && item.fileName) item.thumbnailName = item.fileName;
    });

    next.characters.forEach((character) => {
      if ("online" in character) delete character.online;
      if (!Array.isArray(character.inventory)) character.inventory = [];
      if (!Array.isArray(character.statuses)) character.statuses = [];
      if (!Array.isArray(character.records)) character.records = [];
      if (!Array.isArray(character.investigations)) character.investigations = [];
      character.inventory.forEach((item) => {
        item.certainty = "confirmed";
        if (!item.thumbnailName && item.fileName) item.thumbnailName = item.fileName;
      });

      if (character.role === "survivor") {
        character.ap = 0;
        character.maxAp = 0;
        if (!character.freezeClock) {
          character.freezeClock = { baseHours: 0, lastUpdated: new Date().toISOString(), modifiers: [] };
        }
        if (!Array.isArray(character.freezeClock.modifiers)) character.freezeClock.modifiers = [];
        if (!character.freezeClock.lastUpdated) character.freezeClock.lastUpdated = new Date().toISOString();
        character.freezeClock.baseHours = Math.max(0, Math.min(120, Number(character.freezeClock.baseHours || 0)));
      } else {
        character.freezeClock = { baseHours: 120, lastUpdated: new Date().toISOString(), modifiers: [] };
        character.spiritState = character.spiritState || "stable";
        character.spiritSince = character.spiritSince || new Date().toISOString();
      }
    });
    next.infectionClockSchema = 3;
    return next;
  }

  function clockMultiplier(character, floorOverride = null, roomOverride = null) {
    if (!character || character.role === "spirit") return 1;
    const clock = character.freezeClock || { modifiers: [] };
    let multiplier = 1 + currentSpaceAddition(character, floorOverride, roomOverride);
    let minimum = 1;
    for (const modifier of clock.modifiers || []) {
      multiplier += Number(modifier.add || 0);
      minimum = Math.max(minimum, Number(modifier.min || 1));
    }
    return Math.max(multiplier, minimum);
  }

  function settleFreezeClock(character, floorOverride = null, roomOverride = null) {
    if (!character || character.role === "spirit") return;
    if (!character.freezeClock) character.freezeClock = { baseHours: 0, lastUpdated: new Date().toISOString(), modifiers: [] };
    const now = Date.now();
    const last = new Date(character.freezeClock.lastUpdated || now).getTime();
    const realHours = Math.max(0, (now - last) / 36e5);
    character.freezeClock.baseHours = Math.min(INFECTION_TOTAL_HOURS, Number(character.freezeClock.baseHours || 0) + realHours * clockMultiplier(character, floorOverride, roomOverride));
    character.freezeClock.lastUpdated = new Date(now).toISOString();
  }

  function effectiveFreezeHours(character) {
    if (!character) return 0;
    if (character.role === "spirit") return INFECTION_TOTAL_HOURS;
    const clock = character.freezeClock || { baseHours: 0, lastUpdated: new Date().toISOString(), modifiers: [] };
    const live = Math.max(0, (Date.now() - new Date(clock.lastUpdated).getTime()) / 36e5) * clockMultiplier(character);
    return Math.min(INFECTION_TOTAL_HOURS, Number(clock.baseHours || 0) + live);
  }

  function infectionRemainingSeconds(character) {
    if (!character || character.role === "spirit") return 0;
    return Math.max(0, Math.ceil((INFECTION_TOTAL_HOURS - effectiveFreezeHours(character)) * 3600));
  }

  function infectionClockText(character) {
    return character?.role === "spirit" ? "빙혼 완료" : formatClockSeconds(infectionRemainingSeconds(character));
  }

  function resetInfectionClock(character) {
    if (!character || character.role === "spirit") return;
    character.freezeClock = { baseHours: 0, lastUpdated: new Date().toISOString(), modifiers: [] };
  }

  function infectionClockMarkup(character, compact = false) {
    if (!character) return "";
    if (character.role === "spirit") {
      return `<span class="${compact ? "character-card__clock" : "infection-summary-card__meta"} infection-complete"><strong>5단계 · 빙혼 완료</strong></span>`;
    }
    const stage = freezeStage(effectiveFreezeHours(character));
    const multiplierMarkup = session?.type === "admin" ? `<em data-infection-multiplier="${character.id}">×${clockMultiplier(character).toFixed(1)}</em>` : "";
    return `<span class="${compact ? "character-card__clock" : "infection-summary-card__meta"}"><strong data-infection-clock="${character.id}">${infectionClockText(character)}</strong>${multiplierMarkup}<span data-infection-stage="${character.id}">${freezeStageLabel(stage)}</span></span>`;
  }

  function convertExpiredSurvivorsToSpirits() {
    const convertedCharacters = [];
    const convertedAt = new Date().toISOString();
    state.characters.forEach((character) => {
      if (character.role !== "survivor" || infectionRemainingSeconds(character) > 0) return;
      settleFreezeClock(character);
      character.role = "spirit";
      character.freezeClock = { baseHours: INFECTION_TOTAL_HOURS, lastUpdated: convertedAt, modifiers: [] };
      character.maxAp = Math.max(5, Number(character.maxAp || 0));
      character.ap = Math.min(character.maxAp, Math.max(1, Number(character.ap || 3)));
      character.spiritState = "stable";
      character.spiritSince = convertedAt;
      convertedCharacters.push(character);
      addLog(`${character.name}의 감염 잔여 시간이 종료되어 자동으로 빙혼자로 전환되었습니다.`);
    });
    if (!convertedCharacters.length) return false;
    persistState();
    renderAll();
    if (session?.type === "player" && convertedCharacters.some((character) => character.id === session.characterId)) {
      showToast("감염 시간이 모두 소진되어 빙혼자로 전환되었습니다.");
    } else if (session?.type === "admin") {
      showToast(`${convertedCharacters.map((character) => character.name).join(", ")}이(가) 빙혼자로 자동 전환되었습니다.`);
    }
    return true;
  }

  function refreshLiveInfectionClocks() {
    if (!session) return;
    if (convertExpiredSurvivorsToSpirits()) return;
    document.querySelectorAll("[data-infection-clock]").forEach((node) => {
      const character = getCharacter(Number(node.dataset.infectionClock));
      if (character?.role === "survivor") node.textContent = infectionClockText(character);
    });
    if (session.type === "admin") {
      document.querySelectorAll("[data-infection-multiplier]").forEach((node) => {
        const character = getCharacter(Number(node.dataset.infectionMultiplier));
        if (character?.role === "survivor") node.textContent = `×${clockMultiplier(character).toFixed(1)}`;
      });
    }
    document.querySelectorAll("[data-infection-stage]").forEach((node) => {
      const character = getCharacter(Number(node.dataset.infectionStage));
      if (character) node.textContent = character.role === "spirit" ? "5단계" : freezeStageLabel(freezeStage(effectiveFreezeHours(character)));
    });
    document.querySelectorAll("[data-infection-progress]").forEach((node) => {
      const character = getCharacter(Number(node.dataset.infectionProgress));
      if (character?.role === "survivor") node.style.width = `${Math.min(100, (effectiveFreezeHours(character) / INFECTION_TOTAL_HOURS) * 100)}%`;
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
    const index = Math.abs(String(team.id || character.id).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % NON_RED_TEAM_PALETTE_V3.length;
    return NON_RED_TEAM_PALETTE_V3[index];
  }

  function tokenMarkup(character, selected) {
    const status = character.statuses[0] ? STATUS_DEFINITIONS[character.statuses[0]] : null;
    const team = getTeamForCharacter(character.id);
    const tokenColor = character.role === "spirit" ? "#a3263b" : survivorTokenColorV3(character, team);
    const tokenDark = character.role === "spirit" ? "#58121f" : "#0b2238";
    const teamTitle = team ? ` · ${escapeHtml(team.name)}` : "";
    return `<span class="character-token character-token--${character.role} ${team && character.role === "survivor" ? "is-team-colored" : ""} ${selected ? "is-selected" : ""}" data-token-character="${character.id}" style="--token-color:${tokenColor};--token-dark:${tokenDark}" title="${escapeHtml(character.name)} · ${character.id} · ${ROLE_LABELS[character.role]}${teamTitle}"><span class="character-token__name">${escapeHtml(character.name)}</span>${status ? `<i class="character-token__status">${status.icon}</i>` : ""}</span>`;
  }

  function renderMap() {
    const floor = FLOOR_DEFINITIONS[ui.currentFloor];
    const perspective = getPerspective();
    const movementActor = getMovementActor();
    const reachable = getReachableCellCosts(movementActor, floor.id);
    const exposure = session.type === "player" ? getRoleExposure(movementActor.role) : null;
    const warmthAllowed = !exposure || exposure.mapInfo.warmth;
    const warmth = warmthAllowed ? getWarmthInfo(perspective.mode, perspective.character, floor.id) : { active: false, count: 0, roomId: null };
    const focus = perspective.mode === "admin" ? movementActor : perspective.character;
    const activeRoomId = focus && focus.floor === floor.id ? getRoomId(focus.floor, focus.x, focus.y) : null;

    elements.mapGrid.style.setProperty("--columns", GRID_COLUMNS);
    elements.mapGrid.style.setProperty("--rows", GRID_ROWS);
    elements.mapGrid.classList.toggle("is-player-locked", session.type === "player" && movementActor.role === "survivor");
    elements.mapGrid.innerHTML = "";

    floor.rooms.forEach((room) => {
      const roomElement = document.createElement("div");
      roomElement.className = "map-room";
      roomElement.dataset.roomId = room.id;
      roomElement.style.gridColumn = `${room.x1 + 1} / ${room.x2 + 2}`;
      roomElement.style.gridRow = `${room.y1 + 1} / ${room.y2 + 2}`;
      roomElement.style.setProperty("--room-color", room.color);
      const level = getSpaceBurningLevel(floor.id, room.id);
      roomElement.dataset.burningLevel = String(level);
      if (room.id === activeRoomId) roomElement.classList.add("is-active-room");
      if (warmth.active && room.id === warmth.roomId) roomElement.classList.add("is-warm");
      const restrictedForPlayers = session.type === "player" && ["service_tunnel", "life_link"].includes(room.id);
      const showLabel = !restrictedForPlayers && (!exposure || exposure.mapInfo.roomLabels || room.id === activeRoomId);
      roomElement.innerHTML = showLabel ? `<span>${escapeHtml(room.label)}</span>` : "";
      if (perspective.mode === "admin" && level > 0) {
        roomElement.insertAdjacentHTML("beforeend", `<small class="map-room__burning">진행 ${level} · +${SPACE_TIME_ADDITIONS[level].toFixed(1)}배속</small>`);
      }
      elements.mapGrid.appendChild(roomElement);
    });

    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLUMNS; x += 1) {
        const cell = floor.cells[cellKey(x, y)];
        const key = cellKey(x, y);
        const cellElement = document.createElement("button");
        cellElement.type = "button";
        cellElement.className = "map-cell is-visible";
        cellElement.dataset.x = String(x);
        cellElement.dataset.y = String(y);
        cellElement.dataset.roomId = cell.roomId;
        cellElement.style.gridColumn = String(x + 1);
        cellElement.style.gridRow = String(y + 1);
        const restrictedCellForPlayers = session.type === "player" && ["service_tunnel", "life_link"].includes(cell.roomId);
        cellElement.title = restrictedCellForPlayers ? `비공개 구역 · X${x + 1}, Y${y + 1}` : `${cell.roomLabel} · X${x + 1}, Y${y + 1}`;
        if (reachable.has(key) && movementActor.floor === floor.id && movementActor.role === "spirit") cellElement.classList.add("is-reachable");
        if (movementActor.floor === floor.id && movementActor.x === x && movementActor.y === y) cellElement.classList.add("is-current");
        if (perspective.mode === "admin" && state.layers.danger && isDangerCell(floor.id, x, y)) cellElement.classList.add("is-danger");
        if (getTransitionAt(floor.id, x, y)) cellElement.classList.add("is-transition");
        const details = perspective.mode === "admin" || cell.roomId === activeRoomId;
        if (details) appendMapMarkersWithExposure(cellElement, floor, x, y, perspective, exposure);
        const canShow = !exposure || exposure.mapInfo.teamPositions;
        let characters = getVisibleCharactersAtCell(floor.id, x, y, perspective, true).filter((character) => character.id === movementActor.id || canShow || getRoomId(character.floor, character.x, character.y) === activeRoomId);
        if (perspective.mode === "spirit") characters = characters.filter((character) => character.role === "spirit");
        if (perspective.mode === "survivor") characters = characters.filter((character) => character.role === "survivor");
        characters.forEach((character) => cellElement.insertAdjacentHTML("beforeend", tokenMarkup(character, character.id === movementActor.id)));
        elements.mapGrid.appendChild(cellElement);
      }
    }
    renderWarmthBanner(warmth, perspective);
    updateMovementRule(movementActor);
  }

  function roleSettingsMarkup(role) {
    const exposure = getRoleExposure(role);
    const floors = FLOOR_ORDER.map((floor) => settingToggleMarkup(role, "floors", floor, floor, exposure.floors[floor])).join("");
    const featureKeys = [["inventory", "소지품"], ["records", "조사 기록"], ["investigation", "현재 위치 조사"]];
    const infoKeys = [["roomLabels", "공간명"], ["teamPositions", "그룹 위치 공유"], ["warmth", "온기 감지"]];
    return `<section class="operations-card role-settings-card role-settings-card--${role}"><header><div><p class="eyebrow">${role.toUpperCase()} EXPOSURE</p><h2>${ROLE_LABELS[role]} 화면 설정</h2></div>${roleChipMarkup(role)}</header><div class="settings-section"><h3>노출 층</h3><div class="settings-toggle-grid settings-toggle-grid--floors">${floors}</div></div><div class="settings-section"><h3>노출 기능</h3><div class="settings-toggle-grid">${featureKeys.map(([key, label]) => settingToggleMarkup(role, "features", key, label, exposure.features[key])).join("")}</div></div><div class="settings-section"><h3>지도 정보</h3><div class="settings-toggle-grid">${infoKeys.map(([key, label]) => settingToggleMarkup(role, "mapInfo", key, label, exposure.mapInfo[key])).join("")}</div></div><p class="form-help">위험구역과 공간 시간 배율은 플레이어에게 공개되지 않으며 관리자 지도에서만 표시됩니다.</p></section>`;
  }

  function renderAdminRoster() {
    const filter = ui.adminRosterFilter || "all";
    ui.adminRosterFilter = filter;
    const filteredCharacters = state.characters.filter((character) => filter === "all" || character.role === filter);
    const cards = filteredCharacters.map((character) => {
      const statuses = character.statuses.slice(0, 2).map((statusId) => {
        const status = STATUS_DEFINITIONS[statusId];
        return `<span class="status-icon" title="${escapeHtml(status?.name || statusId)}">${status?.icon || "·"}</span>`;
      }).join("");
      const movementText = character.role === "spirit" ? `행동력 ${character.ap} / ${character.maxAp}` : "운영진 위치 제어";
      return `<article class="character-card ${character.id === ui.selectedCharacterId ? "is-selected" : ""}" data-select-character="${character.id}" tabindex="0" aria-label="${escapeHtml(character.name)} 선택">
        ${avatarMarkup(character)}
        <span class="character-card__main">
          <span class="character-card__title"><span class="character-card__id">${character.id}</span><strong>${escapeHtml(character.name)}</strong>${roleChipMarkup(character.role)}</span>
          <span class="character-card__meta">${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</span>
          <span class="character-card__submeta">${movementText}</span>
          ${infectionClockMarkup(character, true)}
          <span class="character-card__teams">${teamChipsMarkup(character.id)}</span>
        </span>
        <span class="character-card__statuses">${statuses}<button type="button" class="character-card__manage-button" data-manage-character="${character.id}">관리</button></span>
      </article>`;
    }).join("");

    const teamCards = state.teams.length ? state.teams.map((team) => {
      const members = team.memberIds.map(getCharacter).filter(Boolean);
      const visible = team.visible !== false;
      return `<article class="compact-team-card ${visible ? "" : "is-visibility-off"}" style="--team-color:${team.color}"><div class="compact-team-card__head"><div><strong>${escapeHtml(team.name)}</strong><span>${members.length}명 · ${visible ? "위치 공유 중" : "공유 숨김"}</span></div><div class="compact-team-card__actions"><button type="button" class="team-eye-button ${visible ? "is-on" : ""}" data-toggle-team-visibility="${team.id}" title="그룹은 유지하고 위치 공유만 ${visible ? "끕니다" : "켭니다"}">${visible ? "◉" : "○"}</button><button type="button" class="compact-icon-button" data-dissolve-team="${team.id}">해제</button></div></div><div class="compact-team-card__members">${members.map((member) => `<button type="button" data-select-character="${member.id}">${escapeHtml(member.name)} <small>${member.id}</small></button>`).join("")}</div></article>`;
    }).join("") : `<div class="compact-empty">편성된 팀이 없습니다.</div>`;

    elements.leftSidebar.innerHTML = `<div class="sidebar-header"><h2>캐릭터 현황</h2><span class="status-pill">${filteredCharacters.length} / ${state.characters.length}명</span></div><div class="sidebar-body"><div class="sidebar-roster-filter" aria-label="캐릭터 현황 필터"><button type="button" data-sidebar-roster-filter="all" class="${filter === "all" ? "is-active" : ""}">전체</button><button type="button" data-sidebar-roster-filter="spirit" class="${filter === "spirit" ? "is-active" : ""}">빙혼자</button><button type="button" data-sidebar-roster-filter="survivor" class="${filter === "survivor" ? "is-active" : ""}">생환자</button></div><div class="roster-list">${cards || emptyStateMarkup("해당 분류의 캐릭터가 없습니다.")}</div><section class="left-team-section"><div class="left-team-section__head"><div><p class="eyebrow">TEAM CONTROL</p><h3>팀 편성 · 위치 공유</h3></div><button type="button" class="button button--small button--primary" data-open-team-manager>편성·수정</button></div><div class="compact-team-list">${teamCards}</div></section><div class="side-note"><strong>지도에서 팀 데려오기</strong><p>지도 위치를 클릭한 뒤 이동시킬 팀을 선택하면 해당 팀원 전원이 같은 공간으로 이동합니다. 개인 이동은 캐릭터의 관리 버튼에서 지정합니다.</p></div></div>`;
  }

  function renderPlayerProfile() {
    const character = getCharacter(session.characterId);
    const teams = getTeamsForCharacter(character.id);
    const visibleTeams = teams.filter((team) => team.visible !== false);
    const visibleMemberIds = new Set(visibleTeams.flatMap((team) => team.memberIds));
    visibleMemberIds.delete(character.id);
    const visibleMembers = [...visibleMemberIds].map(getCharacter).filter((member) => member && member.role === character.role);
    const statuses = character.statuses.length ? character.statuses.map((statusId) => {
      const status = STATUS_DEFINITIONS[statusId];
      return `<div class="status-list__item"><strong>${status.icon} ${escapeHtml(status.name)}</strong><p>${escapeHtml(status.description)}</p></div>`;
    }).join("") : emptyStateMarkup("현재 적용된 상태이상이 없습니다.");
    const movementCard = character.role === "spirit" ? `<div class="stat-card"><span>행동력</span><strong>${character.ap} / ${character.maxAp}</strong></div>` : "";
    const apMeter = character.role === "spirit" ? `<div class="ap-meter" style="--ap-percent:${Math.max(0, Math.min(100, (character.ap / Math.max(1, character.maxAp)) * 100))}%"><span></span></div>` : "";
    const teamMarkup = teams.length ? teams.map((team) => {
      const members = team.memberIds.map(getCharacter).filter((member) => member && member.role === character.role);
      const visible = team.visible !== false;
      return `<article class="team-summary-card ${visible ? "" : "is-visibility-off"}" style="--team-color:${team.color}"><div class="team-summary-card__head"><strong>${escapeHtml(team.name)}</strong><span>${visible ? "위치 공유 중" : "위치 공유 꺼짐"}</span></div><div class="team-member-list">${members.length ? members.map((member) => `<div class="team-member-row">${avatarMarkup(member, true)}<span><strong>${escapeHtml(member.name)} · ${member.id}</strong><small>${member.floor} · ${escapeHtml(getRoomLabel(member.floor, member.x, member.y))}</small></span></div>`).join("") : `<span class="muted-text">같은 분류의 공개 팀원이 없습니다.</span>`}</div></article>`;
    }).join("") : emptyStateMarkup("현재 편성된 팀이 없습니다.");
    const sharedMemberMarkup = visibleMembers.length ? visibleMembers.map((member) => `<span class="shared-member-chip">${escapeHtml(member.name)} · ${member.id}</span>`).join("") : `<span class="shared-member-chip is-muted">공개 중인 같은 분류 팀원 없음</span>`;
    const spiritGuide = character.role === "spirit" ? `<div class="side-note"><strong>빙혼자 이동</strong><p>다른 공간으로 이동할 때 행동력 1이 차감됩니다. 같은 공간의 생환자는 신원 대신 온기와 인원수로만 감지합니다.</p></div>` : "";
    elements.leftSidebar.innerHTML = `<div class="sidebar-header"><h2>내 캐릭터</h2>${roleChipMarkup(character.role)}</div><div class="player-profile"><div class="player-profile__identity">${avatarMarkup(character)}<div><h2>${escapeHtml(character.name)}</h2><span class="character-card__id">ID ${character.id}</span></div></div><div class="stat-grid"><div class="stat-card"><span>현재 위치</span><strong>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</strong></div>${movementCard}</div>${apMeter}<section><p class="eyebrow">MY GROUPS</p><div class="team-summary-list">${teamMarkup}</div><div class="shared-member-list">${sharedMemberMarkup}</div></section><section><p class="eyebrow">STATUS EFFECTS</p><div class="status-list">${statuses}</div></section>${spiritGuide}</div>`;
  }

  function renderSelectedSummary() {
    const selected = getMovementActor();
    const visibleTeams = getVisibleTeamsForCharacter(selected.id);
    const allTeams = getTeamsForCharacter(selected.id);
    const teamText = allTeams.length ? ` · 그룹 ${allTeams.map((team) => `${team.name}${team.visible === false ? "(숨김)" : ""}`).join(", ")}` : " · 미편성";
    if (session.type === "admin") {
      const movement = selected.role === "spirit" ? `행동력 ${selected.ap} / ${selected.maxAp}` : "위치 이동은 운영진만 가능";
      elements.selectedCharacterSummary.innerHTML = `${avatarMarkup(selected)}<div><h3>${escapeHtml(selected.name)} · ID ${selected.id} ${roleChipMarkup(selected.role)}</h3><p>${escapeHtml(selected.floor)} ${escapeHtml(getRoomLabel(selected.floor, selected.x, selected.y))} · ${movement}${teamText}${visibleTeams.length ? "" : allTeams.length ? " · 원격 공유 없음" : ""}</p>${infectionClockMarkup(selected, true)}</div>`;
      return;
    }
    const playerDetail = selected.role === "spirit" ? ` · 행동력 ${selected.ap} / ${selected.maxAp}` : "";
    elements.selectedCharacterSummary.innerHTML = `${avatarMarkup(selected)}<div><h3>${escapeHtml(selected.name)} · ID ${selected.id} ${roleChipMarkup(selected.role)}</h3><p>${escapeHtml(selected.floor)} ${escapeHtml(getRoomLabel(selected.floor, selected.x, selected.y))}${playerDetail}${teamText}</p></div>`;
  }

  function showCharacterManagementModal(characterId = ui.selectedCharacterId) {
    const selected = getCharacter(characterId);
    if (!selected) return;
    ui.selectedCharacterId = selected.id;
    const statusOptions = Object.entries(STATUS_DEFINITIONS).map(([id, status]) => `<option value="${id}">${escapeHtml(status.name)}</option>`).join("");
    const statusList = selected.statuses.length ? selected.statuses.map((statusId) => { const status = STATUS_DEFINITIONS[statusId]; return `<div class="status-list__item"><strong>${status.icon} ${escapeHtml(status.name)}</strong><button type="button" class="button button--small" data-remove-status="${statusId}">해제</button></div>`; }).join("") : emptyStateMarkup("상태이상 없음");
    const apControls = selected.role === "spirit" ? `<div class="modal-control-card"><div class="modal-control-card__title"><strong>행동력</strong><span>${selected.ap} / ${selected.maxAp}</span></div><p>다른 공간으로 이동할 때마다 행동력 1이 차감됩니다.</p><div class="control-row"><button type="button" class="button button--small" data-admin-action="ap-minus">−1</button><button type="button" class="button button--small" data-admin-action="ap-plus-1">+1</button><button type="button" class="button button--small" data-admin-action="ap-plus-3">+3</button><button type="button" class="button button--small" data-admin-action="ap-max">최대</button></div></div>` : `<div class="modal-control-card"><div class="modal-control-card__title"><strong>이동 권한</strong><span>생환자</span></div><p>플레이어 직접 이동은 잠겨 있으며 운영진만 위치를 변경할 수 있습니다.</p><div class="status-pill status-pill--online">행동력 미적용</div></div>`;
    const infectionControl = selected.role === "survivor" ? `<div class="modal-control-card"><div class="modal-control-card__title"><strong>감염 진행 시간</strong><span data-infection-stage="${selected.id}">${freezeStageLabel(freezeStage(effectiveFreezeHours(selected)))}</span></div><div class="infection-summary-card__time" data-infection-clock="${selected.id}">${infectionClockText(selected)}</div><div class="infection-summary-card__meta"><span>관리자 확인 배속</span><strong data-infection-multiplier="${selected.id}">×${clockMultiplier(selected).toFixed(1)}</strong></div><button type="button" class="button button--danger button--small" data-reset-infection-clock="${selected.id}">120:00:00으로 초기화</button></div>` : `<div class="modal-control-card infection-complete-card"><div class="modal-control-card__title"><strong>감염 상태</strong><span>5단계</span></div><p>빙혼 완료 상태입니다. 잔여 시간과 배율은 적용하거나 표시하지 않습니다.</p></div>`;
    openModal({ eyebrow: "CHARACTER CONTROL", title: `${selected.name} · ID ${selected.id}`, body: `<div class="admin-character-overview">${avatarMarkup(selected)}<div><div class="admin-character-overview__title">${roleChipMarkup(selected.role)} <span class="character-card__teams">${teamChipsMarkup(selected.id)}</span></div><strong>${escapeHtml(selected.floor)} · ${escapeHtml(getRoomLabel(selected.floor, selected.x, selected.y))}</strong><span>좌표 X${selected.x + 1}, Y${selected.y + 1}</span></div></div><div class="admin-modal-grid">${apControls}${infectionControl}<div class="modal-control-card"><div class="modal-control-card__title"><strong>개별 위치 이동</strong><span>선택 캐릭터만</span></div><p>버튼을 누른 뒤 지도에서 이동시킬 위치를 선택합니다.</p><div class="control-row"><button type="button" class="button ${ui.adminTool === "forceMove" ? "button--primary" : ""}" data-admin-action="toggle-force-move">선택 캐릭터 이동</button></div></div><div class="modal-control-card modal-control-card--wide"><div class="modal-control-card__title"><strong>역할 및 상태</strong><span>토큰에 즉시 반영</span></div><div class="modal-form-grid"><label class="control-label">분류<select class="form-control" data-role-select><option value="survivor" ${selected.role === "survivor" ? "selected" : ""}>생환자</option><option value="spirit" ${selected.role === "spirit" ? "selected" : ""}>빙혼자</option></select></label>${selected.role === "spirit" ? `<label class="control-label">빙혼 상태<select class="form-control" data-spirit-state-select><option value="stable" ${selected.spiritState === "stable" ? "selected" : ""}>안정</option><option value="unstable" ${selected.spiritState === "unstable" ? "selected" : ""}>불안정</option><option value="freezing" ${selected.spiritState === "freezing" ? "selected" : ""}>동결 진행</option><option value="dormant" ${selected.spiritState === "dormant" ? "selected" : ""}>휴면</option></select><small>현재 상태 시작: ${formatDateTime(selected.spiritSince)} · ${formatElapsed(selected.spiritSince)}</small></label>` : ""}<label class="control-label">상태이상 추가<span class="control-row"><select class="form-control" data-status-select><option value="">상태 선택</option>${statusOptions}</select><button type="button" class="button" data-admin-action="apply-status">적용</button></span></label></div><div class="status-list">${statusList}</div></div></div>`, footer: `<button type="button" class="button" data-modal-close>닫기</button>` });
  }

  function combinedRosterMarkup(characters) {
    const rows = characters.map((character) => {
      const items = character.inventory.length ? character.inventory.slice(0, 3).map((item) => `<button type="button" class="compact-item-link" data-evidence-id="${escapeHtml(item.uid)}">${escapeHtml(item.title)}</button>`).join("") : `<span class="muted-text">없음</span>`;
      const infectionCell = character.role === "survivor" ? `<div class="spirit-state-cell"><strong data-infection-clock="${character.id}">${infectionClockText(character)}</strong><small><span data-infection-stage="${character.id}">${freezeStageLabel(freezeStage(effectiveFreezeHours(character)))}</span> · <span data-infection-multiplier="${character.id}">×${clockMultiplier(character).toFixed(1)}</span></small></div>` : `<div class="spirit-state-cell infection-complete"><strong>5단계 · 빙혼 완료</strong><small>잔여 시간·배율 미적용</small></div>`;
      return `<tr><td><button type="button" class="operations-character-link" data-operations-character="${character.id}">${character.id} · ${escapeHtml(character.name)}</button></td><td>${roleChipMarkup(character.role)}</td><td>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</td><td><div class="compact-item-list">${items}</div></td><td>${infectionCell}</td><td>${character.statuses.length ? character.statuses.map((id) => `<span class="status-icon">${STATUS_DEFINITIONS[id]?.icon || "·"}</span>`).join("") : "정상"}</td></tr>`;
    }).join("");
    return `<section class="operations-card operations-card--roster"><header><div><p class="eyebrow">CHARACTER STATUS</p><h2>캐릭터 현황</h2></div><span>${characters.length}명</span></header><div class="operations-table-wrap"><table class="operations-table"><thead><tr><th>ID · 이름</th><th>분류</th><th>현재 위치</th><th>소지품</th><th>감염 현황</th><th>상태이상</th></tr></thead><tbody>${rows || `<tr><td colspan="6">해당 인원이 없습니다.</td></tr>`}</tbody></table></div></section>`;
  }

  function freezeOperationsMarkup() {
    const survivors = state.characters.filter((character) => character.role === "survivor");
    const spirits = state.characters.filter((character) => character.role === "spirit");
    const presetOptions = EXPOSURE_PRESETS.filter((preset) => !preset.custom).map((preset) => `<option value="${preset.id}">${escapeHtml(preset.label)}${preset.add ? ` (+${preset.add})` : preset.min ? ` (최소 ${preset.min}배)` : ""}</option>`).join("");
    const cards = survivors.map((character) => {
      const hours = effectiveFreezeHours(character);
      const stage = freezeStage(hours);
      const next = nextFreezeThreshold(stage);
      const percentage = Math.min(100, (hours / INFECTION_TOTAL_HOURS) * 100);
      const modifiers = (character.freezeClock?.modifiers || []).map((modifier) => `<span class="freeze-modifier"><span>${escapeHtml(modifier.label)}${modifier.reason ? ` · ${escapeHtml(modifier.reason)}` : ""} · ${modifier.min ? `최소 ${Number(modifier.min).toFixed(1)}배` : `+${Number(modifier.add).toFixed(1)}`}</span><button type="button" data-remove-time-modifier="${character.id}" data-modifier-id="${modifier.id}" aria-label="제거">×</button></span>`).join("");
      return `<article class="freeze-card"><div class="freeze-card__head"><div><h3>${character.id} · ${escapeHtml(character.name)}</h3><small>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</small></div><div class="freeze-card__actions">${roleChipMarkup(character.role)}<button type="button" class="button button--small button--danger" data-reset-infection-clock="${character.id}">시간 초기화</button></div></div><div class="freeze-card__metrics"><div><span>감염 잔여 시간</span><strong data-infection-clock="${character.id}">${infectionClockText(character)}</strong></div><div><span>현재 단계</span><strong data-infection-stage="${character.id}">${freezeStageLabel(stage)}</strong></div><div><span>현재 시간 배율</span><strong data-infection-multiplier="${character.id}">×${clockMultiplier(character).toFixed(1)}</strong></div></div><div class="freeze-progress"><i data-infection-progress="${character.id}" style="width:${percentage}%"></i></div><p class="space-multiplier-note">진행 경과: ${hours.toFixed(3)}시간 / 120시간<br>${stage >= 5 ? "최종 단계 도달" : `다음 단계 전환까지 감염 진행량 ${Math.max(0, next - hours).toFixed(2)}시간`}<br>현재 공간 진행도 ${getSpaceBurningLevel(character.floor, getRoomId(character.floor, character.x, character.y))}단계 → +${currentSpaceAddition(character).toFixed(1)}배속</p><div class="freeze-modifiers">${modifiers || `<span class="muted-text">추가 노출 배율 없음</span>`}</div><div class="infection-control-stack"><form class="freeze-form freeze-form--reason" data-v3-time-modifier-form><input type="hidden" name="characterId" value="${character.id}"><label>노출 선택<select class="form-control" name="preset">${presetOptions}</select></label><label class="custom-label">배율 적용 사유<input class="form-control" name="reason" required maxlength="80" placeholder="예: B1 서비스 통로에서 빙혼체와 접촉"></label><button class="button button--primary" type="submit">배속 추가</button></form><form class="time-adjustment-form" data-v3-time-adjustment-form><input type="hidden" name="characterId" value="${character.id}"><label>잔여 시간 조정<select class="form-control" name="direction"><option value="add">시간 추가</option><option value="subtract">시간 차감</option></select></label><div class="time-adjustment-fields"><label>시<input class="form-control" type="number" min="0" max="120" name="hours" value="0"></label><label>분<input class="form-control" type="number" min="0" max="59" name="minutes" value="0"></label><label>초<input class="form-control" type="number" min="0" max="59" name="seconds" value="0"></label></div><label class="custom-label">조정 사유<input class="form-control" name="reason" required maxlength="80" placeholder="시간 조정 사유를 입력"></label><button class="button button--dark" type="submit">시간 적용</button></form></div></article>`;
    }).join("");
    const spiritRows = spirits.map((character) => `<div class="infection-complete-row">${avatarMarkup(character, true)}<span><strong>${character.id} · ${escapeHtml(character.name)}</strong><small>${escapeHtml(character.floor)} · ${escapeHtml(getRoomLabel(character.floor, character.x, character.y))}</small></span><em>5단계 · 빙혼 완료</em></div>`).join("");
    return `<section class="operations-card"><header><div><p class="eyebrow">INFECTION TIMELINE</p><h2>생환자 감염 진행 관리</h2></div><button type="button" class="button button--danger button--small" data-reset-all-infection-clocks>생환자 전체 120:00:00 초기화</button></header><p class="form-help">생환자만 잔여 시간과 배율을 계산합니다. 배속 추가에는 적용 사유가 반드시 필요하며, 별도의 시간 추가·차감은 적용 버튼을 눌러 반영합니다.</p><table class="freeze-stage-table"><thead><tr><th>단계</th><th>감염 경과 기준</th></tr></thead><tbody><tr><td>1단계</td><td>18시간</td></tr><tr><td>2단계</td><td>42시간</td></tr><tr><td>3단계</td><td>66시간</td></tr><tr><td>4단계</td><td>90시간</td></tr><tr><td>5단계</td><td>120시간</td></tr></tbody></table></section><div class="freeze-grid">${cards || emptyStateMarkup("감염 시간을 관리할 생환자가 없습니다.")}</div><section class="operations-card"><header><div><p class="eyebrow">COMPLETED INFECTION</p><h2>빙혼 완료 인원</h2></div><span>${spirits.length}명</span></header><div class="infection-complete-list">${spiritRows || emptyStateMarkup("빙혼자가 없습니다.")}</div></section>`;
  }

  function inventoryOperationsMarkup() {
    const characterChecks = state.characters.map((character) => `<label class="operations-check-card"><input type="checkbox" name="characterIds" value="${character.id}" />${avatarMarkup(character, true)}<span><strong>${escapeHtml(character.name)} · ${character.id}</strong><small>${ROLE_LABELS[character.role]} · 현재 소지품 ${character.inventory.length}건</small></span></label>`).join("");
    const resourceOptions = state.resourceLibrary.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("");
    const templates = state.resourceLibrary.map((item) => {
      const thumb = item.thumbnailKey ? `<img data-media-key="${escapeHtml(item.thumbnailKey)}" alt="${escapeHtml(item.title)} 썸네일" />` : item.imageData ? `<img src="${item.imageData}" alt="${escapeHtml(item.title)} 썸네일" />` : "▤";
      const originalInfo = item.originalName ? `${escapeHtml(item.originalName)} · ${formatFileSizeV3(item.originalSize || 0)}` : "원본 없음";
      return `<article class="resource-template-card"><span class="resource-template-card__thumb">${thumb}</span><div class="resource-template-card__copy"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p>${certaintyChipMarkup(item.certainty)}<small class="resource-file-meta">썸네일 ${formatFileSizeV3(item.thumbnailSize || 0)} · ${originalInfo}</small></div><div class="resource-template-card__actions"><button type="button" class="button button--small" data-preview-resource="${escapeHtml(item.id)}">미리보기</button><button type="button" class="button button--small button--danger" data-delete-resource="${escapeHtml(item.id)}">삭제</button></div></article>`;
    }).join("");
    return `<div class="operations-library-grid"><div><section class="operations-card"><header><div><p class="eyebrow">RESOURCE LIBRARY</p><h2>조사 자료 사전 등록</h2></div><span>${state.resourceLibrary.length}건</span></header><form class="operations-form" data-resource-library-form><label>자료 이름<input class="form-control" name="title" required maxlength="60" placeholder="예: 의무실 출입 기록" /></label><label>설명<textarea class="form-control" name="description" required rows="5" placeholder="플레이어가 클릭했을 때 볼 설명을 입력하세요."></textarea></label><div class="operations-form-grid"><label>정보 상태<select class="form-control" name="certainty"><option value="unknown">미확인</option><option value="confirmed">확인</option></select></label><label>열람용 썸네일 이미지<input class="form-control" type="file" name="thumbnail" accept="image/*" /></label></div><label>다운로드용 원본 파일<input class="form-control" type="file" name="original" /></label><p class="form-help">썸네일은 최대 5MB이며 플레이어 상세창에서 바로 열람합니다. 원본 파일은 별도 저장되어 플레이어가 다운로드할 수 있습니다. 원본만 첨부하면 이미지 파일에 한해 썸네일을 자동 생성합니다.</p><button type="submit" class="button button--primary">자료 보관함에 등록</button></form></section><section class="operations-card"><header><div><p class="eyebrow">REGISTERED RESOURCES</p><h2>등록된 자료</h2></div></header><div class="resource-library-list">${templates || emptyStateMarkup("사전 등록된 자료가 없습니다.")}</div></section></div><section class="operations-card library-delivery-panel"><header><div><p class="eyebrow">DELIVERY</p><h2>조사 물품 전달</h2></div></header><form class="operations-form" data-resource-delivery-form><label>전달할 자료<select class="form-control" name="resourceId" required><option value="">자료 선택</option>${resourceOptions}</select></label><fieldset><legend>전달 대상</legend><div class="operations-check-grid">${characterChecks}</div></fieldset><p class="form-help">자료가 전달되면 받는 사람의 정보 상태는 자동으로 ‘확인’으로 바뀝니다.</p><button type="submit" class="button button--primary" ${state.resourceLibrary.length ? "" : "disabled"}>선택한 인원에게 전달</button></form></section></div>`;
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
        if (!db.objectStoreNames.contains(MEDIA_STORE_NAME_V3)) db.createObjectStore(MEDIA_STORE_NAME_V3, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function putMediaBlobV3(key, file, name = file.name) {
    const db = await openMediaDbV3();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(MEDIA_STORE_NAME_V3, "readwrite");
      transaction.objectStore(MEDIA_STORE_NAME_V3).put({ key, blob: file, name, type: file.type || "application/octet-stream", size: file.size, createdAt: new Date().toISOString() });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }

  async function getMediaRecordV3(key) {
    if (!key) return null;
    const db = await openMediaDbV3();
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction(MEDIA_STORE_NAME_V3, "readonly").objectStore(MEDIA_STORE_NAME_V3).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return record;
  }

  async function mediaObjectUrlV3(key) {
    if (mediaObjectUrlCacheV3.has(key)) return mediaObjectUrlCacheV3.get(key);
    const record = await getMediaRecordV3(key);
    if (!record?.blob) return null;
    const url = URL.createObjectURL(record.blob);
    mediaObjectUrlCacheV3.set(key, url);
    return url;
  }

  async function hydrateStoredMediaV3(root = document) {
    const images = [];
    if (root?.matches?.("img[data-media-key]:not([data-media-hydrated])")) images.push(root);
    if (root?.querySelectorAll) images.push(...root.querySelectorAll("img[data-media-key]:not([data-media-hydrated])"));
    await Promise.all(images.map(async (image) => {
      image.dataset.mediaHydrated = "loading";
      try {
        const url = await mediaObjectUrlV3(image.dataset.mediaKey);
        if (url) image.src = url;
        image.dataset.mediaHydrated = "true";
      } catch (error) {
        image.dataset.mediaHydrated = "error";
        image.alt = "이미지를 불러오지 못했습니다.";
      }
    }));
  }

  function readImageDimensionsV3(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { resolve({ image, url }); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("IMAGE_DECODE_FAILED")); };
      image.src = url;
    });
  }

  async function createThumbnailBlobV3(file) {
    if (!file.type.startsWith("image/")) throw new Error("THUMBNAIL_IMAGE_REQUIRED");
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
      let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      while (blob && blob.size > THUMBNAIL_MAX_BYTES_V3 && quality > 0.62) {
        quality -= 0.06;
        blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      }
      if (!blob || blob.size > THUMBNAIL_MAX_BYTES_V3) throw new Error("THUMBNAIL_TOO_LARGE");
      return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-thumbnail.jpg`, { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function registerResourceTemplate(formData) {
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const certainty = normalizeCertaintyV3(String(formData.get("certainty") || "unknown"));
    let thumbnail = formData.get("thumbnail");
    const original = formData.get("original");
    if (!title || !description) return;
    if (thumbnail && thumbnail.size && !thumbnail.type.startsWith("image/")) return showToast("썸네일은 이미지 파일만 등록할 수 있습니다.");
    if (thumbnail && thumbnail.size > THUMBNAIL_MAX_BYTES_V3) return showToast("썸네일 이미지는 5MB 이하만 등록할 수 있습니다.");
    if (original && original.size > ORIGINAL_MAX_BYTES_V3) return showToast("브라우저 시제품에서는 원본 파일을 100MB 이하로 등록해 주세요.");
    if ((!thumbnail || !thumbnail.size) && original && original.size && original.type.startsWith("image/")) {
      try { thumbnail = await createThumbnailBlobV3(original); } catch (error) { return showToast("원본 이미지에서 5MB 이하 썸네일을 만들지 못했습니다."); }
    }

    const resourceId = `resource-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let thumbnailKey = null;
    let originalKey = null;
    try {
      if (thumbnail && thumbnail.size) {
        thumbnailKey = `thumbnail-${resourceId}`;
        await putMediaBlobV3(thumbnailKey, thumbnail, thumbnail.name);
      }
      if (original && original.size) {
        originalKey = `original-${resourceId}`;
        await putMediaBlobV3(originalKey, original, original.name);
      } else if (thumbnailKey) {
        originalKey = thumbnailKey;
      }
    } catch (error) {
      console.error(error);
      return showToast("파일 저장에 실패했습니다. 브라우저 저장 권한과 남은 용량을 확인해 주세요.");
    }

    state.resourceLibrary.unshift({
      id: resourceId,
      title,
      description,
      certainty,
      thumbnailKey,
      thumbnailName: thumbnail?.name || null,
      thumbnailSize: thumbnail?.size || 0,
      originalKey,
      originalName: original?.name || thumbnail?.name || null,
      originalSize: original?.size || thumbnail?.size || 0,
      originalType: original?.type || thumbnail?.type || null,
      createdAt: new Date().toISOString(),
    });
    addLog(`운영진이 자료 보관함에 「${title}」을(를) 사전 등록했습니다.`);
    persistState();
    renderAdminOperationsPage();
    showToast("썸네일과 원본 파일을 자료 보관함에 등록했습니다.");
  }

  function deliverResource(formData) {
    const template = state.resourceLibrary.find((item) => item.id === String(formData.get("resourceId") || ""));
    const characterIds = [...new Set(formData.getAll("characterIds").map(Number).filter((id) => getCharacter(id)))];
    if (!template) return showToast("전달할 자료를 선택해 주세요.");
    if (!characterIds.length) return showToast("자료를 받을 인원을 선택해 주세요.");
    const deliveryId = `delivery-${Date.now()}`;
    characterIds.forEach((id) => {
      const character = getCharacter(id);
      character.inventory.unshift({
        uid: `${deliveryId}-${id}`,
        sourceId: template.id,
        title: template.title,
        description: template.description,
        certainty: "confirmed",
        floor: character.floor,
        room: getRoomLabel(character.floor, character.x, character.y),
        discoveredBy: "운영진 전달",
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
    addLog(`운영진이 ${characterIds.map((id) => getCharacter(id).name).join(", ")}에게 자료 「${template.title}」을(를) 전달했습니다. 정보 상태가 확인으로 변경되었습니다.`);
    persistState();
    renderAdminOperationsPage();
    showToast(`${characterIds.length}명에게 자료를 전달했습니다. 정보 상태: 확인`);
  }

  function showEvidenceModal(evidence, investigation = null) {
    if (!evidence && investigation) {
      evidence = { title: investigation.evidenceTitle, description: investigation.result, certainty: "confirmed", floor: investigation.floor, room: getRoomLabel(investigation.floor, investigation.x, investigation.y), discoveredBy: "조사 기록" };
    }
    if (!evidence) return;
    const imageMarkup = evidence.thumbnailKey ? `<figure class="evidence-image"><img data-media-key="${escapeHtml(evidence.thumbnailKey)}" alt="${escapeHtml(evidence.title)} 첨부 이미지" /></figure>` : evidence.imageData ? `<figure class="evidence-image"><img src="${evidence.imageData}" alt="${escapeHtml(evidence.title)} 첨부 이미지" /></figure>` : `<div class="evidence-detail__image">▤</div>`;
    const originalKey = evidence.originalKey || evidence.thumbnailKey || null;
    const downloadButton = originalKey ? `<button type="button" class="button button--primary" data-download-media-key="${escapeHtml(originalKey)}" data-download-name="${escapeHtml(evidence.originalName || evidence.thumbnailName || evidence.fileName || `${evidence.title}.bin`)}">원본 파일 다운로드</button>` : evidence.imageData ? `<a class="button button--primary" href="${evidence.imageData}" download="${escapeHtml(evidence.fileName || `${evidence.title}.png`)}">사진 다운로드</a>` : "";
    openModal({
      eyebrow: "ITEM / EVIDENCE",
      title: evidence.title,
      body: `<div class="evidence-detail">${imageMarkup}<p>${escapeHtml(evidence.description)}</p><div class="detail-grid"><div><span>정보 상태</span><strong>${certaintyLabel(evidence.certainty)}</strong></div><div><span>등록·발견자</span><strong>${escapeHtml(evidence.discoveredBy || "미상")}</strong></div><div><span>등록 장소</span><strong>${escapeHtml(`${evidence.floor || "-"} ${evidence.room || ""}`)}</strong></div><div><span>열람용 썸네일</span><strong>${escapeHtml(evidence.thumbnailName || evidence.fileName || "없음")}</strong></div><div><span>다운로드 원본</span><strong>${escapeHtml(evidence.originalName || evidence.fileName || "없음")}${evidence.originalSize ? ` · ${formatFileSizeV3(evidence.originalSize)}` : ""}</strong></div></div></div>`,
      footer: `${downloadButton}<button type="button" class="button" data-modal-close>닫기</button>`,
    });
    elements.modalFooter.querySelector("[data-modal-close]")?.addEventListener("click", closeModal);
    hydrateStoredMediaV3(elements.modalBody);
  }

  function previewResourceTemplate(resourceId) {
    const item = state.resourceLibrary.find((resource) => resource.id === resourceId);
    if (!item) return;
    showEvidenceModal({ ...item, uid: item.id, floor: "자료 보관함", room: "사전 등록", discoveredBy: "운영진" });
  }

  function handleRightSidebarChange(event) {
    if (session.type !== "admin") return;
    if (event.target.matches("[data-spirit-state-select]")) {
      const character = getCharacter(ui.selectedCharacterId);
      if (!character || character.role !== "spirit") return;
      character.spiritState = event.target.value;
      character.spiritSince = new Date().toISOString();
      addLog(`관리자가 ${character.name}의 빙혼 상태를 ${SPIRIT_STATE_LABELS[character.spiritState]}(으)로 변경했습니다.`);
      persistState();
      renderAll();
      if (!elements.modalBackdrop.classList.contains("is-hidden")) showCharacterManagementModal(character.id);
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
        character.freezeClock = { baseHours: 0, lastUpdated: new Date().toISOString(), modifiers: [] };
      } else {
        character.maxAp = Math.max(5, Number(character.maxAp || 0));
        character.ap = Math.min(character.maxAp, Math.max(1, Number(character.ap || 3)));
        character.spiritState = character.spiritState || "stable";
        character.spiritSince = new Date().toISOString();
        character.freezeClock = { baseHours: INFECTION_TOTAL_HOURS, lastUpdated: new Date().toISOString(), modifiers: [] };
      }
      addLog(`관리자가 ${character.name}의 분류를 ${ROLE_LABELS[character.role]}(으)로 변경했습니다.`);
      persistState();
      renderAll();
      if (!elements.modalBackdrop.classList.contains("is-hidden")) showCharacterManagementModal(character.id);
    }
  }

  async function downloadStoredMediaV3(key, requestedName) {
    try {
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
    const multiplierForm = event.target.closest("[data-v3-time-modifier-form]");
    if (multiplierForm) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const formData = new FormData(multiplierForm);
      const character = getCharacter(Number(formData.get("characterId")));
      const preset = EXPOSURE_PRESETS.find((item) => item.id === formData.get("preset") && !item.custom);
      const reason = String(formData.get("reason") || "").trim();
      if (!character || character.role !== "survivor" || !preset) return;
      if (!reason) return showToast("배율을 추가한 사유를 입력해 주세요.");
      settleFreezeClock(character);
      character.freezeClock.modifiers.push({ id: `mod-${Date.now()}`, label: preset.label, reason, add: preset.add || 0, min: preset.min || 0, createdAt: new Date().toISOString() });
      addLog(`관리자가 ${character.name}에게 ${preset.label} 배율을 추가했습니다. 사유: ${reason}`);
      persistState();
      renderAdminOperationsPage();
      showToast(`${character.name}에게 시간 배율을 추가했습니다.`);
      return;
    }

    const adjustmentForm = event.target.closest("[data-v3-time-adjustment-form]");
    if (adjustmentForm) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const formData = new FormData(adjustmentForm);
      const character = getCharacter(Number(formData.get("characterId")));
      if (!character || character.role !== "survivor") return;
      const hours = Math.max(0, Number(formData.get("hours") || 0));
      const minutes = Math.max(0, Math.min(59, Number(formData.get("minutes") || 0)));
      const seconds = Math.max(0, Math.min(59, Number(formData.get("seconds") || 0)));
      const totalSeconds = Math.round(hours * 3600 + minutes * 60 + seconds);
      const direction = String(formData.get("direction") || "add");
      const reason = String(formData.get("reason") || "").trim();
      if (!totalSeconds) return showToast("조정할 시간을 입력해 주세요.");
      if (!reason) return showToast("시간 조정 사유를 입력해 주세요.");
      settleFreezeClock(character);
      const deltaHours = totalSeconds / 3600;
      if (direction === "add") character.freezeClock.baseHours = Math.max(0, character.freezeClock.baseHours - deltaHours);
      else character.freezeClock.baseHours = Math.min(INFECTION_TOTAL_HOURS, character.freezeClock.baseHours + deltaHours);
      character.freezeClock.lastUpdated = new Date().toISOString();
      addLog(`관리자가 ${character.name}의 감염 잔여 시간을 ${direction === "add" ? "추가" : "차감"}했습니다: ${formatClockSeconds(totalSeconds)} · 사유: ${reason}`);
      persistState();
      renderAdminOperationsPage();
      refreshLiveInfectionClocks();
      showToast(`${character.name}의 잔여 시간을 ${direction === "add" ? "추가" : "차감"}했습니다.`);
    }
  }

  function installV3Enhancements() {
    elements.adminOperationsView.addEventListener("submit", handleV3OperationsSubmit, true);
    document.addEventListener("click", (event) => {
      const resetAllButton = event.target.closest("[data-reset-all-infection-clocks]");
      if (resetAllButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        state.characters.filter((character) => character.role === "survivor").forEach(resetInfectionClock);
        addLog("관리자가 모든 생환자의 감염 진행 시간을 120:00:00으로 초기화했습니다.");
        persistState();
        renderAdminOperationsPage();
        showToast("모든 생환자의 감염 시간을 초기화했습니다.");
        return;
      }
      const downloadButton = event.target.closest("[data-download-media-key]");
      if (!downloadButton) return;
      event.preventDefault();
      downloadStoredMediaV3(downloadButton.dataset.downloadMediaKey, downloadButton.dataset.downloadName);
    }, true);
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





  let engineMounted = false;
  let infectionClockTimer = null;

  mountGameEngineImpl = function mountGameEngineImplInternal() {
    if (engineMounted) return undefined;
    engineMounted = true;
    init();
    installV3Enhancements();
    window.setTimeout(() => {
      try { persistState(); }
      catch (error) { console.warn("초기 감염 시계를 저장하지 못했습니다.", error); }
    }, 0);
    infectionClockTimer = window.setInterval(refreshLiveInfectionClocks, 1000);

    return () => {
      if (infectionClockTimer) window.clearInterval(infectionClockTimer);
      infectionClockTimer = null;
    };
  };

})();


export function mountGameEngine() {
  return mountGameEngineImpl?.();
}
