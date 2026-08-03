/**
 * GVSI Comunidade — cliente Supabase (fase 2)
 * A chave abaixo é a PÚBLICA (publishable) — pode ficar no front.
 * NUNCA colocar a service_role aqui: ela ignora RLS.
 * Requer o supabase-js carregado antes (window.supabase).
 */
(function () {
  window.SUPABASE_URL = "https://mwnyuursbrlfxfssvkyu.supabase.co";
  window.SUPABASE_ANON_KEY = "sb_publishable_ePHPg4AuQYQE5XJG9fjlkg_V1ouyB8o";

  if (!window.supabase || !window.supabase.createClient) {
    console.error("[GVSI] supabase-js não carregou (CDN bloqueado?).");
    return;
  }
  window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "gvsi-comunidade-auth",
    },
  });
})();
