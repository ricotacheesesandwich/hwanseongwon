(() => {
  "use strict";

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
      "Supabase 연결값이 아직 설정되지 않았습니다. js/supabase-config.js를 확인하세요.",
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
