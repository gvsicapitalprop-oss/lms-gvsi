/**
 * GVSI Comunidade — Sala ao vivo (Zoom) no tópico "Sala ao vivo" (21/10/2026).
 *
 * O card no alto do tópico mostra se a aula está acontecendo, a próxima aula (com contagem),
 * o aviso do admin e as próximas aulas (canceladas riscadas). "Entrar na sala" abre a reunião
 * do Zoom aqui dentro, pelo Meeting SDK (componente "embedded"), igual à área de membros
 * (web/src/components/SalaZoom.tsx). Quem não tem acesso nem vê o card: a Edge Function
 * sala-ao-vivo responde 403 e o espaço fica escondido.
 *
 * O SDK vem dos arquivos oficiais do Zoom (source.zoom.us) e só carrega no clique: ele traz o
 * próprio React 18 (vendor) e não pesa para quem só lê o tópico.
 *
 * Uso (views.js, chat): var parar = GVSI.salaCard.mount(elementoDoCard); ... parar();
 */
(function () {
  var G = window.GVSI;
  if (!G) return;
  var VERSAO_ZOOM = '6.5.0';
  var FUSO = 'America/Sao_Paulo';
  var CONSULTA_MS = 30000;

  function esc(s) { return G.esc(s); }

  async function chamar(acao) {
    var r = await G.sb.functions.invoke('sala-ao-vivo', { body: { acao: acao } });
    if (r.error) {
      var status = r.error.context && r.error.context.status;
      var corpo = null;
      try { corpo = await r.error.context.json(); } catch (e) {}
      var err = new Error((corpo && corpo.erro) || r.error.message || 'erro');
      err.status = status || 0;
      err.codigo = corpo && corpo.erro;
      throw err;
    }
    return r.data;
  }

  // ---- datas (sempre no horário de Brasília) ----
  function diaSP(d) { return new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10); }
  function horaSP(iso) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO }).replace(':', 'h');
  }
  /** "quarta 22/10 às 10h30" (ou "hoje às 10h30" / "amanhã às 10h30") */
  function rotulo(iso, agora) {
    var d = new Date(iso);
    var hoje = diaSP(agora), dia = diaSP(d);
    var amanha = diaSP(new Date(agora.getTime() + 86400000));
    if (dia === hoje) return 'hoje às ' + horaSP(iso);
    if (dia === amanha) return 'amanhã às ' + horaSP(iso);
    var sem = d.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: FUSO }).replace(/-feira$/, '');
    var dm = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO });
    return sem + ' ' + dm + ' às ' + horaSP(iso);
  }
  function contagem(ms) {
    if (ms <= 0) return 'agora';
    var min = Math.ceil(ms / 60000);
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return h + 'h' + (m ? ' ' + String(m).padStart(2, '0') + 'min' : '');
    var dd = Math.floor(h / 24), hh = h % 24;
    return dd + (dd === 1 ? ' dia' : ' dias') + (hh ? ' e ' + hh + 'h' : '');
  }

  // =====================================================================
  // Zoom (camada por cima de tudo; não depende da view, só sai pelo "Sair da sala")
  // =====================================================================
  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { ok(); };
      s.onerror = function () { falha(new Error('Não consegui carregar o Zoom. Confira a sua internet.')); };
      document.head.appendChild(s);
    });
  }
  async function carregarSdk() {
    var base = 'https://source.zoom.us/' + VERSAO_ZOOM;
    var libs = ['react', 'react-dom', 'redux', 'redux-thunk', 'lodash'];
    for (var i = 0; i < libs.length; i++) await carregarScript(base + '/lib/vendor/' + libs[i] + '.min.js');
    await carregarScript(base + '/zoom-meeting-embedded-' + VERSAO_ZOOM + '.min.js');
    if (!window.ZoomMtgEmbedded) throw new Error('O Zoom não carregou.');
    return window.ZoomMtgEmbedded;
  }

  var Z = null; // { ov, raiz, cliente, onFs, onKey }

  function fecharZoom() {
    if (!Z) return;
    var z = Z; Z = null;
    try { if (z.cliente && z.cliente.leaveMeeting) z.cliente.leaveMeeting().catch(function () {}); } catch (e) {}
    try { if (window.ZoomMtgEmbedded && window.ZoomMtgEmbedded.destroyClient) window.ZoomMtgEmbedded.destroyClient(); } catch (e) {}
    try { if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); } catch (e) {}
    if (z.onFs) document.removeEventListener('fullscreenchange', z.onFs);
    if (z.ov && z.ov.parentNode) z.ov.remove();
    document.documentElement.style.overflow = '';
  }

  /** Tamanho do vídeo: 16:9 que cabe na área livre. */
  function tamanho(raiz) {
    var w = Math.max(320, raiz.clientWidth - 16), h = Math.max(200, raiz.clientHeight - 16);
    var largura = Math.min(w, Math.round(h * 16 / 9), 1600);
    return { width: largura, height: Math.round(largura * 9 / 16) };
  }

  async function abrirZoom(titulo, aoErro) {
    if (Z) return;
    var ov = document.createElement('div');
    ov.id = 'sala-zoom';
    ov.className = 'fixed inset-0 z-[85] bg-[#0b0d12] flex flex-col';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Sala ao vivo');
    var podeFs = !!(ov.requestFullscreen && document.fullscreenEnabled);
    ov.innerHTML =
      '<div class="shrink-0 flex items-center gap-sm px-container-margin h-14 border-b border-white/10 text-white" style="padding-top:env(safe-area-inset-top)">' +
        '<span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>' +
        '<span class="font-bold truncate flex-1 min-w-0">' + esc(titulo || 'Sala ao vivo') + '</span>' +
        (podeFs ? '<button type="button" id="sala-fs" class="h-10 px-3 rounded-full hover:bg-white/10 flex items-center gap-xs shrink-0" aria-label="Tela cheia" title="Tela cheia"><span class="material-symbols-outlined text-[22px]">fullscreen</span><span class="hidden sm:inline text-body-sm">Tela cheia</span></button>' : '') +
        '<button type="button" id="sala-sair" class="h-10 px-4 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center gap-xs shrink-0 active:scale-95 transition"><span class="material-symbols-outlined text-[20px]">logout</span><span class="text-body-sm font-bold">Sair da sala</span></button>' +
      '</div>' +
      '<div id="sala-zoom-area" class="relative flex-1 min-h-0 overflow-auto flex items-center justify-center">' +
        '<div id="sala-zoom-carregando" class="absolute inset-0 flex flex-col items-center justify-center gap-sm text-white/80 text-body-sm"><span class="material-symbols-outlined animate-spin text-[32px]">progress_activity</span>Entrando na sala…</div>' +
        '<div id="sala-zoom-raiz"></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';
    var area = ov.querySelector('#sala-zoom-area');
    var raiz = ov.querySelector('#sala-zoom-raiz');
    Z = { ov: ov, raiz: raiz, cliente: null, onFs: null };
    var meu = Z;

    ov.querySelector('#sala-sair').addEventListener('click', fecharZoom);
    var fsBtn = ov.querySelector('#sala-fs');
    if (fsBtn) {
      fsBtn.addEventListener('click', function () {
        if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
        else ov.requestFullscreen().catch(function () {});
      });
      Z.onFs = function () {
        var on = document.fullscreenElement === ov;
        fsBtn.querySelector('.material-symbols-outlined').textContent = on ? 'fullscreen_exit' : 'fullscreen';
      };
      document.addEventListener('fullscreenchange', Z.onFs);
    }

    try {
      var dados = await chamar('entrar');
      if (Z !== meu) return;
      var zoom = await carregarSdk();
      if (Z !== meu) return;
      var c = zoom.createClient();
      meu.cliente = c;
      await c.init({
        zoomAppRoot: raiz,
        language: 'pt-PT',
        patchJsMedia: true,
        leaveOnPageUnload: true,
        customize: {
          video: { isResizable: true, viewSizes: { default: tamanho(area) } }
        }
      });
      if (Z !== meu) return;
      // saiu pelo próprio Zoom (botão "Sair" dele, reunião encerrada): fecha a camada
      try {
        c.on('connection-change', function (p) {
          if (p && (p.state === 'Closed' || p.state === 'Fail') && Z === meu) fecharZoom();
        });
      } catch (e) {}
      await c.join({
        signature: dados.signature,
        meetingNumber: dados.meetingNumber,
        password: dados.password,
        userName: dados.userName,
        userEmail: dados.userEmail
      });
      var carr = ov.querySelector('#sala-zoom-carregando'); if (carr) carr.remove();
    } catch (e) {
      if (Z !== meu) return;
      fecharZoom();
      aoErro(mensagemDeErro(e));
    }
  }

  function mensagemDeErro(e) {
    var cod = e && e.codigo;
    if (cod === 'fechada') return 'A sala está fechada agora.';
    if (cod === 'sem-acesso') return 'Sua conta ainda não tem acesso à sala ao vivo.';
    if (cod === 'nao-configurada') return 'A sala ainda não foi configurada. Avise o suporte.';
    if (cod === 'nao-logado') return 'Sua sessão expirou. Entre de novo na sua conta.';
    if (e && e.reason) return 'O Zoom recusou a entrada: ' + e.reason;
    if (e && e.message) return e.message;
    return 'Não consegui entrar na sala.';
  }

  // =====================================================================
  // Card do tópico
  // =====================================================================
  function mount(slot) {
    var st = { parado: false, dados: null, desvio: 0, consulta: null, relogio: null, erro: null, entrando: false };

    function agora() { return new Date(Date.now() + st.desvio); }

    function html() {
      var d = st.dados, now = agora();
      var aberta = !!d.aberta;
      var prox = d.proxima;
      var selo = aberta
        ? '<span class="inline-flex items-center gap-1.5 rounded-full bg-red-600 text-white text-[12px] font-bold tracking-wide px-2.5 py-1"><span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>AO VIVO AGORA</span>'
        : '<span class="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high text-on-surface-variant text-[12px] font-bold tracking-wide px-2.5 py-1"><span class="material-symbols-outlined text-[16px]">schedule</span>SALA FECHADA</span>';
      var linha;
      if (aberta) {
        var at = d.atual;
        linha = at ? 'Aula de ' + esc(rotulo(at.inicio, now)) + ', até ' + esc(horaSP(at.fim)) + '.' : 'A sala está aberta. Pode entrar.';
      } else if (prox) {
        linha = 'Próxima aula: <b class="text-on-surface">' + esc(rotulo(prox.inicio, now)) + '</b>' +
          ' <span data-sala-conta class="whitespace-nowrap">(' + esc(textoConta()) + ')</span>';
      } else {
        linha = 'Nenhuma aula marcada nos próximos dias.';
      }
      var lista = (d.proximas || []).map(function (s) {
        var canc = s.status === 'cancelada';
        var ehAtual = d.atual && s.id === d.atual.id;
        return '<li class="flex items-baseline gap-sm py-1.5 ' + (canc ? 'text-on-surface-variant/70' : 'text-on-surface') + '">' +
          '<span class="material-symbols-outlined text-[16px] shrink-0 self-center ' + (canc ? '' : (ehAtual ? 'text-red-600' : 'text-primary')) + '">' + (canc ? 'event_busy' : (ehAtual ? 'radio_button_checked' : 'event')) + '</span>' +
          '<span class="min-w-0"><span class="' + (canc ? 'line-through' : '') + ' first-letter:uppercase inline-block">' + esc(rotulo(s.inicio, now)) + '</span>' +
          (canc ? ' <span class="text-[12px] font-bold uppercase">cancelada</span>' : '') +
          (s.titulo ? '<span class="block text-[13px] text-on-surface-variant break-words">' + esc(s.titulo) + '</span>' : '') +
          (s.observacao ? '<span class="block text-[13px] text-on-surface-variant break-words">' + esc(s.observacao) + '</span>' : '') +
          '</span></li>';
      }).join('');
      var botao = aberta
        ? '<button type="button" data-sala-entrar class="w-full sm:w-auto h-12 px-6 rounded-xl bg-primary text-on-primary font-bold text-body-md flex items-center justify-center gap-xs shadow-lg active:scale-95 transition disabled:opacity-60"' + (st.entrando ? ' disabled' : '') + '><span class="material-symbols-outlined fill text-[24px]">videocam</span>' + (st.entrando ? 'Entrando…' : 'Entrar na sala') + '</button>'
        : '<button type="button" disabled class="w-full sm:w-auto h-12 px-6 rounded-xl bg-surface-container-high text-on-surface-variant font-bold text-body-md flex items-center justify-center gap-xs cursor-not-allowed"><span class="material-symbols-outlined text-[24px]">videocam_off</span>Entrar na sala</button>';
      return '<div class="bg-surface-container-lowest border border-amber-400/50 rounded-2xl shadow-sm p-md sm:p-lg">' +
        '<div class="flex flex-col sm:flex-row sm:items-center gap-md">' +
          '<div class="flex-1 min-w-0 space-y-xs">' +
            '<div class="flex items-center gap-sm flex-wrap">' + selo + '<h2 class="font-headline-sm text-headline-sm text-on-surface truncate">' + esc(d.titulo || 'Sala ao vivo') + '</h2></div>' +
            '<p class="text-body-sm text-on-surface-variant">' + linha + '</p>' +
            (!aberta && prox && d.abrirAntesMin ? '<p class="text-[13px] text-on-surface-variant">A sala abre ' + d.abrirAntesMin + ' min antes do horário, aqui mesmo, sem instalar nada.</p>' : '') +
          '</div>' +
          '<div class="shrink-0">' + botao + '</div>' +
        '</div>' +
        (d.aviso ? '<div class="mt-md flex items-start gap-xs rounded-xl bg-amber-400/15 border border-amber-400/40 px-3 py-2 text-body-sm text-on-surface"><span class="material-symbols-outlined text-amber-600 dark:text-amber-300 text-[20px] shrink-0">campaign</span><span class="whitespace-pre-line break-words">' + esc(d.aviso) + '</span></div>' : '') +
        (st.erro ? '<p role="alert" class="mt-md text-body-sm text-error">' + esc(st.erro) + '</p>' : '') +
        (lista ? '<details class="mt-md group"' + (st.listaAberta ? ' open' : '') + '><summary class="cursor-pointer select-none text-body-sm font-label-md text-primary flex items-center gap-1 list-none"><span class="material-symbols-outlined text-[20px] transition-transform group-open:rotate-90">chevron_right</span>Próximas aulas</summary><ul class="mt-xs pl-1 text-body-sm divide-y divide-outline-variant/40">' + lista + '</ul></details>' : '') +
      '</div>';
    }

    function textoConta() {
      var p = st.dados && st.dados.proxima;
      if (!p) return '';
      var ms = Date.parse(p.inicio) - agora().getTime();
      return ms > 0 ? 'começa em ' + contagem(ms) : 'começando';
    }

    function desenhar() {
      if (st.parado) return;
      if (!st.dados) { slot.classList.add('hidden'); slot.innerHTML = ''; return; }
      var det = slot.querySelector('details');
      if (det) st.listaAberta = det.open;
      slot.innerHTML = html();
      slot.classList.remove('hidden');
    }

    async function consultar() {
      if (st.parado || st.semAcesso) return;
      try {
        var d = await chamar('estado');
        if (st.parado) return;
        if (d && d.agora) st.desvio = Date.parse(d.agora) - Date.now();
        var mudou = !st.dados || st.dados.aberta !== d.aberta;
        // só redesenha se algo mudou (a contagem anda sozinha no tique)
        var chave = JSON.stringify([d.aberta, d.atual, d.proxima, d.proximas, d.titulo, d.aviso, d.abrirAntesMin]);
        st.dados = d;
        if (mudou && d.aberta) st.erro = null;
        if (!mudou && chave === st.chave) return;
        st.chave = chave;
        desenhar();
      } catch (e) {
        if (st.parado) return;
        // sem acesso / deslogado: o card some. Falha de rede: fica o último estado.
        if (e.status === 401 || e.status === 403) { st.dados = null; st.chave = null; desenhar(); }
        // sem acesso não muda enquanto a página está aberta: para de perguntar
        if (e.status === 403) { st.semAcesso = true; clearInterval(st.consulta); clearInterval(st.relogio); }
      }
    }

    function tique() {
      if (st.parado || !st.dados) return;
      var el = slot.querySelector('[data-sala-conta]');
      if (el) el.textContent = '(' + textoConta() + ')';
      // chegou a hora de abrir: consulta já, sem esperar os 30 s
      var p = st.dados.proxima;
      if (!st.dados.aberta && p) {
        var abre = Date.parse(p.inicio) - (st.dados.abrirAntesMin || 0) * 60000;
        var t = agora().getTime();
        if (t >= abre && t - abre < 1500) consultar();
      }
    }

    slot.addEventListener('click', async function (e) {
      var b = e.target.closest && e.target.closest('[data-sala-entrar]');
      if (!b || st.entrando) return;
      st.entrando = true; st.erro = null; desenhar();
      await abrirZoom(st.dados && st.dados.titulo, function (msg) { st.erro = msg; if (G.toast) G.toast(msg); });
      st.entrando = false; desenhar();
      if (st.erro) consultar();
    });

    slot.classList.add('hidden');
    consultar();
    st.consulta = setInterval(consultar, CONSULTA_MS);
    st.relogio = setInterval(tique, 1000);
    function aoVoltar() { if (document.visibilityState === 'visible') consultar(); }
    document.addEventListener('visibilitychange', aoVoltar);

    return function parar() {
      st.parado = true;
      clearInterval(st.consulta); clearInterval(st.relogio);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }

  G.salaCard = { mount: mount, fecharZoom: fecharZoom };
})();
