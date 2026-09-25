// hub-accesses — painel do 🔑 no suporte. LÊ os acessos da pessoa no Hub Central (assinaturas + avulsos)
// e o status na comunidade; e LIBERA/BLOQUEIA produtos AVULSOS (escreve em access_grants do hub, igual a
// tela /assinaturas/acessos). Valida ADMIN da comunidade pelo JWT do chamador (ou x-mod-secret de serviço).
// verify_jwt=false.
//
// 25/09/2026 (pedido do dono: "tudo tem que ser conectado"):
//  - depois de Liberar/Bloquear, chama a hub-avulsos na hora, que leva o avulso
//    para a área de membros (antes ficava só no Hub);
//  - sem contato no Hub, o Liberar cria o contato (nome da comunidade) em vez
//    de mandar criar lá na mão;
//  - o contato é achado mesmo com maiúsculas no e-mail do Hub.
const HUB_URL = Deno.env.get("HUB_URL") ?? "";
const HUB_KEY = Deno.env.get("HUB_SERVICE_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const MOD = Deno.env.get("MOD_SECRET") ?? "";
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const HH = { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}` };

async function hubGet(path: string): Promise<any[]> {
  const r = await fetch(`${HUB_URL}/rest/v1/${path}`, { headers: HH });
  if (!r.ok) throw new Error("hub " + r.status + " " + (await r.text()).slice(0, 150));
  return await r.json();
}
async function hubWrite(method: string, path: string, obj: unknown): Promise<void> {
  const r = await fetch(`${HUB_URL}/rest/v1/${path}`, { method, headers: { ...HH, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(obj) });
  if (!r.ok) throw new Error(method + " " + r.status + " " + (await r.text()).slice(0, 400));
}
async function commGet(path: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  if (!r.ok) throw new Error("comm " + r.status + " " + (await r.text()).slice(0, 150));
  return await r.json();
}

// ilike acha o e-mail gravado com maiúsculas no Hub; o filtro exato descarta o
// que o "_" (curinga do LIKE) casaria a mais.
async function acharContato(e: string): Promise<string | null> {
  const lista = await hubGet(`contacts?select=id,email&email=ilike.${encodeURIComponent(e)}&order=created_at.asc&limit=10`);
  const exato = lista.find((c) => String(c.email ?? "").trim().toLowerCase() === e);
  return exato?.id ?? null;
}

// Leva o que mudou para a área de membros agora (o cron de 2 min é a rede de segurança).
async function levarParaAreaDeMembros(e: string): Promise<void> {
  try {
    await fetch(`${SB_URL}/functions/v1/hub-avulsos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mod-secret": MOD },
      body: JSON.stringify({ email: e }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.error("[hub-accesses] area de membros:", err);
  }
}

async function lerAcessos(e: string) {
  const enc = encodeURIComponent(e);
  const cid = await acharContato(e);
  const acessos: any[] = [];
  if (cid) {
    const subs = await hubGet(`subscriptions?contact_id=eq.${cid}&select=status,expires_at,created_at,product:product_id(name)&order=created_at.desc`);
    for (const s of subs) acessos.push({ tipo: "assinatura", produto: (s.product && s.product.name) || "(produto)", status: s.status, ate: s.expires_at });
    const grants = await hubGet(`access_grants?contact_id=eq.${cid}&select=product_id,status,starts_at,ends_at,created_at,product:product_id(name)&order=created_at.desc`);
    for (const g of grants) acessos.push({ tipo: "avulso", produto_id: g.product_id, produto: (g.product && g.product.name) || "(produto)", status: g.status, de: g.starts_at, ate: g.ends_at });
  }
  const memb = await commGet(`lms_students?select=id&email=eq.${enc}&limit=1`);
  const blk = await commGet(`comu_hub_blocked?select=email&email=eq.${enc}&limit=1`);
  // O que a pessoa tem aberto na área de membros, por curso (várias origens
  // viram uma linha só; sem data de fim ganha de qualquer data).
  const area: { curso: string; ate: string | null }[] = [];
  if (memb[0]) {
    const subs = await commGet(`lms_subscriptions?select=status,access_open,ends_at,course:course_id(title)&student_id=eq.${memb[0].id}`);
    const porCurso = new Map<string, string | null>();
    for (const s of subs) {
      if (!(s.access_open === true || s.status === "active")) continue;
      const nome = (s.course && s.course.title) || "(curso)";
      const antes = porCurso.get(nome);
      porCurso.set(nome, antes === null || !s.ends_at ? null : (antes && antes > s.ends_at ? antes : s.ends_at));
    }
    for (const [curso, ate] of porCurso) area.push({ curso, ate });
  }
  return { ok: true, email: e, achou_no_hub: !!cid, membro: !!memb[0], bloqueado: !!blk[0], acessos, area_de_membros: area, contact_id: cid || null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // auth: admin da comunidade (JWT) ou atalho de serviço (x-mod-secret)
    const isService = MOD && req.headers.get("x-mod-secret") === MOD;
    if (!isService) {
      const authz = req.headers.get("Authorization") || "";
      const ur = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: authz } });
      if (!ur.ok) return J({ ok: false, error: "nao autenticado" }, 401);
      const u = await ur.json();
      const who = await commGet(`lms_students?select=role&id=eq.${u.id}`);
      if (!who[0] || who[0].role !== "admin") return J({ ok: false, error: "so admin" }, 403);
    }

    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action || "status");

    // lista de produtos ativos do hub (pro seletor "liberar outro produto")
    if (action === "produtos") {
      const prods = await hubGet(`products?select=id,name&is_active=eq.true&order=name`);
      return J({ ok: true, produtos: prods.map((p) => ({ id: p.id, nome: p.name })) });
    }

    const e = String(body.email || "").trim().toLowerCase();
    if (!e) return J({ ok: false, error: "sem email" });

    if (action === "grant" || action === "block") {
      const pid = String(body.product_id || "");
      if (!pid) return J({ ok: false, error: "sem produto" });
      // valida a data antes de mexer em qualquer coisa (inclusive criar contato)
      let until = "";
      if (action === "grant") {
        if (!body.until) return J({ ok: false, error: "informe até quando o acesso vale" });
        const d = new Date(String(body.until));
        if (isNaN(d.getTime())) return J({ ok: false, error: "data inválida" });
        if (d.getTime() <= Date.now()) return J({ ok: false, error: "a data final tem que ser no futuro" });
        until = d.toISOString();
      }
      let cid = await acharContato(e);
      if (!cid && action === "block") return J({ ok: false, error: "Este aluno não tem contato no Hub: não há o que bloquear." });
      if (!cid) {
        // Sem contato no Hub: cria com o nome que a pessoa tem na comunidade.
        const aluno = await commGet(`lms_students?select=full_name&email=eq.${encodeURIComponent(e)}&limit=1`);
        const nome = String(body.name || aluno[0]?.full_name || e.split("@")[0]).trim();
        const r = await fetch(`${HUB_URL}/rest/v1/contacts`, {
          method: "POST",
          headers: { ...HH, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ full_name: nome, email: e }),
        });
        if (!r.ok) return J({ ok: false, error: "Não consegui criar o contato no Hub: " + (await r.text()).slice(0, 200) });
        cid = (await r.json())[0]?.id ?? null;
        if (!cid) return J({ ok: false, error: "Não consegui criar o contato no Hub." });
      }

      if (action === "grant") {
        const nowIso = new Date().toISOString();
        const patch = { status: "active", starts_at: nowIso, activated_at: nowIso, ends_at: until, paused_at: null, canceled_at: null, cancel_reason: null, notes: "Liberado pelo suporte da comunidade" };
        const ex = await hubGet(`access_grants?contact_id=eq.${cid}&product_id=eq.${pid}&select=id&order=created_at.desc&limit=1`);
        if (ex[0]) await hubWrite("PATCH", `access_grants?id=eq.${ex[0].id}`, patch);
        else await hubWrite("POST", "access_grants", { contact_id: cid, product_id: pid, ...patch });
      } else {
        await hubWrite("PATCH", `access_grants?contact_id=eq.${cid}&product_id=eq.${pid}&status=in.(active,scheduled,paused)`, { status: "canceled", canceled_at: new Date().toISOString(), cancel_reason: "Bloqueado pelo suporte da comunidade", paused_at: null });
      }
      await levarParaAreaDeMembros(e);
    }

    // sempre devolve o estado fresco (read; e depois de grant/block)
    return J(await lerAcessos(e));
  } catch (err) {
    return J({ ok: false, error: String(err) }, 200);
  }
});
