/**
 * GVSI Comunidade — núcleo do SPA (single page app)
 * Roteador por hash (#/grupos, #/chat/<slug>, #/perfil, #/suporte, #/enviar/<slug>).
 * Troca só o #view (sem recarregar a página) → sem flash, sidebar/nav persistem.
 * Cada view em views.js registra { render(el, params), destroy() }.
 */
window.GVSI = window.GVSI || {};
GVSI.views = GVSI.views || {};

(function () {
  var G = GVSI;
  G.sb = window.sb;
  G.me = null;

  // ---- Helpers compartilhados ----
  G.esc = function (s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  G.timeStr = function (iso) {
    try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  };
  var _toastT;
  G.toast = function (msg) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(_toastT); _toastT = setTimeout(function () { el.classList.add('hidden'); }, 2600);
  };
  G.confirmDialog = function (opts) {
    return new Promise(function (resolve) {
      opts = opts || {};
      var modal = document.getElementById('confirm-modal');
      document.getElementById('confirm-title').textContent = opts.title || 'Confirmar?';
      document.getElementById('confirm-text').textContent = opts.text || '';
      var okBtn = document.getElementById('confirm-ok'); okBtn.textContent = opts.ok || 'Confirmar';
      okBtn.className = 'h-10 px-4 rounded-full font-label-md active:scale-95 transition ' + (opts.danger ? 'bg-error text-on-error' : 'bg-primary text-on-primary');
      var cancelBtn = document.getElementById('confirm-cancel');
      modal.classList.remove('hidden'); modal.classList.add('flex');
      function close(v) { modal.classList.add('hidden'); modal.classList.remove('flex'); okBtn.onclick = null; cancelBtn.onclick = null; modal.onclick = null; resolve(v); }
      okBtn.onclick = function () { close(true); };
      cancelBtn.onclick = function () { close(false); };
      modal.onclick = function (e) { if (e.target === modal) close(false); };
    });
  };
  G.navigate = function (hash) { if (location.hash === hash) render(); else location.hash = hash; };

  // ---- Tema ----
  G.updateThemeIcons = function () {
    var dark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('[data-theme-icon]').forEach(function (el) { el.textContent = dark ? 'light_mode' : 'dark_mode'; });
  };
  function initTheme() {
    var root = document.documentElement;
    // delegação: funciona também nos botões criados dentro das views
    document.addEventListener('click', function (e) {
      var tt = e.target.closest && e.target.closest('[data-theme-toggle]');
      if (tt) {
        var next = root.classList.contains('dark') ? 'light' : 'dark';
        root.classList.toggle('dark', next === 'dark');
        try { localStorage.setItem('gvsi-theme', next); } catch (er) {}
        G.updateThemeIcons();
        return;
      }
      var so = e.target.closest && e.target.closest('[data-signout]');
      if (so) { e.preventDefault(); (async function () { try { await G.sb.auth.signOut(); } catch (er) {} location.replace('login.html'); })(); }
    });
    G.updateThemeIcons();
  }

  // ---- Sidebar / topo ----
  var TONES = {
    primary: { bg: 'bg-primary-container', fg: 'text-on-primary-container' },
    secondary: { bg: 'bg-secondary-container', fg: 'text-on-secondary-container' },
    tertiary: { bg: 'bg-tertiary-container', fg: 'text-on-tertiary-container' },
  };
  G.topics = [];
  async function loadTopics() {
    if (G.sb) {
      try {
        var r = await G.sb.from('comu_topics').select('slug,name,icon,tone,description,position').eq('is_active', true).order('position');
        if (!r.error && r.data && r.data.length) {
          return r.data.map(function (t) { return { id: t.slug, name: t.name, icon: t.icon, tone: t.tone, desc: t.description || '' }; });
        }
      } catch (e) {}
    }
    return window.GVSI_TOPICS || [];
  }
  function topicItemHtml(t, activeId) {
    var tone = TONES[t.tone] || TONES.primary;
    var active = t.id === activeId;
    return '<a href="#/chat/' + t.id + '" data-slug="' + t.id + '" class="topic-item flex items-center gap-md p-md rounded-xl transition-colors cursor-pointer ' +
      (active ? 'bg-surface-container-high' : 'hover:bg-surface-container-low') + '">' +
      '<div class="w-12 h-12 rounded-full ' + tone.bg + ' flex items-center justify-center ' + tone.fg + ' shrink-0"><span class="material-symbols-outlined text-[24px]">' + t.icon + '</span></div>' +
      '<div class="flex-1 min-w-0"><h3 class="font-bold text-on-surface truncate">' + G.esc(t.name) + '</h3><p class="text-body-sm text-outline truncate">' + G.esc(t.desc) + '</p></div>' +
      '<span class="unread-badge hidden min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center">0</span>' +
      '<span class="material-symbols-outlined text-outline">chevron_right</span></a>';
  }
  G.renderTopicList = function (container, activeId) {
    if (!container) return;
    container.innerHTML = G.topics.map(function (t) { return topicItemHtml(t, activeId); }).join('');
  };
  G.applyUnread = async function () {
    if (!G.sb) return;
    try {
      var r = await G.sb.rpc('comu_unread_counts');
      if (r.error || !r.data) return;
      var map = {}; r.data.forEach(function (x) { map[x.slug] = Number(x.unread) || 0; });
      document.querySelectorAll('.topic-item').forEach(function (item) {
        var b = item.querySelector('.unread-badge'); if (!b) return;
        var n = map[item.dataset.slug] || 0;
        if (n > 0) { b.textContent = n > 99 ? '99+' : n; b.classList.remove('hidden'); } else { b.classList.add('hidden'); }
      });
    } catch (e) {}
  };
  G.updateSidebarProfile = function () {
    var m = G.me || {};
    document.querySelectorAll('[data-side-avatar]').forEach(function (el) {
      el.innerHTML = m.avatar_url ? '<img src="' + G.esc(m.avatar_url) + '" class="w-full h-full object-cover" alt="">' : '<span class="material-symbols-outlined text-[20px]">person</span>';
    });
    document.querySelectorAll('[data-side-name]').forEach(function (el) { el.textContent = m.full_name || 'Meu Perfil'; });
  };
  function setActive(route) {
    // o console de suporte é tela cheia própria → esconde a sidebar de tópicos
    var shellAside = document.querySelector('aside.fixed.inset-y-0');
    if (shellAside) shellAside.style.display = (route.name === 'suporte') ? 'none' : '';
    // tópico ativo na sidebar
    var activeSlug = route.name === 'chat' ? route.params.topico : '';
    document.querySelectorAll('#side-topics .topic-item').forEach(function (a) {
      var on = a.dataset.slug === activeSlug;
      a.classList.toggle('bg-surface-container-high', on);
      a.classList.toggle('hover:bg-surface-container-low', !on);
    });
    // link do perfil na sidebar
    var pl = document.querySelector('[data-side-profile]');
    if (pl) pl.classList.toggle('bg-surface-container-high', route.name === 'perfil');
  }
  G.setActive = setActive;

  // ---- Roteador ----
  function parseRoute() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h || h === '/') return { name: 'grupos', params: {} };
    var seg = h.replace(/^\//, '').split('/');
    if (seg[0] === 'chat') return { name: 'chat', params: { topico: decodeURIComponent(seg[1] || '') } };
    if (seg[0] === 'enviar') return { name: 'enviar', params: { topico: decodeURIComponent(seg[1] || '') } };
    if (seg[0] === 'perfil') return { name: 'perfil', params: {} };
    if (seg[0] === 'suporte') return { name: 'suporte', params: {} };
    if (seg[0] === 'grupos') return { name: 'grupos', params: {} };
    return { name: 'grupos', params: {} };
  }
  var current = null;
  async function render() {
    var route = parseRoute();
    var view = G.views[route.name] || G.views.grupos;
    if (current && current.destroy) { try { current.destroy(); } catch (e) {} }
    var el = document.getElementById('view');
    el.innerHTML = '';
    setActive(route);
    current = view;
    try { await view.render(el, route.params); } catch (e) { console.error('view error', e); }
    G.updateThemeIcons();
  }
  G.render = render;
  window.addEventListener('hashchange', render);

  // ---- Init (guarda de auth + carrega perfil + shell) ----
  document.addEventListener('DOMContentLoaded', async function () {
    if (!G.sb) { location.replace('login.html'); return; }
    var session = (await G.sb.auth.getSession()).data.session;
    if (!session) { location.replace('login.html'); return; }
    var user = (await G.sb.auth.getUser()).data.user;
    // perfil próprio + garante registro em lms_students
    var pr = await G.sb.from('lms_students').select('id,full_name,email,bio,phone,avatar_url,role').eq('id', user.id).maybeSingle();
    G.me = pr.data || { id: user.id, email: user.email, full_name: null, avatar_url: null, role: 'student' };
    if (!pr.data) {
      try { await G.sb.from('lms_students').upsert({ id: user.id, email: user.email, full_name: (user.user_metadata && user.user_metadata.full_name) || (user.email || '').split('@')[0] }, { onConflict: 'id', ignoreDuplicates: true }); } catch (e) {}
    }
    initTheme();
    G.updateSidebarProfile();
    G.topics = await loadTopics();
    G.renderTopicList(document.getElementById('side-topics'), '');
    G.applyUnread();
    if (!location.hash) { location.replace('#/'); }
    render();
  });
})();
