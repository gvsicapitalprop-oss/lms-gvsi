/**
 * GVSI Comunidade — autenticação (fase 2)
 * - Guarda as páginas do app (redireciona p/ login.html sem sessão)
 * - Garante o perfil em lms_students (não há trigger que crie no signup)
 * - Expõe window.GVSIAuth p/ login.html e botões de logout
 */
(function () {
  function client() { return window.sb; }

  async function getSession() {
    if (!client()) return null;
    const { data } = await client().auth.getSession();
    return data.session;
  }

  async function getUser() {
    if (!client()) return null;
    const { data } = await client().auth.getUser();
    return data.user;
  }

  // Cria o registro em lms_students se ainda não existir (sem sobrescrever).
  async function ensureProfile() {
    const user = await getUser();
    if (!user) return;
    const meta = user.user_metadata || {};
    await client().from("lms_students").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: meta.full_name || (user.email ? user.email.split("@")[0] : "Membro"),
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
  }

  async function signOut() {
    try { await client().auth.signOut(); } catch (e) {}
    try { sessionStorage.removeItem("gvsi-profile-ensured"); } catch (e) {}
    location.replace("login.html");
  }

  // Garante sessão; senão manda p/ login. Roda ensureProfile 1x por sessão.
  async function requireAuth() {
    const session = await getSession();
    if (!session) { location.replace("login.html"); return null; }
    try {
      if (!sessionStorage.getItem("gvsi-profile-ensured")) {
        await ensureProfile();
        sessionStorage.setItem("gvsi-profile-ensured", "1");
      }
    } catch (e) { /* perfil garante na próxima */ }
    return session;
  }

  window.GVSIAuth = { getSession, getUser, ensureProfile, signOut, requireAuth };

  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.hasAttribute("data-app")) requireAuth();
    document.querySelectorAll("[data-signout]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); signOut(); });
    });
  });
})();
