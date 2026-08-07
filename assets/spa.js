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
      return slugs[key] ? pre + '<a href="/chat/' + key + '" class="text-primary font-medium hover:underline">#' + slug + '</a>' : full;
    });
    out = out.replace(/(^|\s)@([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9_.]*)/g, '$1<span class="text-primary font-medium">@$2</span>');
    return out;
  };
  G.timeStr = function (iso) {
    try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  };
  // Rótulo curto p/ menu inicial (item #13): hoje -> HH:MM; senão -> DD/MM.
  G.shortWhen = function (iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso), now = new Date();
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate())
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch (e) { return ''; }
  };
  var _toastT;
  G.toast = function (msg) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(_toastT); _toastT = setTimeout(function () { el.classList.add('hidden'); }, 2600);
  };
  // ---- Divisória arrastável da lista lateral (desktop) — item #1 ----
  G.initSideResizer = function () {
    var r = document.getElementById('side-resizer'); if (!r || r._wired) return; r._wired = true;
    var MIN = 260, MAX = 560, dragging = false;
    function setW(px) { px = Math.max(MIN, Math.min(MAX, px)); document.documentElement.style.setProperty('--side-w', px + 'px'); return px; }
    r.addEventListener('pointerdown', function (e) { dragging = true; try { r.setPointerCapture(e.pointerId); } catch (x) {} document.body.style.userSelect = 'none'; document.body.style.cursor = 'col-resize'; e.preventDefault(); });
    r.addEventListener('pointermove', function (e) { if (dragging) setW(e.clientX); });
    function end(e) { if (!dragging) return; dragging = false; try { r.releasePointerCapture(e.pointerId); } catch (x) {} document.body.style.userSelect = ''; document.body.style.cursor = ''; var w = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--side-w'), 10); if (w) { try { localStorage.setItem('gvsi-side-w', w); } catch (x) {} } }
    r.addEventListener('pointerup', end); r.addEventListener('pointercancel', end);
    r.addEventListener('dblclick', function () { setW(360); try { localStorage.setItem('gvsi-side-w', 360); } catch (x) {} });
  };
  if (document.readyState !== 'loading') G.initSideResizer(); else document.addEventListener('DOMContentLoaded', G.initSideResizer);
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
      overlay.className = 'gvsi-sheet-overlay fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-0 sm:p-container-margin bg-black/50';
      var sheet = document.createElement('div');
      sheet.className = 'gvsi-sheet w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl shadow-2xl border border-outline-variant/40 p-lg space-y-md max-h-[90vh] overflow-y-auto custom-scrollbar';
      // cabeçalho com ícone (círculo vermelho se for ação perigosa)
      var iconWrap = '';
      if (opts.icon) {
        var hc = opts.danger ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary';
        iconWrap = '<span class="w-12 h-12 rounded-full ' + hc + ' flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[26px]">' + opts.icon + '</span></span>';
      }
      var head = '<div class="flex items-start gap-md">' + iconWrap +
        '<div class="min-w-0"><h3 class="font-headline-sm text-headline-sm text-on-surface">' + G.esc(opts.title || 'Escolha uma opção') + '</h3>' +
        (opts.text ? '<p class="text-body-sm text-on-surface-variant mt-1">' + G.esc(opts.text) + '</p>' : '') + '</div></div>';
      sheet.innerHTML = head;
      var list = document.createElement('div'); list.className = 'space-y-sm';
      var closing = false;
      function close(v) {
        if (closing) return; closing = true;
        document.removeEventListener('keydown', onKey);
        overlay.classList.add('gvsi-sheet-closing');
        setTimeout(function () { overlay.remove(); }, 130);
        resolve(v);
      }
      (opts.options || []).forEach(function (o) {
        var b = document.createElement('button'); b.type = 'button';
        b.className = 'w-full text-left rounded-2xl border p-md flex items-center gap-md transition active:scale-[0.99] ' +
          (o.danger ? 'border-error/30 bg-error/5 hover:bg-error/10' : 'border-outline-variant/60 bg-surface-container-low hover:bg-surface-container-high');
        var ic = o.icon ? '<span class="w-11 h-11 rounded-full flex items-center justify-center shrink-0 ' + (o.danger ? 'bg-error/15 text-error' : 'bg-primary/10 text-primary') + '"><span class="material-symbols-outlined text-[24px]">' + o.icon + '</span></span>' : '';
        var txt = '<span class="min-w-0 flex-1"><span class="block font-bold ' + (o.danger ? 'text-error' : 'text-on-surface') + '">' + G.esc(o.label) + '</span>' +
          (o.desc ? '<span class="block text-body-sm text-on-surface-variant mt-1">' + G.esc(o.desc) + '</span>' : '') + '</span>';
        b.innerHTML = ic + txt + '<span class="material-symbols-outlined text-outline shrink-0">chevron_right</span>';
        b.onclick = function () { close(o.value); };
        list.appendChild(b);
      });
      sheet.appendChild(list);
      var cancel = document.createElement('button'); cancel.type = 'button';
      cancel.className = 'w-full h-12 rounded-2xl border border-outline-variant text-on-surface font-bold active:scale-[0.99] transition hover:bg-surface-container-high';
      cancel.textContent = opts.cancel || 'Cancelar'; cancel.onclick = function () { close(null); };
      sheet.appendChild(cancel);
      overlay.appendChild(sheet); document.body.appendChild(overlay);
      overlay.onclick = function (e) { if (e.target === overlay) close(null); };
      function onKey(e) { if (e.key === 'Escape') close(null); }
      document.addEventListener('keydown', onKey);
    });
  };
  G.navigate = function (path) { if (location.pathname === path) { render(); } else { history.pushState(null, '', path); render(); } };

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

  // ---- 1º acesso: criar senha (item #13). Campos VISÍVEIS + aviso de maiúscula. ----
  G.showSetPassword = function () {
    if (document.getElementById('setpw-screen')) return;
    var ov = document.createElement('div');
    ov.id = 'setpw-screen';
    ov.className = 'fixed inset-0 z-[100] bg-background overflow-y-auto flex items-start sm:items-center justify-center p-container-margin';
    ov.innerHTML =
      '<div class="w-full max-w-md my-auto py-lg space-y-lg">' +
        '<div class="text-center space-y-sm">' +
          '<h1 class="font-headline-md text-headline-md text-on-surface">Complete seu cadastro</h1>' +
          '<p class="text-body-md text-on-surface-variant text-balance">É rapidinho: escolha uma foto, confirme seu nome e crie a sua senha.</p>' +
        '</div>' +
        '<div class="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm p-lg space-y-md">' +
          '<div><label class="block text-label-md font-label-md text-on-surface-variant mb-xs">Foto de perfil</label>' +
            '<button type="button" id="spw-avatar-btn" class="w-full flex items-center gap-md border rounded-xl p-3 text-left transition active:scale-[0.99] border-primary/40 bg-primary/5 hover:bg-primary/10" aria-label="Escolher foto">' +
              '<span id="spw-avatar" class="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary overflow-hidden shrink-0"><span class="material-symbols-outlined text-[30px]">add_a_photo</span></span>' +
              '<span class="flex-1 min-w-0"><span id="spw-avatar-txt" class="block text-body-md font-bold text-on-surface">Toque para adicionar sua foto</span><span class="block text-body-sm text-on-surface-variant">Ajuda a comunidade a te reconhecer</span></span>' +
              '<span class="material-symbols-outlined text-primary shrink-0">photo_camera</span>' +
            '</button>' +
            '<input id="spw-avatar-input" type="file" accept="image/*" class="hidden">' +
          '</div>' +
          '<div><label for="spw-name" class="block text-label-md font-label-md text-on-surface-variant mb-xs">Seu nome</label><input id="spw-name" type="text" autocomplete="name" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-4 px-4 text-body-lg text-on-surface focus:ring-2 focus:ring-primary" placeholder="Como você quer ser chamado(a)"></div>' +
          '<div><label for="spw1" class="block text-label-md font-label-md text-on-surface-variant mb-xs">Crie uma senha</label><input id="spw1" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-4 px-4 text-body-lg text-on-surface focus:ring-2 focus:ring-primary" placeholder="Digite uma senha"></div>' +
          '<div><label for="spw2" class="block text-label-md font-label-md text-on-surface-variant mb-xs">Repita a senha</label><input id="spw2" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-4 px-4 text-body-lg text-on-surface focus:ring-2 focus:ring-primary" placeholder="Digite a mesma senha de novo"></div>' +
          '<div id="spw-caps" class="hidden items-center gap-sm bg-tertiary-container/40 text-on-tertiary-container rounded-xl px-3 py-2 text-body-sm"><span class="material-symbols-outlined text-[20px]">keyboard_capslock</span><span>Sua senha tem <b>LETRA MAIÚSCULA</b>. Guarde bem, vai precisar digitar igual depois.</span></div>' +
          '<p id="spw-msg" class="text-body-md text-center min-h-6"></p>' +
          '<button id="spw-save" type="button" disabled class="w-full h-14 bg-primary text-on-primary rounded-xl font-headline-sm text-headline-sm flex items-center justify-center gap-sm shadow-md active:scale-[0.98] transition disabled:opacity-50">Salvar e entrar</button>' +
        '</div>' +
        '<p class="text-center text-body-sm text-on-surface-variant text-balance">A senha aparece na tela de propósito, pra você conferir o que está digitando.</p>' +
      '</div>';
    document.body.appendChild(ov);
    var nameEl = ov.querySelector('#spw-name'), p1 = ov.querySelector('#spw1'), p2 = ov.querySelector('#spw2');
    var caps = ov.querySelector('#spw-caps'), msg = ov.querySelector('#spw-msg'), btn = ov.querySelector('#spw-save');
    var avBtn = ov.querySelector('#spw-avatar-btn'), avInput = ov.querySelector('#spw-avatar-input'), avEl = ov.querySelector('#spw-avatar'), avatarFile = null;
    nameEl.value = (G.me && G.me.full_name) || '';
    var avTxt = ov.querySelector('#spw-avatar-txt');
    function avChosen() { if (avTxt) avTxt.textContent = 'Foto escolhida — toque para trocar'; avBtn.className = 'w-full flex items-center gap-md border rounded-xl p-3 text-left transition active:scale-[0.99] border-outline-variant bg-surface-container-low hover:bg-surface-container'; }
    if (G.me && G.me.avatar_url) { avEl.innerHTML = '<img src="' + G.esc(G.me.avatar_url) + '" class="w-full h-full object-cover" alt="">'; avChosen(); }
    avBtn.addEventListener('click', function () { avInput.click(); });
    avInput.addEventListener('change', function () { var f = this.files[0]; if (!f) return; avatarFile = f; avEl.innerHTML = '<img src="' + URL.createObjectURL(f) + '" class="w-full h-full object-cover" alt="">'; avChosen(); });
    var MIN = 6;
    function validate() {
      var a = p1.value, b = p2.value, nm = nameEl.value.trim();
      caps.classList.toggle('hidden', !/[A-Z]/.test(a));
      caps.style.display = /[A-Z]/.test(a) ? 'flex' : '';
      var ok = false, m = '', cls = 'text-error';
      if (!nm) { m = 'Escreva o seu nome.'; }
      else if (!a) { m = ''; }
      else if (a.length < MIN) { m = 'A senha precisa ter pelo menos ' + MIN + ' caracteres.'; }
      else if (!b) { m = ''; }
      else if (a !== b) { m = 'As duas senhas não estão iguais.'; }
      else { ok = true; m = 'Tudo certo! Pode salvar.'; cls = 'text-primary'; }
      msg.textContent = m; msg.className = 'text-body-md text-center min-h-6 ' + cls;
      btn.disabled = !ok;
      return ok;
    }
    nameEl.addEventListener('input', validate); p1.addEventListener('input', validate); p2.addEventListener('input', validate);
    btn.addEventListener('click', async function () {
      if (!validate()) return;
      btn.disabled = true; btn.textContent = 'Salvando...';
      try {
        var up = await G.sb.auth.updateUser({ password: p1.value });
        if (up.error) throw up.error;
        var patch = { full_name: nameEl.value.trim(), needs_password: false };
        if (avatarFile) {
          try {
            var ext = (avatarFile.name.split('.').pop() || 'jpg').toLowerCase();
            var path = 'avatars/' + G.me.id + '/' + Date.now() + '.' + ext;
            var upl = await G.sb.storage.from('comu-media').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type || undefined });
            if (!upl.error) patch.avatar_url = G.sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
          } catch (e) {}
        }
        try { await G.sb.from('lms_students').update(patch).eq('id', G.me.id); } catch (e) {}
        if (G.me) { G.me.full_name = patch.full_name; if (patch.avatar_url) G.me.avatar_url = patch.avatar_url; G.me.needs_password = false; }
        if (G.updateSidebarProfile) G.updateSidebarProfile();
        ov.remove();
        if (G.toast) G.toast('Tudo pronto! Bem-vindo(a) à comunidade.');
        if (G.showOnboarding) G.showOnboarding(); // tour guiado no 1º acesso
      } catch (e) {
        msg.textContent = (e && e.message) ? e.message : 'Não foi possível salvar. Tente de novo.';
        msg.className = 'text-body-md text-center text-error';
        btn.disabled = false; btn.textContent = 'Salvar e entrar';
      }
    });
    try { nameEl.focus(); } catch (e) {}
  };

  // ---- Onboarding guiado: painel aberto, ilumina cada grupo de verdade (coach-marks) ----
  G.showOnboarding = function () {
    if (document.getElementById('onb-screen')) return;
    if (location.pathname !== '/') G.navigate('/');
    setTimeout(start, 160); // deixa a home/sidebar montar
    function pickGroupItems() {
      var mob = [].slice.call(document.querySelectorAll('#topic-list .topic-item')).filter(function (e) { return e.offsetParent !== null; });
      if (mob.length) return mob;
      return [].slice.call(document.querySelectorAll('#side-topics .topic-item')).filter(function (e) { return e.offsetParent !== null; });
    }
    function start() {
      var items = pickGroupItems();
      var steps = [{ el: null, title: 'Bem-vindo à Comunidade GVSI!', text: 'Vou te apresentar rapidinho cada grupo, pra você saber onde fica cada coisa. É só ir tocando em "Próximo".' }];
      items.forEach(function (it) {
        var h = it.querySelector('h3'); var pv = it.querySelector('.topic-preview');
        steps.push({ el: it, title: h ? h.textContent : 'Grupo', text: (pv && pv.dataset.desc) || 'Toque neste grupo para abrir a conversa.' });
      });
      steps.push({ el: null, title: 'Pronto, é só isso!', text: 'Agora é só escolher um grupo e começar. Quando quiser rever, toque no botão "Tutorial" no canto da tela.' });
      run(steps);
    }
    function run(steps) {
      var i = 0;
      var ov = document.createElement('div'); ov.id = 'onb-screen'; ov.className = 'fixed inset-0 z-[101]';
      var hole = document.createElement('div'); hole.style.cssText = 'position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(0,0,0,.72);transition:all .25s ease;pointer-events:none;display:none;';
      var ring = document.createElement('div'); ring.style.cssText = 'position:fixed;border-radius:14px;border:3px solid rgb(var(--c-primary));box-shadow:0 0 0 4px rgb(var(--c-primary) / .3);transition:all .25s ease;pointer-events:none;display:none;';
      var card = document.createElement('div'); card.className = 'fixed z-[102] w-[min(92vw,360px)] bg-surface-container-lowest border border-outline-variant/50 rounded-2xl shadow-2xl p-lg';
      ov.appendChild(hole); ov.appendChild(ring); document.body.appendChild(ov); document.body.appendChild(card);
      function done() { try { localStorage.setItem('gvsi-onboarded', '1'); } catch (e) {} window.removeEventListener('resize', reflow); window.removeEventListener('scroll', reflow, true); ov.remove(); card.remove(); }
      function reflow() { var s = steps[i]; if (s && s.el) placeOn(s.el); }
      function placeOn(el) {
        var r = el.getBoundingClientRect(); var pad = 6;
        hole.style.display = 'block'; ring.style.display = 'block';
        [hole, ring].forEach(function (b) { b.style.left = (r.left - pad) + 'px'; b.style.top = (r.top - pad) + 'px'; b.style.width = (r.width + pad * 2) + 'px'; b.style.height = (r.height + pad * 2) + 'px'; });
        card.style.transform = 'none';
        var cw = card.offsetWidth, ch = card.offsetHeight, vw = window.innerWidth, vh = window.innerHeight, m = 12, left, top;
        if (r.right + m + cw <= vw - 8) { left = r.right + m; top = Math.min(Math.max(8, r.top), vh - ch - 8); }
        else if (r.bottom + m + ch <= vh - 8) { left = Math.min(Math.max(8, r.left), vw - cw - 8); top = r.bottom + m; }
        else { left = Math.min(Math.max(8, r.left), vw - cw - 8); top = Math.max(8, r.top - ch - m); }
        card.style.left = left + 'px'; card.style.top = top + 'px';
      }
      function place() {
        var s = steps[i];
        card.innerHTML = '<h3 class="font-headline-sm text-headline-sm text-on-surface mb-xs">' + G.esc(s.title) + '</h3>' +
          '<p class="text-body-md text-on-surface-variant">' + G.esc(s.text) + '</p>' +
          '<div class="flex items-center justify-between mt-md gap-sm"><button type="button" class="onb-skip text-body-sm text-on-surface-variant underline shrink-0">Pular</button>' +
          '<div class="flex gap-sm">' + (i > 0 ? '<button type="button" class="onb-back h-11 px-4 rounded-xl border border-outline-variant text-on-surface font-label-md">Voltar</button>' : '') +
          '<button type="button" class="onb-next h-11 px-5 rounded-xl bg-primary text-on-primary font-label-md">' + (i === steps.length - 1 ? 'Concluir' : 'Próximo') + '</button></div></div>';
        card.querySelector('.onb-next').onclick = function () { if (i < steps.length - 1) { i++; place(); } else done(); };
        var bk = card.querySelector('.onb-back'); if (bk) bk.onclick = function () { if (i > 0) { i--; place(); } };
        card.querySelector('.onb-skip').onclick = done;
        if (s.el) { ov.style.background = 'transparent'; try { s.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} setTimeout(function () { placeOn(s.el); }, 260); }
        else { ov.style.background = 'rgba(0,0,0,.72)'; hole.style.display = 'none'; ring.style.display = 'none'; card.style.left = '50%'; card.style.top = '50%'; card.style.transform = 'translate(-50%,-50%)'; }
      }
      window.addEventListener('resize', reflow); window.addEventListener('scroll', reflow, true);
      place();
    }
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
      if (so) { e.preventDefault(); (async function () { try { await G.sb.auth.signOut(); } catch (er) {} location.replace('/login'); })(); }
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
  function topicTime(slug) { var m = G.lastMsgs[slug]; return m && m.created_at ? G.shortWhen(m.created_at) : ''; }
  G.applyTopicPreviews = function () {
    document.querySelectorAll('.topic-item').forEach(function (item) {
      var p = item.querySelector('.topic-preview');
      if (p) { var html = topicPreview(item.dataset.slug); if (html) p.innerHTML = html; else p.textContent = p.dataset.desc || ''; }
      var t = item.querySelector('.topic-time'); if (t) t.textContent = topicTime(item.dataset.slug);
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
    return '<a href="/chat/' + t.id + '" data-slug="' + t.id + '" class="topic-item flex items-center gap-md p-md rounded-xl transition-colors cursor-pointer ' +
      (active ? 'bg-surface-container-high' : 'hover:bg-surface-container-low') + '">' +
      '<div class="w-12 h-12 rounded-full ' + tone.bg + ' flex items-center justify-center ' + tone.fg + ' shrink-0"><span class="material-symbols-outlined text-[24px]">' + t.icon + '</span></div>' +
      '<div class="flex-1 min-w-0"><h3 class="font-bold text-on-surface truncate">' + G.esc(t.name) + '</h3><p class="topic-preview text-body-sm text-on-surface-variant truncate" data-desc="' + G.esc(t.desc) + '">' + (topicPreview(t.id) || G.esc(t.desc)) + '</p></div>' +
      '<div class="flex flex-col items-end gap-1 shrink-0 ml-1"><span class="topic-time text-[12px] text-on-surface-variant/80 tabular-nums whitespace-nowrap">' + topicTime(t.id) + '</span>' +
      '<span class="unread-badge hidden min-w-[24px] h-6 px-1.5 rounded-full bg-primary text-on-primary text-[13px] font-bold flex items-center justify-center">0</span></div></a>';
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
    // sidebar de tópicos sempre visível (o console de suporte agora fica ao lado dela — item #2)
    var shellAside = document.querySelector('aside.fixed.inset-y-0');
    if (shellAside) shellAside.style.display = '';
    // botão flutuante "Tutorial": só nas telas calmas (home/perfil), pra não cobrir o Enviar
    var fab = document.getElementById('onb-fab');
    if (fab) { if (!fab._wired) { fab._wired = true; fab.addEventListener('click', function () { if (G.showOnboarding) G.showOnboarding(); }); } fab.style.display = (route.name === 'grupos' || route.name === 'perfil') ? 'flex' : 'none'; }
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
    var h = location.pathname || '/';
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
    try { var _p = location.pathname; if (_p && _p !== '/') localStorage.setItem('gvsi-route', _p); } catch (e) {}
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
  window.addEventListener('popstate', render);
  // Intercepta cliques em links internos (rota por caminho, sem recarregar a página).
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (a.target === '_blank' || a.hasAttribute('download') || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var href = a.getAttribute('href');
    if (!href) return;
    if (href.charAt(0) === '#') { e.preventDefault(); return; }               // âncora (ex.: #conquistas) — no-op
    if (href.charAt(0) === '/' && href.charAt(1) !== '/') { e.preventDefault(); G.navigate(href); }  // rota interna
  });

  // ---- Init (guarda de auth + carrega perfil + shell) ----
  document.addEventListener('DOMContentLoaded', async function () {
    if (!G.sb) { location.replace('/login'); return; }
    var session = (await G.sb.auth.getSession()).data.session;
    if (!session) { location.replace('/login'); return; }
    var user = (await G.sb.auth.getUser()).data.user;
    // perfil próprio + garante registro em lms_students
    var pr = await G.sb.from('lms_students').select('id,full_name,email,bio,phone,avatar_url,role,needs_password').eq('id', user.id).maybeSingle();
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
    if (location.pathname === '/') { var _r; try { _r = localStorage.getItem('gvsi-route'); } catch (e) {} if (_r && _r.charAt(0) === '/' && _r !== '/') history.replaceState(null, '', _r); }
    render();
    if (G.me && G.me.needs_password) G.showSetPassword(); // 1º acesso → cria senha
  });
})();
