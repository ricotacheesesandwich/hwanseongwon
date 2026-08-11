-- =====================================================================
-- 비밀번호 최초 등록용 템플릿
--
-- 이 파일 자체의 PLACEHOLDER는 GitHub에 올려도 됩니다.
-- 하지만 아래 문자열을 실제 학번/관리자 비밀번호로 바꾼 파일은
-- 절대로 저장소에 커밋하지 마세요.
--
-- 권장 사용법:
-- 1) 이 내용을 Supabase SQL Editor에 직접 붙여넣기
-- 2) 따옴표 안의 CHANGE_... 부분만 실제 값으로 교체
-- 3) Run
-- 4) 실제 값이 들어간 쿼리를 로컬 파일로 저장하지 않기
-- =====================================================================

begin;

insert into private.access_credentials (
  account_key,
  account_type,
  character_id,
  password_hash,
  enabled,
  updated_at
)
values
  (
    'admin',
    'admin',
    null,
    extensions.crypt('CHANGE_ADMIN_PASSWORD', extensions.gen_salt('bf', 12)),
    true,
    now()
  ),
  (
    'character-101',
    'player',
    101,
    extensions.crypt('CHANGE_MUHYEON_STUDENT_NUMBER', extensions.gen_salt('bf', 12)),
    true,
    now()
  ),
  (
    'character-102',
    'player',
    102,
    extensions.crypt('CHANGE_DOHYEON_STUDENT_NUMBER', extensions.gen_salt('bf', 12)),
    true,
    now()
  ),
  (
    'character-103',
    'player',
    103,
    extensions.crypt('CHANGE_KKASUN_STUDENT_NUMBER', extensions.gen_salt('bf', 12)),
    true,
    now()
  ),
  (
    'character-104',
    'player',
    104,
    extensions.crypt('CHANGE_HYEYEON_STUDENT_NUMBER', extensions.gen_salt('bf', 12)),
    true,
    now()
  ),
  (
    'character-105',
    'player',
    105,
    extensions.crypt('CHANGE_HYEJIN_STUDENT_NUMBER', extensions.gen_salt('bf', 12)),
    true,
    now()
  ),
  (
    'character-106',
    'player',
    106,
    extensions.crypt('CHANGE_TAEHEO_STUDENT_NUMBER', extensions.gen_salt('bf', 12)),
    true,
    now()
  )
on conflict (account_key) do update
set
  account_type = excluded.account_type,
  character_id = excluded.character_id,
  password_hash = excluded.password_hash,
  enabled = excluded.enabled,
  updated_at = now();

commit;

-- 성공 여부만 확인합니다. password_hash는 조회하지 않습니다.
select account_key, account_type, character_id, enabled, updated_at
from private.access_credentials
order by account_type, character_id nulls first;
