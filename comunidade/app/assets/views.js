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
          '<h1 class="font-headline-sm text-headline-sm font-bold text-primary">GVSI Comunidade</h1>' +
          '<button type="button" data-theme-toggle class="text-primary flex items-center" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button>' +
        '</header>' +
        '<div class="lg:pl-[360px] min-h-screen">' +
          '<div class="lg:hidden pt-14 pb-16"><div class="px-container-margin py-lg">' +
            '<div class="mb-lg relative"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>' +
            '<input id="topic-search" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary focus:border-primary transition-all text-body-md text-on-surface" placeholder="Procurar tópicos na comunidade" type="text"></div>' +
            '<h2 class="text-headline-md font-bold text-on-surface mb-lg px-2">Escolha um tópico para entrar na conversa</h2>' +
            '<div id="topic-list" class="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm p-sm gap-1"></div>' +
            '<p id="no-results" class="hidden text-center text-on-surface-variant py-lg">Nenhum tópico encontrado.</p>' +
          '</div></div>' +
          '<div class="hidden lg:flex min-h-screen flex-col items-center justify-center text-center gap-md p-xl">' +
            '<div class="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[40px]">forum</span></div>' +
            '<div class="space-y-xs max-w-sm"><h2 class="font-headline-md text-headline-md text-on-surface">Bem-vindo à Comunidade GVSI</h2><p class="text-body-md text-on-surface-variant">Selecione um tópico na barra lateral para começar a conversar.</p></div>' +
          '</div>' +
        '</div>' +
        '<nav class="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-xl bg-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] flex justify-around items-center h-16 px-2">' +
          '<a class="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-4 py-1" href="#/"><span class="material-symbols-outlined fill">groups</span><span class="font-label-md text-label-md">Grupos</span></a>' +
          '<a class="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1" href="#/perfil"><span class="material-symbols-outlined">person</span><span class="font-label-md text-label-md">Meu Perfil</span></a>' +
        '</nav>';
      G.renderTopicList(document.getElementById('topic-list'), '');
      G.applyUnread();
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
      if (S.picker && S.picker.parentNode) S.picker.remove();
      if (S.recTimer) clearInterval(S.recTimer);
      if (S.recStream) { try { S.recStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
      if (S.onPickerDoc) document.removeEventListener('click', S.onPickerDoc);
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
          '<header class="fixed top-0 left-0 right-0 lg:left-[360px] z-40 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-between px-container-margin h-16">' +
            '<div class="flex items-center gap-md min-w-0">' +
              '<a class="lg:hidden text-primary flex items-center" href="#/" aria-label="Voltar"><span class="material-symbols-outlined">arrow_back</span></a>' +
              '<div class="flex flex-col min-w-0 justify-center"><h1 id="chat-title" class="font-headline-sm text-headline-sm font-bold text-primary leading-tight truncate">GVSI Comunidade</h1><span id="chat-subtitle" class="text-body-sm text-on-surface-variant leading-tight">Grupo da comunidade</span></div>' +
            '</div>' +
            '<div class="flex items-center gap-xs">' +
              '<button type="button" data-theme-toggle class="lg:hidden text-primary flex items-center" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button>' +
            '</div>' +
          '</header>' +
          '<main id="chat-scroll" class="lg:pl-[360px] h-[100dvh] pt-16 pb-52 lg:pb-40 flex flex-col overflow-y-auto custom-scrollbar">' +
            '<div id="chat-messages" class="hidden w-full max-w-3xl mx-auto flex flex-col gap-lg px-container-margin py-lg"></div>' +
            '<div id="chat-loading" class="flex-grow flex items-center justify-center text-on-surface-variant text-body-sm gap-sm"><span class="material-symbols-outlined animate-spin">progress_activity</span> Carregando…</div>' +
            '<div id="chat-empty" class="hidden flex-grow flex flex-col items-center justify-center text-center gap-md py-xl px-container-margin"><div class="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[40px]">forum</span></div><div class="space-y-xs max-w-xs"><h2 class="font-headline-sm text-headline-sm text-on-surface">Ainda não há mensagens</h2><p class="text-body-sm text-on-surface-variant">Seja o primeiro a enviar uma mensagem neste grupo.</p></div></div>' +
          '</main>' +
          '<div id="chat-composer" class="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-[360px] px-container-margin pb-md lg:pb-lg z-40">' +
            '<form id="chat-form" class="glass-input rounded-2xl p-sm flex flex-col gap-sm shadow-xl border border-outline-variant/40 max-w-3xl mx-auto">' +
              '<div id="composer-normal" class="flex flex-col gap-sm">' +
                '<input id="chat-input" class="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-3 text-body-md focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant text-on-surface" placeholder="Escreva uma mensagem..." type="text" autocomplete="off">' +
                '<div class="flex flex-wrap items-center gap-sm">' +
                  '<a id="btn-attach" href="#/enviar/' + esc(slug) + '" class="h-11 px-3 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-xs shrink-0" aria-label="Anexar foto ou arquivo"><span class="material-symbols-outlined text-[24px]">attach_file</span><span class="text-body-sm font-label-md">Anexar</span></a>' +
                  '<button type="button" id="btn-mic" class="h-11 px-3 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-xs shrink-0" aria-label="Gravar áudio"><span class="material-symbols-outlined text-[24px]">mic</span><span class="text-body-sm font-label-md">Áudio</span></button>' +
                  '<button type="submit" id="btn-send" class="h-11 px-5 ml-auto bg-primary text-on-primary rounded-xl flex items-center gap-xs shadow-lg active:scale-95 transition-all shrink-0" aria-label="Enviar mensagem"><span class="material-symbols-outlined fill text-[24px]">send</span><span class="text-body-md font-bold">Enviar</span></button>' +
                '</div>' +
              '</div>' +
              '<div id="rec-bar" class="hidden flex items-center gap-sm px-sm py-1">' +
                '<span class="w-3 h-3 rounded-full bg-error animate-pulse shrink-0"></span>' +
                '<span class="material-symbols-outlined text-error">mic</span>' +
                '<span id="rec-time" class="text-body-lg text-on-surface tabular-nums">0:00</span>' +
                '<span class="flex-grow"></span>' +
                '<button type="button" id="rec-cancel" class="h-11 px-3 rounded-xl border border-outline-variant text-on-surface flex items-center gap-xs shrink-0" aria-label="Cancelar gravação"><span class="material-symbols-outlined text-[24px]">close</span><span class="text-body-sm">Cancelar</span></button>' +
                '<button type="button" id="rec-send" class="h-11 px-4 bg-primary text-on-primary rounded-xl flex items-center gap-xs shadow shrink-0" aria-label="Enviar áudio"><span class="material-symbols-outlined fill text-[24px]">send</span><span class="text-body-sm font-bold">Enviar</span></button>' +
              '</div>' +
            '</form>' +
          '</div>' +
          '<div id="chat-readonly" class="hidden fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-[360px] px-container-margin pb-md lg:pb-lg z-40"><div class="max-w-3xl mx-auto flex items-center justify-center gap-sm bg-surface-container-high text-on-surface-variant rounded-2xl p-md border border-outline-variant/40 text-body-sm"><span class="material-symbols-outlined text-[20px]">lock</span>Somente administradores podem publicar neste tópico.</div></div>' +
          '<nav class="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-xl bg-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] flex justify-around items-center h-16 px-2">' +
            '<a class="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1" href="#/"><span class="material-symbols-outlined">groups</span><span class="font-label-md text-label-md">Grupos</span></a>' +
            '<a class="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1" href="#/perfil"><span class="material-symbols-outlined">person</span><span class="font-label-md text-label-md">Meu Perfil</span></a>' +
          '</nav>';

        var titleEl = document.getElementById('chat-title');
        var msgsEl = document.getElementById('chat-messages');
        var emptyEl = document.getElementById('chat-empty');
        var loadingEl = document.getElementById('chat-loading');
        var scrollEl = document.getElementById('chat-scroll');
        var form = document.getElementById('chat-form');
        var input = document.getElementById('chat-input');
        function scrollBottom() { scrollEl.scrollTop = scrollEl.scrollHeight; }
        function nearBottom() { return (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight) < 160; }

        // perfil próprio (nome/avatar) já está em G.me
        // resolve tópico
        var topic = null;
        if (slug) { var tr = await sb.from('comu_topics').select('id,name,slug,post_policy').eq('slug', slug).maybeSingle(); topic = tr.data; }
        if (self.destroyed) return;
        if (topic) { titleEl.textContent = topic.name; document.title = 'GVSI Comunidade — ' + topic.name; }

        if (topic && topic.post_policy === 'readonly' && !isAdmin) {
          document.getElementById('chat-composer').classList.add('hidden');
          document.getElementById('chat-readonly').classList.remove('hidden');
          document.getElementById('chat-subtitle').textContent = 'Somente leitura';
        }
        var isSupport = topic && topic.post_policy === 'support';
        if (isSupport && isAdmin) { G.navigate('#/suporte'); return; }
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
          card.className = 'self-center w-full max-w-md bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-lg shadow-sm space-y-md my-md';
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
        // ---- render de mensagem ----
        function renderMsgBody(container, m, mine) {
          container.innerHTML = '';
          if (m.status === 'deleted') { container.innerHTML = '<div class="rounded-xl p-md ' + (mine ? 'rounded-tr-none' : 'rounded-tl-none') + ' bg-surface-container-high text-on-surface-variant text-body-sm italic flex items-center gap-xs"><span class="material-symbols-outlined text-[16px]">block</span>mensagem apagada</div>'; return; }
          var when = timeStr(m.created_at);
          var edited = m.status === 'edited' ? ' <span class="text-[12px] opacity-80">(editado)</span>' : '';
          var content;
          if (m.kind === 'image' && m.media_url) content = '<img src="' + esc(m.media_url) + '" class="rounded-lg max-w-full mb-xs" alt="">' + (m.body ? '<p class="' + (mine ? '' : 'text-on-surface ') + 'font-body-md">' + esc(m.body) + edited + '</p>' : '');
          else if (m.kind === 'video' && m.media_url) content = '<video controls preload="metadata" src="' + esc(m.media_url) + '" class="rounded-lg max-w-full mb-xs" style="max-height:20rem"></video>' + (m.body ? '<p class="' + (mine ? '' : 'text-on-surface ') + 'font-body-md">' + esc(m.body) + edited + '</p>' : '');
          else if (m.kind === 'audio' && m.media_url) content = '<audio controls src="' + esc(m.media_url) + '" class="max-w-full"></audio>';
          else content = '<p class="' + (mine ? '' : 'text-on-surface ') + 'font-body-md whitespace-pre-wrap break-words">' + esc(m.body) + edited + '</p>';
          var inner;
          if (mine) inner = '<div class="flex items-center gap-xs mr-sm mb-xs"><span class="text-[13px] text-on-surface-variant">' + when + '</span><span class="font-label-md text-label-md text-primary">Você</span></div><div class="message-gradient-outgoing text-white shadow-lg rounded-xl rounded-tr-none p-md">' + content + '</div>';
          else {
            var av = m.author_avatar ? '<img src="' + esc(m.author_avatar) + '" class="w-8 h-8 rounded-full object-cover shrink-0" alt="">' : '<span class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-outline shrink-0"><span class="material-symbols-outlined text-[18px]">person</span></span>';
            inner = '<div class="flex items-start gap-sm">' + av + '<div class="flex flex-col min-w-0"><div class="flex items-center gap-xs ml-sm mb-xs"><span class="font-label-md text-label-md text-on-surface-variant">' + esc(m.author_name || 'Membro') + '</span><span class="text-[13px] text-on-surface-variant">' + when + '</span></div><div class="bg-surface-container-lowest shadow-[0px_4px_20px_rgba(0,0,0,0.05)] rounded-xl rounded-tl-none p-md border border-outline-variant/30">' + content + '</div></div></div>';
          }
          container.innerHTML = inner;
          var ageMs = Date.now() - new Date(m.created_at).getTime();
          var within = ageMs < 1800000;
          var canEdit = mine && (within || isAdmin) && m.kind !== 'audio';
          var canDelete = isAdmin || (mine && within);
          if (canEdit || canDelete) {
            var actions = document.createElement('div');
            actions.className = 'flex items-center gap-md mt-xs ' + (mine ? 'mr-sm justify-end' : 'ml-sm');
            if (canEdit) { var eb = document.createElement('button'); eb.type = 'button'; eb.className = 'text-body-sm text-on-surface-variant hover:text-primary flex items-center gap-1 py-1'; eb.innerHTML = '<span class="material-symbols-outlined text-[20px]">edit</span>Editar'; eb.addEventListener('click', function () { startEdit(m); }); actions.appendChild(eb); }
            if (canDelete) { var db = document.createElement('button'); db.type = 'button'; db.className = 'text-body-sm text-on-surface-variant hover:text-error flex items-center gap-1 py-1'; db.innerHTML = '<span class="material-symbols-outlined text-[20px]">delete</span>Apagar'; db.addEventListener('click', function () { doDelete(m); }); actions.appendChild(db); }
            container.appendChild(actions);
            if (mine && !isAdmin && within) setTimeout(function () { if (actions.parentNode) actions.remove(); }, 1800000 - ageMs);
          }
        }
        function bubble(m) {
          if (m.kind === 'system') {
            var sw = document.createElement('div'); sw.setAttribute('data-msg-id', m.id); sw.className = 'w-full flex justify-center';
            sw.innerHTML = '<div class="max-w-md text-center text-body-sm text-on-surface-variant bg-surface-container-high rounded-2xl px-4 py-2">' + esc(m.body || '') + '</div>';
            return sw;
          }
          var mine = me.id && m.author_id === me.id;
          var wrap = document.createElement('div'); wrap.setAttribute('data-msg-id', m.id); wrap.setAttribute('data-author-id', m.author_id || '');
          wrap.className = 'flex flex-col gap-xs max-w-[85%] ' + (mine ? 'items-end self-end' : 'items-start');
          var body = document.createElement('div'); body.className = 'msg-body w-full flex flex-col ' + (mine ? 'items-end' : 'items-start');
          renderMsgBody(body, m, mine); wrap.appendChild(body);
          var rr = document.createElement('div'); rr.className = 'react-row flex items-center gap-xs flex-wrap mt-xs' + (mine ? ' justify-end' : ''); rr.setAttribute('data-react', m.id); wrap.appendChild(rr);
          return wrap;
        }
        function addMessage(m, scroll) { if (!m || seen[m.id]) return; seen[m.id] = true; msgsEl.appendChild(bubble(m)); renderReactions(m.id); emptyEl.classList.add('hidden'); msgsEl.classList.remove('hidden'); if (scroll) scrollBottom(); }
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
              text: 'De ' + (m.author_name || 'Membro') + '. Não pode ser desfeito.',
              options: [
                { label: 'Apagar só esta mensagem', value: 'one', icon: 'delete', danger: true },
                { label: 'Apagar tudo desta pessoa neste tópico', value: 'topic', icon: 'delete_sweep', danger: true },
                { label: 'Apagar tudo desta pessoa em todos os grupos', value: 'all', icon: 'delete_forever', danger: true }
              ]
            });
          } else {
            var ok = await G.confirmDialog({ title: 'Apagar esta mensagem?', text: 'Esta ação não pode ser desfeita.', ok: 'Apagar', danger: true });
            choice = ok ? 'one' : null;
          }
          if (!choice) return;
          var q = sb.from('comu_messages').delete();
          if (choice === 'one') q = q.eq('id', m.id);
          else if (choice === 'topic') q = q.eq('author_id', m.author_id).eq('topic_id', topic.id).is('ticket_id', null);
          else q = q.eq('author_id', m.author_id).is('ticket_id', null);
          var del = await q;
          if (del.error) { G.toast('Não foi possível apagar: ' + del.error.message); return; }
          if (choice === 'one') removeMessage(m.id); else removeAuthorMessages(m.author_id);
          G.toast(choice === 'one' ? 'Mensagem apagada' : 'Mensagens apagadas');
        }
        function updateMessage(m) { var wrap = msgsEl.querySelector('[data-msg-id="' + m.id + '"]'); if (!wrap) return; renderMsgBody(wrap.querySelector('.msg-body'), m, me.id && m.author_id === me.id); if (m.status === 'deleted') { var rr = wrap.querySelector('.react-row'); if (rr) rr.innerHTML = ''; } }

        // ---- reações ----
        var EMOJIS = ['❤️', '👍', '🔥', '✨', '😂', '🙏'];
        var picker = document.createElement('div'); self.picker = picker;
        picker.className = 'hidden fixed z-[80] bg-surface-container-highest border border-outline-variant rounded-full shadow-lg px-2 py-1 flex items-center gap-1';
        var pickerTarget = null;
        EMOJIS.forEach(function (em) { var b = document.createElement('button'); b.type = 'button'; b.className = 'text-[26px] hover:scale-125 transition-transform px-2 py-1'; b.textContent = em; b.addEventListener('click', function () { if (pickerTarget) toggleReaction(pickerTarget, em); hidePicker(); }); picker.appendChild(b); });
        document.body.appendChild(picker);
        function hidePicker() { picker.classList.add('hidden'); pickerTarget = null; }
        function openPicker(anchor, id) { pickerTarget = id; picker.classList.remove('hidden'); var r = anchor.getBoundingClientRect(); var pr = picker.getBoundingClientRect(); var top = r.top - pr.height - 6; if (top < 8) top = r.bottom + 6; var left = r.left; if (left + pr.width > window.innerWidth - 8) left = window.innerWidth - 8 - pr.width; picker.style.top = top + 'px'; picker.style.left = Math.max(8, left) + 'px'; }
        self.onPickerDoc = function (e) { if (picker.classList.contains('hidden')) return; if (!picker.contains(e.target) && !(e.target.closest && e.target.closest('.react-add'))) hidePicker(); };
        document.addEventListener('click', self.onPickerDoc);
        var reactionsMap = self.reactionsMap;
        function renderReactions(id) {
          var row = msgsEl.querySelector('[data-react="' + id + '"]'); if (!row) return;
          var data = reactionsMap[id] || {}; row.innerHTML = '';
          Object.keys(data).forEach(function (em) { var users = data[em]; if (!users || !users.length) return; var mineR = users.indexOf(me.id) !== -1; var chip = document.createElement('button'); chip.type = 'button'; chip.className = 'px-3 py-1 rounded-full text-body-sm flex items-center gap-1 border transition-colors ' + (mineR ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-surface-container-high border-outline-variant/50 text-on-surface-variant'); chip.innerHTML = '<span>' + em + '</span><span class="font-bold">' + users.length + '</span>'; chip.addEventListener('click', function () { toggleReaction(id, em); }); row.appendChild(chip); });
          var add = document.createElement('button'); add.type = 'button'; add.className = 'react-add w-11 h-11 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors'; add.innerHTML = '<span class="material-symbols-outlined text-[22px]">add_reaction</span>'; add.addEventListener('click', function (e) { e.stopPropagation(); openPicker(e.currentTarget, id); }); row.appendChild(add);
        }
        async function toggleReaction(id, em) { if (!me.id) return; var data = reactionsMap[id] || (reactionsMap[id] = {}); var users = data[em] || (data[em] = []); var have = users.indexOf(me.id) !== -1; if (have) data[em] = users.filter(function (u) { return u !== me.id; }); else users.push(me.id); renderReactions(id); if (have) await sb.from('comu_message_reactions').delete().eq('message_id', id).eq('user_id', me.id).eq('reaction', em); else await sb.from('comu_message_reactions').insert({ message_id: id, user_id: me.id, reaction: em }); }
        async function loadReactions(ids) { if (!ids || !ids.length) return; var r = await sb.from('comu_message_reactions').select('message_id,user_id,reaction').in('message_id', ids); if (self.destroyed) return; (r.data || []).forEach(function (x) { var d = reactionsMap[x.message_id] || (reactionsMap[x.message_id] = {}); var u = d[x.reaction] || (d[x.reaction] = []); if (u.indexOf(x.user_id) === -1) u.push(x.user_id); }); ids.forEach(renderReactions); }
        function applyReactionEvent(type, row) { if (!row || !row.message_id) return; if (!msgsEl.querySelector('[data-react="' + row.message_id + '"]')) return; var d = reactionsMap[row.message_id] || (reactionsMap[row.message_id] = {}); var u = d[row.reaction] || (d[row.reaction] = []); if (type === 'INSERT') { if (u.indexOf(row.user_id) === -1) u.push(row.user_id); } else { d[row.reaction] = u.filter(function (x) { return x !== row.user_id; }); } renderReactions(row.message_id); }

        // ---- carrega histórico + realtime ----
        if (topic) {
          var lr = await sb.from('comu_messages').select('*').eq('topic_id', topic.id).neq('status', 'deleted').order('created_at', { ascending: true }).limit(200);
          if (self.destroyed) return;
          loadingEl.classList.add('hidden');
          if (!lr.error && lr.data && lr.data.length) {
            lr.data.forEach(function (m) { addMessage(m, false); });
            scrollBottom(); requestAnimationFrame(scrollBottom); setTimeout(function () { if (!self.destroyed) scrollBottom(); }, 250);
            loadReactions(lr.data.map(function (m) { return m.id; }));
          }
          else emptyEl.classList.remove('hidden');
          if (isSupport) {
            // Suporte (1:1): postgres_changes basta (sem fan-out)
            self.channels.push(sb.channel('comu-' + topic.id)
              .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_messages', filter: 'topic_id=eq.' + topic.id }, function (p) { addMessage(p.new, nearBottom()); if (p.new && p.new.kind === 'system') refreshTicketInfo(); })
              .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comu_messages', filter: 'topic_id=eq.' + topic.id }, function (p) { updateMessage(p.new); })
              .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comu_messages' }, function (p) { if (p.old && p.old.id) removeMessage(p.old.id); })
              .subscribe());
          } else {
            // Grupo: BROADCAST (escala p/ centenas). Se o broadcast falhar,
            // cai automaticamente em postgres_changes (o chat nunca quebra).
            var pgFallbackOn = false;
            var enablePgFallback = function () {
              if (pgFallbackOn || self.destroyed) return; pgFallbackOn = true;
              self.channels.push(sb.channel('comu-' + topic.id)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_messages', filter: 'topic_id=eq.' + topic.id }, function (p) { addMessage(p.new, nearBottom()); })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comu_messages', filter: 'topic_id=eq.' + topic.id }, function (p) { updateMessage(p.new); })
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comu_messages' }, function (p) { if (p.old && p.old.id) removeMessage(p.old.id); })
                .subscribe());
              self.channels.push(sb.channel('comu-react-' + topic.id)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_message_reactions' }, function (p) { applyReactionEvent('INSERT', p.new); })
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comu_message_reactions' }, function (p) { applyReactionEvent('DELETE', p.old); })
                .subscribe());
            };
            try { var _sess = (await sb.auth.getSession()).data.session; if (_sess) await Promise.resolve(sb.realtime.setAuth(_sess.access_token)); } catch (e) {}
            if (self.destroyed) return;
            self.channels.push(sb.channel('topic:' + topic.id, { config: { private: true } })
              .on('broadcast', { event: 'INSERT' }, function (m) { if (m && m.payload && m.payload.record) addMessage(m.payload.record, nearBottom()); })
              .on('broadcast', { event: 'UPDATE' }, function (m) { if (m && m.payload && m.payload.record) updateMessage(m.payload.record); })
              .on('broadcast', { event: 'DELETE' }, function (m) { var r = m && m.payload && (m.payload.old_record || m.payload.record); if (r && r.id) removeMessage(r.id); })
              .on('broadcast', { event: 'reaction' }, function (m) { var p = m && m.payload; if (p && p.message_id) applyReactionEvent(p.op, { message_id: p.message_id, user_id: p.user_id, reaction: p.reaction }); })
              .subscribe(function (status) { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') enablePgFallback(); }));
          }
          refreshTicketInfo();
          if (me.id) { sb.from('comu_topic_reads').upsert({ topic_id: topic.id, user_id: me.id, last_read_at: new Date().toISOString() }, { onConflict: 'topic_id,user_id' }).then(function () { G.applyUnread(); }, function () {}); }
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
          self.mediaRecorder.start(); self.recSeconds = 0; updateRecTime(); self.recTimer = setInterval(function () { self.recSeconds++; updateRecTime(); }, 1000); setRecUI(true);
        }
        function cancelRecording() { if (self.recTimer) clearInterval(self.recTimer); if (self.mediaRecorder && self.mediaRecorder.state !== 'inactive') { self.mediaRecorder.onstop = function () { stopStream(); }; try { self.mediaRecorder.stop(); } catch (e) { stopStream(); } } else stopStream(); self.recChunks = []; setRecUI(false); }
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
        if (micBtn) micBtn.addEventListener('click', function () { if (!self.recording) startRecording(); });
        var recCancelBtn = document.getElementById('rec-cancel');
        if (recCancelBtn) recCancelBtn.addEventListener('click', function () { if (self.recording) { cancelRecording(); G.toast('Gravação cancelada'); } });
        var recSendBtn = document.getElementById('rec-send');
        if (recSendBtn) recSendBtn.addEventListener('click', function () { if (self.recording) finishRecording(); });

        // ---- envio de texto ----
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          if (self.recording) { finishRecording(); return; }
          var body = input.value.trim(); if (!body || !topic || !me.id) { input.value = ''; return; }
          input.value = '';
          var ins;
          if (isSupport) ins = await sb.rpc('comu_send_support_message', { p_body: body, p_kind: 'text', p_author_name: me.full_name || 'Membro' });
          else ins = await sb.from('comu_messages').insert({ topic_id: topic.id, author_id: me.id, kind: 'text', body: body, author_name: me.full_name || 'Membro', author_avatar: me.avatar_url || null }).select().single();
          if (ins.error) { console.error(ins.error); input.value = body; return; }
          if (!self.destroyed) addMessage(ins.data, true); if (isSupport) refreshTicketInfo();
        });
      }
    };
  })();

  // =====================================================================
  // ENVIAR MÍDIA
  // =====================================================================
  GVSI.views.enviar = {
    destroy: function () {},
    render: async function (view, params) {
      var slug = params.topico; var me = G.me || {}; var back = '#/chat/' + encodeURIComponent(slug || '');
      view.innerHTML =
        '<header class="fixed top-0 left-0 right-0 lg:left-[360px] z-40 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] flex items-center justify-between px-container-margin h-14">' +
          '<a class="text-primary flex items-center" href="' + back + '" aria-label="Fechar"><span class="material-symbols-outlined">close</span></a>' +
          '<h1 class="font-headline-sm text-headline-sm font-bold text-primary">Enviar Mídia</h1>' +
          '<button type="button" data-theme-toggle class="lg:hidden text-primary flex items-center" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button>' +
          '<div class="hidden lg:block w-9"></div>' +
        '</header>' +
        '<main class="lg:pl-[360px] pt-20 pb-28 px-container-margin"><div class="max-w-3xl mx-auto space-y-lg">' +
          '<section class="grid grid-cols-3 gap-sm">' +
            '<button type="button" id="act-camera" class="bg-surface-container-high rounded-xl p-md flex flex-col items-center justify-center gap-sm shadow-sm active:scale-[0.98] transition-all"><div class="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-3xl">photo_camera</span></div><div class="text-center"><h3 class="font-headline-sm text-headline-sm text-primary">Foto</h3><p class="text-body-sm text-on-surface-variant">Câmera/galeria</p></div></button>' +
            '<button type="button" id="act-video" class="bg-tertiary-container rounded-xl p-md flex flex-col items-center justify-center gap-sm shadow-sm active:scale-[0.98] transition-all"><div class="w-14 h-14 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-3xl">videocam</span></div><div class="text-center"><h3 class="font-headline-sm text-headline-sm text-on-tertiary-container">Vídeo</h3><p class="text-body-sm text-on-tertiary-container/80">Câmera/galeria</p></div></button>' +
            '<button type="button" id="act-audio" class="bg-secondary-container rounded-xl p-md flex flex-col items-center justify-center gap-sm shadow-sm active:scale-95"><div class="w-14 h-14 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-3xl">mic</span></div><div class="text-center"><h3 class="font-headline-sm text-headline-sm text-on-secondary-container">Áudio</h3><p class="text-body-sm text-on-secondary-container/80">Arquivo</p></div></button>' +
          '</section>' +
          '<input id="file-camera" type="file" accept="image/*" class="hidden"><input id="file-video" type="file" accept="video/*" class="hidden"><input id="file-audio" type="file" accept="audio/*" class="hidden">' +
          '<section class="bg-surface-container-low rounded-xl p-lg border border-outline-variant shadow-sm space-y-md">' +
            '<div id="preview-empty" class="flex flex-col items-center justify-center text-center gap-sm py-lg"><span class="material-symbols-outlined text-[40px] text-outline">image</span><p class="text-body-sm text-on-surface-variant max-w-xs">Escolha uma foto ou um áudio para pré-visualizar aqui.</p></div>' +
            '<div id="preview" class="hidden"><div class="flex gap-md items-start"><div id="preview-thumb" class="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-high flex items-center justify-center text-outline"></div><div class="flex-grow min-w-0 space-y-sm"><div class="flex items-center justify-between gap-sm"><span id="preview-name" class="font-label-md text-label-md text-on-surface-variant truncate">arquivo</span><button type="button" id="preview-remove" class="text-error text-xs hover:underline font-semibold shrink-0">Remover</button></div><textarea id="caption" class="w-full bg-transparent border-none focus:ring-0 text-body-md placeholder:text-outline p-0 resize-none h-16 text-on-surface" placeholder="Adicione uma legenda (opcional)..."></textarea></div></div><audio id="preview-audio" controls class="hidden w-full mt-sm"></audio><video id="preview-video" controls class="hidden w-full mt-sm rounded-lg" style="max-height:16rem"></video></div>' +
          '</section>' +
        '</div></main>' +
        '<div class="fixed bottom-0 left-0 right-0 lg:left-[360px] z-40 bg-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] rounded-t-xl px-container-margin py-md"><div class="max-w-3xl mx-auto flex items-center justify-between gap-md"><p id="target-label" class="hidden md:flex items-center gap-xs text-body-sm text-on-surface-variant"><span class="material-symbols-outlined text-[18px]">groups</span> Compartilhar no grupo</p><button id="btn-send" type="button" disabled class="flex-grow md:flex-none bg-primary text-on-primary h-12 px-xl rounded-full font-headline-sm text-headline-sm flex items-center justify-center gap-sm shadow-md active:scale-95 transition-all disabled:opacity-50"><span id="btn-send-label">Enviar para o grupo</span><span class="material-symbols-outlined">send</span></button></div></div>';

      var topic = null;
      if (slug) { var tr = await sb.from('comu_topics').select('id,name,slug,post_policy').eq('slug', slug).maybeSingle(); topic = tr.data; if (topic) document.getElementById('target-label').innerHTML = '<span class="material-symbols-outlined text-[18px]">groups</span> ' + esc(topic.name); }
      var selectedFile = null, selectedKind = null;
      function humanSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }
      function clearSel() { selectedFile = null; selectedKind = null; document.getElementById('preview').classList.add('hidden'); document.getElementById('preview-empty').classList.remove('hidden'); document.getElementById('btn-send').disabled = true; var a = document.getElementById('preview-audio'); a.classList.add('hidden'); a.src = ''; var v = document.getElementById('preview-video'); if (v) { v.classList.add('hidden'); v.removeAttribute('src'); } }
      function showSel(file, kind) { selectedFile = file; selectedKind = kind; document.getElementById('preview-empty').classList.add('hidden'); document.getElementById('preview').classList.remove('hidden'); document.getElementById('preview-name').textContent = file.name + ' · ' + humanSize(file.size); var thumb = document.getElementById('preview-thumb'), audio = document.getElementById('preview-audio'), video = document.getElementById('preview-video'); var url = URL.createObjectURL(file); audio.classList.add('hidden'); if (video) video.classList.add('hidden'); if (kind === 'image') { thumb.innerHTML = '<img src="' + url + '" class="w-full h-full object-cover" alt="">'; } else if (kind === 'video') { thumb.innerHTML = '<span class="material-symbols-outlined text-[32px]">movie</span>'; if (video) { video.src = url; video.classList.remove('hidden'); } } else { thumb.innerHTML = '<span class="material-symbols-outlined text-[32px]">graphic_eq</span>'; audio.src = url; audio.classList.remove('hidden'); } document.getElementById('btn-send').disabled = false; }
      document.getElementById('act-camera').addEventListener('click', function () { document.getElementById('file-camera').click(); });
      document.getElementById('act-video').addEventListener('click', function () { document.getElementById('file-video').click(); });
      document.getElementById('act-audio').addEventListener('click', function () { document.getElementById('file-audio').click(); });
      document.getElementById('file-camera').addEventListener('change', function () { if (this.files[0]) showSel(this.files[0], 'image'); });
      document.getElementById('file-video').addEventListener('change', function () { if (this.files[0]) showSel(this.files[0], 'video'); });
      document.getElementById('file-audio').addEventListener('change', function () { if (this.files[0]) showSel(this.files[0], 'audio'); });
      document.getElementById('preview-remove').addEventListener('click', clearSel);
      document.getElementById('btn-send').addEventListener('click', async function () {
        if (!selectedFile || !topic) return; var btn = document.getElementById('btn-send'); btn.disabled = true; document.getElementById('btn-send-label').textContent = 'Enviando...';
        try {
          var ext = (selectedFile.name.split('.').pop() || (selectedKind === 'image' ? 'jpg' : (selectedKind === 'video' ? 'mp4' : 'm4a'))).toLowerCase();
          var path = slug + '/' + me.id + '/' + Date.now() + '.' + ext;
          var up = await sb.storage.from('comu-media').upload(path, selectedFile, { upsert: true, contentType: selectedFile.type || undefined }); if (up.error) throw up.error;
          var url = sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
          var caption = document.getElementById('caption').value.trim() || null;
          var res;
          if (topic.post_policy === 'support') res = await sb.rpc('comu_send_support_message', { p_body: caption, p_kind: selectedKind, p_media_url: url, p_author_name: me.full_name || 'Membro' });
          else res = await sb.from('comu_messages').insert({ topic_id: topic.id, author_id: me.id, kind: selectedKind, body: caption, media_url: url, media_meta: { name: selectedFile.name, size: selectedFile.size, mime: selectedFile.type }, author_name: me.full_name || 'Membro', author_avatar: me.avatar_url || null }).select().single();
          if (res.error) throw res.error;
          G.navigate(back);
        } catch (err) { btn.disabled = false; document.getElementById('btn-send-label').textContent = 'Enviar para o grupo'; G.toast('Erro ao enviar: ' + (err && err.message ? err.message : err)); }
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
        '<header class="lg:hidden fixed top-0 left-0 right-0 z-50 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] h-14 flex items-center justify-between px-container-margin"><a href="#/" class="text-primary flex items-center" aria-label="Voltar"><span class="material-symbols-outlined">arrow_back</span></a><h1 class="font-headline-sm text-headline-sm font-bold text-primary">Meu Perfil</h1><button type="button" data-theme-toggle class="text-primary flex items-center" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button></header>' +
        '<div class="lg:pl-[360px] min-h-screen"><div class="pt-14 lg:pt-lg pb-20 lg:pb-8 px-container-margin max-w-3xl mx-auto space-y-lg">' +
          '<h1 class="hidden lg:block font-headline-md text-headline-md text-on-surface pt-sm">Meu Perfil</h1>' +
          '<section class="grid grid-cols-1 md:grid-cols-3 gap-md">' +
            '<div class="md:col-span-2 bg-surface-container-lowest rounded-xl p-lg shadow-[0px_4px_20px_rgba(0,0,0,0.05)] flex flex-col items-center md:flex-row md:items-start gap-lg border border-outline-variant/30">' +
              '<button type="button" data-edit-open class="relative shrink-0 active:scale-95 transition-transform" aria-label="Alterar foto"><span id="pf-avatar" class="w-24 h-24 rounded-full bg-surface-container-high ring-4 ring-primary-container/20 flex items-center justify-center text-outline overflow-hidden"><span class="material-symbols-outlined text-[48px]">person</span></span><span class="absolute bottom-0 right-0 bg-primary text-on-primary p-1.5 rounded-full border-2 border-surface-container-lowest shadow-sm"><span class="material-symbols-outlined text-[16px]">photo_camera</span></span></button>' +
              '<div class="flex-1 text-center md:text-left space-y-xs min-w-0"><div class="flex items-center justify-center md:justify-start gap-sm flex-wrap"><h2 id="pf-name" class="font-headline-md text-headline-md text-on-surface">Carregando…</h2><span id="pf-role" class="hidden bg-primary/10 text-primary px-2 py-0.5 rounded-full font-label-md text-label-md border border-primary/20"></span></div><p id="pf-sub" class="font-body-md text-body-md text-on-surface-variant break-words"> </p><div class="pt-sm"><button type="button" data-edit-open class="inline-flex items-center gap-xs bg-primary/10 text-primary px-4 py-2 rounded-full font-label-md text-label-md border border-primary/20 active:scale-95 transition-transform"><span class="material-symbols-outlined text-[16px]">edit</span> Editar perfil</button></div></div>' +
            '</div>' +
            '<div class="bg-surface-container-high rounded-xl p-lg shadow-sm border border-outline-variant/20 flex flex-col justify-center items-center text-center space-y-md"><div class="grid grid-cols-2 gap-md w-full"><div class="flex flex-col items-center"><span id="pf-msgcount" class="font-headline-sm text-headline-sm text-primary">0</span><span class="font-label-md text-label-md text-on-surface-variant">Mensagens</span></div><div class="flex flex-col items-center"><span class="font-headline-sm text-headline-sm text-secondary">0</span><span class="font-label-md text-label-md text-on-surface-variant">Conquistas</span></div></div><a href="#conquistas" class="w-full h-12 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center">Ver conquistas</a></div>' +
          '</section>' +
          '<section class="space-y-md"><h3 class="font-headline-sm text-headline-sm text-on-surface">Recursos</h3><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">' +
            '<a href="#/chat/suporte" class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-lg flex flex-col justify-between h-44 hover:shadow-md active:scale-[0.98] transition-all"><div class="bg-primary/10 text-primary p-2 rounded-lg w-fit"><span class="material-symbols-outlined">support_agent</span></div><div><h4 class="font-headline-sm text-headline-sm text-on-surface">Suporte GVSI</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Fale com a equipe de suporte.</p></div></a>' +
            '<button type="button" data-soon class="text-left bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-lg flex flex-col justify-between h-44 hover:shadow-md active:scale-[0.98] transition-all"><div class="bg-primary/10 text-primary p-2 rounded-lg w-fit"><span class="material-symbols-outlined">library_books</span></div><div><h4 class="font-headline-sm text-headline-sm text-on-surface">Guia do Trader</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Gerenciamento de risco e consistência.</p></div></button>' +
            '<a href="#/" class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-lg flex flex-col justify-between h-44 hover:shadow-md active:scale-[0.98] transition-all"><div class="bg-secondary-container/30 text-on-secondary-container p-2 rounded-lg w-fit"><span class="material-symbols-outlined">forum</span></div><div><h4 class="font-headline-sm text-headline-sm text-on-surface">Fórum de Trades</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Volte para os grupos da comunidade.</p></div></a>' +
          '</div></section>' +
          '<section id="conquistas" class="space-y-md"><h3 class="font-headline-sm text-headline-sm text-on-surface">Conquistas</h3><div class="bg-surface-container-lowest rounded-xl p-xl border border-outline-variant/30 flex flex-col items-center justify-center text-center gap-sm"><span class="material-symbols-outlined text-[40px] text-outline">workspace_premium</span><p class="text-body-sm text-on-surface-variant max-w-xs">Suas conquistas e certificações aparecerão aqui conforme você participa da comunidade.</p></div></section>' +
          '<section class="bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden"><div class="divide-y divide-outline-variant/20">' +
            '<button type="button" data-edit-open class="w-full flex items-center justify-between p-lg hover:bg-surface-container-high transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">person_edit</span><span class="font-body-md text-body-md text-on-surface">Editar perfil</span></div><span class="material-symbols-outlined text-outline">chevron_right</span></button>' +
            '<button type="button" data-soon class="w-full flex items-center justify-between p-lg hover:bg-surface-container-high transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">shield</span><span class="font-body-md text-body-md text-on-surface">Privacidade e segurança</span></div><span class="material-symbols-outlined text-outline">chevron_right</span></button>' +
            '<button type="button" data-soon class="w-full flex items-center justify-between p-lg hover:bg-surface-container-high transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-primary">notifications</span><span class="font-body-md text-body-md text-on-surface">Configurações de notificação</span></div><span class="material-symbols-outlined text-outline">chevron_right</span></button>' +
            '<button type="button" data-signout class="w-full flex items-center justify-between p-lg hover:bg-error/10 transition-colors text-left"><div class="flex items-center gap-md"><span class="material-symbols-outlined text-error">logout</span><span class="font-body-md text-body-md text-error">Sair da conta</span></div></button>' +
          '</div></section>' +
        '</div></div>' +
        '<nav class="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-xl bg-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] h-16 flex justify-around items-center px-2"><a class="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1" href="#/"><span class="material-symbols-outlined">groups</span><span class="font-label-md text-label-md">Grupos</span></a><a class="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-4 py-1" href="#/perfil"><span class="material-symbols-outlined fill">person</span><span class="font-label-md text-label-md">Meu Perfil</span></a></nav>' +
        '<div id="edit-modal" class="hidden fixed inset-0 z-[60] items-center justify-center p-container-margin bg-black/40"><div class="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-lg space-y-md max-h-[90vh] overflow-y-auto custom-scrollbar"><div class="flex items-center justify-between"><h3 class="font-headline-sm text-headline-sm text-on-surface">Editar perfil</h3><button type="button" data-edit-close class="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high" aria-label="Fechar"><span class="material-symbols-outlined">close</span></button></div>' +
          '<form id="edit-form" class="space-y-md"><div class="flex items-center gap-md"><span class="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-outline overflow-hidden shrink-0"><span id="ef-avatar-icon" class="material-symbols-outlined text-[32px]">person</span><img id="ef-avatar-preview" class="hidden w-16 h-16 object-cover" alt=""></span><button type="button" id="ef-avatar-btn" class="text-primary text-label-md font-label-md flex items-center gap-xs"><span class="material-symbols-outlined text-[18px]">photo_camera</span> Alterar foto</button><input id="ef-avatar-input" type="file" accept="image/*" class="hidden"></div>' +
          '<div><label for="ef-name" class="block text-label-md font-label-md text-on-surface-variant mb-xs">Nome</label><input id="ef-name" type="text" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-body-md text-on-surface" placeholder="Seu nome"></div>' +
          '<div><label for="ef-bio" class="block text-label-md font-label-md text-on-surface-variant mb-xs">Bio</label><textarea id="ef-bio" rows="2" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-body-md text-on-surface resize-none" placeholder="Fale um pouco sobre você"></textarea></div>' +
          '<div><label for="ef-phone" class="block text-label-md font-label-md text-on-surface-variant mb-xs">Telefone</label><input id="ef-phone" type="tel" class="w-full bg-surface-container-low border border-outline-variant rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary text-body-md text-on-surface" placeholder="(00) 00000-0000"></div>' +
          '<p id="ef-msg" class="hidden text-body-sm text-center"></p>' +
          '<div class="flex gap-sm pt-sm"><button type="button" data-edit-close class="flex-1 h-11 rounded-xl border border-outline-variant text-on-surface font-label-md">Cancelar</button><button id="ef-save" type="submit" class="flex-1 h-11 rounded-xl bg-primary text-on-primary font-label-md">Salvar</button></div></form></div></div>';

      function avatarHtml() { return me.avatar_url ? '<img src="' + esc(me.avatar_url) + '" class="w-full h-full object-cover" alt="">' : '<span class="material-symbols-outlined" style="font-size:48px">person</span>'; }
      function fillUI() {
        document.getElementById('pf-name').textContent = me.full_name || 'Complete seu perfil';
        document.getElementById('pf-sub').textContent = me.bio || me.email || 'Adicione uma bio ao seu perfil.';
        document.getElementById('pf-avatar').innerHTML = avatarHtml();
        var badge = document.getElementById('pf-role');
        if (me.role === 'admin' || me.role === 'suporte') { badge.textContent = me.role === 'admin' ? 'Administrador' : 'Suporte'; badge.classList.remove('hidden'); } else badge.classList.add('hidden');
        G.updateSidebarProfile(); document.title = 'GVSI Comunidade — ' + (me.full_name || 'Meu Perfil');
      }
      fillUI();
      sb.from('comu_messages').select('id', { count: 'exact', head: true }).eq('author_id', me.id).then(function (r) { var el = document.getElementById('pf-msgcount'); if (el) el.textContent = r.count || 0; });

      var modal = document.getElementById('edit-modal');
      function openEdit() {
        document.getElementById('ef-name').value = me.full_name || ''; document.getElementById('ef-bio').value = me.bio || ''; document.getElementById('ef-phone').value = me.phone || ''; document.getElementById('ef-msg').classList.add('hidden');
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
        var payload = { full_name: document.getElementById('ef-name').value.trim() || null, bio: document.getElementById('ef-bio').value.trim() || null, phone: document.getElementById('ef-phone').value.trim() || null, avatar_url: me.avatar_url || null };
        document.getElementById('ef-save').disabled = true;
        var up = await sb.from('lms_students').update(payload).eq('id', me.id).select().single();
        document.getElementById('ef-save').disabled = false;
        if (up.error) { efMsg('Erro ao salvar: ' + up.error.message, false); return; }
        Object.assign(me, up.data); G.me = me; fillUI(); closeEdit(); G.toast('Perfil atualizado ✅');
      });
      document.querySelectorAll('[data-soon]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); G.toast('Em breve.'); }); });
    }
  };

  // =====================================================================
  // SUPORTE (console do atendente — só admin)
  // =====================================================================
  GVSI.views.suporte = (function () {
    var S = null;
    function cleanup() { if (!S) return; S.destroyed = true; (S.channels || []).forEach(function (c) { try { sb.removeChannel(c); } catch (e) {} }); S = null; }
    return {
      destroy: cleanup,
      render: async function (view) {
        var me = G.me || {};
        if (me.role !== 'admin') { G.navigate('#/'); return; }
        S = { destroyed: false, channels: [], currentTicket: null, filter: 'todos', seen: Object.create(null), convoChannel: null };
        var self = S;
        view.innerHTML =
          '<header class="fixed top-0 left-0 right-0 z-50 bg-surface shadow-[0px_4px_20px_rgba(0,0,0,0.05)] h-14 flex items-center justify-between px-container-margin"><button type="button" id="suporte-back" class="flex items-center gap-sm text-primary" aria-label="Voltar"><span class="material-symbols-outlined">arrow_back</span><span class="font-headline-sm text-headline-sm font-bold">Suporte · Atendimento</span></button><div class="flex items-center gap-xs"><button type="button" data-theme-toggle class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors" aria-label="Tema"><span class="material-symbols-outlined" data-theme-icon>dark_mode</span></button><button type="button" data-signout class="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors" aria-label="Sair"><span class="material-symbols-outlined">logout</span></button></div></header>' +
          '<div class="pt-14 h-[100dvh] flex">' +
            '<aside id="list-panel" class="w-full lg:w-[380px] lg:border-r border-outline-variant flex flex-col shrink-0"><div class="p-sm flex gap-1 border-b border-outline-variant"><button data-filter="todos" class="flex-1 py-2 rounded-lg text-label-md font-label-md bg-primary text-on-primary transition-colors">Todos</button><button data-filter="pendentes" class="flex-1 py-2 rounded-lg text-label-md font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors">Pendentes</button><button data-filter="resolvidos" class="flex-1 py-2 rounded-lg text-label-md font-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors">Resolvidos</button></div><div id="ticket-list" class="flex-1 overflow-y-auto custom-scrollbar"><p class="p-lg text-center text-on-surface-variant text-body-sm">Carregando…</p></div></aside>' +
            '<section id="convo-panel" class="hidden lg:flex flex-1 flex-col min-w-0"><div id="convo-empty" class="flex-1 flex flex-col items-center justify-center text-center gap-md p-xl text-on-surface-variant"><span class="material-symbols-outlined text-[48px]">forum</span><p class="text-body-md max-w-xs">Selecione uma conversa para ver o histórico e responder.</p></div>' +
              '<div id="convo-main" class="hidden flex-1 flex-col min-h-0"><div class="h-16 shrink-0 border-b border-outline-variant px-md flex items-center"><div class="max-w-3xl mx-auto w-full flex items-center gap-md"><button id="convo-back" class="lg:hidden text-primary flex items-center" aria-label="Voltar"><span class="material-symbols-outlined">arrow_back</span></button><span class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-outline shrink-0"><span class="material-symbols-outlined">person</span></span><div class="flex-1 min-w-0"><h2 id="convo-name" class="font-bold text-on-surface truncate">—</h2><p id="convo-protocol" class="text-body-sm text-outline truncate">—</p></div><button id="btn-resolve" class="bg-primary text-on-primary rounded-full px-4 py-2 text-label-md font-label-md active:scale-95 transition disabled:opacity-60 flex items-center gap-xs"><span class="material-symbols-outlined text-[18px]">check_circle</span><span id="btn-resolve-label">Marcar como resolvido</span></button></div></div>' +
                '<div id="convo-scroll" class="flex-1 overflow-y-auto custom-scrollbar p-md"><div id="convo-messages" class="flex flex-col gap-md max-w-3xl mx-auto w-full"></div></div>' +
                '<form id="convo-form" class="shrink-0 border-t border-outline-variant p-sm"><div class="max-w-3xl mx-auto w-full flex flex-col gap-sm"><input id="convo-input" type="text" autocomplete="off" placeholder="Responder…" class="w-full bg-surface-container-low border border-outline-variant rounded-xl px-md py-3 text-body-md focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant"><div class="flex flex-wrap items-center gap-sm"><button type="button" id="convo-attach" class="h-11 px-3 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-xs shrink-0" aria-label="Anexar foto ou vídeo"><span class="material-symbols-outlined text-[24px]">attach_file</span><span class="text-body-sm font-label-md">Anexar</span></button><button type="button" id="convo-audio-btn" class="h-11 px-3 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-xs shrink-0" aria-label="Enviar áudio"><span class="material-symbols-outlined text-[24px]">mic</span><span class="text-body-sm font-label-md">Áudio</span></button><button type="submit" class="h-11 px-5 ml-auto bg-primary text-on-primary rounded-xl flex items-center gap-xs shadow-lg active:scale-95 transition-all shrink-0" aria-label="Enviar"><span class="material-symbols-outlined fill text-[24px]">send</span><span class="text-body-md font-bold">Enviar</span></button></div></div><input id="convo-file-media" type="file" accept="image/*,video/*" class="hidden"><input id="convo-file-audio" type="file" accept="audio/*" class="hidden"></form></div>' +
            '</section>' +
          '</div>';
        var topicRes = await sb.from('comu_topics').select('id').eq('slug', 'suporte').single(); if (self.destroyed) return;
        var supportTopicId = topicRes.data.id;
        function statusLabel(s) { return s === 'aberto' ? 'Pendente' : (s === 'resolvido' ? 'Resolvido' : 'Fechado'); }
        function statusClass(s) { return s === 'aberto' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-secondary-container text-on-secondary-container'; }
        function timeShort(iso) { try { var d = new Date(iso); if (Date.now() - d.getTime() < 86400000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); return d.toLocaleDateString('pt-BR'); } catch (e) { return ''; } }
        async function loadTickets() {
          var q = sb.from('comu_support_tickets').select('*, member:lms_students!user_id(full_name,avatar_url,email)').order('last_message_at', { ascending: false });
          if (self.filter === 'pendentes') q = q.eq('status', 'aberto'); if (self.filter === 'resolvidos') q = q.in('status', ['resolvido', 'fechado']);
          var r = await q; if (self.destroyed) return;
          var list = document.getElementById('ticket-list'); list.innerHTML = '';
          if (r.error) { list.innerHTML = '<p class="p-md text-error text-body-sm">' + esc(r.error.message) + '</p>'; return; }
          if (!r.data.length) { list.innerHTML = '<p class="p-lg text-center text-on-surface-variant text-body-sm">Nenhuma conversa.</p>'; return; }
          r.data.forEach(function (tk) {
            var m = tk.member || {}; var el = document.createElement('button');
            el.className = 'w-full text-left flex items-center gap-md p-md hover:bg-surface-container-low transition-colors border-b border-outline-variant/30 ' + (self.currentTicket && self.currentTicket.id === tk.id ? 'bg-surface-container-high' : '');
            el.innerHTML = '<span class="w-11 h-11 rounded-full bg-surface-container-high flex items-center justify-center text-outline overflow-hidden shrink-0">' + (m.avatar_url ? '<img src="' + esc(m.avatar_url) + '" class="w-full h-full object-cover">' : '<span class="material-symbols-outlined">person</span>') + '</span><span class="flex-1 min-w-0"><span class="flex items-center justify-between gap-xs"><span class="font-bold text-on-surface truncate">' + esc(m.full_name || 'Membro') + '</span><span class="text-[13px] text-on-surface-variant shrink-0">' + timeShort(tk.last_message_at) + '</span></span><span class="flex items-center justify-between gap-xs mt-0.5"><span class="text-body-sm text-outline truncate">' + esc(tk.protocol) + '</span><span class="text-[10px] px-2 py-0.5 rounded-full ' + statusClass(tk.status) + '">' + statusLabel(tk.status) + '</span></span></span>';
            el.addEventListener('click', function () { openTicket(tk); }); list.appendChild(el);
          });
        }
        function addMsg(msg) {
          if (self.seen[msg.id]) return; self.seen[msg.id] = true;
          var container = document.getElementById('convo-messages');
          if (msg.kind === 'system') {
            var note = document.createElement('div'); note.className = 'self-center max-w-md text-center text-body-sm text-on-surface-variant bg-surface-container-high rounded-2xl px-4 py-2 my-xs';
            note.textContent = msg.body || ''; container.appendChild(note); return;
          }
          var mine = msg.author_id === me.id;
          var content;
          if (msg.kind === 'image' && msg.media_url) content = '<img src="' + esc(msg.media_url) + '" class="rounded-lg max-w-full">';
          else if (msg.kind === 'video' && msg.media_url) content = '<video controls preload="metadata" src="' + esc(msg.media_url) + '" class="rounded-lg max-w-full" style="max-height:20rem"></video>';
          else if (msg.kind === 'audio' && msg.media_url) content = '<audio controls src="' + esc(msg.media_url) + '" class="max-w-full"></audio>';
          else content = '<p class="font-body-md whitespace-pre-wrap break-words ' + (mine ? '' : 'text-on-surface') + '">' + esc(msg.body) + '</p>';
          var wrap = document.createElement('div');
          if (mine) { wrap.className = 'flex flex-col items-end gap-xs max-w-[80%] self-end'; wrap.innerHTML = '<div class="message-gradient-outgoing text-white rounded-xl rounded-tr-none p-md shadow">' + content + '</div>'; }
          else { wrap.className = 'flex flex-col items-start gap-xs max-w-[80%]'; wrap.innerHTML = '<span class="text-label-md font-label-md text-on-surface-variant ml-sm">' + esc(msg.author_name || 'Membro') + '</span><div class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl rounded-tl-none p-md">' + content + '</div>'; }
          container.appendChild(wrap);
        }
        function scrollConvo() { var s = document.getElementById('convo-scroll'); s.scrollTop = s.scrollHeight; }
        function updateResolveBtn() { var lbl = document.getElementById('btn-resolve-label'), b = document.getElementById('btn-resolve'); if (self.currentTicket && self.currentTicket.status === 'aberto') { lbl.textContent = 'Marcar como resolvido'; b.disabled = false; } else { lbl.textContent = 'Resolvido'; b.disabled = true; } }
        function subscribeConvo(ticketId) { if (self.convoChannel) sb.removeChannel(self.convoChannel); self.convoChannel = sb.channel('ticket-' + ticketId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_messages', filter: 'ticket_id=eq.' + ticketId }, function (p) { addMsg(p.new); scrollConvo(); }).subscribe(); self.channels.push(self.convoChannel); }
        async function openTicket(tk) {
          self.currentTicket = tk; self.seen = Object.create(null);
          document.getElementById('convo-empty').classList.add('hidden'); var cm = document.getElementById('convo-main'); cm.classList.remove('hidden'); cm.classList.add('flex');
          document.getElementById('list-panel').classList.add('hidden'); document.getElementById('convo-panel').classList.remove('hidden');
          var m = tk.member || {}; document.getElementById('convo-name').textContent = m.full_name || 'Membro'; document.getElementById('convo-protocol').textContent = tk.protocol + ' · ' + statusLabel(tk.status); updateResolveBtn();
          document.getElementById('convo-messages').innerHTML = '';
          var r = await sb.from('comu_messages').select('*').eq('ticket_id', tk.id).order('created_at', { ascending: true }); if (self.destroyed) return;
          (r.data || []).forEach(addMsg); scrollConvo(); subscribeConvo(tk.id); loadTickets();
        }
        function closeConvo() {
          if (self.convoChannel) { try { sb.removeChannel(self.convoChannel); } catch (e) {} self.convoChannel = null; }
          self.currentTicket = null;
          var cm = document.getElementById('convo-main'); cm.classList.add('hidden'); cm.classList.remove('flex');
          document.getElementById('convo-empty').classList.remove('hidden');
          document.getElementById('convo-panel').classList.add('hidden');   // mobile: volta pra lista (no desktop lg:flex mantém visível)
          document.getElementById('list-panel').classList.remove('hidden');
          loadTickets();
        }
        // "Voltar" do topo: se tem conversa aberta, volta pra lista; senão sai pra home
        document.getElementById('suporte-back').addEventListener('click', function () { if (self.currentTicket) closeConvo(); else G.navigate('#/'); });
        document.getElementById('convo-back').addEventListener('click', closeConvo);
        document.getElementById('convo-form').addEventListener('submit', async function (e) {
          e.preventDefault(); var body = document.getElementById('convo-input').value.trim(); if (!body || !self.currentTicket) return; document.getElementById('convo-input').value = '';
          var ins = await sb.from('comu_messages').insert({ topic_id: supportTopicId, author_id: me.id, ticket_id: self.currentTicket.id, kind: 'text', body: body, author_name: me.full_name || 'Suporte' }).select().single();
          if (ins.error) { console.error(ins.error); document.getElementById('convo-input').value = body; return; } addMsg(ins.data); scrollConvo();
        });
        async function sendMedia(file, kind) {
          if (!file || !self.currentTicket) return;
          var ext = (file.name.split('.').pop() || (kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : 'm4a')).toLowerCase();
          var path = 'suporte/' + self.currentTicket.id + '/' + Date.now() + '.' + ext;
          var up = await sb.storage.from('comu-media').upload(path, file, { upsert: true, contentType: file.type || undefined });
          if (up.error) { G.toast('Erro no upload: ' + up.error.message); return; }
          var url = sb.storage.from('comu-media').getPublicUrl(path).data.publicUrl;
          var ins = await sb.from('comu_messages').insert({ topic_id: supportTopicId, author_id: me.id, ticket_id: self.currentTicket.id, kind: kind, media_url: url, media_meta: { name: file.name, size: file.size, mime: file.type }, author_name: me.full_name || 'Suporte' }).select().single();
          if (ins.error) { G.toast('Erro ao enviar: ' + ins.error.message); return; }
          addMsg(ins.data); scrollConvo();
        }
        document.getElementById('convo-attach').addEventListener('click', function () { document.getElementById('convo-file-media').click(); });
        document.getElementById('convo-audio-btn').addEventListener('click', function () { document.getElementById('convo-file-audio').click(); });
        document.getElementById('convo-file-media').addEventListener('change', function () { var f = this.files[0]; if (f) sendMedia(f, (f.type || '').indexOf('video') === 0 ? 'video' : 'image'); this.value = ''; });
        document.getElementById('convo-file-audio').addEventListener('change', function () { var f = this.files[0]; if (f) sendMedia(f, 'audio'); this.value = ''; });
        document.getElementById('btn-resolve').addEventListener('click', async function () {
          if (!self.currentTicket || self.currentTicket.status !== 'aberto') return;
          var tid = self.currentTicket.id;
          var up = await sb.from('comu_support_tickets').update({ status: 'resolvido', resolved_at: new Date().toISOString() }).eq('id', tid).select('*, member:lms_students!user_id(full_name,avatar_url,email)').single();
          if (up.error) { console.error(up.error); return; } self.currentTicket = up.data; document.getElementById('convo-protocol').textContent = self.currentTicket.protocol + ' · ' + statusLabel(self.currentTicket.status); updateResolveBtn(); loadTickets();
          var sysIns = await sb.from('comu_messages').insert({ topic_id: supportTopicId, author_id: me.id, ticket_id: tid, kind: 'system', body: 'Conversa finalizada pelo suporte. Se precisar de algo, é só enviar uma nova mensagem que iniciamos um novo atendimento.', author_name: 'Suporte' }).select().single();
          if (!sysIns.error) { addMsg(sysIns.data); scrollConvo(); }
        });
        document.querySelectorAll('[data-filter]').forEach(function (b) { b.addEventListener('click', function () { self.filter = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(function (x) { x.classList.remove('bg-primary', 'text-on-primary'); x.classList.add('text-on-surface-variant'); }); b.classList.add('bg-primary', 'text-on-primary'); b.classList.remove('text-on-surface-variant'); loadTickets(); }); });
        loadTickets();
        self.channels.push(sb.channel('tickets-list').on('postgres_changes', { event: '*', schema: 'public', table: 'comu_support_tickets' }, function () { loadTickets(); }).subscribe());
      }
    };
  })();
})();
