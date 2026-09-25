// hub-avulsos — leva para a área de membros o que o Hub libera SEM assinatura
// (access_grants: bônus, liberações do painel 🔑 da comunidade e da tela
// /assinaturas/acessos do Hub). O Hub só manda webhook de assinatura
// (subscription-access-trigger.ts), então avulso nunca chegava: na virada de
// 25/09/2026 alunos com bônus ficaram só com o Master Trader.
//
// Só serviço (x-mod-secret). Jeitos de chamar:
//   {}        cron a cada 2 min: avulsos que mudaram no Hub desde o cursor
//             (lms_settings.hub_avulsos_cursor). O cursor nasceu em 25/09:
//             o que já existia antes fica como está, a pedido do dono.
//   {email}   uma pessoa: os avulsos dela e as assinaturas do Hub com acesso
//             ligado (access_enabled). Chamado quando a conta nasce (gatilho
//             em lms_students) e pelo hub-accesses depois de Liberar/Bloquear.
//   dry_run   true: só diz o que faria. Com {desde}, simula o cron a partir
//             dessa data (não mexe no cursor).
//
// Produto do Hub -> curso: o mesmo mapa da integração
// (lms_settings.integracao_hub.mapa_slugs). Grava como a rota /api/hub/access
// (provider hub_central); o avulso vai como "grant:<id>", separado das
// assinaturas. verify_jwt=false.
const HUB_URL = Deno.env.get("HUB_URL") ?? "";
const HUB_KEY = Deno.env.get("HUB_SERVICE_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MOD = Deno.env.get("MOD_SECRET") ?? "";

const HH = { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}` };
const SH = { apikey: SVC, Authorization: `Bearer ${SVC}` };
const J = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const enc = encodeURIComponent;

const CAMPOS_AVULSO =
  "id,status,starts_at,ends_at,activated_at,created_at,updated_at,product:product_id(slug),contact:contact_id(email,full_name)";

async function hubGet(path: string): Promise<any[]> {
  const r = await fetch(`${HUB_URL}/rest/v1/${path}`, { headers: HH });
  if (!r.ok) throw new Error("hub " + r.status + " " + (await r.text()).slice(0, 200));
  return await r.json();
}

async function lms(method: string, path: string, body?: unknown, prefer = "return=representation"): Promise<any> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { ...SH, "Content-Type": "application/json", Prefer: prefer },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`lms ${method} ${path.split("?")[0]} ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
const lmsGet = (path: string) => lms("GET", path);

// Igual ao lerMapa da área de membros: "pmt = programa-master-trader" por linha.
function lerMapa(texto: unknown): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const linha of String(texto ?? "").split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const partes = limpa.split(/\s*[=|:\t]\s*/);
    if (partes.length < 2) continue;
    const de = partes[0].trim().toLowerCase();
    const para = partes.slice(1).join("").trim();
    if (de && para) mapa.set(de, para);
  }
  return mapa;
}

type Ctx = {
  mapa: Map<string, string>;
  criar: boolean;
  cursos: Map<string, string>;
  agora: number;
  agoraIso: string;
  ensaio: boolean;
  feito: string[];
};

async function contexto(ensaio: boolean): Promise<Ctx> {
  const [cfg, cursos] = await Promise.all([
    lmsGet("lms_settings?key=eq.integracao_hub&select=value"),
    lmsGet("lms_courses?select=id,slug"),
  ]);
  const v = cfg[0]?.value ?? {};
  const agora = Date.now();
  return {
    mapa: lerMapa(v.mapa_slugs),
    criar: v.criar_usuario !== false,
    cursos: new Map(cursos.map((c: any) => [c.slug, c.id])),
    agora,
    agoraIso: new Date(agora).toISOString(),
    ensaio,
    feito: [],
  };
}

function cursoDo(ctx: Ctx, slug: unknown): { id: string; slug: string } | null {
  if (typeof slug !== "string" || !slug) return null;
  const alvo = ctx.mapa.get(slug.toLowerCase()) ?? slug;
  const id = ctx.cursos.get(alvo);
  return id ? { id, slug: alvo } : null;
}

async function diario(evento: string, alunoId: string | null, detalhes: Record<string, unknown>) {
  try {
    await lms("POST", "lms_access_logs", { event: evento, student_id: alunoId, details: detalhes }, "return=minimal");
  } catch (e) {
    console.error("[hub-avulsos] diario", e);
  }
}

async function acharAluno(email: string): Promise<string | null> {
  const s = await lmsGet(`lms_students?select=id&email=eq.${enc(email)}&limit=1`);
  return s[0]?.id ?? null;
}

// Mesmo desenho do acharOuCriarAluno da área de membros: conta sem senha, com
// needs_password; a pessoa cria a senha no Primeiro acesso.
async function criarAluno(email: string, nome: string | null): Promise<string | null> {
  const r = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({ email, email_confirm: true, user_metadata: { full_name: nome ?? "" } }),
  });
  if (!r.ok) {
    console.error("[hub-avulsos] criar conta", r.status, (await r.text()).slice(0, 200));
    return null;
  }
  const u = await r.json();
  const id = u?.id ?? u?.user?.id;
  if (!id) return null;
  await lms(
    "POST",
    "lms_students?on_conflict=id",
    { id, email, full_name: nome, role: "student", needs_password: true },
    "resolution=merge-duplicates,return=minimal",
  );
  await diario("user_registered", id, { email, origem: "hub_avulso" });
  return id;
}

const mesmoInstante = (a: unknown, b: unknown) =>
  (a ? Date.parse(String(a)) : null) === (b ? Date.parse(String(b)) : null);

// Abre (ou reabre) a linha desta origem. Idempotente.
async function abrir(
  ctx: Ctx,
  alunoId: string,
  cursoId: string,
  pid: string,
  d: { inicio: string; fim: string | null; raw: string },
): Promise<"liberado" | "ja-estava"> {
  const ex = await lmsGet(
    `lms_subscriptions?select=id,status,access_open,ends_at&student_id=eq.${alunoId}&course_id=eq.${cursoId}` +
      `&provider=eq.hub_central&provider_subscription_id=eq.${enc(pid)}&limit=1`,
  );
  const l = ex[0];
  if (l && l.status === "active" && l.access_open === true && mesmoInstante(l.ends_at, d.fim)) return "ja-estava";
  if (ctx.ensaio) return "liberado";
  const campos = {
    status: "active",
    access_open: true,
    ends_at: d.fim,
    status_raw: d.raw,
    paused_reason: null,
    last_status_at: ctx.agoraIso,
    updated_at: ctx.agoraIso,
  };
  if (l) {
    await lms("PATCH", `lms_subscriptions?id=eq.${l.id}`, campos, "return=minimal");
  } else {
    await lms(
      "POST",
      "lms_subscriptions?on_conflict=student_id,course_id,provider,provider_subscription_id",
      {
        student_id: alunoId,
        course_id: cursoId,
        provider: "hub_central",
        provider_subscription_id: pid,
        ignore_drip: false,
        starts_at: d.inicio,
        ...campos,
      },
      "resolution=merge-duplicates,return=minimal",
    );
  }
  return "liberado";
}

// Fecha só a linha desta origem (o acesso manual ou do WordPress fica).
async function fechar(ctx: Ctx, alunoId: string, cursoId: string, pid: string, motivo: string): Promise<number> {
  const filtro =
    `lms_subscriptions?student_id=eq.${alunoId}&course_id=eq.${cursoId}&provider=eq.hub_central` +
    `&provider_subscription_id=eq.${enc(pid)}&or=(status.neq.cancelled,access_open.eq.true)`;
  if (ctx.ensaio) return (await lmsGet(filtro.replace("lms_subscriptions?", "lms_subscriptions?select=id&"))).length;
  const r = await lms("PATCH", filtro, {
    status: "cancelled",
    access_open: false,
    paused_reason: motivo,
    last_status_at: ctx.agoraIso,
    updated_at: ctx.agoraIso,
  });
  return Array.isArray(r) ? r.length : 0;
}

async function aplicarAvulso(ctx: Ctx, g: any): Promise<string> {
  const curso = cursoDo(ctx, g?.product?.slug);
  if (!curso) return "sem-curso";
  const email = String(g?.contact?.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) return "sem-email";
  const pid = "grant:" + g.id;
  const ativo =
    g.status === "active" &&
    (!g.ends_at || Date.parse(g.ends_at) > ctx.agora) &&
    (!g.starts_at || Date.parse(g.starts_at) <= ctx.agora);
  let alunoId = await acharAluno(email);

  if (ativo) {
    let criou = false;
    if (!alunoId && ctx.criar) {
      if (ctx.ensaio) {
        ctx.feito.push(`criaria conta e liberaria ${curso.slug} (${pid})`);
        return "liberado";
      }
      alunoId = await criarAluno(email, g?.contact?.full_name ?? null);
      criou = !!alunoId;
    }
    if (!alunoId) return "sem-aluno";
    const r = await abrir(ctx, alunoId, curso.id, pid, {
      inicio: g.starts_at ?? g.activated_at ?? g.created_at ?? ctx.agoraIso,
      fim: g.ends_at ?? null,
      raw: `${g.product.slug}:avulso`,
    });
    if (r === "liberado") {
      ctx.feito.push(`liberou ${curso.slug} (${pid})`);
      if (!ctx.ensaio) {
        await diario("hub_grant", alunoId, { curso: curso.slug, hub: pid, origem: "avulso", criou_conta: criou });
      }
    }
    return r;
  }

  if (!alunoId) return "nada";
  const n = await fechar(ctx, alunoId, curso.id, pid, "hub_avulso_" + g.status);
  if (n) {
    ctx.feito.push(`fechou ${curso.slug} (${pid}, ${g.status})`);
    if (!ctx.ensaio) {
      await diario("hub_revoke", alunoId, { curso: curso.slug, hub: pid, origem: "avulso", status_hub: g.status, afetadas: n });
    }
  }
  return n ? "fechado" : "nada";
}

// Assinatura do Hub com acesso ligado, para quem acabou de ganhar conta: o
// mesmo que o webhook de compra faria (fim = expires_at, senão início +
// access_duration_days do produto).
async function aplicarAssinatura(ctx: Ctx, alunoId: string, s: any): Promise<string> {
  const curso = cursoDo(ctx, s?.product?.slug);
  if (!curso) return "sem-curso";
  const dias = s?.product?.access_duration_days;
  const fim =
    s.expires_at ??
    (s.starts_at && dias ? new Date(Date.parse(s.starts_at) + dias * 864e5).toISOString() : null);
  const r = await abrir(ctx, alunoId, curso.id, s.id, {
    inicio: s.starts_at ?? s.created_at ?? ctx.agoraIso,
    fim,
    raw: `${s.product.slug}:active`,
  });
  if (r === "liberado") {
    ctx.feito.push(`liberou ${curso.slug} (assinatura ${s.id})`);
    if (!ctx.ensaio) await diario("hub_grant", alunoId, { curso: curso.slug, hub: s.id, origem: "assinatura, conta nova" });
  }
  return r;
}

function contar(res: Record<string, number>, tag: string) {
  res[tag] = (res[tag] ?? 0) + 1;
}

async function porCursor(ctx: Ctx, desdeEnsaio: string | null) {
  const cur = await lmsGet("lms_settings?key=eq.hub_avulsos_cursor&select=value");
  const desde: string | null = desdeEnsaio ?? cur[0]?.value?.ate ?? null;
  if (!desde) return { ok: false, error: "cursor nao iniciado (lms_settings.hub_avulsos_cursor)" };

  const lista = await hubGet(
    `access_grants?select=${CAMPOS_AVULSO}&updated_at=gt.${enc(desde)}&order=updated_at.asc&limit=300`,
  );
  const res: Record<string, number> = {};
  const erros: string[] = [];
  // O cursor só anda até antes do primeiro erro: o que falhou é refeito na
  // próxima rodada (aplicar de novo não duplica nada).
  let ate = desde;
  let travou = false;
  for (const g of lista) {
    try {
      contar(res, await aplicarAvulso(ctx, g));
      if (!travou) ate = g.updated_at;
    } catch (e) {
      travou = true;
      erros.push(`${g.id}: ${String(e).slice(0, 160)}`);
    }
  }
  if (!ctx.ensaio && !desdeEnsaio && ate !== desde) {
    await lms("PATCH", "lms_settings?key=eq.hub_avulsos_cursor", { value: { ate, rodou_em: ctx.agoraIso } }, "return=minimal");
  }
  return { ok: erros.length === 0, modo: "cursor", desde, ate, lidos: lista.length, resultado: res, erros };
}

async function porEmail(ctx: Ctx, email: string) {
  const e = email.trim().toLowerCase();
  // ilike acha o e-mail com maiúsculas no Hub; o filtro exato tira os falsos
  // positivos do "_" (curinga do LIKE).
  const contatos = (await hubGet(`contacts?select=id,email&email=ilike.${enc(e)}&limit=10`)).filter(
    (c) => String(c.email ?? "").trim().toLowerCase() === e,
  );
  if (!contatos.length) return { ok: true, modo: "email", contato_no_hub: false };
  const ids = contatos.map((c) => c.id).join(",");

  const res: Record<string, number> = {};
  const erros: string[] = [];
  const avulsos = await hubGet(`access_grants?select=${CAMPOS_AVULSO}&contact_id=in.(${ids})`);
  for (const g of avulsos) {
    try {
      contar(res, await aplicarAvulso(ctx, g));
    } catch (err) {
      erros.push(`${g.id}: ${String(err).slice(0, 160)}`);
    }
  }

  const alunoId = await acharAluno(e);
  if (alunoId) {
    const subs = await hubGet(
      `subscriptions?select=id,status,starts_at,expires_at,created_at,product:product_id(slug,access_duration_days)` +
        `&contact_id=in.(${ids})&status=eq.active&access_enabled=eq.true`,
    );
    for (const s of subs) {
      try {
        contar(res, await aplicarAssinatura(ctx, alunoId, s));
      } catch (err) {
        erros.push(`${s.id}: ${String(err).slice(0, 160)}`);
      }
    }
  }
  return { ok: erros.length === 0, modo: "email", contato_no_hub: true, resultado: res, erros };
}

Deno.serve(async (req: Request) => {
  if (!MOD || req.headers.get("x-mod-secret") !== MOD) return J({ ok: false, error: "forbidden" }, 403);
  try {
    const body = await req.json().catch(() => ({} as any));
    const ctx = await contexto(body.dry_run === true);
    const saida = body.email
      ? await porEmail(ctx, String(body.email))
      : await porCursor(ctx, body.dry_run === true && body.desde ? String(body.desde) : null);
    return J({ ...saida, ensaio: ctx.ensaio, feito: ctx.feito.slice(0, 50) });
  } catch (err) {
    console.error("[hub-avulsos]", err);
    return J({ ok: false, error: String(err).slice(0, 300) }, 200);
  }
});
