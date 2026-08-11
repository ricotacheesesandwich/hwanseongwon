(() => {
  "use strict";

  /*
   * 브라우저에 공개되어도 되는 값만 이 파일에 넣습니다.
   * - Project URL
   * - sb_publishable_... 키
   *
   * 절대 넣지 말 것:
   * - sb_secret_...
   * - service_role
   * - 학생 학번/비밀번호 원문
   * - 관리자 비밀번호 원문
   */
  const SUPABASE_URL = "https://iyxcaeoksphgwvifdxdr.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_Jy42YpJiBPonjxA_sKzm_A___B3faYN";

  const configured =
    /^https:\/\/.+\.supabase\.co$/i.test(SUPABASE_URL) &&
    SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");

  window.SHU_SUPABASE_CONFIG = Object.freeze({
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    functionName: "game-api",
    configured,
  });

  if (!configured) {
    console.warn(
      "Supabase 연결값이 아직 설정되지 않았습니다. vanilla/js/supabase-config.js를 확인하세요.",
    );
    return;
  }

  if (!window.supabase?.createClient) {
    console.error("Supabase JS SDK를 불러오지 못했습니다.");
    return;
  }

  window.shuSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
})();
