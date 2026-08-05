export default function LoginView() {
  return (
    <section id="loginView" className="login-view login-view--search" aria-labelledby="loginTitle">
      <div className="login-card login-card--search">
        <div className="brand brand--login">
          <div className="brand__seal" aria-hidden="true">SHU</div>
          <div>
            <p className="eyebrow">SAENGHWAN UNIVERSITY INSTITUTE</p>
            <h1 id="loginTitle">학술원 조사 시스템</h1>
          </div>
        </div>

        <form id="characterLoginForm" className="login-form login-form--search">
          <label htmlFor="characterIdInput">접속 ID 검색</label>
          <div className="login-form__row">
            <input
              id="characterIdInput"
              name="characterId"
              inputMode="numeric"
              autoComplete="off"
              maxLength="4"
              placeholder="ID를 입력하세요"
              required
            />
            <button type="submit" className="button button--primary">검색</button>
          </div>
          <p id="loginError" className="form-message" role="alert" />
        </form>

        <div id="loginSearchResult" className="login-search-result" aria-live="polite" />
      </div>
    </section>
  );
}
