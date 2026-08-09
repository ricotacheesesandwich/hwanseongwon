export default function Topbar() {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand__seal" aria-hidden="true">
          SHU
        </div>
        <div className="brand__copy">
          <strong>생환대학교 부설 학술원 조사 시스템</strong>
          <span>공간 이동 · 팀 위치 공유 · 조사 기록</span>
        </div>
      </div>

      <nav
        id="viewModeNav"
        className="view-mode-nav"
        aria-label="관리자 시점 전환"
      >
        <button type="button" data-view-mode="survivor">
          생환자 시점
        </button>
        <button type="button" data-view-mode="spirit">
          빙혼자 시점
        </button>
        <button type="button" data-view-mode="admin" className="is-active">
          관리자 시점
        </button>
      </nav>

      <div className="topbar__actions">
        <button
          id="themeToggleButton"
          type="button"
          className="theme-toggle"
          role="switch"
          aria-checked="false"
          aria-label="다크모드로 전환"
        >
          <span className="theme-toggle__track" aria-hidden="true">
            <span className="theme-toggle__thumb" />
          </span>

          <span id="themeToggleLabel" className="theme-toggle__label">
            라이트
          </span>
        </button>
        <button
          id="adminOperationsButton"
          type="button"
          className="button button--operations admin-only"
        >
          관리페이지
        </button>
        <div id="sessionBadge" className="session-badge" />
        <button id="eventButton" type="button" className="event-button">
          <span aria-hidden="true">!</span> 긴급 이벤트 0건
        </button>
        <button
          id="logoutButton"
          type="button"
          className="icon-button"
          title="로그아웃"
          aria-label="로그아웃"
        >
          ↪
        </button>
      </div>
    </header>
  );
}
