/**
 * GVSI Comunidade — Banner da campanha (Black Friday, 21/10/2026).
 *
 * Mesmo banner em vídeo da área de membros, no alto da tela inicial. Quem vê é decidido lá
 * (www.giovannipaganini.com/api/campanha/banner, mesma regra da home: só quem já era aluno
 * antes do corte). Aqui só manda o token de login e desenha o que voltar.
 *
 * "Ocultar banner" esconde por 5 horas (neste navegador); enquanto oculto, fica um botão
 * discreto para mostrar de novo.
 *
 * Uso (views.js, grupos): GVSI.campanhaBanner.mount(elementoDoBanner)
 */
(function () {
  var G = window.GVSI;
  if (!G) return;
  var API = 'https://www.giovannipaganini.com/api/campanha/banner';
  var CHAVE_OCULTO = 'gvsi-campanha-oculta';
  var OCULTO_MS = 5 * 3600000;
  var CACHE_MS = 10 * 60000;
  var cache = null; // { em, dados }

  function esc(s) { return G.esc(s); }

  async function buscar() {
    if (cache && Date.now() - cache.em < CACHE_MS) return cache.dados;
    var s = await G.sb.auth.getSession();
    var token = s && s.data && s.data.session && s.data.session.access_token;
    if (!token) return null;
    var r = await fetch(API, { headers: { Authorization: 'Bearer ' + token, 'X-Origem': 'comunidade' } });
    var dados = r.ok ? await r.json() : null;
    cache = { em: Date.now(), dados: dados };
    return dados;
  }

  function ocultoAte(chave) {
    try {
      var v = JSON.parse(localStorage.getItem(CHAVE_OCULTO) || 'null');
      if (v && v.chave === chave && v.ate > Date.now()) return v.ate;
    } catch (e) {}
    return 0;
  }

  function desenhar(box, d) {
    var slot = box.parentElement;
    if (!d || !d.mostrar || !/\.mp4($|\?)/i.test(d.banner)) { slot.classList.add('hidden'); box.innerHTML = ''; return; }
    slot.classList.remove('hidden');

    if (ocultoAte(d.chave)) {
      box.innerHTML =
        '<div class="flex justify-end"><button type="button" data-campanha-mostrar class="text-label-md font-label-md text-primary hover:underline">Mostrar banner da Black Friday</button></div>';
      box.querySelector('[data-campanha-mostrar]').addEventListener('click', function () {
        try { localStorage.removeItem(CHAVE_OCULTO); } catch (e) {}
        desenhar(box, d);
      });
      return;
    }

    box.innerHTML =
      '<div class="relative overflow-hidden rounded-xl bg-black border border-outline-variant" style="aspect-ratio:3/1">' +
        '<a href="' + esc(d.link) + '" target="_blank" rel="noopener" aria-label="Black Friday: ver as ofertas" class="block w-full h-full">' +
          '<video class="block w-full h-full object-cover" autoplay muted loop playsinline preload="metadata"></video>' +
        '</a>' +
        (d.previa ? '<span class="absolute top-2 left-2 rounded-full bg-black/75 text-white text-[11px] font-bold px-2.5 py-1">Prévia: só administradores veem. Ligue no painel da área de membros.</span>' : '') +
        '<button type="button" data-campanha-ocultar class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/65 border border-white/20 text-white text-[11px] font-bold px-3 py-1.5 hover:bg-black/80"><span class="material-symbols-outlined text-[14px]">close</span>Ocultar banner</button>' +
      '</div>';
    var v = box.querySelector('video');
    v.muted = true;
    v.src = d.banner;
    v.play().catch(function () {});
    box.querySelector('[data-campanha-ocultar]').addEventListener('click', function () {
      try { localStorage.setItem(CHAVE_OCULTO, JSON.stringify({ chave: d.chave, ate: Date.now() + OCULTO_MS })); } catch (e) {}
      desenhar(box, d);
    });
  }

  G.campanhaBanner = {
    mount: function (box) {
      if (!box) return;
      buscar().then(function (d) { if (box.isConnected) desenhar(box, d); }).catch(function () {});
    },
  };
})();
