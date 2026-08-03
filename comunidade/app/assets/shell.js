/**
 * GVSI Comunidade — shell compartilhado
 * - Carrega os tópicos do Supabase (comu_topics); cai no topics.js se falhar
 * - Renderiza sidebar (desktop) + lista (mobile), marca o ativo
 * - Alterna e persiste o tema (claro/escuro)
 * - Filtro de busca da home
 */
(function () {
  var TONES = {
    primary:   { bg: "bg-primary-container",   fg: "text-on-primary-container" },
    secondary: { bg: "bg-secondary-container", fg: "text-on-secondary-container" },
    tertiary:  { bg: "bg-tertiary-container",  fg: "text-on-tertiary-container" },
  };

  function topicItem(t, activeId) {
    var tone = TONES[t.tone] || TONES.primary;
    var active = t.id === activeId;
    var a = document.createElement("a");
    a.href = "chat.html?topico=" + t.id;
    a.dataset.slug = t.id;
    a.className =
      "topic-item flex items-center gap-md p-md rounded-xl transition-colors cursor-pointer " +
      (active ? "bg-surface-container-high" : "hover:bg-surface-container-low");
    a.innerHTML =
      '<div class="w-12 h-12 rounded-full ' + tone.bg + " flex items-center justify-center " + tone.fg + ' shrink-0">' +
        '<span class="material-symbols-outlined text-[24px]">' + t.icon + "</span>" +
      "</div>" +
      '<div class="flex-1 min-w-0">' +
        '<h3 class="font-bold text-on-surface truncate">' + t.name + "</h3>" +
        '<p class="text-body-sm text-outline truncate">' + (t.desc || "") + "</p>" +
      "</div>" +
      '<span class="unread-badge hidden min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center">0</span>' +
      '<span class="material-symbols-outlined text-outline">chevron_right</span>';
    return a;
  }

  function renderList(container, topics, activeId) {
    if (!container) return;
    container.innerHTML = "";
    topics.forEach(function (t) { container.appendChild(topicItem(t, activeId)); });
  }

  // Tópicos do banco (comu_topics); fallback para o estático (topics.js)
  async function loadTopics() {
    if (window.sb) {
      try {
        var res = await window.sb
          .from("comu_topics")
          .select("slug,name,icon,tone,description,position")
          .eq("is_active", true)
          .order("position", { ascending: true });
        if (!res.error && res.data && res.data.length) {
          return res.data.map(function (t) {
            return { id: t.slug, name: t.name, icon: t.icon, tone: t.tone, desc: t.description || "" };
          });
        }
      } catch (e) { /* usa fallback */ }
    }
    return window.GVSI_TOPICS || [];
  }

  function initTheme() {
    var root = document.documentElement;
    function isDark() { return root.classList.contains("dark"); }
    function updateIcons() {
      var dark = isDark();
      document.querySelectorAll("[data-theme-icon]").forEach(function (el) {
        el.textContent = dark ? "light_mode" : "dark_mode";
      });
      document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
        btn.setAttribute("aria-label", dark ? "Ativar modo claro" : "Ativar modo escuro");
      });
    }
    function toggle() {
      var next = isDark() ? "light" : "dark";
      root.classList.toggle("dark", next === "dark");
      try { localStorage.setItem("gvsi-theme", next); } catch (e) {}
      updateIcons();
    }
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", toggle);
    });
    updateIcons();
  }

  function initSearch() {
    var search = document.getElementById("topic-search");
    if (!search) return;
    var noResults = document.getElementById("no-results");
    search.addEventListener("input", function (e) {
      var val = e.target.value.trim().toLowerCase();
      var visible = 0;
      document.querySelectorAll("#topic-list .topic-item").forEach(function (item) {
        var title = item.querySelector("h3").textContent.toLowerCase();
        var match = title.indexOf(val) !== -1;
        item.style.display = match ? "flex" : "none";
        if (match) visible++;
      });
      if (noResults) noResults.classList.toggle("hidden", visible > 0);
    });
  }

  // Badges de não-lidas (função comu_unread_counts)
  async function applyUnread() {
    if (!window.sb) return;
    try {
      var r = await window.sb.rpc("comu_unread_counts");
      if (r.error || !r.data) return;
      var map = {};
      r.data.forEach(function (x) { map[x.slug] = Number(x.unread) || 0; });
      document.querySelectorAll(".topic-item").forEach(function (item) {
        var badge = item.querySelector(".unread-badge");
        if (!badge) return;
        var n = map[item.dataset.slug] || 0;
        if (n > 0) { badge.textContent = n > 99 ? "99+" : n; badge.classList.remove("hidden"); }
        else { badge.classList.add("hidden"); }
      });
    } catch (e) { /* ignore */ }
  }

  // Avatar/nome do usuário logado na sidebar (todas as páginas)
  async function loadSidebarProfile() {
    if (!window.sb) return;
    try {
      var u = (await window.sb.auth.getUser()).data.user;
      if (!u) return;
      var pr = await window.sb.from("lms_students").select("full_name,avatar_url").eq("id", u.id).maybeSingle();
      var prof = pr.data || {};
      document.querySelectorAll("[data-side-avatar]").forEach(function (el) {
        el.innerHTML = prof.avatar_url
          ? '<img src="' + prof.avatar_url + '" class="w-full h-full object-cover" alt="">'
          : '<span class="material-symbols-outlined text-[20px]">person</span>';
      });
      document.querySelectorAll("[data-side-name]").forEach(function (el) {
        el.textContent = prof.full_name || "Meu Perfil";
      });
    } catch (e) { /* ignore */ }
  }

  document.addEventListener("DOMContentLoaded", async function () {
    initTheme();
    var params = new URLSearchParams(location.search);
    var activeId = (document.body.dataset.topico || params.get("topico") || "").trim();
    var topics = await loadTopics();
    renderList(document.getElementById("side-topics"), topics, activeId);
    renderList(document.getElementById("topic-list"), topics, activeId);
    initSearch();
    applyUnread();
    loadSidebarProfile();
  });
})();
