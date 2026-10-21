// hub-mesa-pendentes — quem pagou a mesa no Hub e ainda não tem conta na mesa (21/10/2026).
//
// A conta da mesa é criada à mão pela equipe (de propósito: nem todo mundo que paga quer
// começar o teste na hora, e criar a conta dispara o prazo). Só que nada avisava a equipe:
// a compra fica no Hub e a mesa nunca fica sabendo. Esta conferência lê no Hub quem tem a
// mesa paga DE FATO (mesma regra da hub-diario) e pergunta à suporte-consulta da mesa
// (só leitura) se a pessoa já tem login e conta. Quem não tem vai para comu_mesa_pendentes,
// que o painel do suporte mostra para a equipe. Não cria nada na mesa.
//
// Só serviço (x-mod-secret). Corpo: {} roda e grava; { "dry_run": true } só devolve a lista;
// { "produtos": true } lista os produtos do Hub que contam como mesa.
const HUB_URL = Deno.env.get("HUB_URL") ?? "";
const HUB_KEY = Deno.env.get("HUB_SERVICE_KEY") ?? "";
const MOD = Deno.env.get("MOD_SECRET") ?? "";
const MESA_URL = Deno.env.get("MESA_CONSULTA_URL") ?? "";
const MESA_SECRET = Deno.env.get("MESA_CONSULTA_SECRET") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

async function hubGet(path: string): Promise<any[]> {
  const r = await fetch(`${HUB_URL}/rest/v1/${path}`, { headers: { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}` } });
  if (!r.ok) throw new Error(`hub ${r.status} ${(await r.text()).slice(0, 160)}`);
  return await r.json();
}
async function hubGetTodos(path: string): Promise<any[]> {
  const todos: any[] = [];
  for (let de = 0; de < 20000; de += 1000) {
    const parte = await hubGet(`${path}&order=id.asc&limit=1000&offset=${de}`);
    todos.push(...parte);
    if (parte.length < 1000) break;
  }
  return todos;
}

/** Produtos do Hub que dão a mesa: só os do cliente Giovanni (o Hub atende outras empresas). */
async function produtosDaMesa() {
  const donos = await hubGet("products?select=client_id&access_webhook_url=ilike.*giovannipaganini*&limit=1");
  const cliente = donos[0]?.client_id;
  if (!cliente) throw new Error("cliente do Hub nao encontrado");
  const todos = await hubGet(`products?select=id,slug,name,access_duration_days&client_id=eq.${cliente}`);
  const norm = (t: string) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // "Upgrade" é de quem já tem conta: não é compra de conta nova
  return todos.filter((p) => (norm(p.slug).includes("mesa") || norm(p.name).includes("mesa")) && !norm(p.name).includes("upgrade"));
}

// Uma chamada só, no modo lote da mesa: uma por pessoa batia no limite de chamadas entre funções.
async function naMesa(emails: string[]): Promise<Map<string, any>> {
  const r = await fetch(MESA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-suporte-secret": MESA_SECRET },
    body: JSON.stringify({ emails }),
    signal: AbortSignal.timeout(60000),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.ok || !Array.isArray(d.lote)) throw new Error(`mesa ${r.status} ${JSON.stringify(d).slice(0, 160)}`);
  return new Map(d.lote.map((x: any) => [x.email, x]));
}

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`lms ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.status === 204 ? null : await r.json().catch(() => null);
}

Deno.serve(async (req) => {
  if (!MOD || req.headers.get("x-mod-secret") !== MOD) return new Response("forbidden", { status: 403 });
  try {
    const corpo = await req.json().catch(() => ({}));
    const produtos = await produtosDaMesa();
    if (corpo?.produtos) return json({ ok: true, produtos });
    if (!produtos.length) return json({ ok: false, erro: "nenhum produto da mesa no Hub" });
    if (!MESA_URL || !MESA_SECRET) return json({ ok: false, erro: "MESA_CONSULTA_URL/SECRET faltando" });

    const ids = produtos.map((p) => p.id).join(",");
    const nomeProd = new Map(produtos.map((p) => [p.id, p.name]));
    const dias = new Map(produtos.map((p) => [p.id, p.access_duration_days]));
    const agora = Date.now();
    // por e-mail, a compra mais antiga ainda valendo (é desde ela que a pessoa espera)
    const compradores = new Map<string, { email: string; nome: string; produto: string; pago_em: string | null; ref: string }>();
    const ponha = (email: string, nome: string, produto: string, pago_em: string | null, ref: string) => {
      const e = String(email ?? "").trim().toLowerCase();
      if (!e.includes("@")) return;
      const ja = compradores.get(e);
      if (ja && ja.pago_em && pago_em && Date.parse(ja.pago_em) <= Date.parse(pago_em)) return;
      compradores.set(e, { email: e, nome: String(nome ?? "").trim(), produto, pago_em, ref });
    };

    // assinaturas pagas de fato (mesma regra da hub-diario e da conferencia() da hub-avulsos)
    const subs = await hubGetTodos(
      "subscriptions?select=id,product_id,starts_at,expires_at,last_renewal_date,created_at,contact:contact_id(email,full_name)" +
        `&product_id=in.(${ids})&status=eq.active&access_enabled=not.is.false` +
        "&or=(and(payment_status.eq.up_to_date,or(last_renewal_date.not.is.null,access_status.eq.synced)),payment_status.eq.trial)" +
        "&metadata->>inadimplente_plano_restante=is.null",
    );
    for (const s of subs) {
      const d = dias.get(s.product_id);
      const fim = s.expires_at ?? (s.starts_at && d ? new Date(Date.parse(s.starts_at) + d * 864e5).toISOString() : null);
      if (fim && Date.parse(fim) <= agora) continue;
      ponha(s.contact?.email, s.contact?.full_name, nomeProd.get(s.product_id) ?? "", s.starts_at ?? s.created_at ?? null, `sub-${s.id}`);
    }
    // liberações no Hub (bônus, manual) que já começaram
    const grants = await hubGetTodos(
      "access_grants?select=id,product_id,status,starts_at,ends_at,created_at,contact:contact_id(email,full_name)" +
        `&product_id=in.(${ids})&status=eq.active`,
    );
    for (const g of grants) {
      if (g.starts_at && Date.parse(g.starts_at) > agora) continue;
      if (g.ends_at && Date.parse(g.ends_at) <= agora) continue;
      ponha(g.contact?.email, g.contact?.full_name, nomeProd.get(g.product_id) ?? "", g.starts_at ?? g.created_at ?? null, `grant-${g.id}`);
    }

    // a mesa falhando lança erro antes de gravar: a lista não some nem volta inteira por isso
    const lista = [...compradores.values()];
    const mesa = await naMesa(lista.map((c) => c.email));
    const pendentes: any[] = [];
    for (const c of lista) {
      const m = mesa.get(c.email);
      if (!m || m.tem_conta) continue;
      pendentes.push({
        email: c.email,
        nome: c.nome || null,
        produto: c.produto || null,
        pago_em: c.pago_em,
        ref_hub: c.ref,
        // sem_login: precisa convidar antes de criar a conta; sem_conta: já tem login
        situacao: !m.encontrado ? "sem_login" : m.compra_na_fila ? "compra_na_fila" : "sem_conta",
      });
    }
    if (corpo?.dry_run) return json({ ok: true, dry_run: true, produtos: produtos.map((p) => p.name), compradores: lista.length, pendentes });

    const agoraIso = new Date().toISOString();
    if (pendentes.length) {
      await sb("comu_mesa_pendentes?on_conflict=email", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(pendentes.map((p) => ({ ...p, visto_em: agoraIso, resolvido_em: null }))),
      });
    }
    // quem saiu da lista (ganhou conta ou deixou de ter direito) fica marcado como resolvido
    await sb(`comu_mesa_pendentes?resolvido_em=is.null&visto_em=lt.${encodeURIComponent(agoraIso)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ resolvido_em: agoraIso }),
    });
    return json({ ok: true, produtos: produtos.map((p) => p.name), compradores: lista.length, pendentes: pendentes.length });
  } catch (e) {
    return json({ ok: false, erro: String(e).slice(0, 300) }, 500);
  }
});
