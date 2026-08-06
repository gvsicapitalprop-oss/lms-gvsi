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
  // Formatação leve (estilo WhatsApp/markdown) -> HTML seguro.
  // Escapa TUDO primeiro, depois aplica só as tags permitidas.
  G.fmt = function (s) {
    var out = G.esc(s);
    out = out.replace(/`([^`\n]+)`/g, '<code class="px-1 py-0.5 rounded bg-black/10 dark:bg-white/20 text-[0.92em]">$1</code>');
    out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');       // **negrito**
    out = out.replace(/(^|[^\w*])\*([^*\n]+)\*(?![\w*])/g, '$1<em>$2</em>'); // *itálico*
    out = out.replace(/(^|[^\w_])_([^_\n]+)_(?![\w_])/g, '$1<em>$2</em>');   // _itálico_
    out = out.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');                   // ~~tachado~~
    // menções: #tópico (só slug conhecido vira link) e @pessoa (destaque)
    var slugs = {}; (G.topics || []).forEach(function (t) { if (t && t.id) slugs[String(t.id).toLowerCase()] = true; });
    out = out.replace(/(^|\s)#([A-Za-z0-9][A-Za-z0-9_-]*)/g, function (full, pre, slug) {
      var key = slug.toLowerCase();
      return slugs[key] ? pre + '<a href="#/chat/' + key + '" class="text-primary font-medium hover:underline">#' + slug + '</a>' : full;
    });
    out = out.replace(/(^|\s)@([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9_.]*)/g, '$1<span class="text-primary font-medium">@$2</span>');
    return out;
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
  // Som de notificação ao chegar mensagem nova de outra pessoa.
  G.playPing = function () {
    var now = Date.now();
    if (G._pingAt && now - G._pingAt < 300) return;        // no máx ~3 toques/seg
    G._pingAt = now;
    try {
      if (!G._ping) { G._ping = new Audio('assets/ping.mp3?v=4'); G._ping.preload = 'auto'; G._ping.volume = 0.6; }
      G._ping.currentTime = 0;
      var pr = G._ping.play();
      if (pr && pr.catch) pr.catch(function () {});          // autoplay bloqueado: ignora
    } catch (e) {}
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
  G.chooseAction = function (opts) {
    return new Promise(function (resolve) {
      opts = opts || {};
      var overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-container-margin bg-black/40';
      var sheet = document.createElement('div');
      sheet.className = 'w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg space-y-xs';
      var head = '<h3 class="font-headline-sm text-headline-sm text-on-surface">' + G.esc(opts.title || 'Escolha uma opção') + '</h3>';
      if (opts.text) head += '<p class="text-body-sm text-on-surface-variant pb-xs">' + G.esc(opts.text) + '</p>';
      sheet.innerHTML = head;
      function close(v) { overlay.remove(); resolve(v); }
      (opts.options || []).forEach(function (o) {
        var b = document.createElement('button'); b.type = 'button';
        b.className = 'w-full text-left min-h-12 py-2 px-3 rounded-xl font-label-md text-label-md flex items-center gap-sm transition ' + (o.danger ? 'text-error hover:bg-error/10' : 'text-on-surface hover:bg-surface-container-high');
        b.innerHTML = (o.icon ? '<span class="material-symbols-outlined text-[20px] shrink-0">' + o.icon + '</span>' : '') + '<span>' + G.esc(o.label) + '</span>';
        b.onclick = function () { close(o.value); };
        sheet.appendChild(b);
      });
      var cancel = document.createElement('button'); cancel.type = 'button';
      cancel.className = 'w-full h-11 mt-xs rounded-xl border border-outline-variant text-on-surface-variant font-label-md';
      cancel.textContent = 'Cancelar'; cancel.onclick = function () { close(null); };
      sheet.appendChild(cancel);
      overlay.appendChild(sheet); document.body.appendChild(overlay);
      overlay.onclick = function (e) { if (e.target === overlay) close(null); };
    });
  };
  G.navigate = function (hash) { if (location.hash === hash) render(); else location.hash = hash; };

  // Tela de "demissão" (banimento) — ocupa tudo, imagem passando no fundo
  G.showBanned = function () {
    if (document.getElementById('banned-screen')) return;
    try { document.querySelectorAll('aside, #view, #confirm-modal, #toast').forEach(function (el) { el.style.display = 'none'; }); } catch (e) {}
    var wrap = document.createElement('div'); wrap.id = 'banned-screen';
    wrap.innerHTML =
      '<style>' +
      '#banned-screen{position:fixed;inset:0;z-index:99999;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center}' +
      '#banned-screen .bbg{position:absolute;inset:-40%;background:url("assets/banido.png") repeat;background-size:300px auto;opacity:.5;filter:contrast(1.15) brightness(.9);animation:bslide 16s linear infinite}' +
      '@keyframes bslide{from{background-position:0 0}to{background-position:-1400px -700px}}' +
      '#banned-screen .btxt{position:relative;color:#ff1f1f;font-family:Inter,system-ui,sans-serif;font-weight:900;font-size:clamp(2.2rem,10vw,7rem);text-align:center;letter-spacing:.06em;line-height:1.05;text-shadow:0 0 26px rgba(255,0,0,.85),0 6px 10px #000;animation:bpulse 1.1s ease-in-out infinite;padding:0 16px;user-select:none}' +
      '@keyframes bpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.07);opacity:.8}}' +
      '</style>' +
      '<div class="bbg"></div><h1 class="btxt">VOCÊ FOI DEMITIDO</h1>';
    document.body.appendChild(wrap);
    try { document.title = 'VOCÊ FOI DEMITIDO'; } catch (e) {}
  };

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
  // ---- preview da última mensagem no menu (dinâmico) ----
  G.lastMsgs = {};
  function msgPreviewHtml(m) {
    if (!m) return '';
    if (m.kind === 'system') return G.esc((m.body || '').replace(/\s+/g, ' ').trim());
    var who = m.author_name ? G.esc(String(m.author_name).trim().split(/\s+/)[0]) + ': ' : '';
    if (m.kind === 'image') return who + 'Foto';
    if (m.kind === 'video') return who + 'Vídeo';
    if (m.kind === 'audio') return who + 'Áudio';
    return who + G.esc((m.body || '').replace(/\s+/g, ' ').trim());
  }
  function topicPreview(slug) { return msgPreviewHtml(G.lastMsgs[slug]); }
  G.applyTopicPreviews = function () {
    document.querySelectorAll('#side-topics .topic-item').forEach(function (item) {
      var p = item.querySelector('.topic-preview'); if (!p) return;
      var html = topicPreview(item.dataset.slug);
      if (html) p.innerHTML = html; else p.textContent = p.dataset.desc || '';
    });
  };
  G.loadLastMessages = async function () {
    if (!G.sb) return;
    try {
      var r = await G.sb.rpc('comu_topic_last_messages');
      if (r.error || !r.data) return;
      var map = {}; r.data.forEach(function (x) { map[x.slug] = { body: x.body, kind: x.kind, author_name: x.author_name, created_at: x.created_at }; });
      G.lastMsgs = map;
      G.applyTopicPreviews();
    } catch (e) {}
  };
  function topicItemHtml(t, activeId) {
    var tone = TONES[t.tone] || TONES.primary;
    var active = t.id === activeId;
    return '<a href="#/chat/' + t.id + '" data-slug="' + t.id + '" class="topic-item flex items-center gap-md p-md rounded-xl transition-colors cursor-pointer ' +
      (active ? 'bg-surface-container-high' : 'hover:bg-surface-container-low') + '">' +
      '<div class="w-12 h-12 rounded-full ' + tone.bg + ' flex items-center justify-center ' + tone.fg + ' shrink-0"><span class="material-symbols-outlined text-[24px]">' + t.icon + '</span></div>' +
      '<div class="flex-1 min-w-0"><h3 class="font-bold text-on-surface truncate">' + G.esc(t.name) + '</h3><p class="topic-preview text-body-sm text-on-surface-variant truncate" data-desc="' + G.esc(t.desc) + '">' + (topicPreview(t.id) || G.esc(t.desc)) + '</p></div>' +
      '<span class="unread-badge hidden min-w-[24px] h-6 px-1.5 rounded-full bg-primary text-on-primary text-[13px] font-bold flex items-center justify-center">0</span>' +
      '<span class="material-symbols-outlined text-outline">chevron_right</span></a>';
  }
  var TOPIC_GROUPS = [
    { title: 'Ajuda', slugs: ['suporte'] },
    { title: 'Conversas', slugs: ['prints', 'geral', 'resultados'] },
    { title: 'Publicações da GVSI', slugs: ['tutoriais', 'recados', 'desafio', 'arquivos'] }
  ];
  function groupHeaderHtml(title) {
    return '<div class="topic-group-header px-md pt-md pb-xs text-label-md font-label-md text-on-surface-variant/80 uppercase tracking-wide">' + G.esc(title) + '</div>';
  }
  G.renderTopicList = function (container, activeId) {
    if (!container) return;
    var byId = {}; G.topics.forEach(function (t) { byId[t.id] = t; });
    var used = {}, html = '';
    TOPIC_GROUPS.forEach(function (g) {
      var items = g.slugs.map(function (s) { return byId[s]; }).filter(Boolean);
      if (!items.length) return;
      items.forEach(function (t) { used[t.id] = 1; });
      html += groupHeaderHtml(g.title) + items.map(function (t) { return topicItemHtml(t, activeId); }).join('');
    });
    var rest = G.topics.filter(function (t) { return !used[t.id]; });
    if (rest.length) html += (Object.keys(used).length ? groupHeaderHtml('Outros') : '') + rest.map(function (t) { return topicItemHtml(t, activeId); }).join('');
    container.innerHTML = html;
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
    try { if (location.hash) localStorage.setItem('gvsi-route', location.hash); } catch (e) {}
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
    // banimento: se estiver banido, mostra a tela de demissão e para por aqui
    try { var _ban = await G.sb.from('comu_bans').select('user_id').eq('user_id', user.id).maybeSingle(); if (_ban.data) { G.showBanned(); return; } } catch (e) {}
    // quem pode banir (allowlist) + "demissão" em tempo real
    try { var _cb = await G.sb.from('comu_banners').select('user_id').eq('user_id', user.id).maybeSingle(); G.me.canBan = !!(_cb && _cb.data); } catch (e) { G.me.canBan = false; }
    try { G.sb.channel('comu-ban-self').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_bans', filter: 'user_id=eq.' + user.id }, function () { G.showBanned(); }).subscribe(); } catch (e) {}
    initTheme();
    G.updateSidebarProfile();
    G.topics = await loadTopics();
    G.renderTopicList(document.getElementById('side-topics'), '');
    G.applyUnread();
    G.loadLastMessages();
    // Badges/preview da sidebar: por POLL leve (15s) + ao voltar o foco — NÃO
    // por postgres_changes global, que não escala (1 msg = 1 leitura RLS por
    // usuário conectado). As mensagens do tópico ABERTO já chegam via Broadcast.
    function refreshSidebar() { if (document.hidden) return; G.applyUnread(); G.loadLastMessages(); }
    if (G._sidebarPoll) clearInterval(G._sidebarPoll);
    G._sidebarPoll = setInterval(refreshSidebar, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshSidebar(); });
    if (!location.hash) { var _r; try { _r = localStorage.getItem('gvsi-route'); } catch (e) {} location.replace(_r && _r.charAt(0) === '#' ? _r : '#/'); }
    render();
  });
})();
