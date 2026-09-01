/**
 * GVSI Comunidade — views do SPA. Cada view: { render(el, params), destroy() }.
 * Usa helpers de GVSI (esc, timeStr, toast, confirmDialog, sb, me, navigate, topics).
 */
(function () {
  var G = GVSI;
  var sb = G.sb;
  function esc(s) { return G.esc(s); }
  function timeStr(s) { return G.timeStr(s); }

  // =====================================================================
  // GRUPOS
  // =====================================================================
  GVSI.views.grupos = {
    render: function (view) {
      view.innerHTML =
        '<header class="lg:hidden fixed top-0 left-0 right-0 z-50 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] h-14 flex items-center justify-between px-container-margin">' +
          '<span class="w-9"></span>' +
          '<div class="flex items-center"><img src="assets/logo-light.svg?v=2" alt="GVSI" class="h-10 w-auto dark:hidden"><img src="assets/logo-dark.svg?v=4" alt="GVSI" class="h-10 w-auto hidden dark:block brightness-0 invert"></div>' +
          '<button type="button" data-theme-toggle class="text-primary flex items-center" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button>' +
        '</header>' +
        '<div class="lg:pl-[var(--side-w)] min-h-screen pt-14 lg:pt-0 lg:flex lg:flex-col">' +
          '<div id="challenge-widget" class="hidden lg:pt-lg px-container-margin pt-lg shrink-0"><div class="max-w-3xl mx-auto"></div></div>' +
          '<div class="lg:hidden pb-16"><div class="px-container-margin py-lg">' +
            '<div class="mb-lg relative"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>' +
            '<input id="topic-search" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary focus:border-primary transition-all text-body-md text-on-surface" placeholder="Procurar tópicos na comunidade" type="text"></div>' +
            '<h2 class="text-headline-md font-bold text-on-surface mb-lg px-2">Escolha um tópico para entrar na conversa</h2>' +
            '<div id="topic-list" class="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm p-sm gap-1"></div>' +
            '<p id="no-results" class="hidden text-center text-on-surface-variant py-lg">Nenhum tópico encontrado.</p>' +
          '</div></div>' +
          '<div class="hidden lg:flex lg:flex-1 flex-col items-center justify-center text-center gap-md p-xl">' +
            '<div class="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[40px]">forum</span></div>' +
            '<div class="space-y-xs max-w-md"><h2 class="font-headline-md text-headline-md text-on-surface text-balance">Bem-vindo à Comunidade do Giovanni</h2><p class="text-body-md text-on-surface-variant text-balance">Selecione um tópico na barra lateral para começar a conversar.</p></div>' +
          '</div>' +
        '</div>' +
        '<nav class="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-xl bg-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] flex justify-around items-center h-16 px-2">' +
          '<a class="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-4 py-1" href="/"><span class="material-symbols-outlined fill">groups</span><span class="font-label-md text-label-md">Grupos</span></a>' +
          '<a class="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1" href="/perfil"><span class="material-symbols-outlined">person</span><span class="font-label-md text-label-md">Meu Perfil</span></a>' +
        '</nav>';
      G.renderTopicList(document.getElementById('topic-list'), '');
      G.applyUnread();
      G.loadLastMessages(); // #13: preenche última mensagem + horário na tela inicial
      // Indicador do Desafio (só para participantes)
      (function () {
        var box = document.getElementById('challenge-widget'); if (!box) return;
        sb.rpc('comu_challenge_for_me').then(function (r) {
          var d = r && r.data; if (!d || r.error || !d.participating || !d.challenge) return;
          var ch = d.challenge, days = d.days || [];
          function fd(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1]; }
          function wd(iso) { var p = String(iso).split('-'); var dt = new Date(+p[0], +p[1] - 1, +p[2]); return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dt.getDay()]; }
          var CFG = { cumprido: ['check_circle', 'bg-primary/15 text-primary', 'Feito'], falha_sem: ['cancel', 'bg-error/15 text-error', 'Sem operar'], falha_invalido: ['rule', 'bg-amber-400/20 text-amber-700 dark:text-amber-300', 'Sem os campos'], falha_excesso: ['warning', 'bg-amber-400/20 text-amber-700 dark:text-amber-300', 'Demais'], hoje: ['schedule', 'bg-blue-500/15 text-blue-500', 'Hoje'], futuro: ['lock_clock', 'bg-surface-container-high text-on-surface-variant', '—'] };
          var cells = days.map(function (x) {
            var c = CFG[x.status] || CFG.futuro; var cnt = x.count;
            var sub = (x.status === 'cumprido' || x.status === 'falha_excesso') ? (cnt + ' op') : (x.status === 'hoje' ? (cnt + '/' + ch.max) : (x.status === 'falha_invalido' ? ((x.raw || 0) + ' print') : (x.status === 'falha_sem' ? '0 op' : '')));
            return '<div class="flex-1 min-w-0 rounded-xl p-2 text-center ' + c[1] + '"><div class="text-[11px] font-bold uppercase opacity-80">' + wd(x.date) + '</div><div class="text-[12px] tabular-nums">' + fd(x.date) + '</div><span class="material-symbols-outlined text-[22px] my-0.5 block">' + c[0] + '</span><div class="text-[11px] font-bold leading-tight">' + c[2] + '</div>' + (sub ? '<div class="text-[10px] opacity-80">' + sub + '</div>' : '') + '</div>';
          }).join('');
          function wdf(iso) { var p = String(iso).split('-'); var dt = new Date(+p[0], +p[1] - 1, +p[2]); return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][dt.getDay()]; }
          var banner = !d.started ? '<div class="mb-md rounded-xl bg-primary/10 border border-primary/25 px-3 py-2 text-body-sm text-primary flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">celebration</span><span>Você já está participando! O desafio <b>começa ' + wdf(ch.start) + ' (' + fd(ch.start) + ')</b>. Suas operações passam a contar a partir desse dia.</span></div>' : '';
          var inner = box.querySelector('div'); if (!inner) return;
          inner.innerHTML = '<div class="bg-surface-container-lowest border border-primary/30 rounded-2xl p-lg shadow-sm">' +
            '<div class="flex items-center justify-between gap-2 mb-md flex-wrap"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-primary">emoji_events</span><h3 class="font-headline-sm text-headline-sm text-on-surface">' + esc(ch.name) + '</h3></div><span class="text-body-sm text-on-surface-variant">' + fd(ch.start) + ' a ' + fd(ch.end) + ' · ' + ch.min + '–' + ch.max + ' op/dia</span></div>' +
            banner +
            '<div class="flex gap-1">' + cells + '</div>' +
            '<p class="text-[12px] text-on-surface-variant mt-md">Poste o <b>print</b> de cada operação no tópico <b>Prints das Operações</b>. Faça de 1 a 2 operações por dia.</p>' +
            '</div>';
          box.classList.remove('hidden');
        }, function () {});
      })();
      var search = document.getElementById('topic-search');
      if (search) search.addEventListener('input', function (e) {
        var v = e.target.value.trim().toLowerCase(), vis = 0;
        document.querySelectorAll('#topic-list .topic-item').forEach(function (it) {
          var m = it.querySelector('h3').textContent.toLowerCase().indexOf(v) !== -1;
          it.style.display = m ? 'flex' : 'none'; if (m) vis++;
        });
        var nr = document.getElementById('no-results'); if (nr) nr.classList.toggle('hidden', vis > 0);
      });
    },
    destroy: function () {}
  };

  // =====================================================================
  // CHAT
  // =====================================================================
  GVSI.views.chat = (function () {
    var S = null;
    function cleanup() {
      if (!S) return;
      S.destroyed = true;
      (S.channels || []).forEach(function (c) { try { sb.removeChannel(c); } catch (e) {} });
      if (S.dropView) { try { ['dragover', 'dragenter'].forEach(function (ev) { S.dropView.removeEventListener(ev, S.onDragPrev); }); S.dropView.removeEventListener('drop', S.onDrop); } catch (e) {} }
      if (S.picker && S.picker.parentNode) S.picker.remove();
      if (S.reactPop && S.reactPop.parentNode) S.reactPop.remove();
      if (S.mentionMenu && S.mentionMenu.parentNode) S.mentionMenu.remove();
      if (S.msgMenu && S.msgMenu.parentNode) S.msgMenu.remove();
      ['img-lightbox', 'img-editor'].forEach(function (id) { var el = document.getElementById(id); if (el) el.remove(); });
      if (S.recTimer) clearInterval(S.recTimer);
      if (S.recStream) { try { S.recStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
      if (S.onPickerDoc) document.removeEventListener('click', S.onPickerDoc);
      if (S.onReactPopDoc) document.removeEventListener('click', S.onReactPopDoc);
      if (S.onMentionDoc) document.removeEventListener('click', S.onMentionDoc);
      if (S.onMsgMenuDoc) document.removeEventListener('click', S.onMsgMenuDoc);
      if (S.onMsgMenuScroll) window.removeEventListener('scroll', S.onMsgMenuScroll, true);
      S = null;
    }
    return {
      destroy: cleanup,
      render: async function (view, params) {
        var slug = params.topico;
        var me = G.me || {};
        var isAdmin = me.role === 'admin';
        S = { destroyed: false, channels: [], picker: null, reactionsMap: {}, recTimer: null, recStream: null, mediaRecorder: null, recChunks: [], recMime: '', recSeconds: 0, recording: false };
        var self = S;

        view.innerHTML =
          '<header class="fixed top-0 left-0 right-0 lg:left-[var(--side-w)] z-40 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-between px-container-margin h-16 lg:h-[89px]">' +
            '<div class="flex items-center gap-md min-w-0">' +
              '<a class="lg:hidden text-primary flex items-center" href="/" aria-label="Voltar"><span class="material-symbols-outlined">arrow_back</span></a>' +
              '<div class="flex flex-col min-w-0 justify-center"><h1 id="chat-title" class="font-headline-sm text-headline-sm font-bold text-primary leading-tight truncate">Comunidade do Giovanni</h1><span id="chat-subtitle" class="text-body-sm text-on-surface-variant leading-tight">Grupo da comunidade</span></div>' +
            '</div>' +
            '<div class="flex items-center gap-xs">' +
              '<button type="button" id="chat-search-btn" class="text-primary flex items-center w-9 h-9 justify-center rounded-full hover:bg-surface-container-high" aria-label="Buscar mensagens"><span class="material-symbols-outlined">search</span></button>' +
              '<button type="button" data-theme-toggle class="lg:hidden text-primary flex items-center" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button>' +
            '</div>' +
          '</header>' +
          '<div id="chat-search-panel" class="hidden fixed top-16 lg:top-[89px] left-0 right-0 lg:left-[var(--side-w)] z-40 bg-surface border-b border-outline-variant shadow-lg"><div class="max-w-3xl mx-auto p-sm"><div class="relative"><span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">search</span><input id="chat-search-input" type="text" autocomplete="off" placeholder="Buscar nas mensagens deste grupo…" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2 pl-10 pr-10 text-body-md text-on-surface focus:ring-2 focus:ring-primary/30"><button type="button" id="chat-search-close" class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"><span class="material-symbols-outlined text-[20px]">close</span></button></div><div id="chat-search-results" class="max-h-[50vh] overflow-y-auto custom-scrollbar mt-sm space-y-0.5"></div></div></div>' +
          '<main id="chat-scroll" class="lg:pl-[var(--side-w)] h-[100dvh] pt-16 lg:pt-[89px] pb-64 lg:pb-52 flex flex-col overflow-y-auto custom-scrollbar">' +
            '<div id="chat-messages" class="hidden w-full max-w-3xl mx-auto flex flex-col gap-lg px-container-margin py-lg"></div>' +
            '<div id="chat-loading" class="flex-grow flex items-center justify-center text-on-surface-variant text-body-sm gap-sm"><span class="material-symbols-outlined animate-spin">progress_activity</span> Carregando…</div>' +
            '<div id="chat-empty" class="hidden flex-grow flex flex-col items-center justify-center text-center gap-md py-xl px-container-margin"><div class="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[40px]">forum</span></div><div class="space-y-xs max-w-xs"><h2 class="font-headline-sm text-headline-sm text-on-surface">Ainda não há mensagens</h2><p class="text-body-sm text-on-surface-variant">Seja o primeiro a enviar uma mensagem neste grupo.</p></div></div>' +
          '</main>' +
          '<div id="chat-composer" class="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-[var(--side-w)] px-container-margin pb-md lg:pb-lg z-40">' +
            '<div class="max-w-3xl mx-auto flex justify-end">' +
                '<button type="button" id="scroll-bottom-btn" class="hidden mb-2 w-11 h-11 rounded-full bg-surface-container-highest text-on-surface shadow-lg border border-outline-variant/50 flex items-center justify-center active:scale-95 transition" aria-label="Ir para a última mensagem" title="Ir para a última mensagem"><span class="material-symbols-outlined">keyboard_double_arrow_down</span></button>' +
              '</div>' +
              '<form id="chat-form" class="glass-input rounded-2xl p-sm flex flex-col gap-sm shadow-xl border border-outline-variant/40 max-w-3xl mx-auto">' +
              '<div id="composer-normal" class="flex flex-col gap-sm">' +
                '<div id="reply-preview" class="hidden items-start gap-sm bg-surface-container-high border-l-4 border-primary rounded-lg px-sm py-2">' +
                  '<div class="flex-1 min-w-0"><p id="reply-author" class="text-label-md font-label-md text-primary truncate"></p><p id="reply-snippet" class="text-body-sm text-on-surface-variant truncate"></p></div>' +
                  '<button type="button" id="reply-cancel" class="w-9 h-9 shrink-0 rounded-full hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant" aria-label="Cancelar resposta"><span class="material-symbols-outlined text-[20px]">close</span></button>' +
                '</div>' +
                '<div id="chat-input" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Escreva uma mensagem" data-placeholder="Escreva uma mensagem..." class="ce-input w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-3 text-body-md focus:ring-2 focus:ring-primary/20 text-on-surface min-h-[3rem] max-h-40 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-words"></div>' +
                '<div class="flex items-center gap-xs -my-xs">' +
                  '<button type="button" id="fmt-bold" class="h-11 px-3 rounded-lg hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant" aria-label="Negrito" title="Negrito (**texto**)"><span class="material-symbols-outlined text-[22px]">format_bold</span></button>' +
                  '<button type="button" id="fmt-italic" class="h-11 px-3 rounded-lg hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant" aria-label="Itálico" title="Itálico (*texto*)"><span class="material-symbols-outlined text-[22px]">format_italic</span></button>' +
                  '<button type="button" id="btn-emoji" class="h-11 px-3 rounded-lg hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant" aria-label="Emoji" title="Emoji"><span class="material-symbols-outlined text-[24px]">mood</span></button>' +
                  '<button type="button" id="btn-temp" class="hidden h-11 px-3 rounded-lg hover:bg-surface-container-high items-center justify-center text-on-surface-variant gap-1" aria-label="Mensagem temporária" title="Mensagem temporária (some sozinha)"><span class="material-symbols-outlined text-[22px]">timer</span><span id="btn-temp-lbl" class="text-[12px] font-bold"></span></button>' +
                '</div>' +
                '<div class="flex flex-wrap items-center gap-sm">' +
                  '<a id="btn-attach" href="/enviar/' + esc(slug) + '" class="h-11 px-3 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-xs shrink-0" aria-label="Anexar foto ou arquivo"><span class="material-symbols-outlined text-[24px]">attach_file</span><span class="text-body-sm font-label-md">Anexar</span></a>' +
                  '<button type="button" id="btn-mic" class="h-11 px-3 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-xs shrink-0" aria-label="Gravar áudio"><span class="material-symbols-outlined text-[24px]">mic</span><span class="text-body-sm font-label-md">Áudio</span></button>' +
                  '<button type="submit" id="btn-send" class="h-11 px-5 ml-auto bg-primary text-on-primary rounded-xl flex items-center gap-xs shadow-lg active:scale-95 transition-all shrink-0" aria-label="Enviar mensagem"><span class="material-symbols-outlined fill text-[24px]">send</span><span class="text-body-md font-bold">Enviar</span></button>' +
                '</div>' +
              '</div>' +
              '<div id="rec-bar" class="hidden flex items-center gap-sm px-sm py-1 flex-wrap">' +
                '<span id="rec-dot" class="w-3 h-3 rounded-full bg-error animate-pulse shrink-0"></span>' +
                '<span id="rec-time" class="text-body-lg text-on-surface tabular-nums">0:00</span>' +
                '<audio id="rec-preview" class="hidden"></audio>' +
                '<span class="flex-grow"></span>' +
                '<button type="button" id="rec-pause" class="h-11 px-3 rounded-xl border border-outline-variant text-on-surface flex items-center gap-xs shrink-0" aria-label="Pausar"><span class="material-symbols-outlined text-[22px]" id="rec-pause-ic">pause</span><span class="text-body-sm" id="rec-pause-lbl">Pausar</span></button>' +
                '<button type="button" id="rec-listen" class="hidden h-11 px-3 rounded-xl border border-outline-variant text-primary items-center gap-xs shrink-0" aria-label="Ouvir"><span class="material-symbols-outlined text-[22px]" id="rec-listen-ic">play_arrow</span><span class="text-body-sm" id="rec-listen-lbl">Ouvir</span></button>' +
                '<button type="button" id="rec-cancel" class="h-11 px-3 rounded-xl border border-outline-variant text-error flex items-center gap-xs shrink-0" aria-label="Excluir gravação"><span class="material-symbols-outlined text-[22px]">delete</span><span class="text-body-sm">Excluir</span></button>' +
                '<button type="button" id="rec-send" class="h-11 px-4 bg-primary text-on-primary rounded-xl flex items-center gap-xs shadow shrink-0" aria-label="Enviar áudio"><span class="material-symbols-outlined fill text-[22px]">send</span><span class="text-body-sm font-bold">Enviar</span></button>' +
              '</div>' +
            '</form>' +
          '</div>' +
          '<div id="chat-readonly" class="hidden fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-[var(--side-w)] px-container-margin pb-md lg:pb-lg z-40"><div class="max-w-3xl mx-auto flex items-center justify-center gap-sm bg-surface-container-high text-on-surface-variant rounded-2xl p-md border border-outline-variant/40 text-body-sm"><span class="material-symbols-outlined text-[20px]">lock</span>Somente administradores podem publicar neste tópico.</div></div>' +
          '<nav class="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-xl bg-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] flex justify-around items-center h-16 px-2">' +
            '<a class="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1" href="/"><span class="material-symbols-outlined">groups</span><span class="font-label-md text-label-md">Grupos</span></a>' +
            '<a class="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1" href="/perfil"><span class="material-symbols-outlined">person</span><span class="font-label-md text-label-md">Meu Perfil</span></a>' +
          '</nav>';

        var titleEl = document.getElementById('chat-title');
        var msgsEl = document.getElementById('chat-messages');
        msgsEl.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('.msg-av'); if (!a) return; var w = a.closest('[data-author-id]'); var aid = w && w.getAttribute('data-author-id'); if (aid && G.showMemberCard) G.showMemberCard(aid); });
        var emptyEl = document.getElementById('chat-empty');
        var loadingEl = document.getElementById('chat-loading');
        var scrollEl = document.getElementById('chat-scroll');
        var form = document.getElementById('chat-form');
        var input = document.getElementById('chat-input');
        // ---- compositor WYSIWYG (contenteditable): negrito/itálico REAIS, sem asteriscos visíveis ----
        // serializa o conteúdo pra markdown (**negrito**, *itálico*); nunca lança (fallback = texto puro)
        function ceSerialize(el) {
          try {
            var out = '';
            (function walk(node) {
              for (var i = 0; i < node.childNodes.length; i++) {
                var c = node.childNodes[i];
                if (c.nodeType === 3) { out += c.nodeValue; continue; }
                if (c.nodeType !== 1) continue;
                var tag = c.nodeName.toLowerCase();
                if (tag === 'br') { out += '\n'; continue; }
                var fw = c.style && c.style.fontWeight;
                var bold = tag === 'strong' || tag === 'b' || fw === 'bold' || /^[6-9]00$/.test(fw || '');
                var ital = tag === 'em' || tag === 'i' || (c.style && c.style.fontStyle === 'italic');
                var block = tag === 'div' || tag === 'p';
                if (block && out && out.slice(-1) !== '\n') out += '\n';
                if (bold) out += '**';
                if (ital) out += '*';
                walk(c);
                if (ital) out += '*';
                if (bold) out += '**';
              }
            })(el);
            return out;
          } catch (e) { return el.textContent || ''; }
        }
        function ceText(el) { return el.textContent || ''; }
        function ceClear(el) { el.innerHTML = ''; }
        // caret <-> deslocamento no texto visível
        function ceCaret(el) {
          var sel = window.getSelection(); if (!sel || !sel.rangeCount) return null;
          var rg = sel.getRangeAt(0); if (!el.contains(rg.startContainer)) return null;
          function off(node, o) { var r = document.createRange(); r.selectNodeContents(el); try { r.setEnd(node, o); } catch (x) { return el.textContent.length; } return r.toString().length; }
          return { start: off(rg.startContainer, rg.startOffset), end: off(rg.endContainer, rg.endOffset) };
        }
        function ceSetCaret(el, start, end) {
          if (end == null) end = start;
          var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n, acc = 0, sN = null, sO = 0, eN = null, eO = 0;
          while ((n = w.nextNode())) { var len = n.nodeValue.length; if (sN == null && acc + len >= start) { sN = n; sO = start - acc; } if (eN == null && acc + len >= end) { eN = n; eO = end - acc; } acc += len; }
          el.focus(); if (sN == null) return; if (eN == null) { eN = sN; eO = sO; }
          var rg = document.createRange(); try { rg.setStart(sN, sO); rg.setEnd(eN, eO); } catch (e) { return; }
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rg);
        }
        function scrollBottom() { scrollEl.scrollTop = scrollEl.scrollHeight; }
        function nearBottom() { return (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight) < 160; }
        var scrollBtn = document.getElementById('scroll-bottom-btn');
        function updateScrollBtn() { if (scrollBtn) scrollBtn.classList.toggle('hidden', nearBottom()); }
        if (scrollBtn) scrollBtn.addEventListener('click', function () { try { scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' }); } catch (e) { scrollBottom(); } scrollBtn.classList.add('hidden'); });

        // perfil próprio (nome/avatar) já está em G.me
        // resolve tópico
        var topic = null;
        if (slug) { var tr = await sb.from('comu_topics').select('id,name,slug,post_policy').eq('slug', slug).maybeSingle(); topic = tr.data; }
        if (self.destroyed) return;
        if (topic) { titleEl.textContent = topic.name; document.title = 'Comunidade do Giovanni | ' + topic.name; }

        if (topic && topic.post_policy === 'readonly' && !isAdmin) {
          document.getElementById('chat-composer').classList.add('hidden');
          document.getElementById('chat-readonly').classList.remove('hidden');
          document.getElementById('chat-subtitle').textContent = 'Somente leitura';
        }
        var isSupport = topic && topic.post_policy === 'support';
        if (isSupport && isAdmin) { G.navigate('/suporte'); return; }
        async function refreshTicketInfo() {
          if (!isSupport) return;
          var t2 = await sb.from('comu_support_tickets').select('id,protocol,status,rating,solved').eq('user_id', me.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (self.destroyed) return;
          var sub = document.getElementById('chat-subtitle');
          if (t2.data) { var st = t2.data.status === 'aberto' ? 'Aberto' : (t2.data.status === 'resolvido' ? 'Resolvido' : 'Fechado'); sub.textContent = 'Ticket ' + t2.data.protocol + ' • ' + st; }
          else sub.textContent = 'Envie uma mensagem para abrir um ticket';
          maybeShowRating(t2.data);
        }
        function maybeShowRating(tk) {
          var existing = document.getElementById('support-rating-card');
          if (!tk || tk.status !== 'resolvido' || tk.rating != null) { if (existing) existing.remove(); return; }
          if (existing) return;
          var chosen = { rating: 0, solved: null };
          var card = document.createElement('div');
          card.id = 'support-rating-card';
          card.className = 'w-full bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-lg shadow-sm space-y-md my-md';
          card.innerHTML =
            '<h3 class="font-headline-sm text-headline-sm text-on-surface text-center">Como foi o atendimento?</h3>' +
            '<div class="space-y-xs"><p class="text-body-sm text-on-surface-variant text-center">Resolveu seu problema?</p><div class="flex gap-sm justify-center"><button type="button" data-solved="s" class="rt-solved h-10 px-5 rounded-full border border-outline-variant text-on-surface font-label-md">Sim</button><button type="button" data-solved="n" class="rt-solved h-10 px-5 rounded-full border border-outline-variant text-on-surface font-label-md">Não</button></div></div>' +
            '<div class="space-y-xs"><p class="text-body-sm text-on-surface-variant text-center">Sua nota</p><div id="rt-stars" class="flex gap-1 justify-center"></div></div>' +
            '<button type="button" id="rt-send" class="w-full h-11 bg-primary text-on-primary rounded-xl font-label-md disabled:opacity-50" disabled>Enviar avaliação</button>';
          var stars = card.querySelector('#rt-stars');
          for (var i = 1; i <= 5; i++) { (function (n) { var s = document.createElement('button'); s.type = 'button'; s.className = 'rt-star text-outline transition-transform active:scale-90'; s.innerHTML = '<span class="material-symbols-outlined" style="font-size:34px">star</span>'; s.addEventListener('click', function () { chosen.rating = n; paint(); }); stars.appendChild(s); })(i); }
          function paint() {
            [].forEach.call(stars.children, function (s, idx) { var on = idx < chosen.rating; s.classList.toggle('text-tertiary', on); s.classList.toggle('text-outline', !on); s.firstChild.classList.toggle('fill', on); });
            card.querySelectorAll('.rt-solved').forEach(function (b) { var on = chosen.solved != null && ((b.dataset.solved === 's') === chosen.solved); b.classList.toggle('bg-primary', on); b.classList.toggle('text-on-primary', on); b.classList.toggle('border-primary', on); });
            card.querySelector('#rt-send').disabled = !(chosen.rating > 0 && chosen.solved != null);
          }
          card.querySelectorAll('.rt-solved').forEach(function (b) { b.addEventListener('click', function () { chosen.solved = (b.dataset.solved === 's'); paint(); }); });
          card.querySelector('#rt-send').addEventListener('click', async function () {
            var btn = card.querySelector('#rt-send'); btn.disabled = true; btn.textContent = 'Enviando...';
            var r = await sb.rpc('comu_rate_ticket', { p_ticket_id: tk.id, p_rating: chosen.rating, p_solved: chosen.solved });
            if (r.error) { G.toast('Não foi possível enviar: ' + r.error.message); btn.disabled = false; btn.textContent = 'Enviar avaliação'; return; }
            card.remove(); G.toast('Obrigado pela avaliação!');
          });
          msgsEl.appendChild(card); scrollBottom();
        }

        var seen = Object.create(null);
        // ---- responder citando (#2) ----
        var replyState = null;
        function msgPreview(m) {
          if (!m) return 'mensagem';
          if (m.status === 'deleted') return 'mensagem apagada';
          if (m.kind === 'image') return '📷 Foto';
          if (m.kind === 'video') return '🎬 Vídeo';
          if (m.kind === 'audio') return '🎤 Áudio';
          if (m.kind === 'file') return '📎 ' + ((m.media_meta && m.media_meta.name) || 'Arquivo');
          var t = (m.body || '').replace(/\s+/g, ' ').trim();
          return t.length > 90 ? t.slice(0, 90) + '…' : (t || 'mensagem');
        }
        function startReply(m) {
          if (isSupport) return; // suporte é 1:1: sem citação por ora
          var author = (me.id && m.author_id === me.id) ? 'Você' : (m.author_name || 'Membro');
          replyState = { id: m.id, author: author, snippet: msgPreview(m) };
          document.getElementById('reply-author').textContent = 'Respondendo a ' + author;
          document.getElementById('reply-snippet').textContent = replyState.snippet;
          var box = document.getElementById('reply-preview'); box.classList.remove('hidden'); box.classList.add('flex');
          if (input) input.focus();
        }
        function clearReply() { replyState = null; var box = document.getElementById('reply-preview'); if (box) { box.classList.add('hidden'); box.classList.remove('flex'); } }
        var replyCancelBtn = document.getElementById('reply-cancel'); if (replyCancelBtn) replyCancelBtn.addEventListener('click', clearReply);
        // ---- menções (#6): #tópicos e @pessoas ----
        var mentionMenu = document.createElement('div'); self.mentionMenu = mentionMenu;
        mentionMenu.className = 'hidden fixed z-[82] bg-surface-container-highest border border-outline-variant rounded-xl shadow-lg py-1 w-[280px] max-w-[86vw] max-h-[46vh] overflow-y-auto';
        document.body.appendChild(mentionMenu);
        var mentionCtx = null, mentionActive = 0, mentionRows = [], mentionTopics = null, mentionSeq = 0, mentionTimer = null;
        function hideMention() { mentionMenu.classList.add('hidden'); mentionCtx = null; mentionRows = []; }
        function positionMention() { var r = input.getBoundingClientRect(), pr = mentionMenu.getBoundingClientRect(); var top = r.top - pr.height - 6; if (top < 8) top = r.bottom + 6; var left = r.left; if (left + pr.width > window.innerWidth - 8) left = window.innerWidth - 8 - pr.width; mentionMenu.style.top = top + 'px'; mentionMenu.style.left = Math.max(8, left) + 'px'; }
        function setMentionActive(i) { mentionActive = (i + mentionRows.length) % mentionRows.length; [].forEach.call(mentionMenu.children, function (c, idx) { c.classList.toggle('bg-surface-container-high', idx === mentionActive); }); var el = mentionMenu.children[mentionActive]; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
        function renderMention(rows) {
          mentionRows = rows; mentionActive = 0;
          if (!rows.length) { hideMention(); return; }
          mentionMenu.innerHTML = '';
          rows.forEach(function (row, i) {
            var b = document.createElement('button'); b.type = 'button';
            b.className = 'w-full flex items-center gap-sm px-3 py-2 text-left ' + (i === 0 ? 'bg-surface-container-high' : '');
            if (row.kind === 'topic') b.innerHTML = '<span class="material-symbols-outlined text-[20px] text-primary shrink-0">' + (row.icon || 'tag') + '</span><span class="truncate text-body-md text-on-surface">' + esc(row.name) + '</span>';
            else b.innerHTML = (row.avatar_url ? '<img src="' + esc(row.avatar_url) + '" class="w-7 h-7 rounded-full object-cover shrink-0" alt="">' : '<span class="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[16px]">person</span></span>') + '<span class="truncate text-body-md text-on-surface">' + esc(row.full_name || 'Membro') + '</span>';
            b.addEventListener('mousedown', function (e) { e.preventDefault(); pickMention(i); });
            mentionMenu.appendChild(b);
          });
          mentionMenu.classList.remove('hidden'); positionMention();
        }
        function pickMention(i) {
          var row = mentionRows[i]; if (!row || !mentionCtx) return;
          var token = row.kind === 'topic' ? ('#' + row.slug) : ('@' + String(row.full_name || 'membro').trim().split(/\s+/)[0]);
          ceSetCaret(input, mentionCtx.start, mentionCtx.end);
          try { document.execCommand('insertText', false, token + ' '); } catch (x) {}
          hideMention();
        }
        function onMentionType() {
          var o = ceCaret(input); if (!o) { hideMention(); return; }
          var pos = o.start, text = ceText(input).slice(0, pos);
          var mm = text.match(/(^|\s)([@#])([^\s@#]*)$/);
          if (!mm) { hideMention(); return; }
          var trigger = mm[2], q = mm[3];
          mentionCtx = { start: pos - q.length - 1, end: pos };
          if (trigger === '#') {
            if (!mentionTopics) mentionTopics = (G.topics || []).map(function (t) { return { kind: 'topic', slug: t.id, name: t.name, icon: t.icon }; });
            var ql = q.toLowerCase();
            renderMention(mentionTopics.filter(function (t) { return !ql || String(t.slug).toLowerCase().indexOf(ql) >= 0 || String(t.name || '').toLowerCase().indexOf(ql) >= 0; }).slice(0, 8));
          } else {
            if (mentionTimer) clearTimeout(mentionTimer);
            var seq = ++mentionSeq;
            mentionTimer = setTimeout(async function () {
              var r = await sb.rpc('comu_search_members', { p_q: q });
              if (self.destroyed || seq !== mentionSeq || !mentionCtx) return;
              renderMention((r.data || []).map(function (u) { return { kind: 'person', id: u.id, full_name: u.full_name, avatar_url: u.avatar_url }; }));
            }, 120);
          }
        }
        input.addEventListener('input', onMentionType);
        input.addEventListener('keydown', function (e) {
          if (!mentionMenu.classList.contains('hidden') && mentionRows.length) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionActive(mentionActive + 1); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setMentionActive(mentionActive - 1); return; }
            if (e.key === 'Enter') { e.preventDefault(); pickMention(mentionActive); return; }
            if (e.key === 'Escape') { e.preventDefault(); hideMention(); return; }
            return;
          }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (typeof form.requestSubmit === 'function') form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); }
        });
        // editor de pré-envio de imagem (redimensionar + legenda) — reusa o cropper
        async function openImageComposer(file) {
          if (!file) return;
          try { await ensureCropper(); } catch (e) { G.toast('Editor indisponível.'); return; }
          if (self.destroyed) return;
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
          function closeC() { try { if (cropper) cropper.destroy(); } catch (e) {} cropper = null; try { URL.revokeObjectURL(src); } catch (e) {} ov.remove(); }
          function applyZoom() { if (cropper) { try { cropper.zoomTo(baseRatio * (parseInt(zoomEl.value, 10) || 100) / 100); } catch (e) {} } }
          imgEl.onload = function () { try { cropper = new Cropper(imgEl, { viewMode: 1, autoCropArea: 0.95, background: false, dragMode: 'crop', zoomOnWheel: false, ready: function () { var cd = cropper.getCanvasData(); baseRatio = (cd && cd.naturalWidth) ? (cd.width / cd.naturalWidth) : 1; if (zoomEl) zoomEl.value = 100; } }); } catch (e) {} };
          imgEl.onerror = function () { G.toast('Não foi possível abrir a imagem.'); closeC(); };
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
            if (!canvas) { G.toast('Falha ao processar a imagem.'); btn.disabled = false; return; }
            canvas.toBlob(async function (blob) {
              if (!blob) { G.toast('Falha ao gerar a imagem.'); btn.disabled = false; return; }
              var caption = (ov.querySelector('#ic-caption').value || '').trim() || null;
              try {
                var path = (slug || 'geral') + '/' + me.id + '/' + Date.now() + '.jpg';
                var up = await G.storageUpload(path, blob, 'image/jpeg');
                if (!up.ok) { G.toast('Não consegui enviar a imagem. Verifique sua conexão e tente de novo.'); btn.disabled = false; return; }
                var url = sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
                var res;
                if (isSupport) res = await sb.rpc('comu_send_support_message', { p_body: caption, p_kind: 'image', p_media_url: url, p_author_name: me.full_name || 'Membro' });
                else res = await sb.from('comu_messages').insert({ topic_id: topic.id, author_id: me.id, kind: 'image', body: caption, media_url: url, media_meta: { w: canvas.width, h: canvas.height, mime: 'image/jpeg' }, author_name: me.full_name || 'Membro', author_avatar: me.avatar_url || null }).select().single();
                if (res.error) { G.toast('Erro ao enviar: ' + res.error.message); btn.disabled = false; return; }
                if (!self.destroyed && res.data) addMessage(res.data, true);
                closeC();
              } catch (e) { G.toast('Não foi possível enviar.'); btn.disabled = false; }
            }, 'image/jpeg', 0.9);
          };
        }
        // ---- enviar arquivo por arrastar/soltar ou colar (imagem/vídeo/áudio) ----
        async function sendFile(file) {
          if (!file || !topic) return;
          if (topic.post_policy === 'readonly' && !isAdmin) { G.toast('Você não pode enviar aqui.'); return; }
          var ty = file.type || '';
          var kind = ty.indexOf('image') === 0 ? 'image' : (ty.indexOf('video') === 0 ? 'video' : (ty.indexOf('audio') === 0 ? 'audio' : null));
          if (!kind) { if (isAdmin) kind = 'file'; else { G.toast('Só imagem, vídeo ou áudio.'); return; } } // admin pode enviar qualquer arquivo
          if (kind === 'video' && !isAdmin && !isSupport) { G.toast('Vídeo só pode ser enviado no suporte.'); return; }
          if (kind === 'audio' && !isAdmin && !isSupport) { G.toast('Áudio só pode ser enviado no suporte.'); return; }
          if (kind === 'image') { openImageComposer(file); return; } // imagem: redimensionar/legendar antes de enviar
          G.toast('Enviando…');
          try {
            var ext = ((file.name && file.name.indexOf('.') >= 0) ? file.name.split('.').pop() : (kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : kind === 'audio' ? 'webm' : 'bin')).toLowerCase();
            var path = (slug || 'geral') + '/' + me.id + '/' + Date.now() + '.' + ext;
            var up = await G.storageUpload(path, file, ty || undefined);
            if (!up.ok) { G.toast('Não consegui enviar. Verifique sua conexão e tente de novo.'); return; }
            var url = sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
            var res;
            if (isSupport) res = await sb.rpc('comu_send_support_message', { p_body: null, p_kind: kind, p_media_url: url, p_author_name: me.full_name || 'Membro' });
            else res = await sb.from('comu_messages').insert({ topic_id: topic.id, author_id: me.id, kind: kind, media_url: url, media_meta: { name: file.name, size: file.size, mime: ty }, author_name: me.full_name || 'Membro', author_avatar: me.avatar_url || null }).select().single();
            if (res.error) { G.toast('Erro ao enviar: ' + res.error.message); return; }
            if (!self.destroyed && res.data) addMessage(res.data, true);
          } catch (e) { G.toast('Não foi possível enviar.'); }
        }
        // drop com handlers nomeados guardados em S e removidos no cleanup (senão vazam entre telas
        // e o arquivo solto no suporte dispara os drops de chats visitados antes)
        self.dropView = view;
        self.onDragPrev = function (e) { e.preventDefault(); };
        self.onDrop = function (e) { e.preventDefault(); if (self.destroyed) return; var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) sendFile(f); };
        ['dragover', 'dragenter'].forEach(function (ev) { view.addEventListener(ev, self.onDragPrev); });
        view.addEventListener('drop', self.onDrop);
        // colar: imagem/mídia envia; texto cola normal (respeitando o teto)
        input.addEventListener('paste', function (e) {
          var dt = e.clipboardData || window.clipboardData;
          if (dt && dt.files && dt.files.length) { var f = dt.files[0]; if (f && /^(image|video|audio)\//.test(f.type || '')) { e.preventDefault(); sendFile(f); return; } }
          e.preventDefault(); var t = ''; try { t = dt.getData('text'); } catch (x) {} t = (t || '').slice(0, 65536); try { document.execCommand('insertText', false, t); } catch (x) { }
        });
        // ao esvaziar, tira <br>/blocos órfãos pra o placeholder (:empty) voltar
        input.addEventListener('input', function () { if (!input.textContent) input.innerHTML = ''; });
        self.onMentionDoc = function (e) { if (mentionMenu.classList.contains('hidden')) return; if (!mentionMenu.contains(e.target) && e.target !== input) hideMention(); };
        document.addEventListener('click', self.onMentionDoc);
        // ---- render de mensagem ----
        function renderMsgBody(container, m, mine) {
          container.innerHTML = '';
          if (m.status === 'deleted') { container.innerHTML = '<div class="rounded-xl p-md ' + (mine ? 'rounded-tr-none' : 'rounded-tl-none') + ' bg-surface-container-high text-on-surface-variant text-body-sm italic flex items-center gap-xs"><span class="material-symbols-outlined text-[16px]">block</span>mensagem apagada</div>'; return; }
          var when = timeStr(m.created_at);
          var edited = (m.status === 'edited' && mine) ? ' <span class="text-[12px] opacity-80">(editado)</span>' : '';
          var tempTag = '';
          if (m.expires_at) { var _lms = new Date(m.expires_at).getTime() - Date.now(); var _lt = _lms <= 0 ? 'expira' : (_lms >= 3600000 ? Math.round(_lms / 3600000) + 'h' : Math.max(1, Math.round(_lms / 60000)) + 'min'); tempTag = '<span class="inline-flex items-center gap-[1px] text-[11px] ' + (mine ? 'text-white/85' : 'text-on-surface-variant') + '" title="Mensagem temporária — some sozinha"><span class="material-symbols-outlined text-[13px]">timer</span>' + _lt + '</span>'; }
          var authorIsAdmin = (mine && isAdmin) || !!(G.adminIds && m.author_id && G.adminIds[m.author_id]); // links clicáveis só nas mensagens da equipe
          var content;
          if (m.kind === 'image' && m.media_url) content = '<img src="' + esc(m.media_url) + '" data-full="' + esc(m.media_url) + '" class="msg-img rounded-lg max-w-full mb-xs cursor-zoom-in" alt="">' + (m.body ? '<p class="' + (mine ? '' : 'text-on-surface ') + 'font-body-md">' + G.fmt(m.body, authorIsAdmin) + edited + '</p>' : '');
          else if (m.kind === 'video' && m.media_url) content = G.videoHtml(m.media_url) + (m.body ? '<p class="' + (mine ? '' : 'text-on-surface ') + 'font-body-md">' + G.fmt(m.body, authorIsAdmin) + edited + '</p>' : '');
          else if (m.kind === 'audio' && m.media_url) content = G.audioHtml(m.media_url, mine);
          else if (m.kind === 'file' && m.media_url) content = G.fileCard(m, mine) + (m.body ? '<p class="' + (mine ? '' : 'text-on-surface ') + 'font-body-md mt-xs">' + G.fmt(m.body, authorIsAdmin) + edited + '</p>' : '');
          else content = '<p class="' + (mine ? '' : 'text-on-surface ') + 'font-body-md whitespace-pre-wrap break-words">' + G.fmt(m.body, authorIsAdmin) + edited + '</p>';
          if (m.reply_to && (m.reply_snippet || m.reply_author)) {
            var qB = mine ? 'border-white/50' : 'border-primary/60', qN = mine ? 'text-white' : 'text-primary', qT = mine ? 'text-white/85' : 'text-on-surface-variant', qBg = mine ? 'bg-white/10' : 'bg-black/5 dark:bg-white/10';
            content = '<div class="reply-quote mb-xs border-l-4 ' + qB + ' ' + qBg + ' rounded px-2 py-1 cursor-pointer" data-goto="' + esc(m.reply_to) + '"><p class="text-[12px] font-bold ' + qN + ' truncate">' + esc(G.shortName(m.reply_author) || 'Membro') + '</p><p class="text-[13px] ' + qT + ' truncate">' + esc(m.reply_snippet || '') + '</p></div>' + content;
          }
          var inner;
          var meBadge = isAdmin ? '<span class="inline-flex items-center gap-[2px] text-[11px] font-bold text-on-primary bg-primary rounded-full px-2 py-[1px] leading-none"><span class="material-symbols-outlined text-[13px]" style="font-variation-settings:\'FILL\' 1">verified</span>Equipe</span>' : '';
          if (mine) inner = '<div class="msg-head flex items-center gap-xs mr-sm mb-xs"><span class="text-[13px] text-on-surface-variant">' + when + '</span>' + meBadge + tempTag + '<span class="font-label-md text-label-md text-primary">Você</span></div><div class="message-gradient-outgoing text-white shadow-lg rounded-xl rounded-tr-none p-md">' + content + '</div>';
          else {
            var isAuthorAdmin = !!(G.adminIds && m.author_id && G.adminIds[m.author_id]);
            var avRing = isAuthorAdmin ? ' ring-2 ring-primary ring-offset-1 ring-offset-surface' : '';
            var av = m.author_avatar ? '<img src="' + esc(m.author_avatar) + '" class="msg-av w-8 h-8 rounded-full object-cover shrink-0' + avRing + '" alt="">' : '<span class="msg-av w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-outline shrink-0' + avRing + '"><span class="material-symbols-outlined text-[18px]">person</span></span>';
            var nameCls = isAuthorAdmin ? 'font-label-md text-label-md text-primary font-bold' : 'font-label-md text-label-md text-on-surface-variant';
            var adminBadge = isAuthorAdmin ? '<span class="inline-flex items-center gap-[2px] text-[11px] font-bold text-on-primary bg-primary rounded-full px-2 py-[1px] leading-none"><span class="material-symbols-outlined text-[13px]" style="font-variation-settings:\'FILL\' 1">verified</span>Equipe</span>' : '';
            var modHidden = isAdmin && m.moderation === 'hidden';
            var modTag = modHidden ? '<span class="inline-flex items-center gap-[2px] text-[10px] font-bold text-error bg-error/15 rounded-full px-2 py-[1px]"><span class="material-symbols-outlined text-[12px]">visibility_off</span>Oculto</span>' : '';
            var bubbleCls = isAuthorAdmin
              ? 'bg-primary/10 dark:bg-primary/20 shadow-[0px_6px_24px_rgba(0,0,0,0.10)] rounded-xl rounded-tl-none p-md border-2 border-primary/50 ring-1 ring-primary/15'
              : 'bg-surface-container-high shadow-[0px_4px_20px_rgba(0,0,0,0.05)] rounded-xl rounded-tl-none p-md border border-outline-variant/40';
            if (modHidden) bubbleCls += ' ring-2 ring-error/50 opacity-70';
            inner = '<div class="flex items-start gap-sm">' + av + '<div class="flex flex-col min-w-0"><div class="msg-head flex items-center gap-xs ml-sm mb-xs"><span class="' + nameCls + '">' + esc(G.shortName(m.author_name) || 'Membro') + '</span>' + adminBadge + modTag + tempTag + '<span class="text-[13px] text-on-surface-variant">' + when + '</span></div><div class="' + bubbleCls + '">' + content + '</div></div></div>';
          }
          container.innerHTML = inner;
          G.mountAudios(container);
          var qEl = container.querySelector('.reply-quote');
          if (qEl) qEl.addEventListener('click', function () { var t = msgsEl.querySelector('[data-msg-id="' + qEl.getAttribute('data-goto') + '"]'); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.style.transition = 'background-color .3s'; t.style.backgroundColor = 'rgba(37,99,235,0.15)'; setTimeout(function () { t.style.backgroundColor = ''; }, 900); } });
          var mimg = container.querySelector('.msg-img');
          if (mimg) mimg.addEventListener('click', function () { openLightbox(mimg.getAttribute('data-full'), m); });
          var mvid = container.querySelector('.vid-expand');
          if (mvid) mvid.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); G.lightbox(mvid.getAttribute('data-full'), { video: true }); });
          // #12 — ações (Reagir/Responder/Editar/Apagar/Banir) só no clique direito (desktop) ou toque longo (mobile)
          container._m = m;
          if (!container._menuBound) {
            container._menuBound = true;
            var buildItems = function () {
              var mm = container._m; var mineM = !!(me.id && mm.author_id === me.id);
              var age = Date.now() - new Date(mm.created_at).getTime(); var withinM = age < 1800000;
              var cEdit = mineM && (withinM || isAdmin) && mm.kind !== 'audio';
              var cDelete = isAdmin || (mineM && withinM);
              var cReply = !isSupport && !(topic && topic.post_policy === 'readonly' && !isAdmin);
              var cBan = !!(G.me && G.me.canBan) && !mineM && !!mm.author_id && !isSupport;
              var it = [{ icon: 'add_reaction', label: 'Reagir', run: function () { openPicker(container, mm.id); } }];
              if (cReply) it.push({ icon: 'reply', label: 'Responder', run: function () { startReply(mm); } });
              if (cEdit) it.push({ icon: 'edit', label: 'Editar', run: function () { startEdit(mm); } });
              if (cDelete) it.push({ icon: 'delete', label: 'Apagar', danger: true, run: function () { doDelete(mm); } });
              if (cBan) it.push({ icon: 'gavel', label: 'Banir usuário', danger: true, run: function () { doBan(mm); } });
              if (isAdmin && !isSupport && mm.author_id && mm.author_id !== me.id) it.push({ icon: 'support_agent', label: 'Responder no suporte', run: function () { replyInSupport(mm); } });
              if (isAdmin && mm.moderation === 'hidden') it.unshift({ icon: 'visibility', label: 'Mostrar a todos', run: function () { doApprove(mm); } });
              return it;
            };
            container.addEventListener('contextmenu', function (e) { e.preventDefault(); openMsgMenu(e.clientX, e.clientY, buildItems()); });
            var lpT = null, lpX = 0, lpY = 0, lpMoved = false;
            container.addEventListener('touchstart', function (e) { if (!e.touches[0]) return; lpMoved = false; lpX = e.touches[0].clientX; lpY = e.touches[0].clientY; lpT = setTimeout(function () { if (!lpMoved) openMsgMenu(lpX, lpY, buildItems()); }, 500); }, { passive: true });
            container.addEventListener('touchmove', function (e) { if (e.touches[0] && (Math.abs(e.touches[0].clientX - lpX) > 10 || Math.abs(e.touches[0].clientY - lpY) > 10)) { lpMoved = true; if (lpT) { clearTimeout(lpT); lpT = null; } } }, { passive: true });
            ['touchend', 'touchcancel'].forEach(function (ev) { container.addEventListener(ev, function () { if (lpT) { clearTimeout(lpT); lpT = null; } }); });
          }
        }
        function bubble(m) {
          if (m.kind === 'system') {
            var sw = document.createElement('div'); sw.setAttribute('data-msg-id', m.id); sw.className = 'w-full';
            sw.innerHTML = '<div class="w-full text-center text-body-sm text-on-surface-variant bg-surface-container-high rounded-2xl px-4 py-3">' + esc(m.body || '') + '</div>';
            return sw;
          }
          var mine = me.id && m.author_id === me.id;
          var wrap = document.createElement('div'); wrap.setAttribute('data-msg-id', m.id); wrap.setAttribute('data-author-id', m.author_id || ''); wrap.setAttribute('data-created', m.created_at || '');
          wrap.className = 'flex flex-col gap-xs max-w-[85%] ' + (mine ? 'items-end self-end' : 'items-start');
          var body = document.createElement('div'); body.className = 'msg-body w-full flex flex-col ' + (mine ? 'items-end' : 'items-start');
          renderMsgBody(body, m, mine); wrap.appendChild(body);
          var rr = document.createElement('div'); rr.className = 'react-row flex items-center gap-xs flex-wrap mt-xs' + (mine ? ' justify-end' : ''); rr.setAttribute('data-react', m.id); wrap.appendChild(rr);
          return wrap;
        }
        function regroup() {
          if (!document.getElementById('gvsi-grp-style')) { var st = document.createElement('style'); st.id = 'gvsi-grp-style'; st.textContent = '.grouped .msg-head{display:none}.grouped .msg-av{visibility:hidden}.grouped{margin-top:-0.4rem}.msg-av{cursor:pointer}'; document.head.appendChild(st); }
          var kids = msgsEl.children, prevA = null, prevT = 0;
          for (var i = 0; i < kids.length; i++) {
            var el = kids[i], aid = el.getAttribute('data-author-id');
            if (!aid) { el.classList.remove('grouped'); prevA = null; prevT = 0; continue; } // sistema quebra o grupo
            var t = Date.parse(el.getAttribute('data-created') || '') || 0;
            if (aid === prevA && prevT && (t - prevT) < 300000) el.classList.add('grouped'); else el.classList.remove('grouped'); // mesmo autor em até 5min
            prevA = aid; prevT = t;
          }
        }
        function applyDayDividers() {
          var olds = msgsEl.querySelectorAll('.day-divider'); for (var j = 0; j < olds.length; j++) olds[j].remove();
          var lastKey = null, kids = Array.prototype.slice.call(msgsEl.children);
          for (var i = 0; i < kids.length; i++) {
            var el = kids[i], c = el.getAttribute && el.getAttribute('data-created'); if (!c) continue;
            var d = new Date(c), key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
            if (key !== lastKey) { lastKey = key; var div = document.createElement('div'); div.className = 'day-divider w-full flex justify-center my-2'; div.innerHTML = '<span class="text-[12px] font-bold text-on-surface-variant bg-surface-container-high rounded-full px-3 py-1 shadow-sm">' + G.dayLabel(c) + '</span>'; msgsEl.insertBefore(div, el); }
          }
        }
        function markRead() { if (!me.id || !topic) return; clearTimeout(self.readT); self.readT = setTimeout(function () { if (self.destroyed) return; sb.from('comu_topic_reads').upsert({ topic_id: topic.id, user_id: me.id, last_read_at: new Date().toISOString() }, { onConflict: 'topic_id,user_id' }).then(function () { G.applyUnread(); }, function () {}); }, 600); }
        // poda: em conversas muito longas, mantém ~250 msgs no DOM (evita travar com o tempo). Só quando no fim; rolar pra cima recarrega.
        function pruneTop() { if (msgsEl.children.length <= 350 || !nearBottom()) return; while (msgsEl.children.length > 250) { var first = msgsEl.firstChild; if (!first) break; var id = first.getAttribute && first.getAttribute('data-msg-id'); if (id && seen[id]) delete seen[id]; msgsEl.removeChild(first); } var f = msgsEl.firstChild, ts = null; while (f) { var c = f.getAttribute && f.getAttribute('data-created'); if (c) { ts = c; break; } f = f.nextSibling; } if (ts) { oldestTs = ts; noOlder = false; } }
        function addMessage(m, scroll, live) { if (!m || seen[m.id]) return; if (m.expires_at && new Date(m.expires_at).getTime() <= Date.now()) return; seen[m.id] = true; msgsEl.appendChild(bubble(m)); renderReactions(m.id); emptyEl.classList.add('hidden'); msgsEl.classList.remove('hidden'); if (scroll) scrollBottom(); else updateScrollBtn(); markRead(); if (live && me.id && m.author_id !== me.id) G.playPing(); if (!isSupport && m.kind !== 'system') { try { G.lastMsgs[slug] = { body: m.body, kind: m.kind, author_name: m.author_name, created_at: m.created_at }; if (G.applyTopicPreviews) G.applyTopicPreviews(); } catch (e) {} } if (m.expires_at) { var _d = new Date(m.expires_at).getTime() - Date.now(); if (_d > 0 && _d < 90000000) setTimeout(function () { removeMessage(m.id); }, _d + 400); } applyDayDividers(); regroup(); pruneTop(); }
        function startEdit(m) {
          var wrap = msgsEl.querySelector('[data-msg-id="' + m.id + '"]'); if (!wrap) return;
          var body = wrap.querySelector('.msg-body'); var isMine = me.id && m.author_id === me.id; body.innerHTML = '';
          var ta = document.createElement('textarea'); ta.className = 'w-full max-w-md bg-surface-container-low border border-outline-variant rounded-xl p-sm text-body-md text-on-surface resize-none'; ta.rows = 2; ta.value = m.body || '';
          var row = document.createElement('div'); row.className = 'flex justify-end gap-sm mt-xs';
          var cc = document.createElement('button'); cc.type = 'button'; cc.className = 'text-body-sm text-on-surface-variant px-3 py-1'; cc.textContent = 'Cancelar';
          var sv = document.createElement('button'); sv.type = 'button'; sv.className = 'text-body-sm bg-primary text-on-primary rounded-full px-3 py-1'; sv.textContent = 'Salvar';
          cc.addEventListener('click', function () { renderMsgBody(body, m, isMine); });
          sv.addEventListener('click', async function () { var nb = ta.value.trim(); if (!nb) return; sv.disabled = true; var up = await sb.from('comu_messages').update({ body: nb, status: 'edited', edited_at: new Date().toISOString() }).eq('id', m.id).select().single(); if (up.error) { G.toast('Não foi possível editar (passou de 30 min?).'); renderMsgBody(body, m, isMine); return; } m.body = up.data.body; m.status = up.data.status; renderMsgBody(body, m, isMine); });
          row.appendChild(cc); row.appendChild(sv); body.appendChild(ta); body.appendChild(row); ta.focus();
        }
        function removeMessage(id) { var w = msgsEl.querySelector('[data-msg-id="' + id + '"]'); if (w) w.remove(); if (!msgsEl.children.length) { msgsEl.classList.add('hidden'); emptyEl.classList.remove('hidden'); } }
        function removeAuthorMessages(authorId) { if (!authorId) return; msgsEl.querySelectorAll('[data-author-id="' + authorId + '"]').forEach(function (w) { w.remove(); }); if (!msgsEl.children.length) { msgsEl.classList.add('hidden'); emptyEl.classList.remove('hidden'); } }
        async function doDelete(m) {
          var choice;
          if (isAdmin) {
            choice = await G.chooseAction({
              title: 'Apagar mensagem',
              text: 'De ' + (m.author_name || 'Membro') + '. Esta ação não pode ser desfeita.',
              icon: 'delete', danger: true,
              options: [
                { label: 'Apagar só esta mensagem', desc: 'Remove apenas este balão.', value: 'one', icon: 'delete' },
                { label: 'Apagar tudo desta pessoa neste tópico', desc: 'Remove todas as mensagens dela aqui neste grupo.', value: 'topic', icon: 'delete_sweep', danger: true },
                { label: 'Apagar tudo desta pessoa em todos os grupos', desc: 'Remove tudo que ela enviou na comunidade inteira.', value: 'all', icon: 'delete_forever', danger: true }
              ]
            });
          } else {
            var ok = await G.confirmDialog({ title: 'Apagar esta mensagem?', text: 'Esta ação não pode ser desfeita.', ok: 'Apagar', danger: true });
            choice = ok ? 'one' : null;
          }
          if (!choice) return;
          // soft-hide: some pros OUTROS e continua visível pro AUTOR (evita reclamação de msg apagada)
          var q = sb.from('comu_messages').update({ moderation: 'hidden' });
          if (choice === 'one') q = q.eq('id', m.id);
          else if (choice === 'topic') q = q.eq('author_id', m.author_id).eq('topic_id', topic.id).is('ticket_id', null);
          else q = q.eq('author_id', m.author_id).is('ticket_id', null);
          var del = await q;
          if (del.error) { G.toast('Não foi possível apagar: ' + del.error.message); return; }
          if (choice === 'one') removeMessage(m.id); else removeAuthorMessages(m.author_id);
          G.toast(choice === 'one' ? 'Mensagem apagada' : 'Mensagens apagadas');
        }
        async function doBan(m) {
          if (!m.author_id) return;
          var ok = await G.confirmDialog({ title: 'Banir ' + (m.author_name || 'este membro') + '?', text: 'A pessoa perderá o acesso e não poderá mais participar da comunidade.', ok: 'Banir', danger: true });
          if (!ok) return;
          var r = await sb.rpc('comu_ban', { p_user_id: m.author_id });
          if (r.error) { G.toast('Não foi possível banir: ' + r.error.message); return; }
          removeAuthorMessages(m.author_id);
          G.toast((m.author_name || 'Membro') + ' foi banido.');
        }
        function updateMessage(m) { if (m && m.status === 'deleted') { removeMessage(m.id); return; } var wrap = msgsEl.querySelector('[data-msg-id="' + m.id + '"]'); if (!wrap) { if (m && m.moderation === 'ok' && (Date.now() - new Date(m.created_at).getTime()) < 600000) addMessage(m, nearBottom()); return; } renderMsgBody(wrap.querySelector('.msg-body'), m, me.id && m.author_id === me.id); }
        async function replyInSupport(m) {
          var quote = m.kind === 'text' ? (m.body || '') : (m.kind === 'image' ? '📷 Foto' : (m.kind === 'audio' ? '🎤 Áudio' : (m.kind === 'video' ? '🎬 Vídeo' : (m.kind === 'file' ? '📎 Arquivo' : (m.body || '')))));
          var ok = await G.confirmDialog({ title: 'Responder no suporte?', text: 'Abre uma conversa privada com ' + (m.author_name || 'o membro') + '. Quando você responder lá, esta mensagem some do grupo.', ok: 'Abrir no suporte' });
          if (!ok) return;
          var r = await sb.rpc('comu_support_open_for', { p_user_id: m.author_id, p_origin_message_id: m.id, p_topic_name: (topic && topic.name) || '', p_quote: quote });
          if (r.error) { G.toast('Não foi possível: ' + r.error.message); return; }
          G._openTicketId = r.data; G.toast('Abrindo no suporte…'); G.navigate('/suporte');
        }
        async function doApprove(m) {
          var up = await sb.from('comu_messages').update({ moderation: 'ok' }).eq('id', m.id).select('id,moderation').single();
          if (up.error) { G.toast('Não foi possível: ' + up.error.message); return; }
          m.moderation = 'ok'; var wrap = msgsEl.querySelector('[data-msg-id="' + m.id + '"]'); if (wrap) renderMsgBody(wrap.querySelector('.msg-body'), m, me.id && m.author_id === me.id); G.toast('Mensagem liberada para todos.');
        }

        // ---- abrir imagem (lightbox) + editor de corte/redimensionamento (admin) ----
        function openLightbox(url, m) {
          if (!url) return;
          var ov = document.createElement('div'); ov.id = 'img-lightbox';
          ov.className = 'fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 gap-3';
          var img = document.createElement('img'); img.src = url; img.alt = ''; img.className = 'max-w-full max-h-[85vh] rounded-lg object-contain';
          var bar = document.createElement('div'); bar.className = 'flex items-center gap-2 flex-wrap justify-center';
          var close = document.createElement('button'); close.type = 'button'; close.className = 'h-11 px-5 rounded-full bg-white/15 text-white font-label-md hover:bg-white/25 flex items-center gap-1'; close.innerHTML = '<span class="material-symbols-outlined text-[20px]">close</span>Fechar'; close.onclick = function () { ov.remove(); };
          bar.appendChild(close);
          if (isAdmin && m && m.kind === 'image') { var ed = document.createElement('button'); ed.type = 'button'; ed.className = 'h-11 px-5 rounded-full bg-primary text-on-primary font-label-md flex items-center gap-1'; ed.innerHTML = '<span class="material-symbols-outlined text-[20px]">crop</span>Cortar / Redimensionar'; ed.onclick = function () { ov.remove(); openImageEditor(m); }; bar.appendChild(ed); }
          ov.appendChild(img); ov.appendChild(bar);
          ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
          document.body.appendChild(ov);
        }
        function ensureCropper() {
          if (window.Cropper) return Promise.resolve();
          if (self._cropperP) return self._cropperP;
          self._cropperP = new Promise(function (resolve, reject) {
            var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css'; document.head.appendChild(css);
            var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js'; s.onload = function () { resolve(); }; s.onerror = function () { self._cropperP = null; reject(new Error('cropper')); }; document.head.appendChild(s);
          });
          return self._cropperP;
        }
        async function editableImageURL(url) {
          try { var path = decodeURIComponent((url.split('/comu-media/')[1] || '').split('?')[0]); if (path) { var dl = await sb.storage.from('comu-media').download(path); if (!dl.error && dl.data) return URL.createObjectURL(dl.data); } } catch (e) {}
          return url; // fallback (pode dar canvas "tainted", mas melhor que nada)
        }
        async function openImageEditor(m) {
          if (!m || !m.media_url) return;
          G.toast('Carregando editor…');
          try { await ensureCropper(); } catch (e) { G.toast('Não foi possível carregar o editor.'); return; }
          if (self.destroyed) return;
          var src = await editableImageURL(m.media_url);
          if (self.destroyed) { if (src.indexOf('blob:') === 0) URL.revokeObjectURL(src); return; }
          var ov = document.createElement('div'); ov.id = 'img-editor';
          ov.className = 'fixed inset-0 z-[100] bg-black/95 flex flex-col p-3 gap-3';
          ov.innerHTML =
            '<style>#img-editor .cropper-view-box{outline:2px solid rgba(124,156,255,.95)}#img-editor .cropper-line{background-color:#6f8cff;opacity:.4}#img-editor .cropper-point{background-color:#7c9cff;opacity:1;width:13px;height:13px}</style>' +
            '<div id="ie-stage" class="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden" style="padding:14px 84px 14px 20px">' +
              '<img id="ie-img" class="max-w-full max-h-full block" alt="">' +
              '<div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);z-index:60;display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(0,0,0,.55);padding:10px 6px;border-radius:9999px">' +
                '<button type="button" id="ie-zin" class="material-symbols-outlined" style="color:#fff;font-size:28px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:9999px;cursor:pointer" aria-label="Aproximar">add</button>' +
                '<input type="range" id="ie-zoom" min="50" max="300" value="100" step="1" aria-label="Zoom" style="writing-mode:vertical-lr;direction:rtl;width:12px;height:170px;accent-color:#7c9cff;cursor:pointer">' +
                '<button type="button" id="ie-zout" class="material-symbols-outlined" style="color:#fff;font-size:28px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:9999px;cursor:pointer" aria-label="Afastar">remove</button>' +
              '</div>' +
            '</div>' +
            '<div class="shrink-0 flex flex-wrap items-center justify-center gap-2">' +
              '<span class="text-white/80 text-body-sm">Tamanho:</span>' +
              '<select id="ie-size" class="h-11 px-3 rounded-xl bg-white/10 text-white border border-white/20 text-body-md"><option value="0">Original</option><option value="1600">Grande (1600px)</option><option value="1000">Médio (1000px)</option><option value="600">Pequeno (600px)</option></select>' +
              '<button type="button" id="ie-cancel" class="h-11 px-5 rounded-full bg-white/15 text-white font-label-md">Cancelar</button>' +
              '<button type="button" id="ie-save" class="h-11 px-5 rounded-full bg-primary text-on-primary font-label-md flex items-center gap-1"><span class="material-symbols-outlined text-[20px]">check</span>Salvar</button>' +
            '</div>';
          document.body.appendChild(ov);
          var imgEl = ov.querySelector('#ie-img'), cropper = null, baseRatio = 1;
          var zoomEl = ov.querySelector('#ie-zoom');
          function closeE() { try { if (cropper) cropper.destroy(); } catch (e) {} cropper = null; if (src.indexOf('blob:') === 0) { try { URL.revokeObjectURL(src); } catch (e) {} } ov.remove(); }
          function applyZoom() { if (cropper) { try { cropper.zoomTo(baseRatio * (parseInt(zoomEl.value, 10) || 100) / 100); } catch (e) {} } }
          imgEl.onload = function () {
            try {
              cropper = new Cropper(imgEl, {
                viewMode: 1, autoCropArea: 0.9, background: false, dragMode: 'crop', zoomOnWheel: false, // zoom pelos botoes/slider, nao pelo scroll
                ready: function () { var cd = cropper.getCanvasData(); baseRatio = (cd && cd.naturalWidth) ? (cd.width / cd.naturalWidth) : 1; if (zoomEl) zoomEl.value = 100; }
              });
            } catch (e) {}
          };
          if (zoomEl) zoomEl.addEventListener('input', applyZoom);
          var zin = ov.querySelector('#ie-zin'), zout = ov.querySelector('#ie-zout');
          if (zin) zin.onclick = function () { zoomEl.value = Math.min(300, (parseInt(zoomEl.value, 10) || 100) + 15); applyZoom(); };
          if (zout) zout.onclick = function () { zoomEl.value = Math.max(50, (parseInt(zoomEl.value, 10) || 100) - 15); applyZoom(); };
          imgEl.onerror = function () { G.toast('Não foi possível abrir a imagem.'); closeE(); };
          imgEl.src = src;
          ov.querySelector('#ie-cancel').onclick = closeE;
          ov.querySelector('#ie-save').onclick = function () {
            if (!cropper) return;
            var save = ov.querySelector('#ie-save'); save.disabled = true; save.textContent = 'Salvando…';
            var max = parseInt(ov.querySelector('#ie-size').value, 10) || 0;
            var opts = { imageSmoothingEnabled: true, imageSmoothingQuality: 'high' }; if (max) { opts.maxWidth = max; opts.maxHeight = max; }
            var canvas; try { canvas = cropper.getCroppedCanvas(opts); } catch (e) { canvas = null; }
            if (!canvas) { G.toast('Falha ao processar a imagem.'); save.disabled = false; save.textContent = 'Salvar'; return; }
            canvas.toBlob(async function (blob) {
              if (!blob) { G.toast('Falha ao gerar a imagem.'); save.disabled = false; save.textContent = 'Salvar'; return; }
              var path = (slug || 'geral') + '/' + me.id + '/crop-' + m.id + '-' + Date.now() + '.jpg';
              var up = await sb.storage.from('comu-media').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
              if (up.error) { G.toast('Erro no upload: ' + up.error.message); save.disabled = false; save.textContent = 'Salvar'; return; }
              var newUrl = sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
              var upd = await sb.from('comu_messages').update({ media_url: newUrl, media_meta: { edited_by: me.id, w: canvas.width, h: canvas.height, mime: 'image/jpeg' } }).eq('id', m.id).select().single();
              if (upd.error) { G.toast('Erro ao salvar: ' + upd.error.message); save.disabled = false; save.textContent = 'Salvar'; return; }
              m.media_url = newUrl;
              if (!self.destroyed) updateMessage(upd.data);
              G.toast('Imagem atualizada.');
              closeE();
            }, 'image/jpeg', 0.9);
          };
        }

        // ---- reações ----
        var EMOJIS = ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🔥', '✨', '⭐', '💯', '🎉', '🎯', '🚀', '✅', '❌', '👀', '👍', '👎', '🙏', '👏', '🙌', '🤝', '💪', '👋', '🤙', '✌️', '👌', '😀', '😃', '😄', '😁', '😆', '😂', '🤣', '🙂', '😉', '😊', '😍', '🥰', '😘', '😎', '🤩', '🤔', '😐', '😴', '😮', '😲', '🥳', '😢', '😭', '😤', '😡', '🤯', '😱', '🤗', '🤭', '🤫', '🤑', '📈', '📉', '💰', '⚡'];
        var picker = document.createElement('div'); self.picker = picker;
        picker.className = 'hidden fixed z-[80] bg-surface-container-highest border border-outline-variant rounded-2xl shadow-lg p-2 flex flex-wrap items-center gap-1 max-w-[340px] max-h-[46vh] overflow-y-auto custom-scrollbar';
        var pickerTarget = null, pickerMode = 'react';
        EMOJIS.forEach(function (em) { var b = document.createElement('button'); b.type = 'button'; b.className = 'text-[26px] hover:scale-125 transition-transform px-2 py-1'; b.textContent = em; b.addEventListener('click', function () { if (pickerMode === 'insert') insertAtCursor(input, em); else if (pickerTarget) toggleReaction(pickerTarget, em); hidePicker(); }); picker.appendChild(b); });
        document.body.appendChild(picker);
        function hidePicker() { picker.classList.add('hidden'); pickerTarget = null; pickerMode = 'react'; }
        function openPicker(anchor, id, mode) { pickerMode = mode || 'react'; pickerTarget = id || null; picker.classList.remove('hidden'); var r = anchor.getBoundingClientRect(); var pr = picker.getBoundingClientRect(); var top = r.top - pr.height - 6; if (top < 8) top = r.bottom + 6; var left = r.left; if (left + pr.width > window.innerWidth - 8) left = window.innerWidth - 8 - pr.width; picker.style.top = top + 'px'; picker.style.left = Math.max(8, left) + 'px'; }
        function insertAtCursor(el, text) { if (!el) return; el.focus(); try { document.execCommand('insertText', false, text); } catch (e) { el.appendChild(document.createTextNode(text)); } el.dispatchEvent(new Event('input')); }
        function formatCmd(cmd) { input.focus(); var o = ceCaret(input); if (o && o.start === o.end) { try { document.execCommand('insertText', false, 'texto'); } catch (e) {} var o2 = ceCaret(input); if (o2) ceSetCaret(input, Math.max(0, o2.start - 5), o2.end); } try { document.execCommand('styleWithCSS', false, false); } catch (e) {} try { document.execCommand(cmd, false, null); } catch (e) {} input.dispatchEvent(new Event('input')); }
        self.onPickerDoc = function (e) { if (picker.classList.contains('hidden')) return; if (!picker.contains(e.target) && !(e.target.closest && e.target.closest('.react-add')) && !(e.target.closest && e.target.closest('#btn-emoji'))) hidePicker(); };
        document.addEventListener('click', self.onPickerDoc);
        // ---- menu de contexto da mensagem (clique direito / toque longo) — itens #12 ----
        var msgMenu = document.createElement('div'); self.msgMenu = msgMenu;
        msgMenu.className = 'hidden fixed z-[86] bg-surface-container-highest border border-outline-variant rounded-xl shadow-lg py-1 min-w-[210px] max-w-[80vw] overflow-hidden';
        document.body.appendChild(msgMenu);
        function hideMsgMenu() { msgMenu.classList.add('hidden'); msgMenu.innerHTML = ''; }
        function openMsgMenu(x, y, items) {
          if (!items || !items.length) return;
          msgMenu.innerHTML = '';
          items.forEach(function (it) { var b = document.createElement('button'); b.type = 'button'; b.className = 'w-full flex items-center gap-md px-4 py-3 text-left text-body-md active:bg-surface-container-high hover:bg-surface-container-high ' + (it.danger ? 'text-error' : 'text-on-surface'); b.innerHTML = '<span class="material-symbols-outlined text-[22px]">' + it.icon + '</span>' + it.label; b.addEventListener('click', function (e) { e.stopPropagation(); hideMsgMenu(); it.run(); }); msgMenu.appendChild(b); });
          msgMenu.classList.remove('hidden');
          var pr = msgMenu.getBoundingClientRect();
          var left = Math.min(x, window.innerWidth - 8 - pr.width); if (left < 8) left = 8;
          var top = Math.min(y, window.innerHeight - 8 - pr.height); if (top < 8) top = 8;
          msgMenu.style.left = left + 'px'; msgMenu.style.top = top + 'px';
        }
        self.onMsgMenuDoc = function (e) { if (msgMenu.classList.contains('hidden')) return; if (!msgMenu.contains(e.target)) hideMsgMenu(); };
        document.addEventListener('click', self.onMsgMenuDoc);
        self.onMsgMenuScroll = function () { hideMsgMenu(); };
        window.addEventListener('scroll', self.onMsgMenuScroll, true);
        // toolbar do compositor: negrito / itálico / emoji
        var fbEl = document.getElementById('fmt-bold'); if (fbEl) fbEl.addEventListener('click', function () { formatCmd('bold'); });
        var fiEl = document.getElementById('fmt-italic'); if (fiEl) fiEl.addEventListener('click', function () { formatCmd('italic'); });
        var beEl = document.getElementById('btn-emoji'); if (beEl) beEl.addEventListener('click', function (ev) { ev.stopPropagation(); if (picker.classList.contains('hidden') || pickerMode !== 'insert') openPicker(beEl, null, 'insert'); else hidePicker(); });
        var reactionsMap = self.reactionsMap;
        var reactorNames = self.reactorNames || (self.reactorNames = {}); // user_id -> nome
        // popover "quem reagiu"
        var reactPop = document.createElement('div'); self.reactPop = reactPop;
        reactPop.className = 'hidden fixed z-[85] bg-inverse-surface text-inverse-on-surface rounded-xl shadow-lg px-3 py-2 text-body-sm max-w-[260px] max-h-[40vh] overflow-y-auto';
        document.body.appendChild(reactPop);
        function hideReactPop() { reactPop.classList.add('hidden'); }
        self.onReactPopDoc = function (e) { if (reactPop.classList.contains('hidden')) return; if (!reactPop.contains(e.target)) hideReactPop(); };
        document.addEventListener('click', self.onReactPopDoc);
        function reactorNamesFor(id, em) { var ids = (reactionsMap[id] && reactionsMap[id][em]) || []; return ids.map(function (u) { return u === me.id ? 'Você' : (reactorNames[u] || 'Membro'); }); }
        function showReactors(anchor, id, em) {
          var names = reactorNamesFor(id, em); if (!names.length) return;
          reactPop.innerHTML = '<div class="flex items-center gap-1 mb-1 opacity-80"><span class="text-[18px]">' + em + '</span><span>' + names.length + '</span></div>' + names.map(function (n) { return '<div class="truncate py-0.5">' + esc(n) + '</div>'; }).join('');
          reactPop.classList.remove('hidden');
          var r = anchor.getBoundingClientRect(), pr = reactPop.getBoundingClientRect();
          var top = r.top - pr.height - 8; if (top < 8) top = r.bottom + 8;
          var left = r.left + r.width / 2 - pr.width / 2; if (left < 8) left = 8; if (left + pr.width > window.innerWidth - 8) left = window.innerWidth - 8 - pr.width;
          reactPop.style.top = top + 'px'; reactPop.style.left = left + 'px';
        }
        function renderReactions(id) {
          var row = msgsEl.querySelector('[data-react="' + id + '"]'); if (!row) return;
          var data = reactionsMap[id] || {}; row.innerHTML = '';
          Object.keys(data).forEach(function (em) {
            var users = data[em]; if (!users || !users.length) return;
            var mineR = users.indexOf(me.id) !== -1;
            var chip = document.createElement('button'); chip.type = 'button';
            chip.className = 'px-3 py-1 rounded-full text-body-sm flex items-center gap-1 border transition-colors ' + (mineR ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-surface-container-high border-outline-variant/50 text-on-surface-variant');
            chip.innerHTML = '<span>' + em + '</span><span class="font-bold">' + users.length + '</span>';
            chip.title = reactorNamesFor(id, em).join(', '); // desktop: hover mostra quem reagiu
            var lp = false, tm = null;
            chip.addEventListener('touchstart', function () { lp = false; tm = setTimeout(function () { lp = true; showReactors(chip, id, em); }, 500); }, { passive: true });
            ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) { chip.addEventListener(ev, function () { if (tm) { clearTimeout(tm); tm = null; } }); });
            chip.addEventListener('click', function (e) { if (lp) { lp = false; e.stopPropagation(); return; } toggleReaction(id, em); }); // toque longo = quem reagiu; toque = reagir
            row.appendChild(chip);
          });
        }
        async function toggleReaction(id, em) {
          if (!me.id) return;
          var data = reactionsMap[id] || (reactionsMap[id] = {});
          var have = (data[em] || []).indexOf(me.id) !== -1;
          // 1 reação por pessoa: remove qualquer reação minha nesta mensagem
          Object.keys(data).forEach(function (e) { var i = data[e].indexOf(me.id); if (i !== -1) data[e].splice(i, 1); });
          if (!have) (data[em] = data[em] || []).push(me.id); // clicou a que já tinha -> tira (toggle off)
          renderReactions(id);
          reactorNames[me.id] = me.full_name || 'Você';
          await sb.from('comu_message_reactions').delete().eq('message_id', id).eq('user_id', me.id);
          if (!have) await sb.from('comu_message_reactions').insert({ message_id: id, user_id: me.id, reaction: em, user_name: me.full_name || null });
        }
        async function loadReactions(ids) { if (!ids || !ids.length) return; var r = await sb.from('comu_message_reactions').select('message_id,user_id,reaction,user_name').in('message_id', ids); if (self.destroyed) return; (r.data || []).forEach(function (x) { var d = reactionsMap[x.message_id] || (reactionsMap[x.message_id] = {}); var u = d[x.reaction] || (d[x.reaction] = []); if (u.indexOf(x.user_id) === -1) u.push(x.user_id); if (x.user_name) reactorNames[x.user_id] = x.user_name; }); ids.forEach(renderReactions); }
        function applyReactionEvent(type, row) { if (!row || !row.message_id) return; if (!msgsEl.querySelector('[data-react="' + row.message_id + '"]')) return; if (row.user_name) reactorNames[row.user_id] = row.user_name; var d = reactionsMap[row.message_id] || (reactionsMap[row.message_id] = {}); var u = d[row.reaction] || (d[row.reaction] = []); if (type === 'INSERT') { if (u.indexOf(row.user_id) === -1) u.push(row.user_id); } else { d[row.reaction] = u.filter(function (x) { return x !== row.user_id; }); } renderReactions(row.message_id); }

        // ---- carrega histórico + realtime ----
        if (topic) {
          // Carrega as N mais RECENTES (não as antigas) e pagina pra cima ao rolar.
          var CH_PAGE = 40;
          var COLS = 'id,topic_id,author_id,ticket_id,kind,body,media_url,media_meta,author_name,author_avatar,status,created_at,edited_at,reply_to,reply_author,reply_snippet,moderation,expires_at';
          var oldestTs = null, noOlder = false, loadingOlder = false;
          var lr = await sb.from('comu_messages').select(COLS).eq('topic_id', topic.id).neq('status', 'deleted').order('created_at', { ascending: false }).limit(CH_PAGE);
          if (self.destroyed) return;
          loadingEl.classList.add('hidden');
          if (!lr.error && lr.data && lr.data.length) {
            var rows0 = lr.data.slice().reverse(); // volta pra ordem cronológica
            oldestTs = rows0[0].created_at;
            if (lr.data.length < CH_PAGE) noOlder = true;
            rows0.forEach(function (m) { addMessage(m, false); });
            scrollBottom(); requestAnimationFrame(scrollBottom); setTimeout(function () { if (!self.destroyed) scrollBottom(); }, 250);
            loadReactions(rows0.map(function (m) { return m.id; }));
          } else { noOlder = true; if (!lr.error) emptyEl.classList.remove('hidden'); }
          function prependMessages(rows) {
            var frag = document.createDocumentFragment(), ids = [];
            rows.forEach(function (m) { if (m && !seen[m.id]) { seen[m.id] = true; frag.appendChild(bubble(m)); ids.push(m.id); } });
            if (frag.childNodes.length) { msgsEl.insertBefore(frag, msgsEl.firstChild); msgsEl.classList.remove('hidden'); emptyEl.classList.add('hidden'); applyDayDividers(); regroup(); }
            if (ids.length) loadReactions(ids);
          }
          async function loadOlder() {
            if (loadingOlder || noOlder || !oldestTs) return;
            loadingOlder = true;
            var prevH = scrollEl.scrollHeight, prevTop = scrollEl.scrollTop;
            var r = await sb.from('comu_messages').select(COLS).eq('topic_id', topic.id).neq('status', 'deleted').lt('created_at', oldestTs).order('created_at', { ascending: false }).limit(CH_PAGE);
            if (self.destroyed) { loadingOlder = false; return; }
            var older = (r.data || []).slice().reverse();
            if (older.length) { oldestTs = older[0].created_at; prependMessages(older); scrollEl.scrollTop = scrollEl.scrollHeight - prevH + prevTop; }
            if (older.length < CH_PAGE) noOlder = true;
            loadingOlder = false;
          }
          scrollEl.addEventListener('scroll', function () { if (scrollEl.scrollTop < 120 && !noOlder) loadOlder(); updateScrollBtn(); });
          if (isSupport) {
            // Suporte (1:1): postgres_changes basta (sem fan-out)
            self.channels.push(sb.channel('comu-' + topic.id)
              .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_messages', filter: 'topic_id=eq.' + topic.id }, function (p) { addMessage(p.new, nearBottom(), true); if (p.new && p.new.kind === 'system') refreshTicketInfo(); })
              .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comu_messages', filter: 'topic_id=eq.' + topic.id }, function (p) { updateMessage(p.new); })
              .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comu_messages' }, function (p) { if (p.old && p.old.id) removeMessage(p.old.id); })
              .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_message_reactions' }, function (p) { applyReactionEvent('INSERT', p.new); })
              .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comu_message_reactions' }, function (p) { applyReactionEvent('DELETE', p.old); })
              .subscribe());
          } else {
            // Grupo: BROADCAST (escala p/ centenas). Se o broadcast falhar,
            // cai automaticamente em postgres_changes (o chat nunca quebra).
            var pgFallbackOn = false;
            var enablePgFallback = function () {
              if (pgFallbackOn || self.destroyed) return; pgFallbackOn = true;
              self.channels.push(sb.channel('comu-' + topic.id)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_messages', filter: 'topic_id=eq.' + topic.id }, function (p) { addMessage(p.new, nearBottom(), true); })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comu_messages', filter: 'topic_id=eq.' + topic.id }, function (p) { updateMessage(p.new); })
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comu_messages' }, function (p) { if (p.old && p.old.id) removeMessage(p.old.id); })
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_message_reactions' }, function (p) { applyReactionEvent('INSERT', p.new); })
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comu_message_reactions' }, function (p) { applyReactionEvent('DELETE', p.old); })
                .subscribe());
            };
            try { var _sess = (await sb.auth.getSession()).data.session; if (_sess) await Promise.resolve(sb.realtime.setAuth(_sess.access_token)); } catch (e) {}
            if (self.destroyed) return;
            self.channels.push(sb.channel('topic:' + topic.id, { config: { private: true } })
              .on('broadcast', { event: 'INSERT' }, function (m) { if (m && m.payload && m.payload.record) addMessage(m.payload.record, nearBottom(), true); })
              .on('broadcast', { event: 'UPDATE' }, function (m) { if (m && m.payload && m.payload.record) updateMessage(m.payload.record); })
              .on('broadcast', { event: 'DELETE' }, function (m) { var r = m && m.payload && (m.payload.old_record || m.payload.record); if (r && r.id) removeMessage(r.id); })
              .on('broadcast', { event: 'reaction' }, function (m) { var p = m && m.payload; if (p && p.message_id) applyReactionEvent(p.op === 'DELETE' ? 'DELETE' : 'INSERT', { message_id: p.message_id, user_id: p.user_id, reaction: p.reaction, user_name: p.user_name }); })
              .on('broadcast', { event: 'HIDE' }, function (m) { var p = m && m.payload; if (p && p.id && (!me.id || p.author_id !== me.id)) removeMessage(p.id); }) // apagada: some pros outros, fica pro autor
              .subscribe(function (status) { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') enablePgFallback(); }));
          }
          refreshTicketInfo();
          if (me.id) { sb.from('comu_topic_reads').upsert({ topic_id: topic.id, user_id: me.id, last_read_at: new Date().toISOString() }, { onConflict: 'topic_id,user_id' }).then(function () { G.applyUnread(); }, function () {}); }
          // ---- busca de mensagens neste tópico ----
          async function jumpToMessage(id) {
            var tries = 0;
            while (!msgsEl.querySelector('[data-msg-id="' + id + '"]') && !noOlder && tries < 25) { await loadOlder(); tries++; }
            var t = msgsEl.querySelector('[data-msg-id="' + id + '"]');
            if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.style.transition = 'background-color .3s'; t.style.backgroundColor = 'rgba(37,99,235,0.18)'; setTimeout(function () { t.style.backgroundColor = ''; }, 1400); }
            else G.toast('Mensagem muito antiga para abrir aqui.');
          }
          (function () {
            var sBtn = document.getElementById('chat-search-btn'), sPanel = document.getElementById('chat-search-panel'), sInput = document.getElementById('chat-search-input'), sClose = document.getElementById('chat-search-close'), sRes = document.getElementById('chat-search-results');
            if (!sBtn || !sPanel) return;
            if (isSupport) { sBtn.classList.add('hidden'); return; }
            function closeS() { sPanel.classList.add('hidden'); sInput.value = ''; sRes.innerHTML = ''; }
            sBtn.addEventListener('click', function () { if (sPanel.classList.contains('hidden')) { sPanel.classList.remove('hidden'); sInput.focus(); } else closeS(); });
            if (sClose) sClose.addEventListener('click', closeS);
            sInput.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeS(); });
            var sTmr;
            sInput.addEventListener('input', function () {
              clearTimeout(sTmr); var q = sInput.value.trim();
              if (q.length < 2) { sRes.innerHTML = ''; return; }
              sRes.innerHTML = '<p class="p-md text-center text-on-surface-variant text-body-sm">Buscando…</p>';
              sTmr = setTimeout(async function () {
                var r = await sb.rpc('comu_search_messages', { p_topic: topic.id, p_q: q });
                if (self.destroyed) return;
                if (r.error) { sRes.innerHTML = '<p class="p-md text-error text-body-sm">' + esc(r.error.message) + '</p>'; return; }
                var rows = r.data || [];
                if (!rows.length) { sRes.innerHTML = '<p class="p-md text-center text-on-surface-variant text-body-sm">Nada encontrado.</p>'; return; }
                sRes.innerHTML = '';
                rows.forEach(function (m) {
                  var w = ''; try { w = new Date(m.created_at).toLocaleDateString('pt-BR') + ' ' + timeStr(m.created_at); } catch (e) {}
                  var snip = esc((m.body || '').replace(/\s+/g, ' ').slice(0, 90));
                  var el = document.createElement('button'); el.type = 'button'; el.className = 'w-full text-left p-sm rounded-lg hover:bg-surface-container-low';
                  el.innerHTML = '<div class="flex justify-between gap-sm"><span class="font-bold text-on-surface text-body-sm truncate">' + esc(G.shortName(m.author_name) || 'Membro') + '</span><span class="text-[12px] text-on-surface-variant shrink-0">' + w + '</span></div><div class="text-body-sm text-on-surface-variant truncate">' + snip + '</div>';
                  el.addEventListener('click', function () { closeS(); jumpToMessage(m.id); });
                  sRes.appendChild(el);
                });
              }, 250);
            });
          })();
        } else { loadingEl.classList.add('hidden'); emptyEl.classList.remove('hidden'); }

        // ---- gravação de voz (toque para gravar / toque para enviar) ----
        function pickMime() { var c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']; for (var i = 0; i < c.length; i++) { if (window.MediaRecorder && MediaRecorder.isTypeSupported(c[i])) return c[i]; } return ''; }
        function updateRecTime() { var el = document.getElementById('rec-time'); if (el) { var m = Math.floor(self.recSeconds / 60), s = self.recSeconds % 60; el.textContent = m + ':' + (s < 10 ? '0' : '') + s; } }
        function setRecUI(on) { self.recording = on; var rb = document.getElementById('rec-bar'), cn = document.getElementById('composer-normal'); if (rb) rb.classList.toggle('hidden', !on); if (cn) cn.classList.toggle('hidden', on); }
        function stopStream() { if (self.recStream) { self.recStream.getTracks().forEach(function (t) { t.stop(); }); self.recStream = null; } }
        async function startRecording() {
          if (self.recording) return;
          if (!navigator.mediaDevices || !window.MediaRecorder) { G.toast('Gravação de áudio não é suportada neste navegador.'); return; }
          try { self.recStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { G.toast('Não foi possível acessar o microfone. Permita o acesso e tente de novo.'); return; }
          if (self.destroyed) { stopStream(); return; }
          self.recMime = pickMime(); self.recChunks = [];
          try { self.mediaRecorder = new MediaRecorder(self.recStream, self.recMime ? { mimeType: self.recMime } : undefined); } catch (e) { self.mediaRecorder = new MediaRecorder(self.recStream); }
          self.mediaRecorder.ondataavailable = function (ev) { if (ev.data && ev.data.size) self.recChunks.push(ev.data); };
          self.mediaRecorder.start(1000); self.recSeconds = 0; self.recPaused = false; updateRecTime();
          var _pl = document.getElementById('rec-pause-lbl'), _pic = document.getElementById('rec-pause-ic'); if (_pl) _pl.textContent = 'Pausar'; if (_pic) _pic.textContent = 'pause';
          var _lst = document.getElementById('rec-listen'); if (_lst) { _lst.classList.add('hidden'); _lst.classList.remove('flex'); }
          var _dot = document.getElementById('rec-dot'); if (_dot) _dot.classList.add('animate-pulse');
          self.recTimer = setInterval(function () { self.recSeconds++; updateRecTime(); }, 1000); setRecUI(true);
        }
        function stopPreview() { var a = document.getElementById('rec-preview'); if (a) { try { a.pause(); } catch (e) {} a.removeAttribute('src'); } var li = document.getElementById('rec-listen-ic'), ll = document.getElementById('rec-listen-lbl'); if (li) li.textContent = 'play_arrow'; if (ll) ll.textContent = 'Ouvir'; }
        function togglePause() {
          if (!self.mediaRecorder) return;
          var pl = document.getElementById('rec-pause-lbl'), pic = document.getElementById('rec-pause-ic'), lst = document.getElementById('rec-listen'), dot = document.getElementById('rec-dot');
          if (!self.recPaused) {
            try { self.mediaRecorder.pause(); } catch (e) {}
            if (self.recTimer) clearInterval(self.recTimer); self.recPaused = true;
            if (pl) pl.textContent = 'Continuar'; if (pic) pic.textContent = 'fiber_manual_record'; if (dot) dot.classList.remove('animate-pulse');
            if (lst) { lst.classList.remove('hidden'); lst.classList.add('flex'); }
          } else {
            stopPreview();
            try { self.mediaRecorder.resume(); } catch (e) {} self.recPaused = false;
            self.recTimer = setInterval(function () { self.recSeconds++; updateRecTime(); }, 1000);
            if (pl) pl.textContent = 'Pausar'; if (pic) pic.textContent = 'pause'; if (dot) dot.classList.add('animate-pulse');
            if (lst) { lst.classList.add('hidden'); lst.classList.remove('flex'); }
          }
        }
        function toggleListen() {
          var a = document.getElementById('rec-preview'), li = document.getElementById('rec-listen-ic'), ll = document.getElementById('rec-listen-lbl');
          if (!a) return;
          if (a.src && !a.paused) { a.pause(); if (li) li.textContent = 'play_arrow'; if (ll) ll.textContent = 'Ouvir'; return; }
          if (!self.recChunks || !self.recChunks.length) { G.toast('Nada gravado ainda.'); return; }
          try { var blob = new Blob(self.recChunks, { type: self.recMime || 'audio/webm' }); a.src = URL.createObjectURL(blob); a.play(); if (li) li.textContent = 'pause'; if (ll) ll.textContent = 'Pausar'; a.onended = function () { if (li) li.textContent = 'play_arrow'; if (ll) ll.textContent = 'Ouvir'; }; } catch (e) { G.toast('Não foi possível reproduzir.'); }
        }
        function cancelRecording() { stopPreview(); self.recPaused = false; if (self.recTimer) clearInterval(self.recTimer); if (self.mediaRecorder && self.mediaRecorder.state !== 'inactive') { self.mediaRecorder.onstop = function () { stopStream(); }; try { self.mediaRecorder.stop(); } catch (e) { stopStream(); } } else stopStream(); self.recChunks = []; setRecUI(false); }
        function finishRecording() {
          if (!self.mediaRecorder) { setRecUI(false); return; }
          if (self.recTimer) clearInterval(self.recTimer); var secs = self.recSeconds; setRecUI(false);
          self.mediaRecorder.onstop = async function () {
            stopStream(); if (!self.recChunks.length || secs < 1) return;
            var blob = new Blob(self.recChunks, { type: self.recMime || 'audio/webm' });
            var ext = self.recMime.indexOf('mp4') >= 0 ? 'mp4' : (self.recMime.indexOf('ogg') >= 0 ? 'ogg' : 'webm');
            var path = (slug || 'geral') + '/' + me.id + '/voz-' + Date.now() + '.' + ext;
            var up = await sb.storage.from('comu-media').upload(path, blob, { contentType: self.recMime || 'audio/webm', upsert: true });
            if (up.error) { G.toast('Erro no upload do áudio: ' + up.error.message); return; }
            var url = sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
            var res;
            if (isSupport) res = await sb.rpc('comu_send_support_message', { p_body: null, p_kind: 'audio', p_media_url: url, p_author_name: me.full_name || 'Membro' });
            else res = await sb.from('comu_messages').insert({ topic_id: topic.id, author_id: me.id, kind: 'audio', media_url: url, media_meta: { duration: secs, mime: self.recMime }, author_name: me.full_name || 'Membro', author_avatar: me.avatar_url || null }).select().single();
            if (res.error) { G.toast('Erro ao enviar o áudio: ' + res.error.message); return; }
            if (!self.destroyed) addMessage(res.data, true); if (isSupport) refreshTicketInfo();
          };
          try { self.mediaRecorder.stop(); } catch (e) { stopStream(); }
        }
        var micBtn = document.getElementById('btn-mic');
        // Áudio: alunos só no suporte. Admin/equipe em qualquer lugar.
        if (micBtn && !isAdmin && !isSupport) { micBtn.classList.add('hidden'); }
        else if (micBtn) micBtn.addEventListener('click', function () { if (!self.recording) startRecording(); });
        // Mensagem temporária (só admin): some sozinha após o tempo escolhido
        var tempMs = null;
        var tempBtn = document.getElementById('btn-temp');
        if (tempBtn && isAdmin && !isSupport) {
          tempBtn.classList.remove('hidden'); tempBtn.classList.add('flex');
          var TEMP_OPTS = [null, 3600000, 21600000, 86400000], TEMP_LBL = ['', '1h', '6h', '24h'], ti = 0;
          var tlbl = document.getElementById('btn-temp-lbl');
          tempBtn.addEventListener('click', function () {
            ti = (ti + 1) % TEMP_OPTS.length; tempMs = TEMP_OPTS[ti];
            if (tlbl) tlbl.textContent = TEMP_LBL[ti];
            tempBtn.classList.toggle('text-primary', !!tempMs); tempBtn.classList.toggle('bg-primary/10', !!tempMs); tempBtn.classList.toggle('text-on-surface-variant', !tempMs);
            G.toast(tempMs ? ('Mensagem temporária: some em ' + TEMP_LBL[ti]) : 'Mensagem temporária desligada');
          });
        }
        // Ao anexar, leva o texto já digitado no chat como legenda da mídia (não perde a mensagem).
        var attachBtn = document.getElementById('btn-attach');
        if (attachBtn) attachBtn.addEventListener('click', function () { try { var ci = document.getElementById('chat-input'); G._draftCaption = ci ? (ci.innerText || '').trim() : ''; if (ci) ci.innerHTML = ''; } catch (e) {} });
        var recCancelBtn = document.getElementById('rec-cancel');
        if (recCancelBtn) recCancelBtn.addEventListener('click', function () { if (self.recording) { cancelRecording(); G.toast('Áudio descartado'); } });
        var recSendBtn = document.getElementById('rec-send');
        if (recSendBtn) recSendBtn.addEventListener('click', function () { if (self.recording) finishRecording(); });
        var recPauseBtn = document.getElementById('rec-pause'); if (recPauseBtn) recPauseBtn.addEventListener('click', function () { if (self.recording) togglePause(); });
        var recListenBtn = document.getElementById('rec-listen'); if (recListenBtn) recListenBtn.addEventListener('click', function () { toggleListen(); });

        // ---- envio de texto ----
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          if (self.recording) { finishRecording(); return; }
          var body = ceSerialize(input).trim(); if (body.length > 65536) body = body.slice(0, 65536);
          if (!body || !topic || !me.id) { ceClear(input); return; }
          var prevHTML = input.innerHTML; ceClear(input);
          var rs = replyState;
          var ins;
          if (isSupport) ins = await sb.rpc('comu_send_support_message', { p_body: body, p_kind: 'text', p_author_name: me.full_name || 'Membro' });
          else ins = await sb.from('comu_messages').insert(Object.assign({ topic_id: topic.id, author_id: me.id, kind: 'text', body: body, author_name: me.full_name || 'Membro', author_avatar: me.avatar_url || null }, rs ? { reply_to: rs.id, reply_author: rs.author, reply_snippet: rs.snippet } : {}, (isAdmin && tempMs) ? { expires_at: new Date(Date.now() + tempMs).toISOString() } : {})).select().single();
          if (ins.error) {
            console.error(ins.error); input.innerHTML = prevHTML;      // não perde o texto digitado
            var em = ins.error.message || '';
            if (/rápido demais|rate/i.test(em)) G.toast('Você está enviando rápido demais. Espere alguns segundos.');
            else if (/Storage|embutida/i.test(em)) G.toast('Mídia deve ir como arquivo, não embutida.');
            else if (/banido|banned/i.test(em)) G.toast('Você não pode enviar mensagens aqui.');
            else G.toast('Não foi possível enviar. Tente de novo.');
            return;
          }
          clearReply();
          if (!self.destroyed) {
            if (ins.data && ins.data.moderation === 'hidden') { /* bloqueada na hora: nem exibe */ }
            else { addMessage(ins.data, true); requestAnimationFrame(function () { scrollBottom(); requestAnimationFrame(scrollBottom); }); pollModeration(ins.data); }
          }
          if (isSupport) refreshTicketInfo();
        });
        // Após enviar: se a IA bloquear, a própria mensagem some da tela do autor (sem avisar que foi bloqueada).
        function pollModeration(m) {
          if (!m || !m.id || m.moderation !== 'pending') return;
          var tries = 0;
          var iv = setInterval(async function () {
            tries++;
            if (self.destroyed || tries > 12) { clearInterval(iv); return; }
            var r = await sb.from('comu_messages').select('moderation').eq('id', m.id).maybeSingle();
            if (r && r.data && r.data.moderation && r.data.moderation !== 'pending') {
              clearInterval(iv);
              if (r.data.moderation === 'hidden') removeMessage(m.id); // bloqueada: some silenciosamente
            }
          }, 1200);
        }
      }
    };
  })();

  // =====================================================================
  // ENVIAR MÍDIA
  // =====================================================================
  GVSI.views.enviar = {
    destroy: function () {},
    render: async function (view, params) {
      var slug = params.topico; var me = G.me || {}; var back = '/chat/' + encodeURIComponent(slug || '');
      view.innerHTML =
        '<header class="fixed top-0 left-0 right-0 lg:left-[var(--side-w)] z-40 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-between px-container-margin h-14">' +
          '<a class="text-primary flex items-center" href="' + back + '" aria-label="Fechar"><span class="material-symbols-outlined">close</span></a>' +
          '<h1 class="font-headline-sm text-headline-sm font-bold text-primary">Enviar Mídia</h1>' +
          '<button type="button" data-theme-toggle class="lg:hidden text-primary flex items-center" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button>' +
          '<div class="hidden lg:block w-9"></div>' +
        '</header>' +
        '<main class="lg:pl-[var(--side-w)] pt-20 pb-28 px-container-margin"><div class="max-w-3xl mx-auto space-y-lg">' +
          '<section id="act-grid" class="grid grid-cols-3 gap-sm">' +
            '<button type="button" id="act-camera" class="bg-surface-container-high rounded-xl p-md flex flex-col items-center justify-center gap-sm shadow-sm active:scale-[0.98] transition-all"><div class="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-3xl">photo_camera</span></div><div class="text-center"><h3 class="font-headline-sm text-headline-sm text-primary">Foto</h3><p class="text-body-sm text-on-surface-variant">Câmera/galeria</p></div></button>' +
            '<button type="button" id="act-video" class="bg-tertiary-container rounded-xl p-md flex flex-col items-center justify-center gap-sm shadow-sm active:scale-[0.98] transition-all"><div class="w-14 h-14 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-3xl">videocam</span></div><div class="text-center"><h3 class="font-headline-sm text-headline-sm text-on-tertiary-container">Vídeo</h3><p class="text-body-sm text-on-tertiary-container/80">Câmera/galeria</p></div></button>' +
            '<button type="button" id="act-audio" class="bg-secondary-container rounded-xl p-md flex flex-col items-center justify-center gap-sm shadow-sm active:scale-95"><div class="w-14 h-14 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-3xl">mic</span></div><div class="text-center"><h3 class="font-headline-sm text-headline-sm text-on-secondary-container">Áudio</h3><p class="text-body-sm text-on-secondary-container/80">Arquivo</p></div></button>' +
            '<button type="button" id="act-file" class="hidden flex-col items-center justify-center gap-sm bg-surface-container-high rounded-xl p-md shadow-sm active:scale-[0.98] transition-all"><div class="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-3xl">description</span></div><div class="text-center"><h3 class="font-headline-sm text-headline-sm text-on-surface">Arquivo</h3><p class="text-body-sm text-on-surface-variant">Qualquer tipo</p></div></button>' +
          '</section>' +
          '<input id="file-camera" type="file" accept="image/*" class="hidden"><input id="file-video" type="file" accept="video/*" class="hidden"><input id="file-audio" type="file" accept="audio/*" class="hidden"><input id="file-any" type="file" class="hidden">' +
          '<section class="bg-surface-container-low rounded-xl p-lg border border-outline-variant shadow-sm space-y-md">' +
            '<div id="preview-empty" class="flex flex-col items-center justify-center text-center gap-sm py-lg"><span class="material-symbols-outlined text-[40px] text-outline">image</span><p class="text-body-sm text-on-surface-variant max-w-xs">Escolha uma foto ou um áudio para pré-visualizar aqui.</p></div>' +
            '<div id="preview" class="hidden"><div class="flex gap-md items-start"><div id="preview-thumb" class="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-high flex items-center justify-center text-outline"></div><div class="flex-grow min-w-0 space-y-sm"><div class="flex items-center justify-between gap-sm"><span id="preview-name" class="font-label-md text-label-md text-on-surface-variant truncate">arquivo</span><button type="button" id="preview-remove" class="text-error text-xs hover:underline font-semibold shrink-0">Remover</button></div><textarea id="caption" class="w-full bg-transparent border-none focus:ring-0 text-body-md placeholder:text-outline p-0 resize-none h-16 text-on-surface" placeholder="Adicione uma legenda (opcional)..."></textarea></div></div><img id="preview-image" alt="" class="hidden w-full mt-md rounded-xl border border-outline-variant/40 bg-surface-container-high" style="max-height:24rem;object-fit:contain"><audio id="preview-audio" controls class="hidden w-full mt-sm"></audio><video id="preview-video" controls class="hidden w-full mt-sm rounded-lg" style="max-height:16rem"></video></div>' +
          '</section>' +
        '</div></main>' +
        '<div class="fixed bottom-0 left-0 right-0 lg:left-[var(--side-w)] z-40 bg-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] rounded-t-xl px-container-margin py-md"><div id="send-progress" class="hidden max-w-3xl mx-auto mb-sm"><div class="h-2 rounded-full bg-surface-container-high overflow-hidden"><div id="send-progress-bar" class="h-full bg-primary" style="width:0%;transition:width .15s"></div></div><p id="send-progress-txt" class="text-[12px] text-on-surface-variant mt-1 text-center">Enviando… 0%</p></div><div class="max-w-3xl mx-auto flex items-center justify-between gap-md"><p id="target-label" class="hidden md:flex items-center gap-xs text-body-sm text-on-surface-variant"><span class="material-symbols-outlined text-[18px]">groups</span> Compartilhar no grupo</p><button id="btn-send" type="button" disabled class="flex-grow md:flex-none bg-primary text-on-primary h-12 px-xl rounded-full font-headline-sm text-headline-sm flex items-center justify-center gap-sm shadow-md active:scale-95 transition-all disabled:opacity-50"><span id="btn-send-label">Enviar para o grupo</span><span class="material-symbols-outlined">send</span></button></div></div>';

      if (G._draftCaption) { var _cap = document.getElementById('caption'); if (_cap) _cap.value = G._draftCaption; G._draftCaption = ''; }
      var topic = null;
      if (slug) { var tr = await sb.from('comu_topics').select('id,name,slug,post_policy').eq('slug', slug).maybeSingle(); topic = tr.data; if (topic) document.getElementById('target-label').innerHTML = '<span class="material-symbols-outlined text-[18px]">groups</span> ' + esc(topic.name); }
      var selectedFile = null, selectedKind = null;
      function humanSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }
      function clearSel() { selectedFile = null; selectedKind = null; document.getElementById('preview').classList.add('hidden'); document.getElementById('preview-empty').classList.remove('hidden'); document.getElementById('btn-send').disabled = true; var a = document.getElementById('preview-audio'); a.classList.add('hidden'); a.src = ''; var v = document.getElementById('preview-video'); if (v) { v.classList.add('hidden'); v.removeAttribute('src'); } var pim = document.getElementById('preview-image'); if (pim) { pim.classList.add('hidden'); pim.removeAttribute('src'); } }
      function showSel(file, kind) { selectedFile = file; selectedKind = kind; document.getElementById('preview-empty').classList.add('hidden'); document.getElementById('preview').classList.remove('hidden'); document.getElementById('preview-name').textContent = file.name + ' · ' + humanSize(file.size); var thumb = document.getElementById('preview-thumb'), audio = document.getElementById('preview-audio'), video = document.getElementById('preview-video'); var url = URL.createObjectURL(file); var image = document.getElementById('preview-image'); audio.classList.add('hidden'); if (video) video.classList.add('hidden'); if (image) image.classList.add('hidden'); if (kind === 'image') { thumb.innerHTML = '<img src="' + url + '" class="w-full h-full object-cover" alt="">'; if (image) { image.src = url; image.classList.remove('hidden'); } } else if (kind === 'video') { thumb.innerHTML = '<span class="material-symbols-outlined text-[32px]">movie</span>'; if (video) { video.src = url; video.classList.remove('hidden'); } } else if (kind === 'audio') { thumb.innerHTML = '<span class="material-symbols-outlined text-[32px]">graphic_eq</span>'; audio.src = url; audio.classList.remove('hidden'); } else { thumb.innerHTML = '<span class="material-symbols-outlined text-[32px]">description</span>'; } document.getElementById('btn-send').disabled = false; }
      document.getElementById('act-camera').addEventListener('click', function () { document.getElementById('file-camera').click(); });
      document.getElementById('act-video').addEventListener('click', function () { document.getElementById('file-video').click(); });
      document.getElementById('act-audio').addEventListener('click', function () { document.getElementById('file-audio').click(); });
      document.getElementById('file-camera').addEventListener('change', function () { if (this.files[0]) showSel(this.files[0], 'image'); });
      document.getElementById('file-video').addEventListener('change', function () { if (this.files[0]) showSel(this.files[0], 'video'); });
      document.getElementById('file-audio').addEventListener('change', function () { if (this.files[0]) showSel(this.files[0], 'audio'); });
      document.getElementById('act-file').addEventListener('click', function () { document.getElementById('file-any').click(); });
      document.getElementById('file-any').addEventListener('change', function () { if (this.files[0]) showSel(this.files[0], 'file'); });
      // #7 — membro: FOTO sempre; VÍDEO e ÁUDIO só no suporte. Admin envia ARQUIVO de qualquer tipo.
      if (me.role !== 'admin') {
        var isSup = !!(topic && topic.post_policy === 'support');
        if (!isSup) { var av = document.getElementById('act-video'); if (av) av.classList.add('hidden'); var aa = document.getElementById('act-audio'); if (aa) aa.classList.add('hidden'); }
        var ag = document.getElementById('act-grid'); if (ag) ag.className = 'grid grid-cols-' + (isSup ? '3' : '1') + ' gap-sm';
      } else {
        var af = document.getElementById('act-file'); if (af) { af.classList.remove('hidden'); af.classList.add('flex'); }
        var ag2 = document.getElementById('act-grid'); if (ag2) ag2.className = 'grid grid-cols-2 gap-sm'; // 4 itens em 2x2
      }
      document.getElementById('preview-remove').addEventListener('click', clearSel);
      document.getElementById('btn-send').addEventListener('click', async function () {
        if (!selectedFile || !topic) return; var btn = document.getElementById('btn-send'); btn.disabled = true; document.getElementById('btn-send-label').textContent = 'Enviando...';
        try {
          var ext = (selectedFile.name.split('.').pop() || (selectedKind === 'image' ? 'jpg' : (selectedKind === 'video' ? 'mp4' : 'm4a'))).toLowerCase();
          var path = slug + '/' + me.id + '/' + Date.now() + '.' + ext;
          var pbW = document.getElementById('send-progress'), pbB = document.getElementById('send-progress-bar'), pbT = document.getElementById('send-progress-txt');
          if (pbW) pbW.classList.remove('hidden');
          var up = await G.uploadWithProgress(path, selectedFile, selectedFile.type || undefined, function (frac) { var p = Math.round(frac * 100); if (pbB) pbB.style.width = p + '%'; if (pbT) pbT.textContent = (p >= 100 ? 'Finalizando…' : 'Enviando… ' + p + '%'); });
          if (pbW) pbW.classList.add('hidden');
          if (!up.ok) { var up2 = await sb.storage.from('comu-media').upload(path, selectedFile, { upsert: true, contentType: selectedFile.type || undefined }); if (up2.error) throw new Error(up.error || up2.error.message); }
          var url = sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
          var caption = document.getElementById('caption').value.trim() || null;
          var res;
          if (topic.post_policy === 'support') res = await sb.rpc('comu_send_support_message', { p_body: caption, p_kind: selectedKind, p_media_url: url, p_author_name: me.full_name || 'Membro' });
          else res = await sb.from('comu_messages').insert({ topic_id: topic.id, author_id: me.id, kind: selectedKind, body: caption, media_url: url, media_meta: { name: selectedFile.name, size: selectedFile.size, mime: selectedFile.type }, author_name: me.full_name || 'Membro', author_avatar: me.avatar_url || null }).select().single();
          if (res.error) throw res.error;
          G.navigate(back);
        } catch (err) { btn.disabled = false; document.getElementById('btn-send-label').textContent = 'Enviar para o grupo'; var _pw = document.getElementById('send-progress'); if (_pw) _pw.classList.add('hidden'); G.toast('Erro ao enviar: ' + (err && err.message ? err.message : err)); }
      });
    }
  };

  // =====================================================================
  // PERFIL
  // =====================================================================
  GVSI.views.perfil = {
    destroy: function () {},
    render: async function (view) {
      var me = G.me || {};
      view.innerHTML =
        '<header class="lg:hidden fixed top-0 left-0 right-0 z-50 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] h-14 flex items-center justify-between px-container-margin"><a href="/" class="text-primary flex items-center" aria-label="Voltar"><span class="material-symbols-outlined">arrow_back</span></a><h1 class="font-headline-sm text-headline-sm font-bold text-primary">Meu Perfil</h1><button type="button" data-theme-toggle class="text-primary flex items-center" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button></header>' +
        '<div class="lg:pl-[var(--side-w)] min-h-screen"><div class="pt-14 lg:pt-lg pb-20 lg:pb-8 px-container-margin max-w-3xl mx-auto space-y-lg">' +
          '<h1 class="hidden lg:block font-headline-md text-headline-md text-on-surface pt-sm">Meu Perfil</h1>' +
          '<section class="grid grid-cols-1 md:grid-cols-3 gap-md">' +
            '<div class="md:col-span-2 bg-surface-container-lowest rounded-xl p-lg shadow-[0px_4px_20px_rgba(0,0,0,0.05)] flex flex-col items-center md:flex-row md:items-start gap-lg border border-outline-variant/30">' +
              '<button type="button" data-edit-open class="relative shrink-0 active:scale-95 transition-transform" aria-label="Alterar foto"><span id="pf-avatar" class="w-24 h-24 rounded-full bg-surface-container-high ring-4 ring-primary-container/20 flex items-center justify-center text-outline overflow-hidden"><span class="material-symbols-outlined text-[48px]">person</span></span><span class="absolute bottom-0 right-0 bg-primary text-on-primary p-1.5 rounded-full border-2 border-surface-container-lowest shadow-sm"><span class="material-symbols-outlined text-[16px]">photo_camera</span></span></button>' +
              '<div class="flex-1 text-center md:text-left space-y-xs min-w-0"><div class="flex items-center justify-center md:justify-start gap-sm flex-wrap"><h2 id="pf-name" class="font-headline-md text-headline-md text-on-surface">Carregando…</h2><span id="pf-role" class="hidden bg-primary/10 text-primary px-2 py-0.5 rounded-full font-label-md text-label-md border border-primary/20"></span></div><p id="pf-sub" class="font-body-md text-body-md text-on-surface-variant break-words"> </p><div class="pt-sm"><button type="button" data-edit-open class="inline-flex items-center gap-xs bg-primary/10 text-primary px-4 py-2 rounded-full font-label-md text-label-md border border-primary/20 active:scale-95 transition-transform"><span class="material-symbols-outlined text-[16px]">edit</span> Editar perfil</button></div></div>' +
            '</div>' +
            '<div class="bg-surface-container-high rounded-xl p-lg shadow-sm border border-outline-variant/20 flex flex-col justify-center items-center text-center space-y-md"><div class="flex flex-wrap justify-center gap-x-lg gap-y-sm w-full"><div class="flex flex-col items-center min-w-[90px]"><span id="pf-msgcount" class="font-headline-sm text-headline-sm text-primary">0</span><span class="text-body-sm text-on-surface-variant text-center leading-tight">Mensagens</span></div><div class="flex flex-col items-center min-w-[90px]"><span class="font-headline-sm text-headline-sm text-secondary">0</span><span class="text-body-sm text-on-surface-variant text-center leading-tight">Conquistas</span></div></div><a href="#conquistas" class="w-full h-12 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center">Ver conquistas</a></div>' +
          '</section>' +
          '<section id="pf-ranking" class="hidden bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden">' +
            '<button type="button" id="pf-ranking-toggle" class="w-full flex items-center justify-between p-lg hover:bg-surface-container-high transition-colors text-left">' +
              '<span class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">leaderboard</span><span class="font-headline-sm text-headline-sm text-on-surface">Ranking de engajamento</span></span>' +
              '<span id="pf-ranking-chevron" class="material-symbols-outlined text-outline transition-transform">expand_more</span>' +
            '</button>' +
            '<div id="pf-ranking-body" class="hidden px-lg pb-lg space-y-md">' +
              '<p class="text-body-sm text-on-surface-variant">Alunos que mais enviam mensagens nos grupos da comunidade (o suporte não conta).</p>' +
              '<div id="pf-ranking-list" class="space-y-1"><p class="text-body-sm text-on-surface-variant">Carregando…</p></div>' +
            '</div>' +
          '</section>' +
          '<section class="bg-surface-container-low rounded-xl p-lg border border-outline-variant/20 space-y-md">' +
            '<div class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">format_size</span><h3 class="font-headline-sm text-headline-sm text-on-surface">Tamanho da letra</h3></div>' +
            '<p class="text-body-sm text-on-surface-variant">Deixe o texto do app maior ou menor, do jeito que ficar melhor pra você ler.</p>' +
            '<div class="flex items-center gap-md">' +
              '<button type="button" id="fs-dec" class="h-14 flex-1 rounded-xl border border-outline-variant bg-surface text-on-surface flex items-center justify-center gap-xs active:scale-95 transition" aria-label="Diminuir a letra"><span class="material-symbols-outlined">text_decrease</span><span class="font-label-md text-label-md">Menor</span></button>' +
              '<span id="fs-val" class="w-24 shrink-0 text-center font-headline-sm text-headline-sm text-primary tabular-nums">100%</span>' +
              '<button type="button" id="fs-inc" class="h-14 flex-1 rounded-xl border border-outline-variant bg-surface text-on-surface flex items-center justify-center gap-xs active:scale-95 transition" aria-label="Aumentar a letra"><span class="material-symbols-outlined">text_increase</span><span class="font-label-md text-label-md">Maior</span></button>' +
            '</div>' +
            '<button type="button" id="fs-reset" class="text-primary text-label-md font-label-md underline">Voltar ao tamanho padrão</button>' +
          '</section>' +
          '<section class="space-y-md"><h3 class="font-headline-sm text-headline-sm text-on-surface">Recursos</h3><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">' +
            '<a href="/chat/suporte" class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-xl flex flex-col gap-md min-h-[12rem] hover:shadow-md active:scale-[0.98] transition-all"><div class="bg-primary/10 text-primary p-2 rounded-lg w-fit"><span class="material-symbols-outlined">support_agent</span></div><div><h4 class="font-headline-sm text-headline-sm text-on-surface">Suporte do Giovanni</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Fale com a equipe de suporte.</p></div></a>' +
            '<button type="button" data-soon class="text-left bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-xl flex flex-col gap-md min-h-[12rem] hover:shadow-md active:scale-[0.98] transition-all"><div class="bg-primary/10 text-primary p-2 rounded-lg w-fit"><span class="material-symbols-outlined">library_books</span></div><div><h4 class="font-headline-sm text-headline-sm text-on-surface">Guia do Trader</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Gerenciamento de risco e consistência.</p></div></button>' +
            '<a href="/" class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-xl flex flex-col gap-md min-h-[12rem] hover:shadow-md active:scale-[0.98] transition-all"><div class="bg-secondary-container/30 text-on-secondary-container p-2 rounded-lg w-fit"><span class="material-symbols-outlined">forum</span></div><div><h4 class="font-headline-sm text-headline-sm text-on-surface">Fórum de Trades</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Volte para os grupos da comunidade.</p></div></a>' +
            '<a href="https://giovannipaganini.com/" target="_blank" rel="noopener noreferrer" class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-xl flex flex-col gap-md min-h-[12rem] hover:shadow-md active:scale-[0.98] transition-all"><div class="flex items-start justify-between"><div class="bg-primary/10 text-primary p-2 rounded-lg w-fit"><span class="material-symbols-outlined">card_membership</span></div><span class="material-symbols-outlined text-[18px] text-on-surface-variant/60">open_in_new</span></div><div><h4 class="font-headline-sm text-headline-sm text-on-surface">Área de membros</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Sua área exclusiva de membro.</p></div></a>' +
            '<a href="https://www.diariodetrade.com/" target="_blank" rel="noopener noreferrer" class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-xl flex flex-col gap-md min-h-[12rem] hover:shadow-md active:scale-[0.98] transition-all"><div class="flex items-start justify-between"><div class="bg-tertiary/10 text-tertiary p-2 rounded-lg w-fit"><span class="material-symbols-outlined">edit_note</span></div><span class="material-symbols-outlined text-[18px] text-on-surface-variant/60">open_in_new</span></div><div><h4 class="font-headline-sm text-headline-sm text-on-surface">Diário de trading</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Registre e analise suas operações.</p></div></a>' +
            '<a href="https://www.gvsicapital.com/" target="_blank" rel="noopener noreferrer" class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-xl flex flex-col gap-md min-h-[12rem] hover:shadow-md active:scale-[0.98] transition-all"><div class="flex items-start justify-between"><div class="bg-secondary-container/30 text-on-secondary-container p-2 rounded-lg w-fit"><span class="material-symbols-outlined">account_balance</span></div><span class="material-symbols-outlined text-[18px] text-on-surface-variant/60">open_in_new</span></div><div><h4 class="font-headline-sm text-headline-sm text-on-surface">Mesa proprietária</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Opere com o capital da mesa.</p></div></a>' +
          '</div></section>' +
          '<section id="conquistas" class="space-y-md"><h3 class="font-headline-sm text-headline-sm text-on-surface">Conquistas</h3><div class="bg-surface-container-lowest rounded-xl p-xl border border-outline-variant/30 flex flex-col items-center justify-center text-center gap-sm"><span class="material-symbols-outlined text-[40px] text-outline">workspace_premium</span><p class="text-body-sm text-on-surface-variant max-w-xs">Suas conquistas e certificações aparecerão aqui conforme você participa da comunidade.</p></div></section>' +
          '<section class="bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden"><div class="divide-y divide-outline-variant/20">' +
            '<button type="button" id="pf-admin" class="hidden w-full items-center justify-between p-lg hover:bg-surface-container-high transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">group</span><span class="font-body-md text-body-md text-on-surface">Gerenciar membros</span></div><span class="material-symbols-outlined text-outline">chevron_right</span></button>' +
            '<button type="button" id="pf-mod" class="hidden w-full items-center justify-between p-lg hover:bg-surface-container-high transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">shield</span><span class="font-body-md text-body-md text-on-surface">Moderação</span></div><span class="material-symbols-outlined text-outline">chevron_right</span></button>' +
            '<button type="button" id="pf-ia" class="hidden w-full items-center justify-between p-lg hover:bg-surface-container-high transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">smart_toy</span><span class="font-body-md text-body-md text-on-surface">Rascunhos da IA</span></div><span id="pf-ia-badge" class="hidden text-[11px] font-bold text-on-primary bg-primary rounded-full px-2 py-[1px] leading-none">0</span></button>' +
            '<button type="button" data-edit-open class="w-full flex items-center justify-between p-lg hover:bg-surface-container-high transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">person_edit</span><span class="font-body-md text-body-md text-on-surface">Editar perfil</span></div><span class="material-symbols-outlined text-outline">chevron_right</span></button>' +
            '<button type="button" data-soon class="w-full flex items-center justify-between p-lg hover:bg-surface-container-high transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">shield</span><span class="font-body-md text-body-md text-on-surface">Privacidade e segurança</span></div><span class="material-symbols-outlined text-outline">chevron_right</span></button>' +
            '<button type="button" id="pf-notif" class="w-full flex items-center justify-between p-lg hover:bg-surface-container-high transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">notifications</span><span class="font-body-md text-body-md text-on-surface">Notificações do navegador</span></div><span id="pf-notif-state" class="text-body-sm text-on-surface-variant">—</span></button>' +
            '<button type="button" id="pf-install" class="w-full flex items-center justify-between p-lg hover:bg-surface-container-high transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">install_mobile</span><span class="font-body-md text-body-md text-on-surface">Instalar o app no celular</span></div><span class="material-symbols-outlined text-outline">chevron_right</span></button>' +
            '<button type="button" data-signout class="w-full flex items-center justify-between p-lg hover:bg-error/10 transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-error">logout</span><span class="font-body-md text-body-md text-error">Sair da conta</span></div></button>' +
          '</div></section>' +
        '</div></div>' +
        '<nav class="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-xl bg-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] h-16 flex justify-around items-center px-2"><a class="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1" href="/"><span class="material-symbols-outlined">groups</span><span class="font-label-md text-label-md">Grupos</span></a><a class="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-4 py-1" href="/perfil"><span class="material-symbols-outlined fill">person</span><span class="font-label-md text-label-md">Meu Perfil</span></a></nav>' +
        '<div id="edit-modal" class="hidden fixed inset-0 z-[60] items-center justify-center p-container-margin bg-black/40"><div class="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg space-y-md max-h-[90vh] overflow-y-auto custom-scrollbar"><div class="flex items-center justify-between"><h3 class="font-headline-sm text-headline-sm text-on-surface">Editar perfil</h3><button type="button" data-edit-close class="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button></div>' +
          '<form id="edit-form" class="space-y-md"><div class="flex items-center gap-md"><span class="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-outline overflow-hidden shrink-0"><span id="ef-avatar-icon" class="material-symbols-outlined text-[32px]">person</span><img id="ef-avatar-preview" class="hidden w-16 h-16 object-cover" alt=""></span><button type="button" id="ef-avatar-btn" class="text-primary text-label-md font-label-md flex items-center gap-xs"><span class="material-symbols-outlined text-[18px]">photo_camera</span> Alterar foto</button><input id="ef-avatar-input" type="file" accept="image/*" class="hidden"></div>' +
          '<div><label for="ef-name" class="block text-label-md font-label-md text-on-surface-variant mb-xs">Nome</label><input id="ef-name" type="text" readonly aria-readonly="true" tabindex="-1" class="w-full bg-surface-container-high border border-outline-variant rounded-xl py-3 px-4 text-body-md text-on-surface-variant cursor-not-allowed" placeholder="Seu nome"><p id="ef-name-lock" class="text-body-sm text-on-surface-variant mt-xs flex items-center gap-xs"><span class="material-symbols-outlined text-[16px]">lock</span>O nome não pode ser alterado.</p></div>' +
          '<div><label for="ef-bio" class="block text-label-md font-label-md text-on-surface-variant mb-xs">Bio</label><textarea id="ef-bio" rows="2" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-body-md text-on-surface resize-none" placeholder="Fale um pouco sobre você"></textarea></div>' +
          '<div><label for="ef-phone" class="block text-label-md font-label-md text-on-surface-variant mb-xs">Telefone</label><input id="ef-phone" type="tel" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-body-md text-on-surface" placeholder="(00) 00000-0000"></div>' +
          '<p id="ef-msg" class="hidden text-body-sm text-center"></p>' +
          '<div class="flex gap-sm pt-sm"><button type="button" data-edit-close class="flex-1 h-11 rounded-xl border border-outline-variant text-on-surface font-label-md">Cancelar</button><button id="ef-save" type="submit" class="flex-1 h-11 rounded-xl bg-primary text-on-primary font-label-md">Salvar</button></div></form></div></div>';

      function avatarHtml() { return me.avatar_url ? '<img src="' + esc(me.avatar_url) + '" class="w-full h-full object-cover" alt="">' : '<span class="material-symbols-outlined" style="font-size:48px">person</span>'; }
      function fillUI() {
        document.getElementById('pf-name').textContent = G.shortName(me.full_name) || 'Complete seu perfil';
        document.getElementById('pf-sub').textContent = me.bio || me.email || 'Adicione uma bio ao seu perfil.';
        document.getElementById('pf-avatar').innerHTML = avatarHtml();
        var badge = document.getElementById('pf-role');
        if (me.role === 'admin' || me.role === 'suporte') { badge.textContent = me.role === 'admin' ? 'Administrador' : 'Suporte'; badge.classList.remove('hidden'); } else badge.classList.add('hidden');
        G.updateSidebarProfile(); document.title = 'Comunidade do Giovanni | ' + (me.full_name || 'Meu Perfil');
      }
      fillUI();
      sb.from('comu_messages').select('id', { count: 'exact', head: true }).eq('author_id', me.id).then(function (r) { var el = document.getElementById('pf-msgcount'); if (el) el.textContent = r.count || 0; });

      // Ranking de engajamento — só para administradores, aberto sob demanda por um botão
      if (me.role === 'admin') {
        var secR = document.getElementById('pf-ranking'); if (secR) secR.classList.remove('hidden');
        var rankLoaded = false;
        var rankTgl = document.getElementById('pf-ranking-toggle');
        if (rankTgl) rankTgl.addEventListener('click', function () {
          var body = document.getElementById('pf-ranking-body'); var chev = document.getElementById('pf-ranking-chevron');
          if (!body) return;
          body.classList.toggle('hidden');
          var isOpen = !body.classList.contains('hidden');
          if (chev) chev.style.transform = isOpen ? 'rotate(180deg)' : '';
          if (isOpen && !rankLoaded) { rankLoaded = true; loadRanking(); }
        });
      }
      function loadRanking() {
        sb.rpc('comu_engagement_ranking', { p_limit: 20 }).then(function (r) {
          var box = document.getElementById('pf-ranking-list'); if (!box) return;
          if (r.error) { box.innerHTML = '<p class="text-body-sm text-error">' + esc(r.error.message) + '</p>'; return; }
          var rows = r.data || [];
          if (!rows.length) { box.innerHTML = '<p class="text-body-sm text-on-surface-variant">Ainda não há mensagens suficientes.</p>'; return; }
          var max = rows[0].msg_count || 1;
          var medal = ['🥇', '🥈', '🥉'];
          box.innerHTML = rows.map(function (x, i) {
            var pos = i < 3 ? '<span class="text-[18px] w-7 text-center shrink-0">' + medal[i] + '</span>' : '<span class="w-7 text-center shrink-0 font-bold text-on-surface-variant tabular-nums">' + (i + 1) + '</span>';
            var av = x.avatar_url ? '<img src="' + esc(x.avatar_url) + '" class="w-9 h-9 rounded-full object-cover shrink-0">' : '<span class="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-outline shrink-0"><span class="material-symbols-outlined text-[20px]">person</span></span>';
            var crown = x.premium ? ' <span class="material-symbols-outlined text-[14px] text-amber-500 align-middle">workspace_premium</span>' : '';
            var pct = Math.max(6, Math.round((x.msg_count / max) * 100));
            return '<div class="flex items-center gap-md p-2 rounded-xl ' + (i < 3 ? 'bg-surface-container-high' : 'hover:bg-surface-container-low') + '">' + pos + av +
              '<div class="flex-1 min-w-0"><p class="font-bold text-on-surface truncate text-body-md">' + esc(x.full_name || 'Membro') + crown + '</p>' +
              '<div class="h-1.5 rounded-full bg-outline-variant/30 mt-1 overflow-hidden"><div class="h-full rounded-full bg-primary" style="width:' + pct + '%"></div></div></div>' +
              '<span class="font-headline-sm text-headline-sm text-primary tabular-nums shrink-0">' + x.msg_count + '</span></div>';
          }).join('');
        });
      }

      // Notificações do navegador — ligar/desligar
      (function () {
        var btn = document.getElementById('pf-notif'), st = document.getElementById('pf-notif-state');
        if (!btn || !st) return;
        function paint() {
          if (!G.notifSupported()) { st.textContent = 'Indisponível'; return; }
          if (Notification.permission === 'denied') { st.innerHTML = '<span class="text-error">Bloqueado</span>'; return; }
          var on = false; try { on = localStorage.getItem('gvsi-notif') === '1'; } catch (e) {}
          on = on && Notification.permission === 'granted';
          st.innerHTML = on ? '<span class="text-primary font-bold">Ativadas</span>' : 'Desativadas';
        }
        paint();
        btn.addEventListener('click', async function () {
          if (!G.notifSupported()) { G.toast('Seu navegador não suporta notificações.'); return; }
          if (Notification.permission === 'denied') { G.toast('As notificações estão bloqueadas. Libere nas configurações do navegador (cadeado ao lado do endereço).'); return; }
          var on = false; try { on = localStorage.getItem('gvsi-notif') === '1'; } catch (e) {}
          if (on && Notification.permission === 'granted') { try { localStorage.setItem('gvsi-notif', '0'); } catch (e) {} G.toast('Notificações desativadas.'); paint(); return; }
          var perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
          if (perm === 'granted') {
            try { localStorage.setItem('gvsi-notif', '1'); } catch (e) {}
            G.toast('Notificações ativadas!');
            try { var n = new Notification('Comunidade do Giovanni', { body: 'Pronto! Você receberá avisos de novas mensagens.', icon: '/assets/favicon.png' }); n.onclick = function () { try { window.focus(); } catch (e) {} n.close(); }; } catch (e) {}
          } else { G.toast('Permissão de notificação negada.'); }
          paint();
        });
      })();

      var modal = document.getElementById('edit-modal');
      function openEdit() {
        document.getElementById('ef-name').value = me.full_name || ''; document.getElementById('ef-bio').value = me.bio || ''; document.getElementById('ef-phone').value = me.phone || ''; document.getElementById('ef-msg').classList.add('hidden');
        // Admin pode alterar o próprio nome; para os demais o campo continua travado
        var _nm = document.getElementById('ef-name'), _lk = document.getElementById('ef-name-lock');
        if (me.role === 'admin') {
          _nm.removeAttribute('readonly'); _nm.removeAttribute('aria-readonly'); _nm.removeAttribute('tabindex');
          _nm.className = 'w-full bg-surface-container-low border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-body-md text-on-surface';
          if (_lk) _lk.classList.add('hidden');
        } else {
          _nm.setAttribute('readonly', ''); _nm.setAttribute('aria-readonly', 'true'); _nm.setAttribute('tabindex', '-1');
          _nm.className = 'w-full bg-surface-container-high border border-outline-variant rounded-xl py-3 px-4 text-body-md text-on-surface-variant cursor-not-allowed';
          if (_lk) _lk.classList.remove('hidden');
        }
        if (me.avatar_url) { document.getElementById('ef-avatar-preview').src = me.avatar_url; document.getElementById('ef-avatar-preview').classList.remove('hidden'); document.getElementById('ef-avatar-icon').classList.add('hidden'); }
        else { document.getElementById('ef-avatar-preview').classList.add('hidden'); document.getElementById('ef-avatar-icon').classList.remove('hidden'); }
        modal.classList.remove('hidden'); modal.classList.add('flex');
      }
      function closeEdit() { modal.classList.add('hidden'); modal.classList.remove('flex'); }
      document.querySelectorAll('[data-edit-open]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); openEdit(); }); });
      document.querySelectorAll('[data-edit-close]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); closeEdit(); }); });
      modal.addEventListener('click', function (e) { if (e.target === modal) closeEdit(); });
      function efMsg(t, ok) { var m = document.getElementById('ef-msg'); m.textContent = t; m.className = 'text-body-sm text-center ' + (ok ? 'text-primary' : 'text-error'); m.classList.remove('hidden'); }
      var avInput = document.getElementById('ef-avatar-input');
      document.getElementById('ef-avatar-btn').addEventListener('click', function () { avInput.click(); });
      avInput.addEventListener('change', async function () {
        var file = avInput.files[0]; if (!file) return; efMsg('Enviando foto...', true);
        var ext = (file.name.split('.').pop() || 'jpg').toLowerCase(); var path = 'avatars/' + me.id + '/' + Date.now() + '.' + ext;
        var up = await sb.storage.from('comu-media').upload(path, file, { upsert: true }); if (up.error) { efMsg('Erro no upload: ' + up.error.message, false); return; }
        me.avatar_url = sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
        document.getElementById('ef-avatar-preview').src = me.avatar_url; document.getElementById('ef-avatar-preview').classList.remove('hidden'); document.getElementById('ef-avatar-icon').classList.add('hidden');
        efMsg('Foto pronta. Clique em Salvar para confirmar.', true);
      });
      document.getElementById('edit-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var payload = { bio: document.getElementById('ef-bio').value.trim() || null, phone: document.getElementById('ef-phone').value.trim() || null, avatar_url: me.avatar_url || null };
        if (me.role === 'admin') { var _nv = document.getElementById('ef-name').value.trim(); if (_nv && _nv !== (me.full_name || '')) { payload.full_name = _nv; payload.name_locked = true; } } // admin edita o próprio nome (trava contra o sync do CSV)
        document.getElementById('ef-save').disabled = true;
        var up = await sb.from('lms_students').update(payload).eq('id', me.id).select().single();
        document.getElementById('ef-save').disabled = false;
        if (up.error) { efMsg('Erro ao salvar: ' + up.error.message, false); return; }
        Object.assign(me, up.data); G.me = me; fillUI(); closeEdit(); G.toast('Perfil atualizado ✅');
      });
      // #10 — controle de tamanho da letra (escala só o texto, via --fs)
      (function () {
        var STEPS = [0.9, 1, 1.1, 1.2, 1.3];
        function curFs() { var f = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')); return f > 0 ? f : 1; }
        function nearestIdx(f) { var bi = 1, bd = 9; STEPS.forEach(function (s, i) { var d = Math.abs(s - f); if (d < bd) { bd = d; bi = i; } }); return bi; }
        var idx = nearestIdx(curFs());
        function apply() { var f = STEPS[idx]; document.documentElement.style.setProperty('--fs', f); try { localStorage.setItem('gvsi-fs', f); } catch (e) {} var v = document.getElementById('fs-val'); if (v) v.textContent = Math.round(f * 100) + '%'; }
        apply();
        var dec = document.getElementById('fs-dec'), inc = document.getElementById('fs-inc'), rst = document.getElementById('fs-reset');
        if (dec) dec.addEventListener('click', function () { idx = Math.max(0, idx - 1); apply(); });
        if (inc) inc.addEventListener('click', function () { idx = Math.min(STEPS.length - 1, idx + 1); apply(); });
        if (rst) rst.addEventListener('click', function () { idx = 1; apply(); });
      })();
      document.querySelectorAll('[data-soon]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); G.toast('Em breve.'); }); });
      // Link discreto de instalar o app (PWA)
      var pfAdmin = document.getElementById('pf-admin'); if (pfAdmin && me.role === 'admin') { pfAdmin.classList.remove('hidden'); pfAdmin.classList.add('flex'); pfAdmin.addEventListener('click', function () { G.navigate('/membros'); }); }
      var pfMod = document.getElementById('pf-mod'); if (pfMod && me.role === 'admin') { pfMod.classList.remove('hidden'); pfMod.classList.add('flex'); pfMod.addEventListener('click', function () { G.navigate('/moderacao'); }); }
      var pfIa = document.getElementById('pf-ia'); if (pfIa && me.role === 'admin') { pfIa.classList.remove('hidden'); pfIa.classList.add('flex'); pfIa.addEventListener('click', function () { G.navigate('/ia-suporte'); }); (async function () { try { var cc = await sb.from('comu_ai_drafts').select('id', { count: 'exact', head: true }).eq('status', 'pending'); var bdg = document.getElementById('pf-ia-badge'); if (bdg && cc && cc.count) { bdg.textContent = cc.count; bdg.classList.remove('hidden'); } } catch (e) {} })(); }
      var pfInstall = document.getElementById('pf-install');
      if (pfInstall) {
        var already = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
        if (already) pfInstall.style.display = 'none';
        pfInstall.addEventListener('click', function () {
          var dp = G._installPrompt;
          if (dp) { try { dp.prompt(); dp.userChoice.then(function () { G._installPrompt = null; }); } catch (e) {} return; }
          if (/iphone|ipad|ipod/i.test(navigator.userAgent)) { G.toast('No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".'); return; }
          G.toast('Abra o menu do navegador e escolha "Instalar aplicativo".');
        });
      }
    }
  };

  // =====================================================================
  // SUPORTE (console do atendente — só admin)
  // =====================================================================
  GVSI.views.suporte = (function () {
    var S = null;
    function cleanup() { if (!S) return; S.destroyed = true; (S.channels || []).forEach(function (c) { try { sb.removeChannel(c); } catch (e) {} }); if (S.supMenu && S.supMenu.parentNode) S.supMenu.remove(); if (S.supPicker && S.supPicker.parentNode) S.supPicker.remove(); if (S.onSupDoc) document.removeEventListener('click', S.onSupDoc); S = null; }
    return {
      destroy: cleanup,
      render: async function (view) {
        var me = G.me || {};
        if (me.role !== 'admin') { G.navigate('/'); return; }
        S = { destroyed: false, channels: [], currentTicket: null, filter: 'pendentes', tagFilter: null, seen: Object.create(null), convoChannel: null, tags: [], contactTags: {} };
        var self = S;
        view.innerHTML =
          '<header class="fixed top-0 left-0 right-0 lg:left-[var(--side-w)] z-50 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] h-14 flex items-center justify-between px-container-margin"><button type="button" id="suporte-back" class="flex items-center gap-sm text-primary" aria-label="Voltar"><span class="material-symbols-outlined">arrow_back</span><span class="font-headline-sm text-headline-sm font-bold">Suporte · Atendimento</span></button><div class="flex items-center gap-xs"><button type="button" data-theme-toggle class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button><button type="button" data-signout class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors" aria-label="Sair"><span class="material-symbols-outlined">logout</span></button></div></header>' +
          '<div class="pt-14 lg:pl-[var(--side-w)] h-[100dvh] flex">' +
            '<aside id="list-panel" class="w-full lg:w-[380px] lg:border-r border-outline-variant flex flex-col shrink-0"><div class="p-sm border-b border-outline-variant"><div class="relative"><span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">search</span><input id="sup-search" type="text" autocomplete="off" placeholder="Buscar por nome, telefone ou e-mail" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2 pl-10 pr-3 text-body-sm text-on-surface focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant"></div><button type="button" id="sup-new" class="w-full h-10 mt-sm rounded-xl bg-primary text-on-primary font-label-md flex items-center justify-center gap-1 active:scale-[0.98] transition"><span class="material-symbols-outlined text-[20px]">edit_square</span>Nova conversa</button></div><div class="p-sm flex gap-1 border-b border-outline-variant"><button data-filter="pendentes" class="flex-1 py-2 rounded-lg text-label-md font-label-md bg-primary text-on-primary transition-colors">Pendentes</button><button data-filter="resolvidos" class="flex-1 py-2 rounded-lg text-label-md font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors">Resolvidos</button></div><div id="tag-filter" class="hidden gap-1 px-sm pb-sm pt-1 overflow-x-auto custom-scrollbar border-b border-outline-variant items-center whitespace-nowrap"></div><div id="ticket-list" class="flex-1 overflow-y-auto custom-scrollbar"><p class="p-lg text-center text-on-surface-variant text-body-sm">Carregando…</p></div></aside>' +
            '<section id="convo-panel" class="hidden lg:flex flex-1 flex-col min-w-0"><div id="convo-empty" class="flex-1 flex flex-col items-center justify-center text-center gap-md p-xl text-on-surface-variant"><span class="material-symbols-outlined text-[48px]">forum</span><p class="text-body-md max-w-xs">Selecione uma conversa para ver o histórico e responder.</p></div>' +
              '<div id="convo-main" class="hidden flex-1 flex-col min-h-0 relative"><div class="min-h-16 shrink-0 border-b border-outline-variant px-md py-2 flex items-center"><div class="max-w-3xl mx-auto w-full flex items-center gap-md"><button id="convo-back" class="lg:hidden text-primary flex items-center" aria-label="Voltar"><span class="material-symbols-outlined">arrow_back</span></button><span id="convo-avatar" class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-outline shrink-0 overflow-hidden"><span class="material-symbols-outlined">person</span></span><div class="flex-1 min-w-0"><h2 id="convo-name" class="font-bold text-on-surface truncate"></h2><p id="convo-protocol" class="text-body-sm text-outline truncate"></p><div id="convo-rating" class="hidden flex-wrap items-center gap-1 mt-0.5"></div><button type="button" id="convo-history" class="hidden items-center gap-1 mt-0.5 text-[12px] text-primary hover:underline"><span class="material-symbols-outlined text-[14px]">history</span><span id="convo-history-lbl"></span></button><div id="convo-tags" class="flex flex-wrap items-center gap-1 mt-1"></div></div><button type="button" id="btn-history" class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0" aria-label="Conversas anteriores" title="Conversas anteriores"><span class="material-symbols-outlined">history</span></button><button type="button" id="btn-profile" class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0" aria-label="Editar perfil do membro" title="Editar perfil"><span class="material-symbols-outlined">manage_accounts</span></button><button type="button" id="btn-access" class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0" aria-label="Acesso ao Diário" title="Acesso ao Diário de Trade"><span class="material-symbols-outlined">key</span></button><button type="button" id="btn-challenge" class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0" aria-label="Desafio" title="Desafio"><span class="material-symbols-outlined">emoji_events</span></button><button type="button" id="btn-tags" class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0" aria-label="Tags do contato"><span class="material-symbols-outlined">sell</span></button><button id="btn-resolve" class="bg-primary text-on-primary rounded-full px-4 py-2 text-label-md font-label-md active:scale-95 transition disabled:opacity-60 flex items-center gap-xs"><span class="material-symbols-outlined text-[18px]">check_circle</span><span id="btn-resolve-label">Marcar como resolvido</span></button></div></div>' +
                '<div id="convo-scroll" class="flex-1 overflow-y-auto custom-scrollbar p-md"><div id="convo-messages" class="flex flex-col gap-md max-w-3xl mx-auto w-full"></div></div>' +
                '<button type="button" id="ai-draft-reopen" class="hidden absolute bottom-24 right-3 z-30 items-center gap-xs h-11 px-4 rounded-full bg-primary text-on-primary shadow-lg active:scale-95 transition"><span class="material-symbols-outlined text-[20px]">smart_toy</span><span class="font-label-md">Sugestão da IA</span></button>' +
                '<div id="ai-draft-bar" class="hidden absolute bottom-24 right-3 left-3 sm:left-auto sm:w-[400px] max-w-[calc(100%-1.5rem)] z-30"><div class="bg-surface-container-lowest border border-primary/40 rounded-2xl shadow-2xl p-md max-h-[60vh] overflow-y-auto custom-scrollbar"></div></div>' +
                '<form id="convo-form" class="shrink-0 border-t border-outline-variant p-sm"><div class="max-w-3xl mx-auto w-full flex flex-col gap-sm"><textarea id="convo-input" rows="1" autocomplete="off" placeholder="Responder…" class="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-3 text-body-md focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant resize-none max-h-52 overflow-y-auto whitespace-pre-wrap"></textarea><div id="sup-rec-bar" class="hidden flex items-center gap-sm flex-wrap"><span id="sup-rec-dot" class="w-3 h-3 rounded-full bg-error animate-pulse shrink-0"></span><span id="sup-rec-time" class="text-body-lg text-on-surface tabular-nums">0:00</span><audio id="sup-rec-preview" class="hidden"></audio><span class="flex-grow"></span><button type="button" id="sup-rec-pause" class="h-11 px-3 rounded-xl border border-outline-variant text-on-surface flex items-center gap-xs shrink-0"><span class="material-symbols-outlined text-[22px]" id="sup-rec-pause-ic">pause</span><span class="text-body-sm" id="sup-rec-pause-lbl">Pausar</span></button><button type="button" id="sup-rec-listen" class="hidden h-11 px-3 rounded-xl border border-outline-variant text-primary items-center gap-xs shrink-0"><span class="material-symbols-outlined text-[22px]" id="sup-rec-listen-ic">play_arrow</span><span class="text-body-sm" id="sup-rec-listen-lbl">Ouvir</span></button><button type="button" id="sup-rec-cancel" class="h-11 px-3 rounded-xl border border-outline-variant text-error flex items-center gap-xs shrink-0"><span class="material-symbols-outlined text-[22px]">delete</span><span class="text-body-sm">Excluir</span></button><button type="button" id="sup-rec-send" class="h-11 px-4 bg-primary text-on-primary rounded-xl flex items-center gap-xs shadow shrink-0"><span class="material-symbols-outlined fill text-[22px]">send</span><span class="text-body-sm font-bold">Enviar</span></button></div><div id="sup-composer-row" class="flex flex-wrap items-center gap-sm"><button type="button" id="convo-emoji" class="h-11 w-11 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center shrink-0" aria-label="Emojis"><span class="material-symbols-outlined text-[24px]">mood</span></button><button type="button" id="convo-attach" class="h-11 px-3 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-xs shrink-0" aria-label="Anexar foto ou vídeo"><span class="material-symbols-outlined text-[24px]">attach_file</span><span class="text-body-sm font-label-md">Anexar</span></button><button type="button" id="convo-audio-btn" class="h-11 px-3 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-xs shrink-0" aria-label="Enviar áudio"><span class="material-symbols-outlined text-[24px]">mic</span><span class="text-body-sm font-label-md">Áudio</span></button><button type="submit" class="h-11 px-5 ml-auto bg-primary text-on-primary rounded-xl flex items-center gap-xs shadow-lg active:scale-95 transition-all shrink-0" aria-label="Enviar"><span class="material-symbols-outlined fill text-[24px]">send</span><span class="text-body-md font-bold">Enviar</span></button></div></div><input id="convo-file-media" type="file" class="hidden"><input id="convo-file-audio" type="file" accept="audio/*" class="hidden"></form></div>' +
            '</section>' +
          '</div>';
        var topicRes = await sb.from('comu_topics').select('id').eq('slug', 'suporte').single(); if (self.destroyed) return;
        var supportTopicId = topicRes.data.id;
        if (me.id) { sb.from('comu_topic_reads').upsert({ topic_id: supportTopicId, user_id: me.id, last_read_at: new Date().toISOString() }, { onConflict: 'topic_id,user_id' }).then(function () { if (G.applyUnread) G.applyUnread(); }, function () {}); }
        // ---- tags de contato ----
        var TAG_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#dc2626', '#7c3aed', '#0d244e', '#0891b2', '#db2777'];
        async function loadTags() {
          var t = await sb.from('comu_support_tags').select('*').order('created_at');
          var c = await sb.from('comu_support_contact_tags').select('user_id,tag_id');
          if (self.destroyed) return;
          self.tags = t.data || []; self.contactTags = {};
          (c.data || []).forEach(function (x) { (self.contactTags[x.user_id] = self.contactTags[x.user_id] || []).push(x.tag_id); });
        }
        function tagById(id) { for (var i = 0; i < self.tags.length; i++) if (self.tags[i].id === id) return self.tags[i]; return null; }
        function contactTagChips(userId) {
          return (self.contactTags[userId] || []).map(function (id) { var t = tagById(id); return t ? '<span class="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style="background:' + esc(t.color) + '">' + esc(t.name) + '</span>' : ''; }).join('');
        }
        function refreshConvoTags() { var el = document.getElementById('convo-tags'); if (el) el.innerHTML = self.currentTicket ? contactTagChips(self.currentTicket.user_id) : ''; }
        function renderTagFilter() {
          var bar = document.getElementById('tag-filter'); if (!bar) return;
          var opts = [{ id: '__waiting__', name: 'Aguardando você', color: '#dc2626', icon: 'schedule' }].concat(self.tags || []);
          if (!self.tags || !self.tags.length) { /* mantém só o Aguardando você se não há tags criadas */ }
          bar.classList.remove('hidden'); bar.classList.add('flex');
          var html = '<span class="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0 mr-1">sell</span>';
          html += opts.map(function (t) {
            var on = self.tagFilter === t.id;
            var ic = t.icon ? '<span class="material-symbols-outlined text-[13px]">' + t.icon + '</span>' : '';
            return '<button type="button" data-tagf="' + esc(t.id) + '" class="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full text-white ' + (on ? 'ring-2 ring-offset-1 ring-offset-surface' : 'opacity-45') + '" style="background:' + esc(t.color) + '">' + ic + esc(t.name) + (on ? '<span class="material-symbols-outlined text-[13px]">close</span>' : '') + '</button>';
          }).join('');
          bar.innerHTML = html;
          bar.querySelectorAll('[data-tagf]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-tagf'); self.tagFilter = (self.tagFilter === id) ? null : id; renderTagFilter(); loadTickets(); }; });
        }
        async function toggleContactTag(userId, tagId, forceOn) {
          var a = self.contactTags[userId] || (self.contactTags[userId] = []); var has = a.indexOf(tagId) !== -1;
          if (has && !forceOn) { self.contactTags[userId] = a.filter(function (x) { return x !== tagId; }); await sb.from('comu_support_contact_tags').delete().eq('user_id', userId).eq('tag_id', tagId); }
          else if (!has) { a.push(tagId); await sb.from('comu_support_contact_tags').insert({ user_id: userId, tag_id: tagId }); }
        }
        function openTagsPanel(tk) {
          var userId = tk.user_id, chosen = TAG_COLORS[0];
          var overlay = document.createElement('div'); overlay.className = 'fixed inset-0 z-[95] flex items-center justify-center p-container-margin bg-black/40';
          var panel = document.createElement('div'); panel.className = 'w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg space-y-md max-h-[85vh] overflow-y-auto custom-scrollbar';
          overlay.appendChild(panel); document.body.appendChild(overlay);
          overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
          function render() {
            var assigned = self.contactTags[userId] || [];
            var h = '<div class="flex items-center justify-between"><h3 class="font-headline-sm text-headline-sm text-on-surface">Tags · ' + esc((tk.member && tk.member.full_name) || 'Membro') + '</h3><button type="button" class="tp-close w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"><span class="material-symbols-outlined">close</span></button></div>';
            h += '<div class="flex flex-wrap gap-2">' + (self.tags.length ? '' : '<p class="text-body-sm text-on-surface-variant">Nenhuma tag ainda. Crie a primeira abaixo.</p>');
            self.tags.forEach(function (t) { var on = assigned.indexOf(t.id) !== -1; h += '<button type="button" data-tag="' + t.id + '" class="tp-toggle inline-flex items-center gap-1 text-body-sm font-bold px-3 py-1.5 rounded-full text-white ' + (on ? '' : 'opacity-50') + '" style="background:' + esc(t.color) + '">' + (on ? '<span class="material-symbols-outlined text-[16px]">check</span>' : '') + esc(t.name) + '</button>'; });
            h += '</div><div class="pt-sm border-t border-outline-variant/40 space-y-sm"><p class="text-label-md font-label-md text-on-surface-variant">Nova tag</p><input id="tp-name" type="text" placeholder="Nome da tag" class="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-body-md text-on-surface"><div class="flex flex-wrap gap-2">';
            TAG_COLORS.forEach(function (c, i) { h += '<button type="button" data-color="' + c + '" class="tp-color w-7 h-7 rounded-full border-2 ' + (i === 0 ? 'border-on-surface' : 'border-transparent') + '" style="background:' + c + '"></button>'; });
            h += '</div><button type="button" id="tp-create" class="w-full h-10 bg-primary text-on-primary rounded-xl font-label-md">Criar e aplicar</button></div>';
            panel.innerHTML = h;
            panel.querySelector('.tp-close').onclick = function () { overlay.remove(); };
            panel.querySelectorAll('.tp-toggle').forEach(function (b) { b.onclick = async function () { await toggleContactTag(userId, b.dataset.tag); render(); refreshConvoTags(); loadTickets(); }; });
            panel.querySelectorAll('.tp-color').forEach(function (b) { b.onclick = function () { chosen = b.dataset.color; panel.querySelectorAll('.tp-color').forEach(function (x) { x.classList.remove('border-on-surface'); x.classList.add('border-transparent'); }); b.classList.add('border-on-surface'); b.classList.remove('border-transparent'); }; });
            panel.querySelector('#tp-create').onclick = async function () { var name = panel.querySelector('#tp-name').value.trim(); if (!name) return; var ins = await sb.from('comu_support_tags').insert({ name: name, color: chosen }).select().single(); if (ins.error) { G.toast('Erro: ' + ins.error.message); return; } self.tags.push(ins.data); await toggleContactTag(userId, ins.data.id, true); render(); refreshConvoTags(); renderTagFilter(); loadTickets(); };
          }
          render();
        }
        // ---- editar perfil do membro do ticket (nome, telefone, bio) + ver e-mail ----
        function openChallengePanel(tk) {
          var uid = tk.user_id; var name = (tk.member && tk.member.full_name) || 'Membro';
          var ov = document.createElement('div');
          ov.className = 'fixed inset-0 z-[80] flex items-center justify-center p-container-margin bg-black/40';
          ov.innerHTML = '<div class="w-full max-w-xs bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg space-y-md">' +
            '<div class="flex items-center justify-between"><h3 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2"><span class="material-symbols-outlined text-primary">emoji_events</span>Desafio</h3><button type="button" id="dz-close" class="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"><span class="material-symbols-outlined">close</span></button></div>' +
            '<p class="text-body-sm text-on-surface-variant">' + esc(name) + '</p>' +
            '<div id="dz-body" class="py-2 text-center text-on-surface-variant text-body-sm">Consultando…</div></div>';
          document.body.appendChild(ov);
          function close() { ov.remove(); } ov.querySelector('#dz-close').onclick = close; ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
          function render(on) {
            var b = ov.querySelector('#dz-body'); if (!b) return;
            b.innerHTML = '<div class="mb-md flex items-center justify-center gap-2 text-label-md font-bold ' + (on ? 'text-primary' : 'text-on-surface-variant') + '"><span class="material-symbols-outlined text-[18px]">' + (on ? 'check_circle' : 'radio_button_unchecked') + '</span>' + (on ? 'Participando do desafio' : 'Não está no desafio') + '</div>' +
              '<button type="button" id="dz-toggle" class="w-full h-11 rounded-full font-label-md active:scale-95 transition ' + (on ? 'border border-error/40 text-error' : 'bg-primary text-on-primary') + '">' + (on ? 'Remover do desafio' : 'Ativar desafio') + '</button>';
            ov.querySelector('#dz-toggle').onclick = async function () {
              var btn = this; btn.disabled = true; btn.classList.add('opacity-60');
              var r = await sb.rpc('comu_challenge_toggle', { p_user: uid, p_on: !on });
              btn.disabled = false; btn.classList.remove('opacity-60');
              if (r.error) { G.toast('Erro: ' + r.error.message); return; }
              G.toast(!on ? 'Desafio ativado.' : 'Removido do desafio.'); render(!on);
            };
          }
          sb.rpc('comu_challenge_is_participant', { p_user: uid }).then(function (r) {
            if (r.error) { var b = ov.querySelector('#dz-body'); if (b) b.innerHTML = '<p class="text-error text-body-sm">' + esc(r.error.message) + '</p>'; return; }
            render(!!r.data);
          });
        }
        function openAccessPanel(tk) {
          var email = (tk.member && tk.member.email) || '';
          var name = (tk.member && tk.member.full_name) || 'Membro';
          var ov = document.createElement('div');
          ov.className = 'fixed inset-0 z-[80] flex items-center justify-center p-container-margin bg-black/40';
          ov.innerHTML = '<div class="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg space-y-md max-h-[90vh] overflow-y-auto custom-scrollbar">' +
            '<div class="flex items-center justify-between"><h3 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2"><span class="material-symbols-outlined text-primary">key</span>Acesso ao Diário</h3><button type="button" id="ac-close" class="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"><span class="material-symbols-outlined">close</span></button></div>' +
            '<p class="text-body-sm text-on-surface-variant">' + esc(name) + '<br><span class="text-outline">' + esc(email) + '</span></p>' +
            '<div id="ac-body"><div class="py-8 text-center text-on-surface-variant text-body-sm">Consultando…</div></div></div>';
          document.body.appendChild(ov);
          function close() { ov.remove(); }
          ov.querySelector('#ac-close').onclick = close;
          ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

          var badge = { liberado: ['Liberado', 'bg-primary/15 text-primary', 'check_circle'], bloqueado: ['Bloqueado', 'bg-error/15 text-error', 'block'], expirado: ['Expirado', 'bg-amber-400/20 text-amber-700 dark:text-amber-300', 'schedule'], agendado: ['Agendado', 'bg-blue-500/15 text-blue-500', 'event_upcoming'], sem_conta: ['Sem conta no Diário', 'bg-surface-container-high text-on-surface-variant', 'person_off'] };
          function dpart(iso) { return iso ? String(iso).slice(0, 10) : ''; }
          function render(s) {
            var body = ov.querySelector('#ac-body'); if (!body) return;
            if (!s || s.ok === false && s.error && s.error !== 'sem_conta') { body.innerHTML = '<p class="text-body-sm text-error py-4">' + esc((s && s.error) || 'Erro ao consultar.') + '</p>'; return; }
            var acc = s.access || 'bloqueado';
            var b = badge[acc] || badge.bloqueado;
            var semConta = acc === 'sem_conta';
            var win = '';
            if (!semConta && (s.from || s.until)) win = '<p class="text-body-sm text-on-surface-variant">Período atual: ' + (s.from ? '<b>' + esc(dpart(s.from)) + '</b>' : 'início livre') + ' até ' + (s.until ? '<b>' + esc(dpart(s.until)) + '</b>' : 'sem prazo') + '</p>';
            var paid = s.has_paid ? '<p class="text-[12px] text-amber-600 dark:text-amber-400 flex items-center gap-1"><span class="material-symbols-outlined text-[15px]">info</span>Tem assinatura paga ativa; bloquear aqui só afeta a liberação manual.</p>' : '';
            body.innerHTML =
              '<div class="flex items-center gap-2 mb-md"><span class="inline-flex items-center gap-1 text-label-md font-bold px-3 py-1 rounded-full ' + b[1] + '"><span class="material-symbols-outlined text-[16px]">' + b[2] + '</span>' + b[0] + '</span></div>' +
              (semConta ? '<p class="text-body-sm text-on-surface-variant mb-md">A pessoa ainda não tem conta no Diário de Trade. Ela precisa criar o acesso lá pelo menos uma vez para você conseguir liberar.</p>' : (win + paid +
                '<div class="grid grid-cols-2 gap-sm mt-md"><label class="text-label-md text-on-surface-variant">De<input type="date" id="ac-from" value="' + esc(dpart(s.from)) + '" class="mt-1 w-full bg-surface-container-low border border-outline-variant rounded-xl py-2 px-3 text-body-sm text-on-surface"></label><label class="text-label-md text-on-surface-variant">Até<input type="date" id="ac-until" value="' + esc(dpart(s.until)) + '" class="mt-1 w-full bg-surface-container-low border border-outline-variant rounded-xl py-2 px-3 text-body-sm text-on-surface"></label></div>' +
                '<p class="text-[12px] text-outline mt-1">Deixe as datas em branco para acesso permanente. Preencha só "Até" para um prazo final.</p>' +
                '<div class="flex gap-sm pt-md"><button type="button" id="ac-grant" class="flex-1 h-11 rounded-full bg-primary text-on-primary font-label-md active:scale-95 transition flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[18px]">lock_open</span>Liberar acesso</button><button type="button" id="ac-block" class="h-11 px-4 rounded-full border border-error/40 text-error font-label-md active:scale-95 transition flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">block</span>Bloquear</button></div>'));
            var gb = ov.querySelector('#ac-grant'), bb = ov.querySelector('#ac-block');
            if (gb) gb.onclick = function () { act('grant', { from: (ov.querySelector('#ac-from').value || null), until: (ov.querySelector('#ac-until').value || null) }, gb); };
            if (bb) bb.onclick = function () { act('block', {}, bb); };
          }
          async function act(action, extra, btn) {
            if (btn) { btn.disabled = true; btn.classList.add('opacity-60'); }
            var payload = Object.assign({ action: action, email: email }, extra || {});
            var res = await sb.functions.invoke('hub-access', { body: payload });
            if (btn) { btn.disabled = false; btn.classList.remove('opacity-60'); }
            if (res.error) { G.toast('Erro: ' + (res.error.message || 'falha')); return; }
            var d = res.data || {};
            if (d.ok === false) { G.toast(d.error === 'sem_conta' ? 'Pessoa sem conta no Diário.' : ('Erro: ' + (d.error || 'falha'))); render(d); return; }
            if (action === 'grant') G.toast('Acesso liberado.');
            if (action === 'block') G.toast('Acesso bloqueado.');
            render(d);
          }
          (async function () {
            var res = await sb.functions.invoke('hub-access', { body: { action: 'status', email: email } });
            if (res.error) { var body = ov.querySelector('#ac-body'); if (body) body.innerHTML = '<p class="text-body-sm text-error py-4">' + esc(res.error.message || 'Falha ao consultar. Você precisa ser admin.') + '</p>'; return; }
            render(res.data);
          })();
        }
        function openProfileEditor(tk) {
          var userId = tk.user_id; if (!userId) { G.toast('Este contato não tem cadastro para editar.'); return; }
          var overlay = document.createElement('div'); overlay.className = 'fixed inset-0 z-[95] flex items-center justify-center p-container-margin bg-black/40';
          var panel = document.createElement('div'); panel.className = 'w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg space-y-md max-h-[85vh] overflow-y-auto custom-scrollbar';
          panel.innerHTML = '<p class="text-body-sm text-on-surface-variant text-center py-md">Carregando…</p>';
          overlay.appendChild(panel); document.body.appendChild(overlay);
          overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
          (async function () {
            var r = await sb.from('lms_students').select('id,full_name,email,phone,bio,avatar_url').eq('id', userId).single();
            if (self.destroyed) { overlay.remove(); return; }
            if (r.error || !r.data) { panel.innerHTML = '<p class="text-body-sm text-error text-center py-md">Não foi possível carregar o perfil.</p>'; return; }
            var u = r.data;
            var av = u.avatar_url ? '<img src="' + esc(u.avatar_url) + '" class="w-16 h-16 rounded-full object-cover mx-auto">' : '<span class="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-outline mx-auto"><span class="material-symbols-outlined text-[32px]">person</span></span>';
            panel.innerHTML =
              '<div class="flex items-center justify-between"><h3 class="font-headline-sm text-headline-sm text-on-surface">Editar perfil</h3><button type="button" class="pe-close w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"><span class="material-symbols-outlined">close</span></button></div>' +
              '<div>' + av + '</div>' +
              '<div class="bg-surface-container-low rounded-xl px-3 py-2 flex items-center gap-2"><span class="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0">mail</span><span class="text-body-md text-on-surface truncate flex-1" title="' + esc(u.email || '') + '">' + esc(u.email || '(sem e-mail)') + '</span>' + (u.email ? '<button type="button" id="pe-copy" class="text-primary text-label-md font-label-md px-2 py-1 rounded-lg hover:bg-primary/10 shrink-0">Copiar</button>' : '') + '</div>' +
              '<button type="button" id="pe-pw" class="w-full h-10 rounded-xl border border-outline-variant text-on-surface font-label-md flex items-center justify-center gap-1 hover:bg-surface-container-high"><span class="material-symbols-outlined text-[18px]">key</span>Alterar senha</button>' +
              '<label class="block"><span class="text-label-md font-label-md text-on-surface-variant">Nome</span><input id="pe-name" type="text" class="mt-1 w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-body-md text-on-surface" value="' + esc(u.full_name || '') + '"></label>' +
              '<label class="block"><span class="text-label-md font-label-md text-on-surface-variant">Telefone</span><input id="pe-phone" type="text" class="mt-1 w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-body-md text-on-surface" value="' + esc(u.phone || '') + '"></label>' +
              '<label class="block"><span class="text-label-md font-label-md text-on-surface-variant">Bio</span><textarea id="pe-bio" rows="2" class="mt-1 w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-body-md text-on-surface resize-none">' + esc(u.bio || '') + '</textarea></label>' +
              '<div class="flex gap-sm justify-end pt-sm"><button type="button" class="pe-close h-10 px-4 rounded-full text-on-surface font-label-md hover:bg-surface-container-high">Cancelar</button><button type="button" id="pe-save" class="h-10 px-4 rounded-full bg-primary text-on-primary font-label-md active:scale-95 transition">Salvar</button></div>';
            panel.querySelectorAll('.pe-close').forEach(function (b) { b.onclick = function () { overlay.remove(); }; });
            var cp = panel.querySelector('#pe-copy'); if (cp) cp.onclick = function () { try { navigator.clipboard.writeText(u.email); G.toast('E-mail copiado.'); } catch (e) { G.toast(u.email); } };
            panel.querySelector('#pe-pw').onclick = async function () { var nv = await G.promptDialog({ title: 'Alterar senha', text: 'Definir nova senha para ' + (u.email || 'membro') + '.', placeholder: 'Mínimo 6 caracteres', type: 'password', ok: 'Salvar' }); if (nv === null) return; nv = nv.trim(); if (nv.length < 6) { G.toast('Senha muito curta (mín. 6).'); return; } var rr = await sb.rpc('comu_admin_set_password', { p_user_id: userId, p_password: nv }); if (rr.error) { G.toast('Não foi possível: ' + rr.error.message); return; } G.toast('Senha alterada com sucesso.'); };
            panel.querySelector('#pe-save').onclick = async function () {
              var name = panel.querySelector('#pe-name').value.trim();
              var phone = panel.querySelector('#pe-phone').value.trim();
              var bio = panel.querySelector('#pe-bio').value.trim();
              if (!name) { G.toast('O nome não pode ficar vazio.'); return; }
              var btn = this; btn.disabled = true;
              var up = await sb.from('lms_students').update({ phone: phone || null, bio: bio || null }).eq('id', userId);
              if (up.error) { btn.disabled = false; G.toast('Não foi possível salvar: ' + up.error.message); return; }
              var nameChanged = name !== (u.full_name || '');
              if (nameChanged) {
                var rn = await sb.rpc('comu_rename_member', { p_user_id: userId, p_name: name }); // também reescreve o nome nas mensagens antigas
                if (rn.error) { btn.disabled = false; G.toast('Não foi possível renomear: ' + rn.error.message); return; }
              }
              if (tk.member) tk.member.full_name = name;
              var nm = document.getElementById('convo-name'); if (nm && self.currentTicket && self.currentTicket.user_id === userId) nm.textContent = name || 'Membro';
              overlay.remove(); G.toast('Perfil atualizado.'); loadTickets();
              if (nameChanged && self.currentTicket && self.currentTicket.id === tk.id) { // recarrega as bolhas já com o nome novo
                self.seen = Object.create(null);
                var mc = document.getElementById('convo-messages'); if (mc) mc.innerHTML = '';
                var rr = await sb.from('comu_messages').select('*').eq('ticket_id', tk.id).order('created_at', { ascending: true });
                if (!self.destroyed) { (rr.data || []).forEach(addMsg); loadReactSup((rr.data || []).map(function (mm) { return mm.id; })); scrollConvo(); }
              }
            };
          })();
        }
        function statusLabel(s) { return s === 'aberto' ? 'Pendente' : (s === 'aguardando' ? 'Aguardando' : (s === 'resolvido' ? 'Resolvido' : 'Fechado')); }
        function statusClass(s) { return s === 'aberto' ? 'bg-tertiary-container text-on-tertiary-container' : (s === 'aguardando' ? 'bg-primary/15 text-primary' : 'bg-secondary-container text-on-secondary-container'); }
        // Histórico: quantas conversas anteriores esse membro já teve
        async function renderHistory(tk) {
          var chip = document.getElementById('convo-history'), lbl = document.getElementById('convo-history-lbl');
          if (chip) { chip.classList.add('hidden'); chip.classList.remove('flex'); }
          if (!tk || !tk.user_id) return;
          var r = await sb.from('comu_support_tickets').select('id', { count: 'exact', head: true }).eq('user_id', tk.user_id).neq('id', tk.id);
          if (self.destroyed || !chip) return;
          var n = r.count || 0;
          if (n > 0) { if (lbl) lbl.textContent = n + (n === 1 ? ' conversa anterior' : ' conversas anteriores'); chip.classList.remove('hidden'); chip.classList.add('flex'); }
        }
        function openNewConversation() {
          var overlay = document.createElement('div'); overlay.className = 'fixed inset-0 z-[95] flex items-start justify-center p-container-margin pt-[12vh] bg-black/40';
          var panel = document.createElement('div'); panel.className = 'w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg space-y-md max-h-[76vh] flex flex-col';
          panel.innerHTML = '<div class="flex items-center justify-between shrink-0"><h3 class="font-headline-sm text-headline-sm text-on-surface">Nova conversa</h3><button type="button" class="nc-close w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"><span class="material-symbols-outlined">close</span></button></div>'
            + '<div class="relative shrink-0"><span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">search</span><input id="nc-q" type="text" autocomplete="off" placeholder="Buscar membro por nome ou e-mail…" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-2 pl-10 pr-3 text-body-md text-on-surface focus:ring-2 focus:ring-primary/30"></div>'
            + '<div id="nc-res" class="flex-1 overflow-y-auto custom-scrollbar divide-y divide-outline-variant/20"><p class="p-md text-center text-on-surface-variant text-body-sm">Digite pelo menos 2 letras.</p></div>';
          overlay.appendChild(panel); document.body.appendChild(overlay);
          overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
          panel.querySelector('.nc-close').onclick = function () { overlay.remove(); };
          var qi = panel.querySelector('#nc-q'), res = panel.querySelector('#nc-res'), tmr;
          async function start(uid) {
            var r = await sb.rpc('comu_support_start', { p_user_id: uid });
            if (r.error) { G.toast('Não foi possível: ' + r.error.message); return; }
            overlay.remove();
            var tk = await sb.from('comu_support_tickets').select('*, member:lms_students!user_id(full_name,avatar_url,email,phone)').eq('id', r.data).maybeSingle();
            if (tk.data && !self.destroyed) { self.filter = 'pendentes'; openTicket(tk.data); }
          }
          qi.addEventListener('input', function () {
            clearTimeout(tmr); var q = qi.value.trim();
            if (q.length < 2) { res.innerHTML = '<p class="p-md text-center text-on-surface-variant text-body-sm">Digite pelo menos 2 letras.</p>'; return; }
            res.innerHTML = '<p class="p-md text-center text-on-surface-variant text-body-sm">Buscando…</p>';
            tmr = setTimeout(async function () {
              var r = await sb.rpc('comu_search_members', { p_q: q });
              if (self.destroyed) return;
              if (r.error) { res.innerHTML = '<p class="p-md text-error text-body-sm">' + esc(r.error.message) + '</p>'; return; }
              var rows = r.data || [];
              if (!rows.length) { res.innerHTML = '<p class="p-md text-center text-on-surface-variant text-body-sm">Ninguém encontrado.</p>'; return; }
              res.innerHTML = '';
              rows.forEach(function (m) {
                var av = m.avatar_url ? '<img src="' + esc(m.avatar_url) + '" class="w-9 h-9 rounded-full object-cover shrink-0">' : '<span class="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-outline shrink-0"><span class="material-symbols-outlined text-[20px]">person</span></span>';
                var el = document.createElement('button'); el.type = 'button'; el.className = 'w-full flex items-center gap-md p-sm hover:bg-surface-container-low text-left';
                el.innerHTML = av + '<span class="min-w-0"><span class="block font-bold text-on-surface text-body-sm truncate">' + esc(m.full_name || 'Membro') + '</span><span class="block text-[12px] text-on-surface-variant truncate">' + esc(m.email || '') + '</span></span>';
                el.onclick = function () { start(m.id); };
                res.appendChild(el);
              });
            }, 250);
          });
          setTimeout(function () { qi.focus(); }, 40);
        }
        function openHistoryPanel(tk) {
          if (!tk || !tk.user_id) { G.toast('Este contato não tem histórico.'); return; }
          var overlay = document.createElement('div'); overlay.className = 'fixed inset-0 z-[95] flex items-center justify-center p-container-margin bg-black/40';
          var panel = document.createElement('div'); panel.className = 'w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg space-y-md max-h-[85vh] overflow-y-auto custom-scrollbar';
          panel.innerHTML = '<p class="text-body-sm text-on-surface-variant text-center py-md">Carregando…</p>';
          overlay.appendChild(panel); document.body.appendChild(overlay);
          overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
          (async function () {
            var r = await sb.from('comu_support_tickets').select('id,protocol,status,created_at,rating').eq('user_id', tk.user_id).order('created_at', { ascending: false });
            if (self.destroyed) { overlay.remove(); return; }
            if (r.error) { panel.innerHTML = '<p class="text-body-sm text-error text-center">' + esc(r.error.message) + '</p>'; return; }
            var rows = r.data || [];
            var h = '<div class="flex items-center justify-between"><h3 class="font-headline-sm text-headline-sm text-on-surface">Conversas de ' + esc((tk.member && tk.member.full_name) || 'membro') + '</h3><button type="button" class="hp-close w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"><span class="material-symbols-outlined">close</span></button></div>';
            h += '<div class="divide-y divide-outline-variant/20">';
            rows.forEach(function (t) {
              var w = ''; try { w = new Date(t.created_at).toLocaleDateString('pt-BR') + ' ' + timeShort(t.created_at); } catch (e) {}
              var cur = t.id === tk.id;
              h += '<button type="button" data-tk="' + t.id + '" class="w-full text-left flex items-center gap-md p-sm hover:bg-surface-container-low ' + (cur ? 'opacity-60 pointer-events-none' : '') + '"><span class="flex-1 min-w-0"><span class="font-bold text-on-surface text-body-sm">' + esc(t.protocol) + (cur ? ' (atual)' : '') + '</span><span class="block text-[12px] text-on-surface-variant">' + w + (t.rating ? ' · ' + t.rating + '★' : '') + '</span></span><span class="text-[10px] px-2 py-0.5 rounded-full ' + statusClass(t.status) + '">' + statusLabel(t.status) + '</span></button>';
            });
            h += '</div>';
            panel.innerHTML = h;
            panel.querySelector('.hp-close').onclick = function () { overlay.remove(); };
            panel.querySelectorAll('[data-tk]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-tk'); var row = rows.filter(function (x) { return x.id === id; })[0]; overlay.remove(); if (row) openTicket(Object.assign({}, row, { member: tk.member, user_id: tk.user_id })); }; });
          })();
        }
        // avaliação (estrelas) que o usuário deu naquele atendimento — mostrada no cabeçalho
        function renderConvoRating() {
          var el = document.getElementById('convo-rating'); if (!el) return;
          var tk = self.currentTicket;
          if (!tk || tk.rating == null) { el.innerHTML = ''; el.classList.add('hidden'); el.classList.remove('flex'); return; }
          el.classList.remove('hidden'); el.classList.add('flex');
          var s = '';
          for (var i = 1; i <= 5; i++) s += '<span class="material-symbols-outlined text-[16px] ' + (i <= tk.rating ? '' : 'text-outline/40') + '" style="' + (i <= tk.rating ? "color:#f5b400;font-variation-settings:'FILL' 1" : "") + '">star</span>';
          var solved = tk.solved === true ? '<span class="inline-flex items-center gap-[1px] text-[11px] font-bold text-primary ml-2"><span class="material-symbols-outlined text-[14px]">check_circle</span>Resolveu</span>' : (tk.solved === false ? '<span class="inline-flex items-center gap-[1px] text-[11px] font-bold text-error ml-2"><span class="material-symbols-outlined text-[14px]">cancel</span>Não resolveu</span>' : '');
          el.innerHTML = '<span class="text-[11px] text-on-surface-variant mr-1">Avaliação:</span><span class="flex items-center">' + s + '</span><span class="text-[12px] font-bold text-on-surface ml-1">' + tk.rating + '/5</span>' + solved;
        }
        function timeShort(iso) { try { var d = new Date(iso); if (Date.now() - d.getTime() < 86400000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); return d.toLocaleDateString('pt-BR'); } catch (e) { return ''; } }
        async function loadTickets() {
          var q = sb.from('comu_support_tickets').select('*, member:lms_students!user_id(full_name,avatar_url,email,phone,premium)').order('last_message_at', { ascending: false });
          if (self.filter === 'pendentes') q = q.in('status', ['aberto', 'aguardando']); if (self.filter === 'resolvidos') q = q.in('status', ['resolvido', 'fechado']);
          var r = await q; if (self.destroyed) return;
          var pendSet = Object.create(null);
          if (canReviewAi) { var pd = await sb.from('comu_ai_drafts').select('ticket_id').eq('status', 'pending'); if (self.destroyed) return; (pd.data || []).forEach(function (x) { pendSet[x.ticket_id] = true; }); }
          var list = document.getElementById('ticket-list'); list.innerHTML = '';
          if (r.error) { list.innerHTML = '<p class="p-md text-error text-body-sm">' + esc(r.error.message) + '</p>'; return; }
          // se a conversa aberta recebeu avaliação/mudou status, reflete no cabeçalho
          if (self.currentTicket) { var _cur = (r.data || []).filter(function (x) { return x.id === self.currentTicket.id; })[0]; if (_cur) { self.currentTicket.rating = _cur.rating; self.currentTicket.solved = _cur.solved; self.currentTicket.status = _cur.status; renderConvoRating(); } }
          var rows = r.data; var query = G.deburr((self.search || '').trim());
          if (query) rows = rows.filter(function (tk) { var m = tk.member || {}; return [m.full_name, m.email, m.phone, tk.protocol].some(function (v) { return v && G.deburr(v).indexOf(query) >= 0; }); });
          if (self.tagFilter === '__waiting__') rows = rows.filter(function (tk) { return (tk.status === 'aberto' || tk.status === 'aguardando') && !tk.last_agent_at; });
          else if (self.tagFilter) rows = rows.filter(function (tk) { return (self.contactTags[tk.user_id] || []).indexOf(self.tagFilter) !== -1; });
          // premium no topo só em Pendentes (em Resolvidos mantém a ordem normal por data)
          if (self.filter !== 'resolvidos') rows = rows.slice().sort(function (a, b) { return ((b.member && b.member.premium) ? 1 : 0) - ((a.member && a.member.premium) ? 1 : 0); });
          if (!rows.length) { list.innerHTML = '<p class="p-lg text-center text-on-surface-variant text-body-sm">' + ((query || self.tagFilter) ? 'Nenhuma conversa com esse filtro.' : 'Nenhuma conversa.') + '</p>'; return; }
          rows.forEach(function (tk) {
            var m = tk.member || {}; var el = document.createElement('button'); var chips = contactTagChips(tk.user_id);
            var premium = !!m.premium;
            var _waiting = (tk.status === 'aberto' || tk.status === 'aguardando') && !tk.last_agent_at; // membro mandou e ainda não foi respondido
            var _wtag = _waiting ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-error/20 text-error font-bold inline-flex items-center gap-[2px]"><span class="material-symbols-outlined text-[12px]">schedule</span>Aguardando você</span>' : '';
            var premChip = premium ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/25 text-amber-700 dark:text-amber-300 font-bold inline-flex items-center gap-[2px]"><span class="material-symbols-outlined text-[12px]">workspace_premium</span>Premium</span>' : '';
            var aiChip = pendSet[tk.id] ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold inline-flex items-center gap-[2px]"><span class="material-symbols-outlined text-[12px]">smart_toy</span>IA aguardando</span>' : '';
            var extra = premChip + aiChip + _wtag + chips;
            el.className = 'w-full text-left flex items-center gap-md p-md transition-colors border-b border-outline-variant/30 ' + (premium ? 'border-l-4 border-l-amber-400 bg-amber-400/5 hover:bg-amber-400/10 ' : 'hover:bg-surface-container-low ') + (self.currentTicket && self.currentTicket.id === tk.id ? 'bg-surface-container-high' : '');
            el.innerHTML = '<span class="w-11 h-11 rounded-full ' + (premium ? 'ring-2 ring-amber-400 ' : '') + 'bg-surface-container-high flex items-center justify-center text-outline overflow-hidden shrink-0">' + (m.avatar_url ? '<img src="' + esc(m.avatar_url) + '" class="w-full h-full object-cover">' : '<span class="material-symbols-outlined">person</span>') + '</span><span class="flex-1 min-w-0"><span class="flex items-center justify-between gap-xs"><span class="font-bold text-on-surface truncate">' + esc(m.full_name || 'Membro') + (premium ? ' <span class="material-symbols-outlined text-[15px] text-amber-500 align-middle">workspace_premium</span>' : '') + '</span><span class="text-[13px] text-on-surface-variant shrink-0">' + timeShort(tk.last_message_at) + '</span></span><span class="flex items-center justify-between gap-xs mt-0.5"><span class="text-body-sm text-outline truncate">' + esc(tk.protocol) + '</span><span class="text-[10px] px-2 py-0.5 rounded-full ' + statusClass(tk.status) + '">' + statusLabel(tk.status) + '</span></span>' + (extra ? '<span class="flex flex-wrap gap-1 mt-1">' + extra + '</span>' : '') + '</span>';
            el.addEventListener('click', function () { openTicket(tk); }); list.appendChild(el);
          });
        }
        // ---- ações nas mensagens do suporte (reagir/editar/apagar) — igual aos grupos ----
        self.reactMap = self.reactMap || {}; self.msgById = self.msgById || {};
        var supMenu = document.createElement('div'); self.supMenu = supMenu;
        supMenu.className = 'hidden fixed z-[86] bg-surface-container-highest border border-outline-variant rounded-xl shadow-lg py-1 min-w-[200px] max-w-[80vw] overflow-hidden';
        var supPicker = document.createElement('div'); self.supPicker = supPicker;
        supPicker.className = 'hidden fixed z-[88] bg-surface-container-highest border border-outline-variant rounded-2xl shadow-lg p-2 flex flex-wrap items-center gap-1 max-w-[320px] max-h-[46vh] overflow-y-auto custom-scrollbar';
        ['❤️', '👍', '👎', '😂', '🙏', '🔥', '✅', '❌', '👏', '🎉', '😢', '😮', '🤝', '💯'].forEach(function (em) { var b = document.createElement('button'); b.type = 'button'; b.className = 'text-[26px] hover:scale-125 transition-transform px-2 py-1'; b.textContent = em; b.addEventListener('click', function (e) { e.stopPropagation(); if (supPicker._t) toggleReactSup(supPicker._t, em); hideSupPicker(); }); supPicker.appendChild(b); });
        document.body.appendChild(supMenu); document.body.appendChild(supPicker);
        function hideSupMenu() { supMenu.classList.add('hidden'); supMenu.innerHTML = ''; }
        function hideSupPicker() { supPicker.classList.add('hidden'); supPicker._t = null; }
        function openSupMenu(x, y, items) { if (!items.length) return; supMenu.innerHTML = ''; items.forEach(function (it) { var b = document.createElement('button'); b.type = 'button'; b.className = 'w-full flex items-center gap-md px-4 py-3 text-left text-body-md hover:bg-surface-container-high ' + (it.danger ? 'text-error' : 'text-on-surface'); b.innerHTML = '<span class="material-symbols-outlined text-[22px]">' + it.icon + '</span>' + it.label; b.addEventListener('click', function (e) { e.stopPropagation(); hideSupMenu(); it.run(); }); supMenu.appendChild(b); }); supMenu.classList.remove('hidden'); var pr = supMenu.getBoundingClientRect(); var l = Math.min(x, window.innerWidth - 8 - pr.width); if (l < 8) l = 8; var t = Math.min(y, window.innerHeight - 8 - pr.height); if (t < 8) t = 8; supMenu.style.left = l + 'px'; supMenu.style.top = t + 'px'; }
        function openSupPicker(anchor, id) { supPicker._t = id; supPicker.classList.remove('hidden'); var r = anchor.getBoundingClientRect(), pr = supPicker.getBoundingClientRect(); var top = r.top - pr.height - 6; if (top < 8) top = r.bottom + 6; var left = r.left; if (left + pr.width > window.innerWidth - 8) left = window.innerWidth - 8 - pr.width; supPicker.style.top = top + 'px'; supPicker.style.left = Math.max(8, left) + 'px'; }
        self.onSupDoc = function (e) { if (!supMenu.classList.contains('hidden') && !supMenu.contains(e.target)) hideSupMenu(); if (!supPicker.classList.contains('hidden') && !supPicker.contains(e.target)) hideSupPicker(); };
        document.addEventListener('click', self.onSupDoc);
        function contentHtml(msg) {
          var isAgent = !(self.currentTicket && msg.author_id === self.currentTicket.user_id); // links clicáveis nas mensagens do suporte
          var quote = (msg.reply_to && (msg.reply_snippet || msg.reply_author)) ? '<div class="reply-quote mb-xs border-l-4 border-primary/60 bg-black/5 dark:bg-white/10 rounded px-2 py-1 cursor-pointer" data-goto="' + esc(msg.reply_to) + '"><p class="text-[12px] font-bold text-primary truncate">' + esc(G.shortName(msg.reply_author) || 'Membro') + '</p><p class="text-[13px] text-on-surface-variant truncate">' + esc(msg.reply_snippet || '') + '</p></div>' : '';
          if (msg.kind === 'image' && msg.media_url) return quote + '<img src="' + esc(msg.media_url) + '" data-full="' + esc(msg.media_url) + '" class="sup-img rounded-lg max-w-full cursor-zoom-in">';
          if (msg.kind === 'video' && msg.media_url) return quote + G.videoHtml(msg.media_url);
          if (msg.kind === 'audio' && msg.media_url) return quote + G.audioHtml(msg.media_url, msg.author_id === me.id);
          if (msg.kind === 'file' && msg.media_url) return quote + G.fileCard(msg, msg.author_id === me.id) + (msg.body ? '<p class="font-body-md mt-xs">' + G.fmt(msg.body, isAgent) + '</p>' : '');
          var mine = msg.author_id === me.id; var edited = msg.status === 'edited' ? ' <span class="text-[12px] opacity-80">(editado)</span>' : '';
          return quote + '<p class="font-body-md whitespace-pre-wrap break-words ' + (mine ? '' : 'text-on-surface') + '">' + G.fmt(msg.body || '', isAgent) + edited + '</p>';
        }
        function renderReactSup(id) { var row = document.querySelector('[data-react-sup="' + id + '"]'); if (!row) return; var data = self.reactMap[id] || {}; row.innerHTML = ''; Object.keys(data).forEach(function (em) { var users = data[em]; if (!users || !users.length) return; var mineR = users.indexOf(me.id) !== -1; var chip = document.createElement('button'); chip.type = 'button'; chip.className = 'px-3 py-1 rounded-full text-body-sm flex items-center gap-1 border transition-colors ' + (mineR ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-surface-container-high border-outline-variant/50 text-on-surface-variant'); chip.innerHTML = '<span>' + em + '</span><span class="font-bold">' + users.length + '</span>'; chip.addEventListener('click', function () { toggleReactSup(id, em); }); row.appendChild(chip); }); }
        async function toggleReactSup(id, em) { if (!me.id) return; var data = self.reactMap[id] || (self.reactMap[id] = {}); var have = (data[em] || []).indexOf(me.id) !== -1; Object.keys(data).forEach(function (e) { var i = data[e].indexOf(me.id); if (i !== -1) data[e].splice(i, 1); }); if (!have) (data[em] = data[em] || []).push(me.id); renderReactSup(id); await sb.from('comu_message_reactions').delete().eq('message_id', id).eq('user_id', me.id); if (!have) await sb.from('comu_message_reactions').insert({ message_id: id, user_id: me.id, reaction: em, user_name: me.full_name || null }); }
        async function loadReactSup(ids) { if (!ids || !ids.length) return; var r = await sb.from('comu_message_reactions').select('message_id,user_id,reaction').in('message_id', ids); if (self.destroyed) return; (r.data || []).forEach(function (x) { var d = self.reactMap[x.message_id] || (self.reactMap[x.message_id] = {}); var u = d[x.reaction] || (d[x.reaction] = []); if (u.indexOf(x.user_id) === -1) u.push(x.user_id); }); ids.forEach(renderReactSup); }
        function applyReactSup(type, row) { if (!row || !row.message_id) return; if (!document.querySelector('[data-react-sup="' + row.message_id + '"]')) return; var d = self.reactMap[row.message_id] || (self.reactMap[row.message_id] = {}); var u = d[row.reaction] || (d[row.reaction] = []); if (type === 'INSERT') { if (u.indexOf(row.user_id) === -1) u.push(row.user_id); } else { d[row.reaction] = u.filter(function (x) { return x !== row.user_id; }); } renderReactSup(row.message_id); }
        function startEditSup(id) { var m = self.msgById[id]; if (!m) return; var bubble = document.querySelector('#convo-messages [data-msg-id="' + id + '"] .sup-bubble'); if (!bubble) return; bubble.innerHTML = '<textarea class="w-full bg-black/20 text-white rounded-lg p-2 text-body-md" rows="2"></textarea><div class="flex gap-2 justify-end mt-1"><button type="button" class="ed-cancel h-9 px-3 rounded-lg bg-white/20 text-white text-body-sm">Cancelar</button><button type="button" class="ed-save h-9 px-3 rounded-lg bg-white text-primary text-body-sm font-bold">Salvar</button></div>'; var ta = bubble.querySelector('textarea'); ta.value = m.body || ''; ta.focus(); bubble.querySelector('.ed-cancel').onclick = function () { bubble.innerHTML = contentHtml(m); }; bubble.querySelector('.ed-save').onclick = async function () { var nv = ta.value.trim(); if (!nv) return; var up = await sb.from('comu_messages').update({ body: nv, status: 'edited' }).eq('id', id).select().single(); if (up.error) { G.toast('Erro ao editar: ' + up.error.message); return; } m.body = nv; m.status = 'edited'; self.msgById[id] = m; bubble.innerHTML = contentHtml(m); }; }
        async function doDeleteSup(id) { var ok = await G.confirmDialog({ title: 'Apagar esta mensagem?', text: 'Essa ação não pode ser desfeita.', ok: 'Apagar', danger: true }); if (!ok) return; var del = await sb.from('comu_messages').delete().eq('id', id); if (del.error) { G.toast('Não foi possível apagar: ' + del.error.message); return; } var w = document.querySelector('#convo-messages [data-msg-id="' + id + '"]'); if (w) w.remove(); }
        function supSnippet(m) { return m.kind === 'text' ? (m.body || '') : (m.kind === 'image' ? '📷 Foto' : (m.kind === 'audio' ? '🎤 Áudio' : (m.kind === 'video' ? '🎬 Vídeo' : (m.kind === 'file' ? '📎 Arquivo' : (m.body || ''))))); }
        function startSupReply(id) { var m = self.msgById[id]; if (!m) return; self.supReply = { id: id, author: m.author_name || 'Membro', snippet: String(supSnippet(m)).replace(/\s+/g, ' ').slice(0, 140) }; showSupReplyBar(); }
        function showSupReplyBar() {
          var form = document.getElementById('convo-form'); if (!form || !self.supReply) return;
          var bar = document.getElementById('convo-reply-bar');
          if (!bar) { bar = document.createElement('div'); bar.id = 'convo-reply-bar'; bar.className = 'shrink-0 px-md pt-sm'; form.parentNode.insertBefore(bar, form); }
          bar.innerHTML = '<div class="max-w-3xl mx-auto flex items-center gap-sm bg-surface-container-high rounded-xl p-sm border-l-4 border-primary/60"><span class="material-symbols-outlined text-[18px] text-primary shrink-0">reply</span><div class="flex-1 min-w-0"><div class="text-[12px] font-bold text-primary truncate">' + esc(G.shortName(self.supReply.author) || 'Membro') + '</div><div class="text-[13px] text-on-surface-variant truncate">' + esc(self.supReply.snippet) + '</div></div><button type="button" id="convo-reply-x" class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest shrink-0"><span class="material-symbols-outlined text-[18px]">close</span></button></div>';
          bar.classList.remove('hidden');
          document.getElementById('convo-reply-x').onclick = clearSupReply;
          var ci = document.getElementById('convo-input'); if (ci) ci.focus();
        }
        function clearSupReply() { self.supReply = null; var bar = document.getElementById('convo-reply-bar'); if (bar) bar.classList.add('hidden'); }
        function supItems(id) { var m = self.msgById[id]; if (!m) return []; var mine = m.author_id === me.id; var items = [{ icon: 'reply', label: 'Responder', run: function () { startSupReply(id); } }, { icon: 'add_reaction', label: 'Reagir', run: function () { var b = document.querySelector('#convo-messages [data-msg-id="' + id + '"] .sup-bubble'); openSupPicker(b || document.body, id); } }]; if (mine && m.kind === 'text') items.push({ icon: 'edit', label: 'Editar', run: function () { startEditSup(id); } }); items.push({ icon: 'delete', label: 'Apagar', danger: true, run: function () { doDeleteSup(id); } }); return items; }
        function bindSupActions(bubble, id) { bubble.addEventListener('contextmenu', function (e) { e.preventDefault(); openSupMenu(e.clientX, e.clientY, supItems(id)); }); var lpT = null, lx = 0, ly = 0, mv = false; bubble.addEventListener('touchstart', function (e) { if (!e.touches[0]) return; mv = false; lx = e.touches[0].clientX; ly = e.touches[0].clientY; lpT = setTimeout(function () { if (!mv) openSupMenu(lx, ly, supItems(id)); }, 500); }, { passive: true }); bubble.addEventListener('touchmove', function (e) { if (e.touches[0] && (Math.abs(e.touches[0].clientX - lx) > 10 || Math.abs(e.touches[0].clientY - ly) > 10)) { mv = true; if (lpT) { clearTimeout(lpT); lpT = null; } } }, { passive: true }); ['touchend', 'touchcancel'].forEach(function (ev) { bubble.addEventListener(ev, function () { if (lpT) { clearTimeout(lpT); lpT = null; } }); }); }
        function updateMsgSup(msg) { if (!msg || !msg.id) return; self.msgById[msg.id] = msg; var bubble = document.querySelector('#convo-messages [data-msg-id="' + msg.id + '"] .sup-bubble'); if (bubble) { bubble.innerHTML = contentHtml(msg); G.mountAudios(bubble); } }
        function addMsg(msg) {
          if (self.seen[msg.id]) return; self.seen[msg.id] = true;
          var container = document.getElementById('convo-messages');
          if (msg.kind === 'system') {
            var note = document.createElement('div'); note.className = 'w-full text-center text-body-sm text-on-surface-variant bg-surface-container-high rounded-2xl px-4 py-3 my-xs';
            note.textContent = msg.body || ''; container.appendChild(note); return;
          }
          self.msgById[msg.id] = msg;
          var mine = msg.author_id === me.id;
          var wrap = document.createElement('div'); wrap.setAttribute('data-msg-id', msg.id); wrap.setAttribute('data-created', msg.created_at || '');
          var bubble = document.createElement('div'); bubble.className = 'sup-bubble ' + (mine ? 'message-gradient-outgoing text-white rounded-xl rounded-tr-none p-md shadow' : 'bg-surface-container-lowest border border-outline-variant/30 rounded-xl rounded-tl-none p-md');
          bubble.innerHTML = contentHtml(msg); G.mountAudios(bubble);
          var react = document.createElement('div'); react.setAttribute('data-react-sup', msg.id); react.className = 'flex flex-wrap items-center gap-xs mt-xs ' + (mine ? 'justify-end' : '');
          if (mine) { wrap.className = 'flex flex-col items-end gap-xs max-w-[80%] self-end'; var _t = document.createElement('span'); _t.className = 'text-[13px] text-on-surface-variant mr-sm'; _t.textContent = G.timeStr(msg.created_at); wrap.appendChild(_t); wrap.appendChild(bubble); wrap.appendChild(react); }
          else {
            wrap.className = 'flex flex-col items-start gap-xs max-w-[80%]';
            var row = document.createElement('div'); row.className = 'flex items-start gap-sm';
            var _fromMember = self.currentTicket && msg.author_id === self.currentTicket.user_id; var _a = msg.author_avatar || (_fromMember && self.currentTicket.member && self.currentTicket.member.avatar_url) || '';
            row.innerHTML = _a ? '<img src="' + esc(_a) + '" class="w-8 h-8 rounded-full object-cover shrink-0">' : '<span class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-outline shrink-0"><span class="material-symbols-outlined text-[18px]">person</span></span>';
            var col = document.createElement('div'); col.className = 'flex flex-col min-w-0'; col.innerHTML = '<div class="flex items-center gap-xs ml-sm"><span class="text-label-md font-label-md text-on-surface-variant">' + esc(msg.author_name || 'Membro') + '</span><span class="text-[13px] text-on-surface-variant">' + G.timeStr(msg.created_at) + '</span></div>';
            col.appendChild(bubble); row.appendChild(col); wrap.appendChild(row); wrap.appendChild(react);
          }
          bindSupActions(bubble, msg.id);
          container.appendChild(wrap);
          renderReactSup(msg.id);
          applyDayDividersSup();
        }
        function applyDayDividersSup() {
          var cont = document.getElementById('convo-messages'); if (!cont) return;
          var olds = cont.querySelectorAll('.day-divider'); for (var j = 0; j < olds.length; j++) olds[j].remove();
          var lastKey = null, kids = Array.prototype.slice.call(cont.children);
          for (var i = 0; i < kids.length; i++) {
            var el = kids[i], c = el.getAttribute && el.getAttribute('data-created'); if (!c) continue;
            var d = new Date(c), key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
            if (key !== lastKey) { lastKey = key; var div = document.createElement('div'); div.className = 'day-divider w-full flex justify-center my-2'; div.innerHTML = '<span class="text-[12px] font-bold text-on-surface-variant bg-surface-container-high rounded-full px-3 py-1 shadow-sm">' + G.dayLabel(c) + '</span>'; cont.insertBefore(div, el); }
          }
        }
        function scrollConvo() { var s = document.getElementById('convo-scroll'); s.scrollTop = s.scrollHeight; }
        function updateResolveBtn() { var lbl = document.getElementById('btn-resolve-label'), b = document.getElementById('btn-resolve'); var s = self.currentTicket && self.currentTicket.status; if (s === 'aberto') { lbl.textContent = 'Marcar como resolvido'; b.disabled = false; } else if (s === 'aguardando') { lbl.textContent = 'Aguardando resposta…'; b.disabled = true; } else { lbl.textContent = 'Resolvido'; b.disabled = true; } }
        function subscribeConvo(ticketId) {
          if (self.convoChannel) sb.removeChannel(self.convoChannel);
          self.convoChannel = sb.channel('ticket-' + ticketId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_messages', filter: 'ticket_id=eq.' + ticketId }, function (p) { addMsg(p.new); scrollConvo(); })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comu_messages', filter: 'ticket_id=eq.' + ticketId }, function (p) { updateMsgSup(p.new); })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comu_messages' }, function (p) { if (p.old && p.old.id) { var w = document.querySelector('#convo-messages [data-msg-id="' + p.old.id + '"]'); if (w) w.remove(); } })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_message_reactions' }, function (p) { applyReactSup('INSERT', p.new); })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comu_message_reactions' }, function (p) { applyReactSup('DELETE', p.old); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comu_ai_drafts', filter: 'ticket_id=eq.' + ticketId }, function () { loadAiDraft(ticketId); loadTickets(); })
            .subscribe();
          self.channels.push(self.convoChannel);
        }
        function updateConvoComposer() {
          var open = !!(self.currentTicket && (self.currentTicket.status === 'aberto' || self.currentTicket.status === 'aguardando'));
          var form = document.getElementById('convo-form');
          var note = document.getElementById('convo-closed');
          if (!note && form && form.parentNode) {
            note = document.createElement('div'); note.id = 'convo-closed';
            note.className = 'hidden shrink-0 border-t border-outline-variant p-md';
            note.innerHTML = '<div class="max-w-3xl mx-auto flex items-center justify-center gap-sm text-on-surface-variant text-body-sm text-center"><span class="material-symbols-outlined text-[20px]">lock</span>Conversa finalizada. Para falar de novo, o membro precisa iniciar um novo atendimento.</div>';
            form.parentNode.insertBefore(note, form.nextSibling);
          }
          if (form) form.style.display = open ? '' : 'none';
          if (note) note.classList.toggle('hidden', open);
        }
        // ---- IA de suporte: rascunho oculto aguardando aprovação ----
        // Só um usuário (revisor) enxerga/aprova. Os demais atendentes respondem normalmente,
        // sem nunca ver a IA, então o atendimento nunca trava. É um popup flutuante (não empurra o campo de resposta).
        var AI_REVIEWER_EMAIL = 'henrique@niinja.com.br';
        var canReviewAi = !!(me && me.email && String(me.email).trim().toLowerCase() === AI_REVIEWER_EMAIL);
        self.aiMinimized = false;
        function clearAiDraft() {
          var bar = document.getElementById('ai-draft-bar'); if (bar) { bar.classList.add('hidden'); var inner = bar.querySelector('div'); if (inner) inner.innerHTML = ''; }
          var rp = document.getElementById('ai-draft-reopen'); if (rp) rp.classList.add('hidden');
          self.aiMinimized = false; self.aiDraft = null;
        }
        function showReopenChip(d) {
          var rp = document.getElementById('ai-draft-reopen'); if (!rp) return;
          rp.classList.remove('hidden'); rp.classList.add('flex');
          rp.onclick = function () { self.aiMinimized = false; renderAiDraft(d); };
        }
        function renderAiDraft(d) {
          if (!canReviewAi) return;
          self.aiDraft = d;
          if (self.aiMinimized) { showReopenChip(d); return; }
          var bar = document.getElementById('ai-draft-bar'); if (!bar) return;
          var inner = bar.querySelector('div'); if (!inner) return;
          var rp = document.getElementById('ai-draft-reopen'); if (rp) { rp.classList.add('hidden'); rp.classList.remove('flex'); }
          var hand = d.suggest_handoff ? '<div class="flex items-start gap-xs mt-xs text-[13px] text-tertiary"><span class="material-symbols-outlined text-[16px]">support_agent</span><span>A IA sugere que um humano assuma' + (d.handoff_reason ? ': ' + esc(d.handoff_reason) : '.') + '</span></div>' : '';
          inner.innerHTML =
            '<div class="flex items-center gap-xs mb-sm"><span class="material-symbols-outlined text-[18px] text-primary">smart_toy</span>' +
            '<span class="text-label-md font-bold text-primary">Sugestão da IA</span>' +
            '<span class="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">não enviada</span>' +
            '<span class="flex-grow"></span>' +
            '<button type="button" id="ai-draft-refresh" class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high" title="Recarregar"><span class="material-symbols-outlined text-[18px]">refresh</span></button>' +
            '<button type="button" id="ai-draft-min" class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high" title="Minimizar"><span class="material-symbols-outlined text-[18px]">remove</span></button></div>' +
            '<div class="bg-surface-container-low border border-outline-variant/40 rounded-xl p-md text-body-md text-on-surface whitespace-pre-wrap break-words">' + G.fmt((d.draft_body || '').replace(/\s*\[MSG\]\s*/g, '\n'), true) + '</div>' + hand +
            '<div class="flex flex-wrap gap-sm mt-sm"><button type="button" id="ai-draft-approve" class="h-11 px-4 bg-primary text-on-primary rounded-xl flex items-center gap-xs font-bold active:scale-95 transition"><span class="material-symbols-outlined text-[20px]">check_circle</span>Aprovar e enviar</button>' +
            '<button type="button" id="ai-draft-edit" class="h-11 px-4 rounded-xl border border-outline-variant text-on-surface flex items-center gap-xs"><span class="material-symbols-outlined text-[20px]">edit</span>Editar antes</button>' +
            '<button type="button" id="ai-draft-reject" class="h-11 px-4 rounded-xl border border-error/50 text-error flex items-center gap-xs"><span class="material-symbols-outlined text-[20px]">cancel</span>Reprovar</button></div>';
          bar.classList.remove('hidden');
          var rf = document.getElementById('ai-draft-refresh'); if (rf) rf.onclick = function () { loadAiDraft(d.ticket_id); };
          document.getElementById('ai-draft-min').onclick = function () { self.aiMinimized = true; bar.classList.add('hidden'); showReopenChip(d); };
          document.getElementById('ai-draft-approve').onclick = function () { approveDraft(d); };
          document.getElementById('ai-draft-edit').onclick = function () { var ci = document.getElementById('convo-input'); if (ci) { ci.value = d.draft_body || ''; convoGrow(); ci.focus(); } self.aiMinimized = true; bar.classList.add('hidden'); showReopenChip(d); G.toast('Rascunho copiado pro campo de resposta. Edite e envie.'); };
          document.getElementById('ai-draft-reject').onclick = function () { rejectDraft(d); };
        }
        async function loadAiDraft(ticketId) {
          if (!canReviewAi || !ticketId) { clearAiDraft(); return; }
          var r = await sb.from('comu_ai_drafts').select('*').eq('ticket_id', ticketId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1);
          if (self.destroyed || !self.currentTicket || self.currentTicket.id !== ticketId) return;
          var d = r.data && r.data[0];
          if (d) { if (!self.aiDraft || self.aiDraft.id !== d.id) self.aiMinimized = false; renderAiDraft(d); } else clearAiDraft();
        }
        async function approveDraft(d) {
          // usa a MESMA RPC da tela de Rascunhos: envia como Saymon e alimenta a base (fonte única).
          var btn = document.getElementById('ai-draft-approve'); if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>Enviando…'; }
          var r2 = await sb.rpc('comu_ai_draft_approve', { p_draft_id: d.id });
          if (r2.error) { G.toast('Erro ao enviar: ' + r2.error.message); if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">check_circle</span>Aprovar e enviar'; } return; }
          clearAiDraft(); scrollConvo(); G.toast('Resposta enviada ao aluno e aprendida ✓');
        }
        async function rejectDraft(d) {
          var reason = await G.promptDialog({ title: 'Por que reprovar?', text: 'Explique o que estava errado. A IA registra isso e evita repetir.', placeholder: 'Ex.: o prazo certo é 48h, não 24h', ok: 'Registrar reprovação' });
          if (reason === null || reason === undefined) return;
          reason = String(reason).trim(); if (!reason) { G.toast('Escreva o motivo para a IA aprender.'); return; }
          var btn = document.getElementById('ai-draft-reject'); if (btn) btn.disabled = true;
          var r3 = await sb.rpc('comu_ai_draft_reject', { p_draft_id: d.id, p_reason: reason });
          if (r3.error) { if (btn) btn.disabled = false; G.toast('Erro: ' + r3.error.message); return; }
          clearAiDraft(); G.toast('Reprovação registrada. A IA vai evitar esse erro.');
        }
        async function openTicket(tk) {
          self.currentTicket = tk; self.seen = Object.create(null);
          document.getElementById('convo-empty').classList.add('hidden'); var cm = document.getElementById('convo-main'); cm.classList.remove('hidden'); cm.classList.add('flex');
          document.getElementById('list-panel').classList.add('hidden'); document.getElementById('convo-panel').classList.remove('hidden'); document.getElementById('convo-panel').classList.add('flex');
          var m = tk.member || {}; document.getElementById('convo-name').textContent = m.full_name || 'Membro'; document.getElementById('convo-protocol').textContent = tk.protocol + ' · ' + statusLabel(tk.status); updateResolveBtn(); refreshConvoTags(); renderConvoRating(); renderHistory(tk); var _av = document.getElementById('convo-avatar'); if (_av) _av.innerHTML = m.avatar_url ? '<img src="' + esc(m.avatar_url) + '" class="w-full h-full object-cover">' : '<span class="material-symbols-outlined">person</span>';
          document.getElementById('convo-messages').innerHTML = '';
          var r = await sb.from('comu_messages').select('*').eq('ticket_id', tk.id).order('created_at', { ascending: true }); if (self.destroyed) return;
          (r.data || []).forEach(addMsg); loadReactSup((r.data || []).map(function (m) { return m.id; })); scrollConvo(); subscribeConvo(tk.id); updateConvoComposer(); loadAiDraft(tk.id); loadTickets();
        }
        function closeConvo() {
          clearAiDraft();
          if (self.convoChannel) { try { sb.removeChannel(self.convoChannel); } catch (e) {} self.convoChannel = null; }
          self.currentTicket = null;
          var cm = document.getElementById('convo-main'); cm.classList.add('hidden'); cm.classList.remove('flex');
          document.getElementById('convo-empty').classList.remove('hidden');
          document.getElementById('convo-panel').classList.add('hidden'); document.getElementById('convo-panel').classList.remove('flex');   // mobile: volta pra lista (no desktop lg:flex mantém visível)
          document.getElementById('list-panel').classList.remove('hidden');
          loadTickets();
        }
        // "Voltar" do topo: se tem conversa aberta, volta pra lista; senão sai pra home
        document.getElementById('suporte-back').addEventListener('click', function () { if (self.currentTicket) closeConvo(); else G.navigate('/'); });
        document.getElementById('convo-back').addEventListener('click', closeConvo);
        document.getElementById('convo-form').addEventListener('submit', async function (e) {
          e.preventDefault(); if (self.currentTicket && ['aberto', 'aguardando'].indexOf(self.currentTicket.status) < 0) { G.toast('Conversa finalizada. Não dá pra enviar aqui.'); return; } var body = document.getElementById('convo-input').value.trim(); if (!body || !self.currentTicket) return; document.getElementById('convo-input').value = ''; convoGrow();
          var _rs = self.supReply;
          var ins = await sb.from('comu_messages').insert(Object.assign({ topic_id: supportTopicId, author_id: me.id, ticket_id: self.currentTicket.id, kind: 'text', body: body, author_name: me.full_name || 'Suporte', author_avatar: me.avatar_url || null }, _rs ? { reply_to: _rs.id, reply_author: _rs.author, reply_snippet: _rs.snippet } : {})).select().single();
          if (ins.error) { console.error(ins.error); document.getElementById('convo-input').value = body; return; } clearSupReply(); addMsg(ins.data); scrollConvo();
        });
        function convoGrow() { var ci = document.getElementById('convo-input'); if (!ci) return; ci.style.height = 'auto'; ci.style.height = Math.min(ci.scrollHeight, 200) + 'px'; }
        (function () { var ci = document.getElementById('convo-input'); if (ci) { ci.addEventListener('input', convoGrow); ci.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); var f = document.getElementById('convo-form'); if (f && f.requestSubmit) f.requestSubmit(); else if (f) f.dispatchEvent(new Event('submit', { cancelable: true })); } }); } })();
        async function sendMedia(file, kind) {
          if (!file || !self.currentTicket) return;
          if (['aberto', 'aguardando'].indexOf(self.currentTicket.status) < 0) { G.toast('Conversa finalizada. Não dá pra enviar aqui.'); return; }
          var ext = (file.name.split('.').pop() || (kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : 'm4a')).toLowerCase();
          var path = 'suporte/' + self.currentTicket.id + '/' + Date.now() + '.' + ext;
          var up = await sb.storage.from('comu-media').upload(path, file, { upsert: true, contentType: file.type || undefined });
          if (up.error) { G.toast('Erro no upload: ' + up.error.message); return; }
          var url = sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
          var ins = await sb.from('comu_messages').insert({ topic_id: supportTopicId, author_id: me.id, ticket_id: self.currentTicket.id, kind: kind, media_url: url, media_meta: { name: file.name, size: file.size, mime: file.type }, author_name: me.full_name || 'Suporte', author_avatar: me.avatar_url || null }).select().single();
          if (ins.error) { G.toast('Erro ao enviar: ' + ins.error.message); return; }
          addMsg(ins.data); scrollConvo();
        }
        document.getElementById('convo-attach').addEventListener('click', function () { document.getElementById('convo-file-media').click(); });
        document.getElementById('convo-emoji').addEventListener('click', function (e) { e.stopPropagation(); G.emojiPicker(this, document.getElementById('convo-input'), false); });
        (function () { var cms = document.getElementById('convo-messages'); if (cms) cms.addEventListener('click', function (e) { if (!e.target || !e.target.closest) return; var im = e.target.closest('.sup-img'); if (im) { G.lightbox(im.getAttribute('data-full') || im.getAttribute('src')); return; } var ve = e.target.closest('.vid-expand'); if (ve) { e.preventDefault(); G.lightbox(ve.getAttribute('data-full'), { video: true }); return; } var rq = e.target.closest('.reply-quote'); if (rq) { var t = cms.querySelector('[data-msg-id="' + rq.getAttribute('data-goto') + '"]'); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.style.transition = 'background-color .3s'; t.style.backgroundColor = 'rgba(37,99,235,0.15)'; setTimeout(function () { t.style.backgroundColor = ''; }, 900); } } }); })();
        // arrastar/soltar ou colar imagem no atendimento (imagem passa pelo editor de pré-envio)
        (function () {
          var ci = document.getElementById('convo-input'), main = document.getElementById('convo-main');
          function kindOf(f) { var ty = (f && f.type) || ''; return ty.indexOf('image') === 0 ? 'image' : (ty.indexOf('video') === 0 ? 'video' : (ty.indexOf('audio') === 0 ? 'audio' : 'file')); }
          async function sendAtImage(blob, caption, dims) {
            if (!self.currentTicket || ['aberto', 'aguardando'].indexOf(self.currentTicket.status) < 0) { G.toast('Conversa finalizada. Não dá pra enviar aqui.'); return false; }
            var path = 'suporte/' + self.currentTicket.id + '/' + Date.now() + '.jpg';
            var up = await sb.storage.from('comu-media').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
            if (up.error) { G.toast('Erro no upload: ' + up.error.message); return false; }
            var url = sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
            var ins = await sb.from('comu_messages').insert({ topic_id: supportTopicId, author_id: me.id, ticket_id: self.currentTicket.id, kind: 'image', body: caption, media_url: url, media_meta: { w: dims.w, h: dims.h, mime: 'image/jpeg' }, author_name: me.full_name || 'Suporte', author_avatar: me.avatar_url || null }).select().single();
            if (ins.error) { G.toast('Erro ao enviar: ' + ins.error.message); return false; }
            addMsg(ins.data); scrollConvo(); return true;
          }
          function handleFile(f, k) { if (!f || !k) return; if (k === 'image' && G.imageComposer) G.imageComposer(f, sendAtImage); else sendMedia(f, k); }
          if (ci) ci.addEventListener('paste', function (e) { var dt = e.clipboardData; if (dt && dt.files && dt.files.length) { var f = dt.files[0], k = kindOf(f); if (k) { e.preventDefault(); handleFile(f, k); } } });
          if (main) { ['dragover', 'dragenter'].forEach(function (ev) { main.addEventListener(ev, function (e) { e.preventDefault(); }); }); main.addEventListener('drop', function (e) { e.preventDefault(); var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0], k = kindOf(f); handleFile(f, k); }); }
        })();
        // gravação de voz no atendimento (admin): pausar / ouvir / continuar / excluir / enviar (igual aos grupos)
        var supRec = { mr: null, stream: null, chunks: [], mime: '', on: false, paused: false, secs: 0, timer: null };
        function supPickMime() { var c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']; for (var i = 0; i < c.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported(c[i])) return c[i]; return ''; }
        var audioBtn = document.getElementById('convo-audio-btn');
        function supRecTime() { var el = document.getElementById('sup-rec-time'); if (el) { var m = Math.floor(supRec.secs / 60), s = supRec.secs % 60; el.textContent = m + ':' + (s < 10 ? '0' : '') + s; } }
        function supSetRecUI(on) { supRec.on = on; var bar = document.getElementById('sup-rec-bar'), row = document.getElementById('sup-composer-row'); if (bar) bar.classList.toggle('hidden', !on); if (row) row.classList.toggle('hidden', on); }
        function supStopPreview() { var a = document.getElementById('sup-rec-preview'); if (a) { try { a.pause(); } catch (e) {} a.removeAttribute('src'); } var li = document.getElementById('sup-rec-listen-ic'), ll = document.getElementById('sup-rec-listen-lbl'); if (li) li.textContent = 'play_arrow'; if (ll) ll.textContent = 'Ouvir'; }
        function supStopStream() { if (supRec.stream) { supRec.stream.getTracks().forEach(function (t) { t.stop(); }); supRec.stream = null; } }
        async function supStartRec() {
          if (self.currentTicket && ['aberto', 'aguardando'].indexOf(self.currentTicket.status) < 0) { G.toast('Conversa finalizada. Não dá pra enviar aqui.'); return; }
          if (!navigator.mediaDevices || !window.MediaRecorder) { G.toast('Gravação não é suportada neste navegador.'); return; }
          try { supRec.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { G.toast('Não foi possível acessar o microfone. Permita o acesso.'); return; }
          if (self.destroyed) { supStopStream(); return; }
          supRec.mime = supPickMime(); supRec.chunks = []; supRec.paused = false;
          try { supRec.mr = new MediaRecorder(supRec.stream, supRec.mime ? { mimeType: supRec.mime } : undefined); } catch (e) { supRec.mr = new MediaRecorder(supRec.stream); }
          supRec.mr.ondataavailable = function (ev) { if (ev.data && ev.data.size) supRec.chunks.push(ev.data); };
          supRec.mr.start(1000); supRec.secs = 0; supRecTime();
          var pl = document.getElementById('sup-rec-pause-lbl'), pic = document.getElementById('sup-rec-pause-ic'), lst = document.getElementById('sup-rec-listen'), dot = document.getElementById('sup-rec-dot');
          if (pl) pl.textContent = 'Pausar'; if (pic) pic.textContent = 'pause'; if (dot) dot.classList.add('animate-pulse'); if (lst) { lst.classList.add('hidden'); lst.classList.remove('flex'); }
          supRec.timer = setInterval(function () { supRec.secs++; supRecTime(); }, 1000);
          supSetRecUI(true);
        }
        function supTogglePause() {
          if (!supRec.mr) return;
          var pl = document.getElementById('sup-rec-pause-lbl'), pic = document.getElementById('sup-rec-pause-ic'), lst = document.getElementById('sup-rec-listen'), dot = document.getElementById('sup-rec-dot');
          if (!supRec.paused) { try { supRec.mr.pause(); } catch (e) {} if (supRec.timer) clearInterval(supRec.timer); supRec.paused = true; if (pl) pl.textContent = 'Continuar'; if (pic) pic.textContent = 'fiber_manual_record'; if (dot) dot.classList.remove('animate-pulse'); if (lst) { lst.classList.remove('hidden'); lst.classList.add('flex'); } }
          else { supStopPreview(); try { supRec.mr.resume(); } catch (e) {} supRec.paused = false; supRec.timer = setInterval(function () { supRec.secs++; supRecTime(); }, 1000); if (pl) pl.textContent = 'Pausar'; if (pic) pic.textContent = 'pause'; if (dot) dot.classList.add('animate-pulse'); if (lst) { lst.classList.add('hidden'); lst.classList.remove('flex'); } }
        }
        function supToggleListen() {
          var a = document.getElementById('sup-rec-preview'), li = document.getElementById('sup-rec-listen-ic'), ll = document.getElementById('sup-rec-listen-lbl');
          if (!a) return;
          if (a.src && !a.paused) { a.pause(); if (li) li.textContent = 'play_arrow'; if (ll) ll.textContent = 'Ouvir'; return; }
          if (!supRec.chunks.length) { G.toast('Nada gravado ainda.'); return; }
          try { var blob = new Blob(supRec.chunks, { type: supRec.mime || 'audio/webm' }); a.src = URL.createObjectURL(blob); a.play(); if (li) li.textContent = 'pause'; if (ll) ll.textContent = 'Pausar'; a.onended = function () { if (li) li.textContent = 'play_arrow'; if (ll) ll.textContent = 'Ouvir'; }; } catch (e) { G.toast('Não foi possível reproduzir.'); }
        }
        function supCancelRec() { supStopPreview(); supRec.paused = false; if (supRec.timer) clearInterval(supRec.timer); if (supRec.mr && supRec.mr.state !== 'inactive') { supRec.mr.onstop = function () { supStopStream(); }; try { supRec.mr.stop(); } catch (e) { supStopStream(); } } else supStopStream(); supRec.chunks = []; supSetRecUI(false); }
        function supFinishRec() {
          if (!supRec.mr) { supSetRecUI(false); return; }
          if (supRec.timer) clearInterval(supRec.timer); var secs = supRec.secs;
          supRec.mr.onstop = function () {
            supStopStream(); supStopPreview(); supSetRecUI(false);
            if (!supRec.chunks.length || secs < 1) return;
            var ext = supRec.mime.indexOf('mp4') >= 0 ? 'mp4' : (supRec.mime.indexOf('ogg') >= 0 ? 'ogg' : 'webm');
            var file; try { file = new File(supRec.chunks, 'voz-' + Date.now() + '.' + ext, { type: supRec.mime || 'audio/webm' }); } catch (e) { file = new Blob(supRec.chunks, { type: supRec.mime || 'audio/webm' }); file.name = 'voz-' + Date.now() + '.' + ext; }
            sendMedia(file, 'audio');
          };
          try { supRec.mr.stop(); } catch (e) { supStopStream(); }
        }
        if (audioBtn) audioBtn.addEventListener('click', function () { if (!supRec.on) supStartRec(); });
        var _srp = document.getElementById('sup-rec-pause'); if (_srp) _srp.addEventListener('click', function () { if (supRec.on) supTogglePause(); });
        var _srl = document.getElementById('sup-rec-listen'); if (_srl) _srl.addEventListener('click', supToggleListen);
        var _src = document.getElementById('sup-rec-cancel'); if (_src) _src.addEventListener('click', function () { if (supRec.on) { supCancelRec(); G.toast('Áudio descartado'); } });
        var _srs = document.getElementById('sup-rec-send'); if (_srs) _srs.addEventListener('click', function () { if (supRec.on) supFinishRec(); });
        document.getElementById('convo-file-media').addEventListener('change', function () { var f = this.files[0]; if (f) { var ty = (f.type || ''); var k = ty.indexOf('image') === 0 ? 'image' : (ty.indexOf('video') === 0 ? 'video' : (ty.indexOf('audio') === 0 ? 'audio' : 'file')); sendMedia(f, k); } this.value = ''; });
        document.getElementById('convo-file-audio').addEventListener('change', function () { var f = this.files[0]; if (f) sendMedia(f, 'audio'); this.value = ''; });
        document.getElementById('btn-resolve').addEventListener('click', async function () {
          if (!self.currentTicket || self.currentTicket.status !== 'aberto') return;
          var tid = self.currentTicket.id, rb = document.getElementById('btn-resolve'); rb.disabled = true;
          var up = await sb.rpc('comu_support_request_close', { p_ticket_id: tid });
          if (up.error) { G.toast('Não foi possível: ' + up.error.message); rb.disabled = false; return; }
          self.currentTicket.status = 'resolvido';
          document.getElementById('convo-protocol').textContent = self.currentTicket.protocol + ' · ' + statusLabel('resolvido');
          updateResolveBtn(); updateConvoComposer(); loadTickets();
          G.toast('Atendimento marcado como resolvido.');
        });
        document.querySelectorAll('[data-filter]').forEach(function (b) { b.addEventListener('click', function () { self.filter = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(function (x) { x.classList.remove('bg-primary', 'text-on-primary'); x.classList.add('text-on-surface-variant', 'hover:bg-surface-container-high'); }); b.classList.add('bg-primary', 'text-on-primary'); b.classList.remove('text-on-surface-variant', 'hover:bg-surface-container-high'); loadTickets(); }); });
        (function () { var si = document.getElementById('sup-search'); if (si) { var st; si.addEventListener('input', function () { self.search = si.value; clearTimeout(st); st = setTimeout(loadTickets, 200); }); } })();
        document.getElementById('btn-tags').addEventListener('click', function () { if (self.currentTicket) openTagsPanel(self.currentTicket); });
        document.getElementById('btn-access').addEventListener('click', function () { if (self.currentTicket) openAccessPanel(self.currentTicket); });
        document.getElementById('btn-challenge').addEventListener('click', function () { if (self.currentTicket) openChallengePanel(self.currentTicket); });
        document.getElementById('btn-profile').addEventListener('click', function () { if (self.currentTicket) openProfileEditor(self.currentTicket); });
        document.getElementById('btn-history').addEventListener('click', function () { if (self.currentTicket) openHistoryPanel(self.currentTicket); });
        (function () { var nb = document.getElementById('sup-new'); if (nb) nb.addEventListener('click', openNewConversation); })();
        var _ch = document.getElementById('convo-history'); if (_ch) _ch.addEventListener('click', function () { if (self.currentTicket) openHistoryPanel(self.currentTicket); });
        ['convo-name', 'convo-avatar'].forEach(function (id) { var el = document.getElementById(id); if (el) { el.style.cursor = 'pointer'; el.title = 'Ver / editar perfil'; el.addEventListener('click', function () { if (self.currentTicket) openProfileEditor(self.currentTicket); }); } });
        await loadTags(); renderTagFilter(); loadTickets();
        // #3 — abrir direto o ticket que veio de "Responder no suporte"
        if (G._openTicketId) { var _oid = G._openTicketId; G._openTicketId = null; (async function () { var rr = await sb.from('comu_support_tickets').select('*, member:lms_students!user_id(full_name,avatar_url,email,phone)').eq('id', _oid).maybeSingle(); if (rr && rr.data && !self.destroyed) openTicket(rr.data); })(); }
        self.channels.push(sb.channel('tickets-list').on('postgres_changes', { event: '*', schema: 'public', table: 'comu_support_tickets' }, function () { loadTickets(); }).subscribe());
        // tags aplicadas (inclusive pela IA) atualizam a lista/filtro ao vivo
        self.channels.push(sb.channel('contact-tags').on('postgres_changes', { event: '*', schema: 'public', table: 'comu_support_contact_tags' }, async function () { await loadTags(); renderTagFilter(); refreshConvoTags(); loadTickets(); }).subscribe());
      }
    };
  })();
  // ---- Painel de administração: membros (só admin) ----
  GVSI.views.membros = {
    render: async function (view) {
      var me = G.me || {};
      if (me.role !== 'admin') { G.navigate('/'); return; }
      var esc = G.esc, sb = G.sb;
      var st = { destroyed: false, all: [], banned: {}, search: '' };
      GVSI.views.membros._st = st;
      view.innerHTML =
        '<header class="fixed top-0 left-0 right-0 lg:left-[var(--side-w)] z-50 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] h-14 flex items-center justify-between px-container-margin"><button type="button" id="mb-back" class="flex items-center gap-sm text-primary" aria-label="Voltar"><span class="material-symbols-outlined">arrow_back</span><span class="font-headline-sm text-headline-sm font-bold">Administração · Membros</span></button><button type="button" data-theme-toggle class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button></header>' +
        '<div class="pt-14 lg:pl-[var(--side-w)] min-h-screen"><div class="max-w-3xl mx-auto px-container-margin py-lg space-y-md">' +
          '<div class="flex gap-1 bg-surface-container-low rounded-xl p-1"><button type="button" id="mb-tab-membros" class="flex-1 py-2 rounded-lg text-label-md font-label-md bg-primary text-on-primary transition-colors">Membros</button><button type="button" id="mb-tab-aval" class="flex-1 py-2 rounded-lg text-label-md font-label-md text-on-surface-variant transition-colors">Avaliações</button></div>' +
          '<div id="mb-pane-membros" class="space-y-md">' +
            '<div class="relative"><span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">search</span><input id="mb-search" type="text" autocomplete="off" placeholder="Buscar por nome ou e-mail" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-3 pl-10 pr-3 text-body-md text-on-surface focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant"></div>' +
            '<p id="mb-count" class="text-body-sm text-on-surface-variant px-1"></p>' +
            '<div id="mb-list" class="bg-surface-container-lowest rounded-xl border border-outline-variant/30 divide-y divide-outline-variant/20 overflow-hidden"><p class="p-lg text-center text-on-surface-variant text-body-sm">Carregando…</p></div>' +
          '</div>' +
          '<div id="mb-pane-aval" class="hidden space-y-md">' +
            '<div id="mb-aval-summary" class="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-lg text-center"><p class="text-body-sm text-on-surface-variant">Carregando…</p></div>' +
            '<div id="mb-aval-list" class="bg-surface-container-lowest rounded-xl border border-outline-variant/30 divide-y divide-outline-variant/20 overflow-hidden"></div>' +
          '</div>' +
        '</div></div>';
      var back = document.getElementById('mb-back'); if (back) back.addEventListener('click', function () { G.navigate('/perfil'); });
      function roleLabel(r) { return r === 'admin' ? 'Admin' : (r === 'suporte' ? 'Suporte' : 'Membro'); }
      function roleClass(r) { return r === 'admin' ? 'bg-primary/15 text-primary' : (r === 'suporte' ? 'bg-secondary-container/40 text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'); }
      function findUser(id) { for (var i = 0; i < st.all.length; i++) if (st.all[i].id === id) return st.all[i]; return null; }
      function paint() {
        var list = document.getElementById('mb-list'); if (!list) return;
        var q = G.deburr((st.search || '').trim());
        var rows = st.all;
        if (q) rows = rows.filter(function (u) { return [u.full_name, u.email].some(function (v) { return v && G.deburr(v).indexOf(q) >= 0; }); });
        var cap = 60, shown = rows.slice(0, cap);
        var cnt = document.getElementById('mb-count'); if (cnt) cnt.textContent = q ? (rows.length + ' resultado(s)') : ('Total: ' + st.all.length + ' membros' + (rows.length > cap ? ' · mostrando ' + cap + ' (refine a busca)' : ''));
        if (!shown.length) { list.innerHTML = '<p class="p-lg text-center text-on-surface-variant text-body-sm">Nenhum membro encontrado.</p>'; return; }
        list.innerHTML = '';
        shown.forEach(function (u) {
          var banned = !!st.banned[u.id];
          var el = document.createElement('div'); el.className = 'flex items-center gap-md p-md';
          var av = u.avatar_url ? '<img src="' + esc(u.avatar_url) + '" class="w-11 h-11 rounded-full object-cover shrink-0">' : '<span class="w-11 h-11 rounded-full bg-surface-container-high flex items-center justify-center text-outline shrink-0"><span class="material-symbols-outlined">person</span></span>';
          var actBan = banned
            ? '<button type="button" data-unban="' + u.id + '" class="w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-primary/10" title="Desbanir"><span class="material-symbols-outlined text-[20px]">lock_open</span></button>'
            : (u.role !== 'admin' ? '<button type="button" data-ban="' + u.id + '" class="w-9 h-9 rounded-full flex items-center justify-center text-error hover:bg-error/10" title="Banir"><span class="material-symbols-outlined text-[20px]">block</span></button>' : '');
          el.innerHTML = av +
            '<div class="flex-1 min-w-0"><div class="flex items-center gap-xs flex-wrap"><span class="font-bold text-on-surface truncate">' + esc(u.full_name || '(sem nome)') + '</span><span class="text-[10px] px-2 py-0.5 rounded-full ' + roleClass(u.role) + '">' + roleLabel(u.role) + '</span>' + (banned ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-error/15 text-error">Banido</span>' : '') + '</div><p class="text-body-sm text-on-surface-variant truncate">' + esc(u.email || '') + '</p></div>' +
            '<div class="flex items-center gap-xs shrink-0"><button type="button" data-edit="' + u.id + '" class="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high" title="Editar nome"><span class="material-symbols-outlined text-[20px]">edit</span></button><button type="button" data-pw="' + u.id + '" class="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high" title="Alterar senha"><span class="material-symbols-outlined text-[20px]">key</span></button>' + actBan + '</div>';
          list.appendChild(el);
        });
        list.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { editName(b.getAttribute('data-edit')); }; });
        list.querySelectorAll('[data-pw]').forEach(function (b) { b.onclick = function () { setPassword(b.getAttribute('data-pw')); }; });
        list.querySelectorAll('[data-ban]').forEach(function (b) { b.onclick = function () { doBan(b.getAttribute('data-ban')); }; });
        list.querySelectorAll('[data-unban]').forEach(function (b) { b.onclick = function () { doUnban(b.getAttribute('data-unban')); }; });
      }
      async function editName(id) {
        var u = findUser(id); if (!u) return;
        var nv = await G.promptDialog({ title: 'Editar nome', text: u.email || '', placeholder: 'Nome', value: u.full_name || '', ok: 'Salvar' });
        if (nv === null) return; nv = nv.trim(); if (!nv || nv === u.full_name) return;
        var r = await sb.rpc('comu_rename_member', { p_user_id: id, p_name: nv }); // atualiza perfil + mensagens antigas
        if (r.error) { G.toast('Não foi possível editar: ' + r.error.message); return; }
        u.full_name = nv; paint(); G.toast('Nome atualizado.');
      }
      async function setPassword(id) {
        var u = findUser(id); if (!u) return;
        var nv = await G.promptDialog({ title: 'Alterar senha', text: 'Definir nova senha para ' + (u.email || 'membro') + '.', placeholder: 'Mínimo 6 caracteres', type: 'password', ok: 'Salvar' });
        if (nv === null) return; nv = nv.trim(); if (nv.length < 6) { G.toast('Senha muito curta (mín. 6).'); return; }
        var r = await sb.rpc('comu_admin_set_password', { p_user_id: id, p_password: nv });
        if (r.error) { G.toast('Não foi possível: ' + r.error.message); return; }
        G.toast('Senha alterada com sucesso.');
      }
      async function doBan(id) {
        var u = findUser(id); if (!u) return;
        var ok = await G.confirmDialog({ title: 'Banir ' + (u.full_name || 'este membro') + '?', text: 'A pessoa perderá o acesso à comunidade.', ok: 'Banir', danger: true });
        if (!ok) return;
        var r = await sb.rpc('comu_ban', { p_user_id: id });
        if (r.error) { G.toast('Não foi possível banir: ' + r.error.message); return; }
        st.banned[id] = true; paint(); G.toast((u.full_name || 'Membro') + ' foi banido.');
      }
      async function doUnban(id) {
        var u = findUser(id); if (!u) return;
        var r = await sb.rpc('comu_unban', { p_user_id: id });
        if (r.error) { G.toast('Não foi possível desbanir: ' + r.error.message); return; }
        delete st.banned[id]; paint(); G.toast((u.full_name || 'Membro') + ' foi desbanido.');
      }
      function stars(n) { n = n || 0; var s = ''; for (var i = 1; i <= 5; i++) s += (i <= n ? '<span class="material-symbols-outlined text-[18px]" style="color:#f5b400;font-variation-settings:\'FILL\' 1">star</span>' : '<span class="material-symbols-outlined text-[18px] text-outline/40">star</span>'); return s; }
      async function loadRatings() {
        var sum = document.getElementById('mb-aval-summary'), list = document.getElementById('mb-aval-list');
        var r = await sb.from('comu_support_tickets').select('protocol, rating, rated_at, member:lms_students!user_id(full_name,avatar_url)').not('rating', 'is', null).order('rated_at', { ascending: false });
        if (st.destroyed) return;
        if (r.error) { if (list) list.innerHTML = '<p class="p-lg text-error text-body-sm">' + esc(r.error.message) + '</p>'; return; }
        var rows = r.data || [], avg = rows.length ? rows.reduce(function (a, x) { return a + (x.rating || 0); }, 0) / rows.length : 0;
        if (sum) sum.innerHTML = rows.length ? '<div class="text-[40px] font-bold text-on-surface leading-none">' + avg.toFixed(1) + '</div><div class="my-xs flex justify-center">' + stars(Math.round(avg)) + '</div><p class="text-body-sm text-on-surface-variant">' + rows.length + (rows.length === 1 ? ' avaliação' : ' avaliações') + '</p>' : '<p class="text-body-sm text-on-surface-variant">Ainda não há avaliações.</p>';
        if (!list) return; if (!rows.length) { list.innerHTML = ''; return; }
        list.innerHTML = '';
        rows.forEach(function (t) { var m = t.member || {}; var av = m.avatar_url ? '<img src="' + esc(m.avatar_url) + '" class="w-10 h-10 rounded-full object-cover shrink-0">' : '<span class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-outline shrink-0"><span class="material-symbols-outlined text-[20px]">person</span></span>'; var d = ''; try { d = t.rated_at ? new Date(t.rated_at).toLocaleDateString('pt-BR') : ''; } catch (e) {} var el = document.createElement('div'); el.className = 'flex items-center gap-md p-md'; el.innerHTML = av + '<div class="flex-1 min-w-0"><span class="font-bold text-on-surface truncate block">' + esc(m.full_name || 'Membro') + '</span><span class="text-body-sm text-on-surface-variant">' + esc(t.protocol || '') + (d ? ' · ' + d : '') + '</span></div><div class="shrink-0 flex">' + stars(t.rating) + '</div>'; list.appendChild(el); });
      }
      var loadedAval = false;
      function showTab(which) {
        var pm = document.getElementById('mb-pane-membros'), pa = document.getElementById('mb-pane-aval'), tm = document.getElementById('mb-tab-membros'), ta = document.getElementById('mb-tab-aval');
        if (which === 'aval') { pm.classList.add('hidden'); pa.classList.remove('hidden'); ta.classList.add('bg-primary', 'text-on-primary'); ta.classList.remove('text-on-surface-variant'); tm.classList.remove('bg-primary', 'text-on-primary'); tm.classList.add('text-on-surface-variant'); if (!loadedAval) { loadedAval = true; loadRatings(); } }
        else { pa.classList.add('hidden'); pm.classList.remove('hidden'); tm.classList.add('bg-primary', 'text-on-primary'); tm.classList.remove('text-on-surface-variant'); ta.classList.remove('bg-primary', 'text-on-primary'); ta.classList.add('text-on-surface-variant'); }
      }
      document.getElementById('mb-tab-membros').addEventListener('click', function () { showTab('membros'); });
      document.getElementById('mb-tab-aval').addEventListener('click', function () { showTab('aval'); });
      var si = document.getElementById('mb-search');
      if (si) { var tmr; si.addEventListener('input', function () { st.search = si.value; clearTimeout(tmr); tmr = setTimeout(paint, 150); }); }
      var from = 0, PAGE = 1000, all = [];
      while (true) {
        var r = await sb.from('lms_students').select('id,full_name,email,avatar_url,role').order('id').range(from, from + PAGE - 1);
        if (st.destroyed) return;
        if (r.error) { var l = document.getElementById('mb-list'); if (l) l.innerHTML = '<p class="p-lg text-error text-body-sm">' + esc(r.error.message) + '</p>'; return; }
        all = all.concat(r.data || []);
        if (!r.data || r.data.length < PAGE) break;
        from += PAGE;
      }
      all.sort(function (a, b) { return String(a.full_name || '~').toLowerCase().localeCompare(String(b.full_name || '~').toLowerCase()); });
      st.all = all;
      var bb = await sb.from('comu_bans').select('user_id'); if (st.destroyed) return;
      (bb.data || []).forEach(function (x) { st.banned[x.user_id] = true; });
      paint();
    },
    destroy: function () { if (GVSI.views.membros._st) GVSI.views.membros._st.destroyed = true; }
  };
  // ---- Painel de administração: moderação (só admin) ----
  GVSI.views.moderacao = {
    render: async function (view) {
      var me = G.me || {};
      if (me.role !== 'admin') { G.navigate('/'); return; }
      var esc = G.esc, sb = G.sb;
      var st = { destroyed: false }; GVSI.views.moderacao._st = st;
      view.innerHTML =
        '<header class="fixed top-0 left-0 right-0 lg:left-[var(--side-w)] z-50 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] h-14 flex items-center justify-between px-container-margin"><button type="button" id="md-back" class="flex items-center gap-sm text-primary" aria-label="Voltar"><span class="material-symbols-outlined">arrow_back</span><span class="font-headline-sm text-headline-sm font-bold">Administração · Moderação</span></button><button type="button" data-theme-toggle class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button></header>' +
        '<div class="pt-14 lg:pl-[var(--side-w)] min-h-screen"><div class="max-w-3xl mx-auto px-container-margin py-lg space-y-md">' +
          '<div class="flex gap-1 bg-surface-container-low rounded-xl p-1"><button type="button" id="md-tab-oc" class="flex-1 py-2 rounded-lg text-label-md font-label-md bg-primary text-on-primary transition-colors">Ocultadas</button><button type="button" id="md-tab-tm" class="flex-1 py-2 rounded-lg text-label-md font-label-md text-on-surface-variant transition-colors">Palavras bloqueadas</button></div>' +
          '<div id="md-pane-oc" class="space-y-md">' +
            '<p class="text-body-sm text-on-surface-variant px-1">Mensagens escondidas automaticamente antes de chegarem aos outros. Só a equipe vê aqui.</p>' +
            '<div id="md-oc-list" class="bg-surface-container-lowest rounded-xl border border-outline-variant/30 divide-y divide-outline-variant/20 overflow-hidden"><p class="p-lg text-center text-on-surface-variant text-body-sm">Carregando…</p></div>' +
          '</div>' +
          '<div id="md-pane-tm" class="hidden space-y-md">' +
            '<div class="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-md"><div class="flex flex-wrap gap-sm"><input id="md-term" type="text" placeholder="Nova palavra ou frase" class="flex-1 min-w-[140px] bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-body-md text-on-surface"><select id="md-cat" class="bg-surface-container-low border border-outline-variant rounded-xl px-2 py-2 text-body-sm text-on-surface"><option value="toxico">Toxicidade</option><option value="critica">Crítica</option><option value="spam">Spam/links</option><option value="concorrente">Concorrente</option></select><button type="button" id="md-add" class="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md">Adicionar</button></div></div>' +
            '<div id="md-tm-list" class="bg-surface-container-lowest rounded-xl border border-outline-variant/30 divide-y divide-outline-variant/20 overflow-hidden"><p class="p-lg text-center text-on-surface-variant text-body-sm">Carregando…</p></div>' +
          '</div>' +
        '</div></div>';
      document.getElementById('md-back').addEventListener('click', function () { G.navigate('/perfil'); });
      function fmtWhen(iso) { try { return new Date(iso).toLocaleString('pt-BR'); } catch (e) { return ''; } }
      function catLabel(c) { return c === 'toxico' ? 'Toxicidade' : (c === 'critica' ? 'Crítica' : (c === 'spam' ? 'Spam/links' : (c === 'concorrente' ? 'Concorrente' : c))); }
      async function loadHidden() {
        var list = document.getElementById('md-oc-list'); if (!list) return;
        var r = await sb.from('comu_messages').select('id,body,kind,created_at,topic_id,author_name').eq('moderation', 'hidden').is('ticket_id', null).order('created_at', { ascending: false }).limit(200);
        if (st.destroyed) return;
        if (r.error) { list.innerHTML = '<p class="p-lg text-error text-body-sm">' + esc(r.error.message) + '</p>'; return; }
        var rows = r.data || [];
        if (!rows.length) { list.innerHTML = '<p class="p-lg text-center text-on-surface-variant text-body-sm">Nenhuma mensagem oculta. 🎉</p>'; return; }
        var topicName = {}; (G.topics || []).forEach(function (t) { topicName[t.id] = t.name; });
        list.innerHTML = '';
        rows.forEach(function (m) {
          var text = m.kind === 'text' ? esc(m.body || '') : (m.kind === 'image' ? '📷 Foto' + (m.body ? ': ' + esc(m.body) : '') : (m.kind === 'audio' ? '🎤 Áudio' : (m.kind === 'video' ? '🎬 Vídeo' : (m.kind === 'file' ? '📎 Arquivo' : esc(m.body || '')))));
          var el = document.createElement('div'); el.className = 'p-md space-y-xs';
          el.innerHTML = '<div class="flex items-center justify-between gap-sm"><span class="font-bold text-on-surface text-body-sm truncate">' + esc(m.author_name || 'Membro') + '</span><span class="text-[12px] text-on-surface-variant shrink-0">' + esc(topicName[m.topic_id] || '') + ' · ' + fmtWhen(m.created_at) + '</span></div>'
            + '<p class="text-body-md text-on-surface whitespace-pre-wrap break-words">' + text + '</p>'
            + '<div class="flex gap-sm justify-end pt-xs"><button type="button" data-approve="' + m.id + '" class="h-9 px-3 rounded-full border border-outline-variant text-primary text-label-md hover:bg-primary/10 flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">visibility</span>Mostrar a todos</button><button type="button" data-del="' + m.id + '" class="h-9 px-3 rounded-full text-error text-label-md hover:bg-error/10 flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">delete</span>Apagar</button></div>';
          list.appendChild(el);
        });
        list.querySelectorAll('[data-approve]').forEach(function (b) { b.onclick = async function () { var up = await sb.from('comu_messages').update({ moderation: 'ok' }).eq('id', b.getAttribute('data-approve')); if (up.error) { G.toast('Erro: ' + up.error.message); return; } G.toast('Mensagem liberada.'); loadHidden(); }; });
        list.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = async function () { var del = await sb.from('comu_messages').delete().eq('id', b.getAttribute('data-del')); if (del.error) { G.toast('Erro: ' + del.error.message); return; } G.toast('Mensagem apagada.'); loadHidden(); }; });
      }
      async function loadTerms() {
        var list = document.getElementById('md-tm-list'); if (!list) return;
        var r = await sb.from('comu_mod_terms').select('*').order('category').order('term');
        if (st.destroyed) return;
        if (r.error) { list.innerHTML = '<p class="p-lg text-error text-body-sm">' + esc(r.error.message) + '</p>'; return; }
        var rows = r.data || [];
        if (!rows.length) { list.innerHTML = '<p class="p-lg text-center text-on-surface-variant text-body-sm">Nenhuma palavra cadastrada.</p>'; return; }
        list.innerHTML = '';
        rows.forEach(function (t) {
          var el = document.createElement('div'); el.className = 'flex items-center gap-md p-md';
          el.innerHTML = '<div class="flex-1 min-w-0"><span class="font-bold text-on-surface ' + (t.active ? '' : 'line-through opacity-50') + '">' + esc(t.term) + '</span> <span class="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">' + esc(catLabel(t.category)) + '</span></div>'
            + '<button type="button" data-toggle="' + t.id + '" class="w-9 h-9 rounded-full flex items-center justify-center ' + (t.active ? 'text-primary' : 'text-outline') + ' hover:bg-surface-container-high" title="' + (t.active ? 'Desativar' : 'Ativar') + '"><span class="material-symbols-outlined text-[22px]">' + (t.active ? 'toggle_on' : 'toggle_off') + '</span></button>'
            + '<button type="button" data-rm="' + t.id + '" class="w-9 h-9 rounded-full flex items-center justify-center text-error hover:bg-error/10" title="Remover"><span class="material-symbols-outlined text-[20px]">delete</span></button>';
          list.appendChild(el);
        });
        list.querySelectorAll('[data-toggle]').forEach(function (b) { b.onclick = async function () { var id = b.getAttribute('data-toggle'); var t = rows.filter(function (x) { return x.id === id; })[0]; var up = await sb.from('comu_mod_terms').update({ active: !t.active }).eq('id', id); if (up.error) { G.toast('Erro: ' + up.error.message); return; } loadTerms(); }; });
        list.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = async function () { var del = await sb.from('comu_mod_terms').delete().eq('id', b.getAttribute('data-rm')); if (del.error) { G.toast('Erro: ' + del.error.message); return; } loadTerms(); }; });
      }
      document.getElementById('md-add').addEventListener('click', async function () {
        var term = document.getElementById('md-term').value.trim(); var cat = document.getElementById('md-cat').value;
        if (!term) return;
        var ins = await sb.from('comu_mod_terms').insert({ term: term, category: cat }); if (ins.error) { G.toast('Erro: ' + ins.error.message); return; }
        document.getElementById('md-term').value = ''; G.toast('Palavra adicionada.'); loadTerms();
      });
      (function () { var ti = document.getElementById('md-term'); if (ti) ti.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('md-add').click(); } }); })();
      var loadedTm = false;
      function tab(w) {
        var po = document.getElementById('md-pane-oc'), pt = document.getElementById('md-pane-tm'), to = document.getElementById('md-tab-oc'), tt = document.getElementById('md-tab-tm');
        if (w === 'tm') { po.classList.add('hidden'); pt.classList.remove('hidden'); tt.classList.add('bg-primary', 'text-on-primary'); tt.classList.remove('text-on-surface-variant'); to.classList.remove('bg-primary', 'text-on-primary'); to.classList.add('text-on-surface-variant'); if (!loadedTm) { loadedTm = true; loadTerms(); } }
        else { pt.classList.add('hidden'); po.classList.remove('hidden'); to.classList.add('bg-primary', 'text-on-primary'); to.classList.remove('text-on-surface-variant'); tt.classList.remove('bg-primary', 'text-on-primary'); tt.classList.add('text-on-surface-variant'); }
      }
      document.getElementById('md-tab-oc').addEventListener('click', function () { tab('oc'); });
      document.getElementById('md-tab-tm').addEventListener('click', function () { tab('tm'); });
      loadHidden();
    },
    destroy: function () { if (GVSI.views.moderacao._st) GVSI.views.moderacao._st.destroyed = true; }
  };

  GVSI.views.iasuporte = {
    render: async function (view) {
      var me = G.me || {};
      if (me.role !== 'admin') { G.navigate('/'); return; }
      var esc = G.esc, sb = G.sb;
      var st = { destroyed: false, ch: null }; GVSI.views.iasuporte._st = st;
      view.innerHTML =
        '<header class="fixed top-0 left-0 right-0 lg:left-[var(--side-w)] z-50 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] h-14 flex items-center justify-between px-container-margin"><button type="button" id="ia-back" class="flex items-center gap-sm text-primary" aria-label="Voltar"><span class="material-symbols-outlined">arrow_back</span><span class="font-headline-sm text-headline-sm font-bold">IA · Rascunhos de suporte</span></button><span id="ia-count" class="text-body-sm text-on-surface-variant"></span></header>' +
        '<div class="pt-14 lg:pl-[var(--side-w)] min-h-screen"><div class="max-w-3xl mx-auto px-container-margin py-lg space-y-md">' +
          '<p class="text-body-sm text-on-surface-variant px-1">A IA responde cada dúvida do suporte aqui, oculto do aluno. <b>Aprovar</b> envia a resposta como Saymon e ensina a IA. <b>Recusar</b> guarda o motivo (a IA não repete) e um humano assume.</p>' +
          '<div id="ia-list" class="space-y-md"><p class="p-lg text-center text-on-surface-variant text-body-sm">Carregando…</p></div>' +
        '</div></div>';
      document.getElementById('ia-back').addEventListener('click', function () { G.navigate('/perfil'); });
      function fmtWhen(iso) { try { return new Date(iso).toLocaleString('pt-BR'); } catch (e) { return ''; } }
      function setCount(n) { var c = document.getElementById('ia-count'); if (c) c.textContent = n ? (n + ' pendente' + (n > 1 ? 's' : '')) : ''; }
      function emptyState() { var list = document.getElementById('ia-list'); if (list) list.innerHTML = '<div class="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-xl text-center"><span class="material-symbols-outlined text-[40px] text-outline">check_circle</span><p class="text-body-sm text-on-surface-variant mt-sm">Nenhum rascunho pendente.</p></div>'; }
      function recount() { var left = document.querySelectorAll('#ia-list > .ia-card').length; setCount(left); if (!left) emptyState(); }
      async function load() {
        var list = document.getElementById('ia-list'); if (!list) return;
        var r = await sb.from('comu_ai_drafts').select('id,ticket_id,member_question,draft_body,suggest_handoff,handoff_reason,created_at').eq('status', 'pending').order('created_at', { ascending: true });
        if (st.destroyed) return;
        if (r.error) { list.innerHTML = '<p class="p-lg text-error text-body-sm">' + esc(r.error.message) + '</p>'; return; }
        var rows = r.data || [];
        setCount(rows.length);
        var protos = {};
        var tids = rows.map(function (x) { return x.ticket_id; }).filter(Boolean);
        if (tids.length) { var tr = await sb.from('comu_support_tickets').select('id,protocol').in('id', tids); if (!st.destroyed && tr && tr.data) tr.data.forEach(function (t) { protos[t.id] = t.protocol; }); }
        if (st.destroyed) return;
        if (!rows.length) { emptyState(); return; }
        list.innerHTML = '';
        rows.forEach(function (d) {
          var handoff = d.suggest_handoff;
          var body = (d.draft_body || '').replace(/\[MSG\]/g, '\n').trim();
          var el = document.createElement('div'); el.className = 'ia-card bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden';
          el.innerHTML =
            '<div class="p-md border-b border-outline-variant/20 flex items-center justify-between gap-sm"><span class="text-[12px] text-on-surface-variant">' + esc(protos[d.ticket_id] || 'ticket') + ' · ' + fmtWhen(d.created_at) + '</span>' + (handoff ? '<span class="text-[11px] font-bold text-error bg-error/10 rounded-full px-2 py-[1px] leading-none">IA sugere humano</span>' : '') + '</div>' +
            '<div class="p-md space-y-sm">' +
              '<div><p class="text-[11px] font-label-md text-on-surface-variant mb-xs">DÚVIDA DO ALUNO</p><p class="text-body-md text-on-surface whitespace-pre-wrap break-words">' + esc(d.member_question || '') + '</p></div>' +
              '<div><p class="text-[11px] font-label-md text-on-surface-variant mb-xs">RESPOSTA DA IA</p>' + (body ? '<p class="text-body-md text-on-surface whitespace-pre-wrap break-words">' + esc(body) + '</p>' : '<p class="text-body-sm italic text-on-surface-variant">A IA não propôs resposta' + (d.handoff_reason ? ' (' + esc(d.handoff_reason) + ')' : '') + '. Recomenda um humano.</p>') + '</div>' +
            '</div>' +
            '<div class="ia-reject hidden p-md border-t border-outline-variant/20 space-y-sm"><textarea class="ia-reason w-full bg-surface-container-low border border-outline-variant rounded-xl py-2 px-3 text-body-md text-on-surface resize-none" rows="2" placeholder="Por que está recusando? (a IA aprende com isso)"></textarea><div class="flex gap-sm justify-end"><button type="button" class="ia-reject-cancel h-9 px-3 rounded-full border border-outline-variant text-on-surface text-label-md">Cancelar</button><button type="button" class="ia-reject-go h-9 px-4 rounded-full bg-error text-white text-label-md">Confirmar recusa</button></div></div>' +
            '<div class="ia-actions p-md border-t border-outline-variant/20 flex flex-wrap gap-sm justify-end">' +
              '<button type="button" class="ia-open h-10 px-3 rounded-full border border-outline-variant text-on-surface text-label-md flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">forum</span>Ver conversa</button>' +
              '<button type="button" class="ia-reject-open h-10 px-4 rounded-full border border-outline-variant text-error text-label-md flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">close</span>Recusar</button>' +
              (body ? '<button type="button" class="ia-approve h-10 px-5 rounded-full bg-primary text-on-primary text-label-md flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">send</span>Aprovar e enviar</button>' : '') +
            '</div>';
          el.querySelector('.ia-open').onclick = function () { G._openTicketId = d.ticket_id; G.navigate('/suporte'); };
          var ap = el.querySelector('.ia-approve');
          if (ap) ap.onclick = async function () { ap.disabled = true; var r2 = await sb.rpc('comu_ai_draft_approve', { p_draft_id: d.id }); if (r2.error) { ap.disabled = false; G.toast('Erro: ' + r2.error.message); return; } G.toast('Enviado ao aluno ✓'); el.remove(); recount(); };
          el.querySelector('.ia-reject-open').onclick = function () { el.querySelector('.ia-reject').classList.remove('hidden'); el.querySelector('.ia-actions').classList.add('hidden'); var ta = el.querySelector('.ia-reason'); if (ta) ta.focus(); };
          el.querySelector('.ia-reject-cancel').onclick = function () { el.querySelector('.ia-reject').classList.add('hidden'); el.querySelector('.ia-actions').classList.remove('hidden'); };
          el.querySelector('.ia-reject-go').onclick = async function () { var reason = (el.querySelector('.ia-reason').value || '').trim(); if (!reason) { G.toast('Escreve o motivo, por favor.'); return; } var b = el.querySelector('.ia-reject-go'); b.disabled = true; var r3 = await sb.rpc('comu_ai_draft_reject', { p_draft_id: d.id, p_reason: reason }); if (r3.error) { b.disabled = false; G.toast('Erro: ' + r3.error.message); return; } G.toast('Recusado. A IA vai evitar isso.'); el.remove(); recount(); };
          list.appendChild(el);
        });
      }
      try { st.ch = sb.channel('ia-drafts').on('postgres_changes', { event: '*', schema: 'public', table: 'comu_ai_drafts' }, function () { if (!st.destroyed) load(); }).subscribe(); } catch (e) {}
      load();
    },
    destroy: function () { var st = GVSI.views.iasuporte._st; if (st) { st.destroyed = true; if (st.ch) { try { G.sb.removeChannel(st.ch); } catch (e) {} } } }
  };
})();
