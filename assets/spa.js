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
  G.fmt = function (s, linkify) {
    var out = G.esc(s);
    out = out.replace(/`([^`\n]+)`/g, '<code class="px-1 py-0.5 rounded bg-black/10 dark:bg-white/20 text-[0.92em]">$1</code>');
    out = out.replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>'); // ***negrito+itálico***
    out = out.replace(/\*\*([^\n]+?)\*\*(?!\*)/g, function (_m, inner) { return '<strong>' + inner.replace(/(^|[^*])\*([^*<\n]+?)\*(?!\*)/g, '$1<em>$2</em>') + '</strong>'; }); // **negrito** (fecha no ÚLTIMO **, deixa *itálico* no fim virar tag)
    out = out.replace(/(^|[^\w*])\*([^*<\n]+?)\*(?![\w*])/g, '$1<em>$2</em>'); // *itálico*
    out = out.replace(/(^|[^\w_])_([^_\n]+)_(?![\w_])/g, '$1<em>$2</em>');   // _itálico_
    out = out.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');                   // ~~tachado~~
    // menções: #tópico (só slug conhecido vira link) e @pessoa (destaque)
    var slugs = {}; (G.topics || []).forEach(function (t) { if (t && t.id) slugs[String(t.id).toLowerCase()] = true; });
    out = out.replace(/(^|\s)#([A-Za-z0-9][A-Za-z0-9_-]*)/g, function (full, pre, slug) {
      var key = slug.toLowerCase();
      return slugs[key] ? pre + '<a href="/chat/' + key + '" class="text-primary font-medium hover:underline">#' + slug + '</a>' : full;
    });
    out = out.replace(/(^|\s)@([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9_.]*)/g, '$1<span class="text-primary font-medium">@$2</span>');
    if (linkify) out = out.replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi, function (u) { var tail = ''; var mm = u.match(/[.,;:!?)\]]+$/); if (mm) { tail = mm[0]; u = u.slice(0, -tail.length); } var href = /^https?:/i.test(u) ? u : 'https://' + u; return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" class="text-primary underline break-all">' + u + '</a>' + tail; });
    return out;
  };
  // Exibição: só os 2 primeiros nomes (o nome completo continua no banco).
  G.shortName = function (name) { var s = String(name || '').trim(); if (/^Suporte\b/i.test(s)) return s; var p = s.split(/\s+/).filter(Boolean); return p.slice(0, 2).join(' '); };
  G.humanSize = function (n) { n = +n || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B'); };
  // Rótulo de dia para os divisores de conversa (Hoje / Ontem / DD/MM/AAAA)
  G.dayLabel = function (iso) { try { var d = new Date(iso), now = new Date(); var a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(now.getFullYear(), now.getMonth(), now.getDate()); var diff = Math.round((b - a) / 86400000); if (diff === 0) return 'Hoje'; if (diff === 1) return 'Ontem'; return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return ''; } };
  // Normaliza texto p/ busca: minúsculas + remove acentos (Débora -> debora)
  G.deburr = function (s) { try { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { return String(s == null ? '' : s).toLowerCase(); } };
  // Modal de entrada de texto (substitui window.prompt do navegador)
  G.promptDialog = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var ov = document.createElement('div'); ov.className = 'fixed inset-0 z-[97] flex items-center justify-center p-container-margin bg-black/40';
      var panel = document.createElement('div'); panel.className = 'w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg space-y-md';
      panel.innerHTML = '<h3 class="font-headline-sm text-headline-sm text-on-surface">' + G.esc(opts.title || '') + '</h3>'
        + (opts.text ? '<p class="text-body-sm text-on-surface-variant">' + G.esc(opts.text) + '</p>' : '')
        + '<input id="pd-input" type="' + (opts.type || 'text') + '" autocomplete="' + (opts.type === 'password' ? 'new-password' : 'off') + '" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other" name="pd-field-' + Math.floor(Date.now() % 1e6) + '" class="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-body-md text-on-surface focus:ring-2 focus:ring-primary/30" placeholder="' + G.esc(opts.placeholder || '') + '" value="' + G.esc(opts.value || '') + '">'
        + '<div class="flex gap-sm justify-end pt-sm"><button type="button" id="pd-cancel" class="h-10 px-4 rounded-full text-on-surface font-label-md hover:bg-surface-container-high">Cancelar</button><button type="button" id="pd-ok" class="h-10 px-4 rounded-full bg-primary text-on-primary font-label-md active:scale-95 transition">' + G.esc(opts.ok || 'Salvar') + '</button></div>';
      ov.appendChild(panel); document.body.appendChild(ov);
      var input = panel.querySelector('#pd-input');
      function done(v) { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); }
      function onKey(e) { if (e.key === 'Escape') done(null); else if (e.key === 'Enter') { e.preventDefault(); done(input.value); } }
      panel.querySelector('#pd-cancel').onclick = function () { done(null); };
      panel.querySelector('#pd-ok').onclick = function () { done(input.value); };
      ov.addEventListener('click', function (e) { if (e.target === ov) done(null); });
      document.addEventListener('keydown', onKey);
      setTimeout(function () { if (opts.type === 'password') input.value = opts.value || ''; input.focus(); input.select(); }, 30);
      setTimeout(function () { if (opts.type === 'password' && input.value !== (opts.value || '')) input.value = opts.value || ''; }, 200);
    });
  };
  // Player de áudio customizado: corrige a duração de WebM (MediaRecorder não grava metadata,
  // o que deixa a barra/tempo "fora de sincronia" no player nativo) e permite velocidade até 2.5x.
  G.audioHtml = function (url, mine, knownDur) {
    var e = G.esc, accent = mine ? '#ffffff' : '#8300E9';
    var wrap = mine ? 'bg-white/15' : 'bg-black/10 dark:bg-white/10';
    var fg = mine ? 'text-white' : 'text-on-surface', sub = mine ? 'text-white/80' : 'text-on-surface-variant';
    var pbtn = mine ? 'bg-white/25 text-white' : 'bg-primary text-on-primary';
    var kd = (typeof knownDur === 'number' && isFinite(knownDur) && knownDur > 0 && knownDur < 86400) ? (' data-known-dur="' + Math.round(knownDur) + '"') : '';
    return '<div data-gvsi-audio' + kd + ' class="flex items-center gap-2 rounded-full px-2 py-1.5 ' + wrap + ' w-[260px] max-w-full">'
      + '<audio preload="metadata" src="' + e(url) + '" class="hidden"></audio>'
      + '<button type="button" class="ga-play shrink-0 w-9 h-9 rounded-full flex items-center justify-center ' + pbtn + '"><span class="material-symbols-outlined text-[22px]">play_arrow</span></button>'
      + '<span class="ga-cur text-[12px] tabular-nums shrink-0 ' + fg + '">0:00</span>'
      + '<input type="range" class="ga-seek flex-1 h-1 cursor-pointer" min="0" max="1000" value="0" style="min-width:50px;accent-color:' + accent + '">'
      + '<span class="ga-dur text-[12px] tabular-nums shrink-0 ' + sub + '">0:00</span>'
      + '<button type="button" class="ga-speed shrink-0 text-[12px] font-bold w-8 text-center ' + fg + '" title="Velocidade">1x</button>'
      + '</div>';
  };
  G.mountAudios = function (root) {
    var scope = root || document;
    var els = scope.querySelectorAll ? scope.querySelectorAll('[data-gvsi-audio]:not([data-ga-init])') : [];
    Array.prototype.forEach.call(els, function (el) {
      el.setAttribute('data-ga-init', '1');
      var audio = el.querySelector('audio'), play = el.querySelector('.ga-play'), icon = play.querySelector('.material-symbols-outlined');
      var cur = el.querySelector('.ga-cur'), dur = el.querySelector('.ga-dur'), seek = el.querySelector('.ga-seek'), speed = el.querySelector('.ga-speed');
      var SPEEDS = [1, 1.5, 2, 2.5], si = 0, fixed = false, seeking = false;
      var known = parseFloat(el.getAttribute('data-known-dur') || ''); // duração guardada na gravação = fonte confiável
      function fmt(t) { if (!isFinite(t) || t < 0) t = 0; var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' + s : s); }
      function sane(d) { return isFinite(d) && d > 0 && d < 7200; } // WebM às vezes reporta Infinity ou nº absurdo; áudio de suporte é curto (< 2h)
      function dval() { return sane(audio.duration) ? audio.duration : (sane(known) ? known : 0); } // duração efetiva (usa a guardada quando o arquivo mente)
      if (sane(known)) { fixed = true; dur.textContent = fmt(known); }
      // Sem duração guardada e vindo corrompida (WebM/opus do MediaRecorder): tenta forçar o cálculo pra mostrar o total.
      audio.addEventListener('loadedmetadata', function () { if (sane(audio.duration)) { fixed = true; dur.textContent = fmt(audio.duration); } else if (!sane(known)) { fixDuration(); } });
      function fixDuration() {
        return new Promise(function (res) {
          if (fixed || sane(audio.duration)) { fixed = true; if (sane(audio.duration)) dur.textContent = fmt(audio.duration); return res(); }
          var done = function () { if (!sane(audio.duration)) return; audio.removeEventListener('durationchange', done); fixed = true; dur.textContent = fmt(audio.duration); try { audio.currentTime = 0; } catch (e) {} res(); };
          audio.addEventListener('durationchange', done);
          try { audio.currentTime = 1e101; } catch (e) { res(); }
          setTimeout(function () { if (!fixed) { audio.removeEventListener('durationchange', done); fixed = true; try { audio.currentTime = 0; } catch (e) {} res(); } }, 1500);
        });
      }
      function onTime() { if (seeking) return; var d = dval(); if (d > 0) seek.value = String(Math.round(audio.currentTime / d * 1000)); cur.textContent = fmt(audio.currentTime); }
      audio.addEventListener('timeupdate', onTime);
      audio.addEventListener('play', function () { icon.textContent = 'pause'; });
      audio.addEventListener('pause', function () { icon.textContent = 'play_arrow'; });
      audio.addEventListener('ended', function () { icon.textContent = 'play_arrow'; seek.value = '0'; cur.textContent = fmt(0); });
      play.addEventListener('click', async function () {
        if (!audio.paused) { audio.pause(); return; }
        try { document.querySelectorAll('[data-gvsi-audio] audio').forEach(function (a) { if (a !== audio) a.pause(); }); } catch (e) {}
        if (!fixed && !sane(known)) await fixDuration();
        audio.playbackRate = SPEEDS[si];
        audio.play();
      });
      seek.addEventListener('input', function () { seeking = true; var d = dval(); if (d > 0) cur.textContent = fmt(d * seek.value / 1000); });
      seek.addEventListener('change', function () { var d = dval(); if (d > 0) { try { audio.currentTime = d * seek.value / 1000; } catch (e) {} } seeking = false; });
      speed.addEventListener('click', function () { si = (si + 1) % SPEEDS.length; audio.playbackRate = SPEEDS[si]; speed.textContent = SPEEDS[si] + 'x'; });
    });
  };
  // Visualizador de imagem em tela cheia (usado no suporte e onde precisar)
  G.lightbox = function (url, opts) {
    if (!url) return;
    opts = opts || {};
    var isVideo = opts.video || /\.(mp4|webm|mov|m4v|ogv|ogg)(\?|$)/i.test(url);
    var ov = document.createElement('div'); ov.className = 'fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 overflow-hidden';
    var media;
    function cleanup() { try { if (isVideo && media) media.pause(); } catch (e) {} ov.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(ev) { if (ev.key === 'Escape') cleanup(); }
    if (isVideo) {
      media = document.createElement('video'); media.src = url; media.controls = true; media.autoplay = true; media.setAttribute('playsinline', ''); media.className = 'max-w-full max-h-[88vh] rounded-lg';
      ov.appendChild(media);
    } else {
      media = document.createElement('img'); media.src = url; media.alt = ''; media.draggable = false;
      media.className = 'max-w-full max-h-[88vh] rounded-lg object-contain select-none';
      media.style.transformOrigin = 'center center'; media.style.touchAction = 'none'; media.style.cursor = 'zoom-in';
      var scale = 1, tx = 0, ty = 0, MIN = 1, MAX = 6;
      function apply() { media.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')'; media.style.cursor = scale > 1 ? 'grab' : 'zoom-in'; }
      function setScale(ns) { ns = Math.min(MAX, Math.max(MIN, ns)); if (ns <= 1) { ns = 1; tx = 0; ty = 0; } scale = ns; apply(); }
      var pointers = new Map(), dragging = false, sx = 0, sy = 0, stx = 0, sty = 0, pinchD = 0, pinchS = 1;
      function dist() { var p = Array.from(pointers.values()); var dx = p[0].x - p[1].x, dy = p[0].y - p[1].y; return Math.hypot(dx, dy); }
      media.addEventListener('pointerdown', function (e) {
        e.stopPropagation(); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { media.setPointerCapture(e.pointerId); } catch (x) {}
        if (pointers.size === 2) { dragging = false; pinchD = dist(); pinchS = scale; }
        else if (scale > 1) { dragging = true; sx = e.clientX; sy = e.clientY; stx = tx; sty = ty; media.style.cursor = 'grabbing'; }
      });
      media.addEventListener('pointermove', function (e) {
        if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) { e.preventDefault(); if (pinchD > 0) setScale(pinchS * dist() / pinchD); }
        else if (dragging) { tx = stx + (e.clientX - sx); ty = sty + (e.clientY - sy); apply(); }
      });
      function ptrUp(e) { pointers.delete(e.pointerId); if (pointers.size < 2) pinchD = 0; if (pointers.size === 0) { dragging = false; media.style.cursor = scale > 1 ? 'grab' : 'zoom-in'; } }
      media.addEventListener('pointerup', ptrUp); media.addEventListener('pointercancel', ptrUp);
      ov.addEventListener('wheel', function (e) { e.preventDefault(); setScale(scale * (e.deltaY < 0 ? 1.15 : 0.87)); }, { passive: false });
      var moved = false;
      media.addEventListener('pointerdown', function () { moved = false; });
      media.addEventListener('pointermove', function () { moved = true; });
      media.addEventListener('click', function (e) { e.stopPropagation(); });
      media.addEventListener('dblclick', function (e) { e.stopPropagation(); setScale(scale > 1 ? 1 : 2.5); });
      ov.appendChild(media);
      // controles de zoom
      var bar = document.createElement('div'); bar.className = 'absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 rounded-full px-2 py-1';
      function zbtn(icon, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'h-10 w-10 rounded-full text-white flex items-center justify-center hover:bg-white/15'; b.innerHTML = '<span class="material-symbols-outlined">' + icon + '</span>'; b.onclick = function (e) { e.stopPropagation(); fn(); }; return b; }
      bar.appendChild(zbtn('remove', function () { setScale(scale - 0.5); }));
      bar.appendChild(zbtn('restart_alt', function () { setScale(1); }));
      bar.appendChild(zbtn('add', function () { setScale(scale + 0.5); }));
      ov.appendChild(bar);
      apply();
    }
    var close = document.createElement('button'); close.type = 'button'; close.className = 'absolute top-4 right-4 h-11 w-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 z-10'; close.innerHTML = '<span class="material-symbols-outlined">close</span>'; close.onclick = function () { cleanup(); };
    ov.appendChild(close);
    ov.addEventListener('click', function (e) { if (e.target === ov) cleanup(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
  };
  // Vídeo na bolha com botão de ampliar (usado no chat e no suporte)
  G.videoHtml = function (url) {
    var u = G.esc(url);
    return '<div class="relative inline-block max-w-full mb-xs"><video controls preload="metadata" src="' + u + '" class="rounded-lg max-w-full block" style="max-height:20rem"></video>' +
      '<button type="button" class="vid-expand absolute top-2 right-2 h-8 w-8 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75" data-full="' + u + '" title="Ampliar" aria-label="Ampliar"><span class="material-symbols-outlined text-[18px]">open_in_full</span></button></div>';
  };
  // Seletor de emojis reutilizável: insere no cursor de um <textarea>/<input> ou contenteditable
  G.emojiPicker = (function () {
    var pop = null, target = null, isCE = false;
    var EMOJIS = ('😀 😃 😄 😁 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😚 😋 😛 😜 🤪 🧐 🤓 😎 🥳 🤩 😏 😒 😞 😔 😟 🙁 😣 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😮 😲 🥱 😴 🤤 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👋 🤚 ✋ 👌 🤌 ✌️ 🤞 🤟 🤘 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 👏 🙌 🙏 🤝 💪 🔥 ✅ ❌ ⭐ 🌟 ✨ 💯 🎉 🎊 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💰 💵 📈 📉 📊 🚀 ⚡ 💎 🏆 🎯').split(' ');
    function close() { if (pop) { pop.remove(); pop = null; } document.removeEventListener('click', onDoc, true); }
    function onDoc(e) { if (pop && !pop.contains(e.target) && e.target !== pop._btn && !pop._btn.contains(e.target)) close(); }
    function insert(em) {
      if (!target) return; target.focus();
      if (isCE) { try { document.execCommand('insertText', false, em); } catch (e) { target.textContent = (target.textContent || '') + em; } }
      else { var s = target.selectionStart, e2 = target.selectionEnd, v = target.value || ''; if (s == null) { target.value = v + em; } else { target.value = v.slice(0, s) + em + v.slice(e2); var p = s + em.length; target.selectionStart = target.selectionEnd = p; } }
      try { target.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    }
    return function (btn, tgt, contentEditable) {
      if (pop && pop._btn === btn) { close(); return; }
      close(); target = tgt; isCE = !!contentEditable;
      pop = document.createElement('div'); pop._btn = btn;
      pop.className = 'fixed z-[96] bg-surface-container-highest border border-outline-variant rounded-2xl shadow-xl p-2 grid grid-cols-8 gap-1 w-[320px] max-w-[92vw] max-h-[46vh] overflow-y-auto custom-scrollbar';
      EMOJIS.forEach(function (em) { var b = document.createElement('button'); b.type = 'button'; b.className = 'text-[22px] hover:scale-125 transition-transform w-8 h-8 flex items-center justify-center'; b.textContent = em; b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); insert(em); }); pop.appendChild(b); });
      document.body.appendChild(pop);
      var r = btn.getBoundingClientRect(), pr = pop.getBoundingClientRect();
      var top = r.top - pr.height - 8; if (top < 8) top = r.bottom + 8;
      var left = r.left; if (left + pr.width > window.innerWidth - 8) left = window.innerWidth - 8 - pr.width; if (left < 8) left = 8;
      pop.style.top = top + 'px'; pop.style.left = left + 'px';
      setTimeout(function () { document.addEventListener('click', onDoc, true); }, 0);
    };
  })();
  // Cartão de arquivo (kind='file') com nome, tamanho e download — usado no chat e no suporte
  G.fileCard = function (m, mine) {
    var e = G.esc, meta = m.media_meta || {};
    var name = e(meta.name || 'arquivo');
    var size = meta.size ? '<span class="block text-[12px] ' + (mine ? 'text-white/80' : 'text-on-surface-variant') + '">' + G.humanSize(meta.size) + '</span>' : '';
    return '<a href="' + e(m.media_url) + '" target="_blank" rel="noopener noreferrer" download class="flex items-center gap-sm rounded-lg p-sm ' + (mine ? 'bg-white/15 hover:bg-white/25' : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20') + ' transition max-w-[16rem]"><span class="material-symbols-outlined text-[30px] shrink-0 ' + (mine ? 'text-white' : 'text-primary') + '">description</span><span class="min-w-0 flex-1"><span class="block font-label-md text-label-md truncate ' + (mine ? 'text-white' : 'text-on-surface') + '">' + name + '</span>' + size + '</span><span class="material-symbols-outlined text-[20px] shrink-0 ' + (mine ? 'text-white/90' : 'text-on-surface-variant') + '">download</span></a>';
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
  // PWA: guarda (sem mostrar nada) o prompt de instalar, usado pelo link discreto no Perfil.
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); G._installPrompt = e; });
  window.addEventListener('appinstalled', function () { G._installPrompt = null; });
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
      '#banned-screen{position:fixed;inset:0;z-index:99999;background:#0d244e;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px 24px;font-family:Inter,system-ui,sans-serif}' +
      '#banned-screen .blogo{height:42px;width:auto;margin-bottom:44px;opacity:.95}' +
      '#banned-screen .bic{width:92px;height:92px;border-radius:9999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;margin-bottom:28px}' +
      '#banned-screen .bic .material-symbols-outlined{font-size:46px;color:#9db8ff}' +
      '#banned-screen h1{color:#fff;font-weight:800;font-size:clamp(1.5rem,5vw,2.1rem);line-height:1.15;margin:0 0 12px;letter-spacing:-.01em}' +
      '#banned-screen p{color:rgba(255,255,255,.72);font-size:1.05rem;line-height:1.55;max-width:34rem;margin:0 auto;text-wrap:balance}' +
      '#banned-screen .bfoot{margin-top:36px;color:rgba(255,255,255,.45);font-size:.85rem}' +
      '</style>' +
      '<img src="assets/logo-branca.png" alt="GVSI Capital Prop" class="blogo">' +
      '<div class="bic"><span class="material-symbols-outlined">do_not_disturb_on</span></div>' +
      '<h1>Seu acesso foi encerrado</h1>' +
      '<p>Sua conta não faz mais parte da <span style="white-space:nowrap">Comunidade do Giovanni</span>.</p>' +
      '<div class="bfoot">Em caso de dúvida, entre em contato com a equipe.</div>';
    document.body.appendChild(wrap);
    try { document.title = 'Acesso encerrado'; } catch (e) {}
  };

  // Mini-perfil (cartão) ao clicar na foto: foto + nome + bio, via RPC segura (sem e-mail/telefone).
  G.showMemberCard = async function (userId) {
    if (!userId || !G.sb) return;
    if (document.getElementById('member-card')) return;
    var r; try { r = await G.sb.rpc('comu_member_card', { p_user_id: userId }); } catch (e) { return; }
    var d = (r && r.data && r.data[0]) || null;
    if (!d) { if (G.toast) G.toast('Perfil indisponível.'); return; }
    var ov = document.createElement('div'); ov.id = 'member-card'; ov.className = 'fixed inset-0 z-[96] flex items-center justify-center p-container-margin bg-black/40';
    var av = d.avatar_url ? '<img src="' + G.esc(d.avatar_url) + '" class="w-24 h-24 rounded-full object-cover mx-auto" alt="">' : '<span class="w-24 h-24 rounded-full bg-surface-container-high flex items-center justify-center text-outline mx-auto"><span class="material-symbols-outlined text-[40px]">person</span></span>';
    ov.innerHTML = '<div class="w-full max-w-xs bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg text-center space-y-sm">' + av + '<h3 class="font-headline-sm text-headline-sm text-on-surface break-words">' + G.esc(G.shortName(d.full_name) || 'Membro') + '</h3>' + (d.bio ? '<p class="text-body-sm text-on-surface-variant text-balance break-words">' + G.esc(d.bio) + '</p>' : '<p class="text-body-sm text-on-surface-variant/60 italic">Sem bio ainda.</p>') + '<button type="button" id="mc-close" class="mt-sm h-10 px-6 rounded-full bg-primary text-on-primary font-label-md active:scale-95 transition">Fechar</button></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var cb = document.getElementById('mc-close'); if (cb) cb.addEventListener('click', close);
  };
  // Cartão do suporte: identidade unica, nunca revela o atendente real.
  G.showSupportCard = function () {
    if (document.getElementById('member-card')) return;
    var icon = 'https://mwnyuursbrlfxfssvkyu.supabase.co/storage/v1/object/public/comu-media/system/support-avatar.jpg';
    var ov = document.createElement('div'); ov.id = 'member-card'; ov.className = 'fixed inset-0 z-[96] flex items-center justify-center p-container-margin bg-black/40';
    ov.innerHTML = '<div class="w-full max-w-xs bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg text-center space-y-sm"><img src="' + icon + '" class="w-24 h-24 rounded-full object-cover mx-auto" alt=""><h3 class="font-headline-sm text-headline-sm text-on-surface">Suporte do Giovanni</h3><p class="text-body-sm text-on-surface-variant">Equipe de suporte do Giovanni Paganini.</p><button type="button" id="mc-close" class="mt-sm h-10 px-6 rounded-full bg-primary text-on-primary font-label-md active:scale-95 transition">Fechar</button></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var cb = document.getElementById('mc-close'); if (cb) cb.addEventListener('click', close);
  };
  // Upload com barra de progresso (o .upload() do SDK não expõe progresso; XHR sim).
  // Re-tenta sozinho em redes fracas (queda no meio do envio / timeout). Path fixo + upsert = idempotente.
  G.uploadWithProgress = function (path, file, contentType, onProgress, tries) {
    tries = tries || 4;
    function once() {
      return new Promise(function (resolve) {
        G.sb.auth.getSession().then(function (s) {
          var tok = (s && s.data && s.data.session && s.data.session.access_token) || window.SUPABASE_ANON_KEY;
          var xhr = new XMLHttpRequest();
          xhr.open('POST', window.SUPABASE_URL + '/storage/v1/object/comu-media/' + path, true);
          xhr.setRequestHeader('Authorization', 'Bearer ' + tok);
          xhr.setRequestHeader('apikey', window.SUPABASE_ANON_KEY);
          xhr.setRequestHeader('x-upsert', 'true');
          if (contentType) xhr.setRequestHeader('Content-Type', contentType);
          xhr.timeout = 60000; // rede travada não fica "Enviando…" pra sempre
          xhr.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
          xhr.onload = function () { if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true }); else resolve({ ok: false, error: String(xhr.responseText || ('HTTP ' + xhr.status)).slice(0, 200), retryable: (xhr.status === 0 || xhr.status === 429 || xhr.status >= 500) }); };
          xhr.onerror = function () { resolve({ ok: false, error: 'Falha de rede no envio', retryable: true }); };
          xhr.ontimeout = function () { resolve({ ok: false, error: 'Tempo esgotado no envio', retryable: true }); };
          xhr.send(file);
        }, function () { resolve({ ok: false, error: 'Sessão inválida', retryable: false }); });
      });
    }
    return (async function () {
      var last = null;
      for (var i = 0; i < tries; i++) {
        if (onProgress) onProgress(0);
        var r = await once();
        if (r.ok) return r;
        last = r;
        if (!r.retryable) break;
        if (i < tries - 1) await new Promise(function (res) { setTimeout(res, 900 * (i + 1)); });
      }
      return last || { ok: false, error: 'falha no envio' };
    })();
  };
  // Upload para o storage com re-tentativas (redes fracas caem no meio do envio). Path fixo + upsert = idempotente.
  G.storageUpload = async function (path, file, contentType, tries) {
    tries = tries || 3; var lastErr = null;
    for (var i = 0; i < tries; i++) {
      try {
        var up = await G.sb.storage.from('comu-media').upload(path, file, { upsert: true, contentType: contentType || undefined });
        if (!up.error) return { ok: true };
        lastErr = (up.error && (up.error.message || up.error)) || 'falha';
      } catch (e) { lastErr = (e && e.message) || String(e); }
      if (i < tries - 1) await new Promise(function (r) { setTimeout(r, 800 * (i + 1)); });
    }
    return { ok: false, error: String(lastErr || 'falha no envio') };
  };
  // Editor de imagem reutilizável (pré-envio): abre o cropper e chama onConfirm(blob, caption, dims).
  G.imageComposer = function (file, onConfirm) {
    if (!file || !onConfirm) return;
    function ensure() { if (window.Cropper) return Promise.resolve(); if (G._cropperP) return G._cropperP; G._cropperP = new Promise(function (res, rej) { try { var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css'; document.head.appendChild(css); var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js'; s.onload = function () { res(); }; s.onerror = function () { G._cropperP = null; rej(new Error('cropper')); }; document.head.appendChild(s); } catch (e) { rej(e); } }); return G._cropperP; }
    ensure().then(function () {
      var src = URL.createObjectURL(file);
      var ov = document.createElement('div'); ov.id = 'img-editor'; ov.className = 'fixed inset-0 z-[100] bg-black/95 flex flex-col p-3 gap-3';
      ov.innerHTML =
        '<style>#img-editor .cropper-view-box{outline:2px solid rgba(124,156,255,.95)}#img-editor .cropper-line{background-color:#6f8cff;opacity:.4}#img-editor .cropper-point{background-color:#7c9cff;opacity:1;width:13px;height:13px}</style>' +
        '<div class="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding:14px 84px 14px 20px"><img id="ic-img" class="max-w-full max-h-full block" alt="">' +
          '<div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);z-index:60;display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(0,0,0,.55);padding:10px 6px;border-radius:9999px">' +
            '<button type="button" id="ic-zin" class="material-symbols-outlined" style="color:#fff;font-size:28px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:9999px;cursor:pointer">add</button>' +
            '<input type="range" id="ic-zoom" min="50" max="300" value="100" step="1" style="writing-mode:vertical-lr;direction:rtl;width:12px;height:170px;accent-color:#7c9cff;cursor:pointer">' +
            '<button type="button" id="ic-zout" class="material-symbols-outlined" style="color:#fff;font-size:28px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:9999px;cursor:pointer">remove</button>' +
          '</div></div>' +
        '<div class="shrink-0 flex flex-col items-center gap-2">' +
          '<input id="ic-caption" type="text" placeholder="Legenda (opcional)" class="w-full max-w-md h-11 px-3 rounded-xl bg-white/10 text-white border border-white/20 text-body-md placeholder:text-white/50">' +
          '<div class="flex flex-wrap items-center justify-center gap-2"><span class="text-white/80 text-body-sm">Tamanho:</span>' +
            '<select id="ic-size" class="h-11 px-3 rounded-xl bg-white/10 text-white border border-white/20 text-body-md"><option value="1600">Grande</option><option value="1000" selected>Médio</option><option value="600">Pequeno</option><option value="0">Original</option></select>' +
            '<button type="button" id="ic-cancel" class="h-11 px-5 rounded-full bg-white/15 text-white font-label-md">Cancelar</button>' +
            '<button type="button" id="ic-send" class="h-11 px-6 rounded-full bg-primary text-on-primary font-label-md flex items-center gap-1"><span class="material-symbols-outlined text-[20px]">send</span>Enviar</button>' +
          '</div></div>';
      document.body.appendChild(ov);
      var imgEl = ov.querySelector('#ic-img'), cropper = null, baseRatio = 1, zoomEl = ov.querySelector('#ic-zoom');
      function closeC() { try { if (cropper) cropper.destroy(); } catch (e) {} try { URL.revokeObjectURL(src); } catch (e) {} ov.remove(); }
      function applyZoom() { if (cropper) { try { cropper.zoomTo(baseRatio * (parseInt(zoomEl.value, 10) || 100) / 100); } catch (e) {} } }
      imgEl.onload = function () { try { cropper = new Cropper(imgEl, { viewMode: 1, autoCropArea: 0.95, background: false, dragMode: 'crop', zoomOnWheel: false, ready: function () { var cd = cropper.getCanvasData(); baseRatio = (cd && cd.naturalWidth) ? (cd.width / cd.naturalWidth) : 1; if (zoomEl) zoomEl.value = 100; } }); } catch (e) {} };
      imgEl.onerror = function () { if (G.toast) G.toast('Não foi possível abrir a imagem.'); closeC(); };
      imgEl.src = src;
      if (zoomEl) zoomEl.addEventListener('input', applyZoom);
      ov.querySelector('#ic-zin').onclick = function () { zoomEl.value = Math.min(300, (parseInt(zoomEl.value, 10) || 100) + 15); applyZoom(); };
      ov.querySelector('#ic-zout').onclick = function () { zoomEl.value = Math.max(50, (parseInt(zoomEl.value, 10) || 100) - 15); applyZoom(); };
      ov.querySelector('#ic-cancel').onclick = closeC;
      ov.querySelector('#ic-send').onclick = function () {
        if (!cropper) return;
        var btn = ov.querySelector('#ic-send'); btn.disabled = true; btn.textContent = 'Enviando…';
        var max = parseInt(ov.querySelector('#ic-size').value, 10) || 0;
        var opts = { imageSmoothingEnabled: true, imageSmoothingQuality: 'high' }; if (max) { opts.maxWidth = max; opts.maxHeight = max; }
        var canvas; try { canvas = cropper.getCroppedCanvas(opts); } catch (e) { canvas = null; }
        if (!canvas) { if (G.toast) G.toast('Falha ao processar a imagem.'); btn.disabled = false; return; }
        canvas.toBlob(function (blob) {
          if (!blob) { if (G.toast) G.toast('Falha ao gerar a imagem.'); btn.disabled = false; return; }
          var caption = (ov.querySelector('#ic-caption').value || '').trim() || null;
          Promise.resolve(onConfirm(blob, caption, { w: canvas.width, h: canvas.height })).then(function (ok) { if (ok === false) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">send</span>Enviar'; } else closeC(); }, function () { btn.disabled = false; });
        }, 'image/jpeg', 0.9);
      };
    }, function () { if (G.toast) G.toast('Editor de imagem indisponível.'); });
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
              '<span class="flex-1 min-w-0"><span id="spw-avatar-txt" class="block text-body-md font-bold text-on-surface text-balance">Adicionar sua foto</span><span class="block text-body-sm text-on-surface-variant text-balance">Ajuda a comunidade a te reconhecer</span></span>' +
              '<span class="material-symbols-outlined text-primary shrink-0">photo_camera</span>' +
            '</button>' +
            '<input id="spw-avatar-input" type="file" accept="image/*" class="hidden">' +
          '</div>' +
          '<div class="bg-surface-container-low border border-outline-variant rounded-xl py-3 px-4"><span class="block text-label-md font-label-md text-on-surface-variant mb-xs">Seu nome</span><span class="block text-body-lg text-on-surface font-bold">' + G.esc((G.me && G.me.full_name) || 'Membro') + '</span></div>' +
          '<div><label for="spw1" class="block text-label-md font-label-md text-on-surface-variant mb-xs">Crie uma senha</label><input id="spw1" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-4 px-4 text-body-lg text-on-surface focus:ring-2 focus:ring-primary" placeholder="Digite uma senha"></div>' +
          '<div><label for="spw2" class="block text-label-md font-label-md text-on-surface-variant mb-xs">Repita a senha</label><input id="spw2" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-4 px-4 text-body-lg text-on-surface focus:ring-2 focus:ring-primary" placeholder="Digite a mesma senha de novo"></div>' +
          '<div id="spw-caps" class="hidden items-center gap-sm bg-tertiary-container/40 text-on-tertiary-container rounded-xl px-3 py-2 text-body-sm"><span class="material-symbols-outlined text-[20px]">keyboard_capslock</span><span>Sua senha tem <b>LETRA MAIÚSCULA</b>. Guarde bem, vai precisar digitar igual depois.</span></div>' +
          '<p id="spw-msg" class="text-body-md text-center min-h-6"></p>' +
          '<button id="spw-save" type="button" disabled class="w-full h-14 bg-primary text-on-primary rounded-xl font-headline-sm text-headline-sm flex items-center justify-center gap-sm shadow-md active:scale-[0.98] transition disabled:opacity-50">Salvar e entrar</button>' +
        '</div>' +
        '<p class="text-center text-body-sm text-on-surface-variant text-balance">A senha aparece na tela de propósito, pra você conferir o que está digitando.</p>' +
      '</div>';
    document.body.appendChild(ov);
    var p1 = ov.querySelector('#spw1'), p2 = ov.querySelector('#spw2');
    var caps = ov.querySelector('#spw-caps'), msg = ov.querySelector('#spw-msg'), btn = ov.querySelector('#spw-save');
    var avBtn = ov.querySelector('#spw-avatar-btn'), avInput = ov.querySelector('#spw-avatar-input'), avEl = ov.querySelector('#spw-avatar'), avatarFile = null;
    var avTxt = ov.querySelector('#spw-avatar-txt');
    function avChosen() { if (avTxt) avTxt.textContent = 'Foto escolhida'; avBtn.className = 'w-full flex items-center gap-md border rounded-xl p-3 text-left transition active:scale-[0.99] border-outline-variant bg-surface-container-low hover:bg-surface-container'; }
    if (G.me && G.me.avatar_url) { avEl.innerHTML = '<img src="' + G.esc(G.me.avatar_url) + '" class="w-full h-full object-cover" alt="">'; avChosen(); }
    avBtn.addEventListener('click', function () { avInput.click(); });
    avInput.addEventListener('change', function () { var f = this.files[0]; if (!f) return; avatarFile = f; avEl.innerHTML = '<img src="' + URL.createObjectURL(f) + '" class="w-full h-full object-cover" alt="">'; avChosen(); });
    var MIN = 6;
    function validate() {
      var a = p1.value, b = p2.value;
      caps.classList.toggle('hidden', !/[A-Z]/.test(a));
      caps.style.display = /[A-Z]/.test(a) ? 'flex' : '';
      var ok = false, m = '', cls = 'text-error';
      if (!a) { m = ''; }
      else if (a.length < MIN) { m = 'A senha precisa ter pelo menos ' + MIN + ' caracteres.'; }
      else if (!b) { m = ''; }
      else if (a !== b) { m = 'As duas senhas não estão iguais.'; }
      else { ok = true; m = 'Tudo certo! Pode salvar.'; cls = 'text-primary'; }
      msg.textContent = m; msg.className = 'text-body-md text-center min-h-6 ' + cls;
      btn.disabled = !ok;
      return ok;
    }
    p1.addEventListener('input', validate); p2.addEventListener('input', validate);
    btn.addEventListener('click', async function () {
      if (!validate()) return;
      btn.disabled = true; btn.textContent = 'Salvando...';
      try {
        var up = await G.sb.auth.updateUser({ password: p1.value });
        if (up.error) throw up.error;
        var patch = { needs_password: false };
        if (avatarFile) {
          try {
            var ext = (avatarFile.name.split('.').pop() || 'jpg').toLowerCase();
            var path = 'avatars/' + G.me.id + '/' + Date.now() + '.' + ext;
            var upl = await G.sb.storage.from('comu-media').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type || undefined });
            if (!upl.error) patch.avatar_url = G.sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
          } catch (e) {}
        }
        try { await G.sb.from('lms_students').update(patch).eq('id', G.me.id); } catch (e) {}
        if (G.me) { if (patch.avatar_url) G.me.avatar_url = patch.avatar_url; G.me.needs_password = false; }
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
      var steps = [{ el: null, title: 'Bem-vindo à Comunidade do Giovanni!', text: 'Vou te apresentar rapidinho cada grupo, pra você saber onde fica cada coisa. É só ir tocando em "Próximo".' }];
      items.forEach(function (it) {
        var h = it.querySelector('h3'); var pv = it.querySelector('.topic-preview');
        steps.push({ el: it, title: h ? h.textContent : 'Grupo', text: (pv && pv.dataset.desc) || 'Toque neste grupo para abrir a conversa.' });
      });
      var prof = document.querySelector('[data-side-profile]');
      if (!prof || prof.offsetParent === null) prof = document.querySelector('nav a[href="/perfil"]');
      if (prof && prof.offsetParent !== null) steps.push({ el: prof, title: 'O seu perfil', text: 'Aqui fica o seu perfil. Toque para trocar a sua foto, ver as suas mensagens e mudar o tamanho da letra, do jeito que ficar melhor pra você ler.' });
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
        var applyTheme = function () { root.classList.toggle('dark', next === 'dark'); try { localStorage.setItem('gvsi-theme', next); } catch (er) {} G.updateThemeIcons(); };
        var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (x) {}
        if (document.startViewTransition && !reduce) {
          // reveal circular saindo do botão de tema
          var cx = (e.clientX ? e.clientX : window.innerWidth - 40), cy = (e.clientY ? e.clientY : 40);
          var endR = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));
          var vt = document.startViewTransition(applyTheme);
          vt.ready.then(function () {
            document.documentElement.animate(
              { clipPath: ['circle(0px at ' + cx + 'px ' + cy + 'px)', 'circle(' + endR + 'px at ' + cx + 'px ' + cy + 'px)'] },
              { duration: 480, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
            );
          }).catch(function () {});
        } else {
          root.classList.add('theme-anim'); applyTheme(); setTimeout(function () { root.classList.remove('theme-anim'); }, 420);
        }
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
    gold: { bg: 'bg-amber-400/20', fg: 'text-amber-600 dark:text-amber-300' },
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
    if (m.kind === 'file') return who + '📎 ' + G.esc((m.media_meta && m.media_meta.name) || 'Arquivo');
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
    { title: 'Publicações do Giovanni', slugs: ['tutoriais', 'recados', 'desafio', 'arquivos'] }
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
  G.notifSupported = function () { return typeof window !== 'undefined' && 'Notification' in window; };
  G.notifyEnabled = function () { try { return localStorage.getItem('gvsi-notif') === '1' && G.notifSupported() && Notification.permission === 'granted'; } catch (e) { return false; } };
  G._notifPrev = null;
  function notifPreviewText(lm) {
    if (!lm) return 'Novas mensagens';
    if (lm.kind === 'image') return '📷 Foto';
    if (lm.kind === 'video') return '🎬 Vídeo';
    if (lm.kind === 'audio') return '🎤 Áudio';
    if (lm.kind === 'file') return '📎 Arquivo';
    var b = (lm.body || '').replace(/\s+/g, ' ').trim();
    return b ? (b.length > 120 ? b.slice(0, 117) + '…' : b) : 'Novas mensagens';
  }
  G.maybeNotify = function (map) {
    // só notifica quando o usuário NÃO está olhando (aba oculta/minimizada); senão os badges já bastam
    if (!G.notifyEnabled() || !document.hidden) { G._notifPrev = map; return; }
    var prev = G._notifPrev;
    if (prev) {
      var byId = {}; (G.topics || []).forEach(function (t) { byId[t.id] = t; });
      Object.keys(map).forEach(function (slug) {
        var now = map[slug] || 0, was = prev[slug] || 0;
        if (now > was && now > 0) {
          var t = byId[slug]; var lm = (G.lastMsgs || {})[slug];
          var title = (t && t.name) || 'Comunidade do Giovanni';
          var body = lm && lm.author_name ? lm.author_name + ': ' + notifPreviewText(lm) : notifPreviewText(lm);
          try {
            var n = new Notification(title, { body: body, tag: 'gvsi-' + slug, icon: '/assets/favicon.png', badge: '/assets/favicon.png' });
            n.onclick = function () { try { window.focus(); } catch (e) {} try { location.href = '/chat/' + slug; } catch (e) {} n.close(); };
          } catch (e) {}
        }
      });
    }
    G._notifPrev = map;
  };
  G.applyUnread = async function () {
    if (!G.sb) return;
    try {
      var r = await G.sb.rpc('comu_unread_counts');
      if (r.error || !r.data) return;
      var map = {}, total = 0; r.data.forEach(function (x) { var n = Number(x.unread) || 0; map[x.slug] = n; total += n; });
      document.querySelectorAll('.topic-item').forEach(function (item) {
        var b = item.querySelector('.unread-badge'); if (!b) return;
        var n = map[item.dataset.slug] || 0;
        if (n > 0) { b.textContent = n > 99 ? '99+' : n; b.classList.remove('hidden'); } else { b.classList.add('hidden'); }
      });
      // #5 — contador de pendências no título da aba: "(3) Comunidade do Giovanni"
      try { var base = document.title.replace(/^\(\d+\+?\)\s*/, ''); document.title = (total > 0 ? '(' + (total > 99 ? '99+' : total) + ') ' : '') + base; } catch (e) {}
      try { G.maybeNotify(map); } catch (e) {}
    } catch (e) {}
  };
  // Balão flutuante do Desafio (aparece em qualquer tela, só para participantes)
  G.setupChallengeFab = async function () {
    if (!G.sb || !G.me || document.getElementById('challenge-fab')) return;
    var r;
    try { r = await G.sb.rpc('comu_challenge_for_me'); } catch (e) { return; }
    var d = r && r.data; if (!d || r.error || !d.participating || !d.challenge) return;
    var ch = d.challenge, days = d.days || [];
    function fd(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1]; }
    function wd(iso) { var p = String(iso).split('-'); var dt = new Date(+p[0], +p[1] - 1, +p[2]); return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dt.getDay()]; }
    var CFG = { cumprido: ['check_circle', 'bg-primary/15 text-primary', 'Feito'], falha_sem: ['cancel', 'bg-error/15 text-error', 'Sem operar'], falha_invalido: ['rule', 'bg-amber-400/20 text-amber-700 dark:text-amber-300', 'Sem campos'], falha_excesso: ['warning', 'bg-amber-400/20 text-amber-700 dark:text-amber-300', 'Demais'], hoje: ['schedule', 'bg-blue-500/15 text-blue-500', 'Hoje'], futuro: ['lock_clock', 'bg-surface-container-high text-on-surface-variant', '—'] };
    var cells = days.map(function (x) {
      var c = CFG[x.status] || CFG.futuro; var cnt = x.count;
      var sub = (x.status === 'cumprido' || x.status === 'falha_excesso') ? (cnt + ' op') : (x.status === 'hoje' ? (cnt + '/' + ch.max) : (x.status === 'falha_invalido' ? ((x.raw || 0) + ' print') : (x.status === 'falha_sem' ? '0 op' : '')));
      return '<div class="flex-1 min-w-0 rounded-lg p-1 text-center ' + c[1] + '"><div class="text-[10px] font-bold uppercase opacity-80">' + wd(x.date) + '</div><div class="text-[10px] tabular-nums">' + fd(x.date) + '</div><span class="material-symbols-outlined text-[18px] block">' + c[0] + '</span>' + (sub ? '<div class="text-[9px] opacity-80 leading-none">' + sub + '</div>' : '') + '</div>';
    }).join('');
    var fab = document.createElement('button');
    fab.id = 'challenge-fab'; fab.type = 'button';
    fab.className = 'fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-[71] h-12 pl-3 pr-4 rounded-full bg-amber-500 text-black shadow-lg flex items-center gap-1.5 active:scale-95 transition';
    fab.setAttribute('aria-label', 'Ver meu desafio'); fab.title = 'Ver meu desafio';
    fab.innerHTML = '<span class="material-symbols-outlined text-[22px]">emoji_events</span><span class="text-label-md font-bold whitespace-nowrap">Meu Desafio</span>';
    var pop = document.createElement('div');
    pop.id = 'challenge-pop';
    pop.className = 'hidden fixed right-4 lg:right-6 z-[72] w-[330px] max-w-[92vw] bg-surface-container-lowest border border-amber-400/40 rounded-2xl shadow-2xl p-lg';
    pop.innerHTML =
      '<div class="flex items-center justify-between mb-xs"><h3 class="font-bold text-on-surface flex items-center gap-1"><span class="material-symbols-outlined text-amber-500 text-[20px]">emoji_events</span>' + G.esc(ch.name) + '</h3><button type="button" id="challenge-pop-x" class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"><span class="material-symbols-outlined text-[20px]">close</span></button></div>' +
      '<p class="text-body-sm text-on-surface-variant mb-sm">' + fd(ch.start) + ' a ' + fd(ch.end) + ' · ' + ch.min + '–' + ch.max + ' operações/dia</p>' +
      (!d.started ? '<div class="mb-sm rounded-xl bg-primary/10 border border-primary/25 px-3 py-2 text-[12px] text-primary flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">celebration</span><span>Você já está participando! O desafio <b>começa ' + ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][(function () { var p = String(ch.start).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getDay(); })()] + ' (' + fd(ch.start) + ')</b>. Suas operações contam a partir daí.</span></div>' : '') +
      '<p class="text-[12px] text-on-surface mb-sm"><b>Como cumprir:</b> poste o <b>print</b> de cada operação no tópico <b>Prints das Operações</b>. Faça de ' + ch.min + ' a ' + ch.max + ' operações por dia.</p>' +
      '<div class="flex gap-1">' + cells + '</div>';
    document.body.appendChild(fab); document.body.appendChild(pop);
    function positionPop() { var r = fab.getBoundingClientRect(); pop.style.bottom = (window.innerHeight - r.top + 8) + 'px'; pop.style.right = Math.max(8, (window.innerWidth - r.right)) + 'px'; }
    fab.addEventListener('click', function (e) { e.stopPropagation(); if (pop.classList.contains('hidden')) { positionPop(); pop.classList.remove('hidden'); } else pop.classList.add('hidden'); });
    pop.querySelector('#challenge-pop-x').addEventListener('click', function () { pop.classList.add('hidden'); });
    document.addEventListener('click', function (e) { if (!pop.classList.contains('hidden') && !pop.contains(e.target) && e.target !== fab && !fab.contains(e.target)) pop.classList.add('hidden'); });
    window.addEventListener('resize', function () { try { G.positionChallengeFab(G._route); if (!pop.classList.contains('hidden')) positionPop(); } catch (e) {} });
    G.positionChallengeFab(G._route);
    // Primeira vez: abre o balão sozinho pra pessoa já ver os dados do desafio dela
    try { if (localStorage.getItem('gvsi-chal-hint') !== '1') { localStorage.setItem('gvsi-chal-hint', '1'); setTimeout(function () { try { G.positionChallengeFab(G._route); positionPop(); pop.classList.remove('hidden'); } catch (e) {} }, 900); } } catch (e) {}
  };
  // Sobe o botão acima do compositor na tela de chat; nas outras, fica no canto (classes bottom-24/lg:bottom-6)
  G.positionChallengeFab = function (routeName) {
    var fab = document.getElementById('challenge-fab'); if (!fab) return;
    // colisão com o botão "Tutorial": se ele estiver visível no canto, alinhar lado a lado (à esquerda dele)
    var onb = document.getElementById('onb-fab');
    var onbVisible = onb && onb.offsetParent !== null && !onb.classList.contains('hidden');
    var base = (window.matchMedia && window.matchMedia('(min-width:1024px)').matches) ? 24 : 16;
    fab.style.right = onbVisible ? (base + onb.getBoundingClientRect().width + 12) + 'px' : '';
    var isDesktop = (window.matchMedia && window.matchMedia('(min-width:1024px)').matches);
    if (routeName === 'chat' && !isDesktop) {
      // no mobile o compositor ocupa a largura toda: sobe o botão acima dele (no desktop ele é centralizado, então fica no canto)
      var comp = document.getElementById('chat-composer');
      if (comp) { var top = comp.getBoundingClientRect().top; fab.style.bottom = Math.max(96, (window.innerHeight - top + 12)) + 'px'; return; }
    }
    fab.style.bottom = '';
  };
  G.showNews = async function () {
    if (!G.sb || !G.me || document.getElementById('news-modal')) return;
    var r = await G.sb.from('comu_news').select('id,title,body,icon').eq('active', true).order('created_at', { ascending: false });
    if (r.error || !r.data || !r.data.length) return;
    var reads = await G.sb.from('comu_news_reads').select('news_id');
    var seen = {}; (reads.data || []).forEach(function (x) { seen[x.news_id] = 1; });
    var n = r.data.filter(function (x) { return !seen[x.id]; })[0];
    if (!n) return;
    var ov = document.createElement('div');
    ov.id = 'news-modal';
    ov.className = 'fixed inset-0 z-[120] flex items-center justify-center p-container-margin bg-black/50';
    ov.innerHTML =
      '<div class="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-amber-400/40 bg-surface-container-lowest">' +
      '<div class="px-lg pt-lg pb-md text-center" style="background:linear-gradient(135deg,#f6c343,#e0a500)">' +
      '<span class="material-symbols-outlined text-[44px] text-black/80">' + G.esc(n.icon || 'workspace_premium') + '</span>' +
      '<h3 class="font-headline-sm text-headline-sm font-bold text-black/90 mt-1">' + G.esc(n.title) + '</h3></div>' +
      '<div class="p-lg"><p class="text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">' + G.fmt(n.body || '', true) + '</p>' +
      '<button type="button" id="news-close" class="w-full mt-lg h-11 rounded-full bg-primary text-on-primary font-label-md active:scale-[0.98] transition">Entendi</button></div></div>';
    document.body.appendChild(ov);
    var marked = false;
    function markRead() { if (marked) return; marked = true; try { G.sb.from('comu_news_reads').upsert({ news_id: n.id, user_id: G.me.id }, { onConflict: 'news_id,user_id' }).then(function () {}, function () {}); } catch (e) {} }
    function close() { markRead(); ov.remove(); }
    markRead();
    ov.querySelector('#news-close').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  };
  G.updateSidebarProfile = function () {
    var m = G.me || {};
    document.querySelectorAll('[data-side-avatar]').forEach(function (el) {
      el.innerHTML = m.avatar_url ? '<img src="' + G.esc(m.avatar_url) + '" class="w-full h-full object-cover" alt="">' : '<span class="material-symbols-outlined text-[20px]">person</span>';
    });
    document.querySelectorAll('[data-side-name]').forEach(function (el) { el.textContent = G.shortName(m.full_name) || 'Meu Perfil'; });
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
    if (seg[0] === 'ia-suporte') return { name: 'iasuporte', params: {} };
    if (seg[0] === 'membros') return { name: 'membros', params: {} };
    if (seg[0] === 'moderacao') return { name: 'moderacao', params: {} };
    if (seg[0] === 'grupos') return { name: 'grupos', params: {} };
    return { name: 'grupos', params: {} };
  }
  var current = null;
  async function render() {
    var route = parseRoute();
    G._route = route.name;
    try { var _p = location.pathname; if (_p && _p !== '/') localStorage.setItem('gvsi-route', _p); } catch (e) {}
    var view = G.views[route.name] || G.views.grupos;
    if (current && current.destroy) { try { current.destroy(); } catch (e) {} }
    var el = document.getElementById('view');
    el.innerHTML = '';
    try { window.scrollTo(0, 0); } catch (e) {} // abre a nova tela SEMPRE no topo (corrige scroll preso ao trocar de tela no celular)
    setActive(route);
    current = view;
    try { await view.render(el, route.params); } catch (e) { console.error('view error', e); }
    G.updateThemeIcons();
    try { requestAnimationFrame(function () { if (G.positionChallengeFab) G.positionChallengeFab(route.name); }); } catch (e) {}
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
    var pr = await G.sb.from('lms_students').select('id,full_name,email,bio,phone,avatar_url,role,needs_password,premium').eq('id', user.id).maybeSingle();
    G.me = pr.data || { id: user.id, email: user.email, full_name: null, avatar_url: null, role: 'student' };
    if (!pr.data) {
      try { await G.sb.from('lms_students').upsert({ id: user.id, email: user.email, full_name: (user.user_metadata && user.user_metadata.full_name) || (user.email || '').split('@')[0] }, { onConflict: 'id', ignoreDuplicates: true }); } catch (e) {}
    }
    // banimento: se estiver banido, mostra a tela de demissão e para por aqui
    try { var _ban = await G.sb.from('comu_bans').select('user_id').eq('user_id', user.id).maybeSingle(); if (_ban.data) { G.showBanned(); return; } } catch (e) {}
    // quem pode banir (allowlist) + "demissão" em tempo real
    try { var _cb = await G.sb.from('comu_banners').select('user_id').eq('user_id', user.id).maybeSingle(); G.me.canBan = (G.me.role === 'admin') || !!(_cb && _cb.data); } catch (e) { G.me.canBan = !!(G.me && G.me.role === 'admin'); }
    try { G.sb.channel('comu-ban-self').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_bans', filter: 'user_id=eq.' + user.id }, function () { G.showBanned(); }).subscribe(); } catch (e) {}
    // IDs dos administradores (destaque das mensagens deles no chat) — carregado 1x.
    // Via RPC SECURITY DEFINER: o RLS de lms_students só deixa cada um ler a própria
    // linha, então um SELECT direto viria vazio para membros comuns.
    try { G.adminIds = {}; var _ad = await G.sb.rpc('comu_admin_ids'); (_ad.data || []).forEach(function (x) { var id = (x && x.id) ? x.id : x; if (id) G.adminIds[id] = 1; }); } catch (e) { G.adminIds = G.adminIds || {}; }
    initTheme();
    G.updateSidebarProfile();
    G.topics = await loadTopics();
    if (G.me && G.me.premium) { var _sup = G.topics.filter(function (t) { return t.id === 'suporte'; })[0]; if (_sup) { _sup.name = 'Suporte Premium'; _sup.tone = 'gold'; _sup.desc = 'Atendimento prioritário da mentoria.'; _sup.premium = true; } }
    G.renderTopicList(document.getElementById('side-topics'), '');
    G.applyUnread();
    G.loadLastMessages();
    setTimeout(function () { try { G.showNews(); } catch (e) {} }, 800);
    setTimeout(function () { try { G.setupChallengeFab(); } catch (e) {} }, 1000);
    // Badges/preview da sidebar: por POLL leve (15s) + ao voltar o foco — NÃO
    // por postgres_changes global, que não escala (1 msg = 1 leitura RLS por
    // usuário conectado). As mensagens do tópico ABERTO já chegam via Broadcast.
    function refreshSidebar() { if (document.hidden && !G.notifyEnabled()) return; Promise.resolve(G.loadLastMessages()).then(function () { G.applyUnread(); }); }
    if (G._sidebarPoll) clearInterval(G._sidebarPoll);
    G._sidebarPoll = setInterval(refreshSidebar, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshSidebar(); });
    if (location.pathname === '/') { var _r; try { _r = localStorage.getItem('gvsi-route'); } catch (e) {} if (_r && _r.charAt(0) === '/' && _r !== '/') history.replaceState(null, '', _r); }
    await render();
    try { if (window.__gvsiContentReady) window.__gvsiContentReady(); } catch (e) {} // avisa o splash: 1º render pronto
    if (G.me && G.me.needs_password) G.showSetPassword(); // 1º acesso → cria senha
  });
})();
