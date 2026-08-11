-- ============================================================
-- 생환대학교 조사 시스템 - 비밀번호 1개 변경용 템플릿
-- 필요한 경우에만 Supabase SQL Editor에서 실행합니다.
-- 실제 비밀번호/학번을 채운 파일은 GitHub에 올리지 마세요.
-- ============================================================

-- account_key 값:
--   admin
--   character-101
--   character-102
--   character-103
--   character-104
--   character-105
--   character-106

-- 예: 관리자 비밀번호 변경
-- 아래 YOUR_NEW_PASSWORD만 실제 새 비밀번호로 바꿔 실행합니다.
update private.access_credentials
set password_hash = extensions.crypt(
      'YOUR_NEW_PASSWORD',
      extensions.gen_salt('bf', 12)
    ),
    updated_at = now()
where account_key = 'admin';

-- 비밀번호를 바꾼 뒤 기존 로그인 세션까지 즉시 끊고 싶으면 실행:
-- delete from private.game_sessions where account_key = 'admin';

-- 특정 학생 예시: 까순(103)
-- update private.access_credentials
-- set password_hash = extensions.crypt(
--       'YOUR_NEW_STUDENT_NUMBER',
--       extensions.gen_salt('bf', 12)
--     ),
--     updated_at = now()
-- where account_key = 'character-103';
-- delete from private.game_sessions where account_key = 'character-103';

-- 모든 접속자의 현재 세션을 한꺼번에 만료시키려면:
-- delete from private.game_sessions;
