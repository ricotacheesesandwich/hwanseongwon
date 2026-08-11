-- ============================================================
-- 생환대학교 조사 시스템 - Supabase 서버 스키마
-- 1회만 실행합니다.
-- ============================================================

begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.access_credentials (
  account_key text primary key,
  account_type text not null check (account_type in ('admin', 'player')),
  character_id bigint unique,
  password_hash text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint access_credentials_character_check check (
    (account_type = 'admin' and character_id is null)
    or
    (account_type = 'player' and character_id is not null)
  )
);

create table if not exists private.game_sessions (
  token_hash text primary key,
  account_key text not null references private.access_credentials(account_key) on delete cascade,
  account_type text not null check (account_type in ('admin', 'player')),
  character_id bigint,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists game_sessions_expires_at_idx
  on private.game_sessions(expires_at);

create table if not exists private.login_guard (
  bucket text primary key,
  failed_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);

-- 공유 조사자료 원본/썸네일 저장소. 비공개 bucket이며 Edge Function이 짧은 signed URL만 발급합니다.
insert into storage.buckets (id, name, public, file_size_limit)
values ('game-media', 'game-media', false, 104857600)
on conflict (id) do update
set public = false,
    file_size_limit = 104857600;

create table if not exists public.game_state (
  id bigint primary key check (id = 1),
  state jsonb not null,
  map_rules jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.game_state enable row level security;
revoke all on table public.game_state from anon, authenticated;
grant all on table public.game_state to service_role;

create table if not exists public.game_state_events (
  id bigserial primary key,
  version bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.game_state_events enable row level security;

-- 이 테이블에는 게임 본문/비밀번호가 없고 "버전이 바뀌었다"는 신호만 있습니다.
drop policy if exists "public can read game state version events" on public.game_state_events;
create policy "public can read game state version events"
  on public.game_state_events
  for select
  to anon, authenticated
  using (true);

grant select on table public.game_state_events to anon, authenticated;
grant all on table public.game_state_events to service_role;
grant all on sequence public.game_state_events_id_seq to service_role;

-- Realtime(Postgres Changes) 대상 등록. 이미 등록되어 있으면 건너뜁니다.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_state_events'
  ) then
    alter publication supabase_realtime add table public.game_state_events;
  end if;
end
$$;

-- ------------------------------------------------------------
-- Edge Function 전용: 비밀번호 확인 + 세션 발급 + 로그인 rate limit
-- 브라우저의 anon/authenticated 역할은 직접 실행할 수 없습니다.
-- ------------------------------------------------------------
create or replace function public.edge_login(
  p_password text,
  p_bucket text
)
returns table (
  status text,
  token text,
  account_type text,
  character_id bigint,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_guard private.login_guard%rowtype;
  v_credential private.access_credentials%rowtype;
  v_token text;
  v_now timestamptz := now();
  v_failed integer;
  v_match_count integer := 0;
begin
  delete from private.game_sessions where expires_at <= v_now;

  select * into v_guard
  from private.login_guard
  where bucket = p_bucket;

  if found and v_guard.blocked_until is not null and v_guard.blocked_until > v_now then
    return query select
      'blocked'::text,
      null::text,
      null::text,
      null::bigint,
      greatest(1, ceil(extract(epoch from (v_guard.blocked_until - v_now)))::integer);
    return;
  end if;

  select count(*) into v_match_count
  from private.access_credentials c
  where c.enabled = true
    and c.password_hash = extensions.crypt(p_password, c.password_hash);

  if v_match_count = 1 then
    select * into v_credential
    from private.access_credentials c
    where c.enabled = true
      and c.password_hash = extensions.crypt(p_password, c.password_hash)
    limit 1;
  end if;

  if v_match_count <> 1 then
    if v_guard.bucket is null or v_guard.window_started_at < v_now - interval '15 minutes' then
      insert into private.login_guard(bucket, failed_count, window_started_at, blocked_until)
      values (p_bucket, 1, v_now, null)
      on conflict (bucket) do update
      set failed_count = 1,
          window_started_at = excluded.window_started_at,
          blocked_until = null;
      v_failed := 1;
    else
      v_failed := v_guard.failed_count + 1;
      update private.login_guard
      set failed_count = v_failed,
          blocked_until = case
            when v_failed >= 8 then v_now + interval '15 minutes'
            else null
          end
      where bucket = p_bucket;
    end if;

    if v_failed >= 8 then
      return query select
        'blocked'::text,
        null::text,
        null::text,
        null::bigint,
        900::integer;
    else
      return query select
        'invalid'::text,
        null::text,
        null::text,
        null::bigint,
        0::integer;
    end if;
    return;
  end if;

  delete from private.login_guard where bucket = p_bucket;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.game_sessions(
    token_hash,
    account_key,
    account_type,
    character_id,
    created_at,
    last_seen_at,
    expires_at
  ) values (
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_credential.account_key,
    v_credential.account_type,
    v_credential.character_id,
    v_now,
    v_now,
    v_now + interval '12 hours'
  );

  return query select
    'ok'::text,
    v_token,
    v_credential.account_type,
    v_credential.character_id,
    0::integer;
end;
$$;

create or replace function public.edge_validate_session(p_token text)
returns table (
  account_key text,
  account_type text,
  character_id bigint,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_hash text;
begin
  if coalesce(p_token, '') = '' then
    return;
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  update private.game_sessions s
  set last_seen_at = now()
  where s.token_hash = v_hash
    and s.expires_at > now();

  return query
  select s.account_key, s.account_type, s.character_id, s.expires_at
  from private.game_sessions s
  where s.token_hash = v_hash
    and s.expires_at > now()
  limit 1;
end;
$$;

create or replace function public.edge_logout(p_token text)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
  if coalesce(p_token, '') <> '' then
    delete from private.game_sessions
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  end if;
end;
$$;

revoke all on function public.edge_login(text, text) from public, anon, authenticated;
revoke all on function public.edge_validate_session(text) from public, anon, authenticated;
revoke all on function public.edge_logout(text) from public, anon, authenticated;

grant execute on function public.edge_login(text, text) to service_role;
grant execute on function public.edge_validate_session(text) to service_role;
grant execute on function public.edge_logout(text) to service_role;

commit;
