# 생환대학교 조사 시스템 — 코드 분할본

현재 단일 `preview.html`에 들어 있던 HTML·CSS·JavaScript를 분리하고, React용 구조도 함께 구성했습니다.

## 1. 바로 실행되는 완전 동일 버전

`preview.html` 또는 `vanilla/index.html`을 열면 됩니다.

- `vanilla/index.html`: HTML 구조
- `vanilla/css/`: 기존 CSS를 기능 단위와 적용 순서에 맞게 6개 파일로 분리
- `vanilla/js/app.js`: 현재 구현된 전체 게임 로직

이 버전은 기존 시제품과 동일하게 브라우저 저장소와 IndexedDB를 사용합니다.

## 2. React 버전

`react/`는 Vite + React 프로젝트입니다.

```bash
cd react
npm install
npm run dev
```

주요 구조:

```text
react/
├─ index.html
├─ package.json
├─ vite.config.js
└─ src/
   ├─ main.jsx
   ├─ App.jsx
   ├─ components/
   │  ├─ LoginView.jsx
   │  ├─ Topbar.jsx
   │  ├─ AppShell.jsx
   │  ├─ Workspace.jsx
   │  ├─ MapPanel.jsx
   │  └─ ModalRoot.jsx
   ├─ styles/
   │  ├─ 01-foundation.css
   │  ├─ 02-app-shell.css
   │  ├─ 03-map-and-teams.css
   │  ├─ 04-spirit-theme.css
   │  ├─ 05-admin-operations.css
   │  └─ 06-feature-overrides.css
   └─ legacy/
      └─ gameEngine.js
```

React 버전은 화면 골격을 JSX 컴포넌트로 분리했으며, 현재까지 누적된 기능을 잃지 않기 위해 게임 상태·지도·관리자 기능 엔진은 `legacy/gameEngine.js`에서 그대로 작동합니다. 이 파일은 이후 기능별 훅과 상태 관리 모듈로 순차 이전할 수 있는 전환 계층입니다.

## 접속 ID

- 101 무현
- 102 도현
- 103 까순
- 104 혜연
- 105 혜진
- 106 태허
- 0000 관리자

## 저장 방식

- 상태 및 설정: `localStorage`
- 같은 브라우저 탭 동기화: `BroadcastChannel` + storage 이벤트
- 자료 원본 파일: `IndexedDB`
- 실제 여러 기기 동시 운영: Supabase 등 서버 연결 필요
