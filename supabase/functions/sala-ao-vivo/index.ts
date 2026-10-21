// sala-ao-vivo — a sala ao vivo (Zoom) dentro do topico "Sala ao vivo" da Comunidade (21/10/2026).
//
// A mesma sala da area de membros (www.giovannipaganini.com/sala-ao-vivo): reuniao do Zoom
// aberta dentro da pagina pelo Meeting SDK, com a assinatura de entrada gerada aqui, para cada
// pessoa, com o nome e o e-mail da conta. O numero e a senha da reuniao nunca vao para quem nao
// pode entrar.
//
// Sempre com o JWT do proprio aluno (verify_jwt=true, e o usuario e conferido aqui dentro pelo
// /auth/v1/user). Quem pode: admin ou quem tem o topico "Sala ao vivo" (lms_tem_acesso_sala,
// migracao/sala-agenda.sql na area-de-membros). Os outros recebem 403 e o card nem aparece.
//   { acao: "estado" }  -> aberta/fechada, aula atual, proxima, proximas 5 (canceladas inclusas), titulo, aviso
//   { acao: "entrar" }  -> so com a sala aberta: assinatura, numero, senha, nome, e-mail, chave do SDK
//
// Regras da agenda copiadas de web/src/lib/sala-agenda-regras.ts e web/src/lib/sala.ts (mudou la,
// muda aqui). Config em lms_settings.sala_ao_vivo; aulas em lms_sala_sessoes. Credenciais do app
// do Zoom Marketplace nos segredos ZOOM_SDK_KEY e ZOOM_SDK_SECRET (os mesmos da area de membros).
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ZOOM_KEY = Deno.env.get("ZOOM_SDK_KEY") ?? "";
const ZOOM_SECRET = Deno.env.get("ZOOM_SDK_SECRET") ?? "";

const DIAS_ADIANTE = 21;
const DIA_MS = 86_400_000;

// So a Comunidade chama esta funcao do navegador (e o localhost para testar).
const ORIGENS = [
  "https://www.suportepaganini.com",
  "https://suportepaganini.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
];
function cors(req: Request): Record<string, string> {
  const o = req.headers.get("Origin") ?? "";
  // previews da Vercel do proprio projeto (lms-gvsi-*.vercel.app)
  const ok = ORIGENS.includes(o) || /^https:\/\/lms-gvsi[a-z0-9-]*\.vercel\.app$/.test(o);
  return {
    "Access-Control-Allow-Origin": ok ? o : ORIGENS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

const SH = { apikey: SVC, Authorization: `Bearer ${SVC}` };

async function rest(method: string, path: string, body?: unknown, prefer = "return=minimal"): Promise<any> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { ...SH, "Content-Type": "application/json", Prefer: prefer },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path.split("?")[0]} ${r.status} ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// ---- regras da agenda (copia de web/src/lib/sala-agenda-regras.ts) ----
// Horario de Brasilia fixo em -03:00: o Brasil nao tem horario de verao desde 2019.

type Modo = "auto" | "aberta" | "fechada";
interface Sessao {
  id: string;
  inicio: string;
  fim: string;
  status: "agendada" | "cancelada";
  origem: "agenda" | "extra";
  titulo: string | null;
  observacao: string | null;
}
interface Config {
  modo: Modo;
  /** "Liberar para os alunos" do painel: desligada, so admins veem a sala */
  publicada: boolean;
  dias: number[];
  hora: string;
  duracaoMin: number;
  abrirAntesMin: number;
  titulo: string;
  numero: string;
  senha: string;
  aviso: string;
}

function diaSP(instante: Date): string {
  return new Date(instante.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}
function diaDaSemanaSP(dia: string): number {
  return new Date(`${dia}T12:00:00Z`).getUTCDay();
}
function somarDiasSP(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
}
function instanteSP(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00-03:00`);
}

function lerConfig(v: any): Config {
  v = v && typeof v === "object" ? v : {};
  const dias = Array.isArray(v.dias)
    ? [...new Set<number>(v.dias.map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [1, 3, 5];
  const hora = typeof v.hora === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.hora) ? v.hora : "10:30";
  const num = (x: unknown, min: number, max: number, padrao: number) => {
    const n = Number(x);
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : padrao;
  };
  // antes da agenda havia so "ativa" (liga/desliga): ligada vira "aberta"
  const modo: Modo =
    v.modo === "auto" || v.modo === "aberta" || v.modo === "fechada" ? v.modo : v.ativa === true ? "aberta" : "auto";
  return {
    modo,
    publicada: v.publicada === true,
    dias,
    hora,
    duracaoMin: num(v.duracaoMin, 15, 480, 120),
    abrirAntesMin: num(v.abrirAntesMin, 0, 60, 10),
    titulo: typeof v.titulo === "string" && v.titulo.trim() ? v.titulo : "Sala ao vivo",
    numero: typeof v.numero === "string" ? v.numero.replace(/\D/g, "") : "",
    senha: typeof v.senha === "string" ? v.senha : "",
    aviso: typeof v.aviso === "string" ? v.aviso : "",
  };
}

function ocorrencias(cfg: Config, deDia: string, ateDia: string) {
  const saida: { inicio: string; fim: string }[] = [];
  for (let dia = deDia; dia <= ateDia; dia = somarDiasSP(dia, 1)) {
    if (!cfg.dias.includes(diaDaSemanaSP(dia))) continue;
    const inicio = instanteSP(dia, cfg.hora);
    saida.push({ inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + cfg.duracaoMin * 60_000).toISOString() });
  }
  return saida;
}

/** Modo "aberta"/"fechada" vence a agenda. No "auto", abre de abrirAntesMin antes do inicio ate o fim (cancelada nao conta). */
function estadoDaSala(modo: Modo, sessoes: Sessao[], agora: Date, abrirAntesMin: number) {
  const t = agora.getTime();
  const validas = sessoes
    .filter((s) => s.status === "agendada")
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  const atual = validas.find((s) => t >= Date.parse(s.inicio) - abrirAntesMin * 60_000 && t < Date.parse(s.fim)) ?? null;
  const proxima = validas.find((s) => Date.parse(s.inicio) - abrirAntesMin * 60_000 > t) ?? null;
  if (modo === "aberta") return { aberta: true, motivo: "forcada-aberta", atual, proxima };
  if (modo === "fechada") return { aberta: false, motivo: "forcada-fechada", atual, proxima };
  if (atual) return { aberta: true, motivo: "aula-agora", atual, proxima };
  return { aberta: false, motivo: proxima ? "fora-do-horario" : "sem-aula", atual: null, proxima };
}

// ---- banco ----

async function lerConfigSala(): Promise<Config> {
  const [linha] = (await rest("GET", "lms_settings?select=value&key=eq.sala_ao_vivo&limit=1")) ?? [];
  return lerConfig(linha?.value);
}

// Cria as aulas da agenda dos proximos dias que ainda nao existem (igual a garantirSessoes da area
// de membros: nao mexe nas que existem). Uma vez a cada 10 min por instancia: o card consulta a
// cada 30 s.
let garantidoEm = 0;
async function garantirSessoes(cfg: Config) {
  if (Date.now() - garantidoEm < 10 * 60_000) return;
  const hoje = diaSP(new Date());
  const novas = ocorrencias(cfg, hoje, somarDiasSP(hoje, DIAS_ADIANTE));
  if (novas.length) {
    await rest(
      "POST",
      "lms_sala_sessoes?on_conflict=inicio",
      novas.map((n) => ({ ...n, status: "agendada", origem: "agenda" })),
      "resolution=ignore-duplicates,return=minimal",
    );
  }
  garantidoEm = Date.now();
}

async function estadoAtual() {
  const cfg = await lerConfigSala();
  try {
    await garantirSessoes(cfg);
  } catch (e) {
    console.error(`[sala-ao-vivo] garantir: ${e}`);
  }
  const agora = new Date();
  const de = new Date(agora.getTime() - 12 * 3_600_000).toISOString();
  const ate = new Date(agora.getTime() + DIAS_ADIANTE * DIA_MS).toISOString();
  const sessoes: Sessao[] =
    (await rest(
      "GET",
      `lms_sala_sessoes?select=id,inicio,fim,status,origem,titulo,observacao&fim=gte.${encodeURIComponent(de)}&inicio=lte.${encodeURIComponent(ate)}&order=inicio`,
    )) ?? [];
  return { ...estadoDaSala(cfg.modo, sessoes, agora, cfg.abrirAntesMin), cfg, sessoes, agora };
}

function publica(s: Sessao | null) {
  return s ? { id: s.id, inicio: s.inicio, fim: s.fim, status: s.status, titulo: s.titulo, observacao: s.observacao } : null;
}

// ---- assinatura do Meeting SDK (igual a web/src/lib/sala-assinatura.ts) ----

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
const txt = (s: string) => new TextEncoder().encode(s);

/** JWT HS256 com o segredo do app. Papel 0 = participante. Vale por 2 horas. */
async function assinaturaZoom(numero: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 2 * 60 * 60;
  const cabecalho = b64url(txt(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const corpo = b64url(txt(JSON.stringify({ appKey: ZOOM_KEY, mn: numero, role: 0, iat, exp, tokenExp: exp })));
  const chave = await crypto.subtle.importKey("raw", txt(ZOOM_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ass = new Uint8Array(await crypto.subtle.sign("HMAC", chave, txt(`${cabecalho}.${corpo}`)));
  return `${cabecalho}.${corpo}.${b64url(ass)}`;
}

Deno.serve(async (req: Request) => {
  const CORS = cors(req);
  const J = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), {
      status: s,
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const ur = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: req.headers.get("Authorization") || "" },
    });
    if (!ur.ok) return J({ ok: false, erro: "nao-logado" }, 401);
    const user = await ur.json();
    if (!user?.id) return J({ ok: false, erro: "nao-logado" }, 401);

    const acesso = await rest("POST", "rpc/lms_tem_acesso_sala", { p_aluno: user.id }, "return=representation");
    if (acesso !== true) return J({ ok: false, erro: "sem-acesso" }, 403);

    let acao = new URL(req.url).searchParams.get("acao") ?? "";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      acao = String(body?.acao ?? acao);
    }
    acao = acao || "estado";

    const est = await estadoAtual();
    const { cfg } = est;

    // sala ainda nao liberada no painel: so admins (para montar e testar)
    if (!cfg.publicada) {
      const eu = await rest("GET", `lms_students?select=role&id=eq.${encodeURIComponent(user.id)}`);
      if (!Array.isArray(eu) || eu[0]?.role !== "admin") return J({ ok: false, erro: "sem-acesso" }, 403);
    }

    if (acao === "estado") {
      const t = est.agora.getTime();
      // as proximas 5 aulas, canceladas inclusas (o card mostra riscadas)
      const proximas = est.sessoes
        .filter((s) => Date.parse(s.fim) > t)
        .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))
        .slice(0, 5)
        .map(publica);
      return J({
        ok: true,
        aberta: est.aberta && !!cfg.numero,
        motivo: est.motivo,
        atual: publica(est.atual),
        proxima: publica(est.proxima),
        proximas,
        abrirAntesMin: cfg.abrirAntesMin,
        titulo: cfg.titulo,
        aviso: cfg.aviso,
        agora: est.agora.toISOString(),
      });
    }

    if (acao === "entrar") {
      if (!est.aberta || !cfg.numero) return J({ ok: false, erro: "fechada" }, 409);
      if (!ZOOM_KEY || !ZOOM_SECRET) return J({ ok: false, erro: "nao-configurada" }, 503);

      const [aluno] =
        (await rest("GET", `lms_students?select=full_name,email&id=eq.${user.id}&limit=1`)) ?? [];
      const email = String(aluno?.email || user.email || "");
      const nome = String(aluno?.full_name || "").trim() || email;

      const bruto = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
      const ip = /^[0-9a-f:.]+$/i.test(bruto) && bruto.length <= 45 ? bruto : null;
      try {
        await rest("POST", "lms_access_logs", {
          event: "sala_entrou",
          student_id: user.id,
          details: { origem: "comunidade", reuniao: cfg.numero },
          ip_address: ip,
        });
      } catch (e) {
        console.error(`[sala-ao-vivo] diario: ${e}`);
      }

      return J({
        ok: true,
        signature: await assinaturaZoom(cfg.numero),
        meetingNumber: cfg.numero,
        password: cfg.senha,
        userName: nome,
        userEmail: email,
        sdkKey: ZOOM_KEY,
      });
    }

    return J({ ok: false, erro: "acao-desconhecida" }, 400);
  } catch (e) {
    console.error(`[sala-ao-vivo] ${e}`);
    return J({ ok: false, erro: "erro-interno" }, 500);
  }
});
