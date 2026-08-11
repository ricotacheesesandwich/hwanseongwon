# 생환대학교 조사 시스템 — Vanilla + Supabase 운영본

현재 실제 사이트는 **Vanilla HTML/CSS/JavaScript**만 사용합니다. React/Vite는 제거했습니다.
GitHub Pages는 `.github/workflows/deploy.yml`에서 `vanilla/` 폴더를 그대로 배포합니다.

## 현재 구조

```text
.
├─ .github/workflows/deploy.yml
├─ vanilla/
│  ├─ index.html
│  ├─ css/
│  └─ js/
│     ├─ app.js
│     ├─ app.txt
│     ├─ supabase-config.js
│     └─ supabase-config.txt
└─ supabase/
   ├─ config.toml
   ├─ sql/
   │  ├─ 01_schema.sql
   │  ├─ 02_credentials_TEMPLATE.sql
   │  └─ 03_change_password_TEMPLATE.sql
   └─ functions/game-api/
      ├─ index.ts
      └─ index.txt
```

## 로그인

로그인 화면에는 **비밀번호 입력칸 하나만** 있습니다.
운영 전에 관리자 비밀번호와 각 캐릭터 비밀번호(예: 학생 학번)를 Supabase DB에 미리 등록합니다.
브라우저의 HTML/JavaScript에는 관리자 비밀번호나 학생 학번 원문이 들어가지 않습니다.
DB에는 `pgcrypto`의 `crypt()`로 만든 해시만 저장합니다.

현재 캐릭터 표시 ID는 101~106으로 유지되며, 이 값은 로그인 비밀번호가 아닙니다.
실제 학번은 `02_credentials_TEMPLATE.sql`을 Supabase SQL Editor에서 실행할 때만 입력합니다.

## 서버 동기화

- 실제 게임 상태 원본: Supabase PostgreSQL
- 접속 중 변경 알림: Supabase Realtime
- 관리자 변경: 서버 저장 후 전체 접속자 갱신
- 동결체 이동: 서버가 본인/역할/AP/경로를 검증하고 AP 차감 + 이동을 처리
- 플레이어 일반 저장: 서버가 허용한 자기 메모만 반영
- 조사 획득: 서버가 현재 위치와 조사 포인트를 검증
- 조사자료 이미지/원본: 비공개 Supabase Storage + 짧은 signed URL

플레이어가 서버에서 상태를 받을 때는 관리자 전체 상태를 그대로 받지 않습니다.
본인, 공개 중인 같은 분류 그룹원, 같은 공간의 같은 분류 인원 등 현재 화면에 필요한 캐릭터 정보만 내려오며, 반대 역할의 신원은 온기/한기 여부처럼 필요한 파생 신호로만 전달됩니다.

## 브라우저에 넣어도 되는 값

`vanilla/js/supabase-config.js`에는 아래 두 값만 넣습니다.

- Supabase Project URL
- `sb_publishable_...` Publishable key

다음 값은 절대 브라우저/GitHub에 넣지 않습니다.

- `sb_secret_...`
- `service_role`
- 관리자 실제 비밀번호
- 학생 실제 학번/비밀번호

## 설치

처음 설치와 GitHub Pages 배포 순서는 `처음부터_끝까지_설치순서.md`를 따르세요.
