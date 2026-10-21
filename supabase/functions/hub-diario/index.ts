// hub-diario — leva para o Diário de Trading quem tem direito a ele pelo Hub (21/10/2026).
//
// O Diário (outro projeto Supabase) era liberado à mão: o último aviso chegou em 12/08, do
// Guru. Tudo é vendido pelo Hub, e o Hub só avisa assinatura; bônus (access_grants) nunca
// chegam. Esta conferência lê no Hub a lista COMPLETA de quem tem direito ao Diário agora e
// manda para o billing-webhook do Diário (action "sync"), que cria a conta se preciso, ativa
// quem falta e encerra só o que ele mesmo abriu por aqui (gateway hub_sync). As liberações
// manuais do painel do Diário nunca são tocadas.
//
// Tem direito:
//  - assinatura ativa do produto do Diário, com controle de acesso ligado e paga DE FATO
//    (a mesma regra da conferência da hub-avulsos: boleto gerado e não pago não conta);
//  - acesso avulso (bônus, liberação manual no Hub) ativo neste momento.
//
// Só serviço (x-mod-secret). Corpo: {} roda; { "dry_run": true } só diz o que faria;
// { "produtos": true } lista os produtos do Hub que contam como Diário.
const HUB_URL = Deno.env.get("HUB_URL") ?? "";
const HUB_KEY = Deno.env.get("HUB_SERVICE_KEY") ?? "";
const MOD = Deno.env.get("MOD_SECRET") ?? "";
const DIARIO_URL = Deno.env.get("DIARIO_WEBHOOK_URL") ?? "";
const DIARIO_TOKEN = Deno.env.get("DIARIO_SYNC_TOKEN") ?? "";

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

/** Produtos do Hub que dão o Diário: só os do cliente Giovanni (o Hub atende outras empresas). */
async function produtosDoDiario() {
  const donos = await hubGet("products?select=client_id&access_webhook_url=ilike.*giovannipaganini*&limit=1");
  const cliente = donos[0]?.client_id;
  if (!cliente) throw new Error("cliente do Hub nao encontrado");
  const todos = await hubGet(`products?select=id,slug,name,access_duration_days&client_id=eq.${cliente}`);
  const norm = (t: string) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return todos.filter((p) => norm(p.slug).includes("diario") || norm(p.name).includes("diario"));
}

Deno.serve(async (req) => {
  if (!MOD || req.headers.get("x-mod-secret") !== MOD) return new Response("forbidden", { status: 403 });
  try {
    const corpo = await req.json().catch(() => ({}));
    const produtos = await produtosDoDiario();
    if (corpo?.produtos) return json({ ok: true, produtos });
    if (!produtos.length) return json({ ok: false, erro: "nenhum produto do Diario no Hub" });
    if (!DIARIO_URL || !DIARIO_TOKEN) return json({ ok: false, erro: "DIARIO_WEBHOOK_URL/DIARIO_SYNC_TOKEN faltando" });

    const ids = produtos.map((p) => p.id).join(",");
    const dias = new Map(produtos.map((p) => [p.id, p.access_duration_days]));
    const agora = Date.now();
    const itens = new Map<string, { email: string; nome: string; ref: string; fim: string | null }>();
    const ponha = (email: string, nome: string, ref: string, fim: string | null) => {
      const e = String(email ?? "").trim().toLowerCase();
      if (e.includes("@")) itens.set(ref, { email: e, nome: String(nome ?? "").trim() || e.split("@")[0], ref, fim });
    };

    // assinaturas pagas de fato (mesma regra da conferencia() da hub-avulsos)
    const subs = await hubGetTodos(
      "subscriptions?select=id,product_id,starts_at,expires_at,created_at,contact:contact_id(email,full_name)" +
        `&product_id=in.(${ids})&status=eq.active&access_enabled=not.is.false` +
        "&or=(and(payment_status.eq.up_to_date,or(last_renewal_date.not.is.null,access_status.eq.synced)),payment_status.eq.trial)" +
        "&metadata->>inadimplente_plano_restante=is.null",
    );
    for (const s of subs) {
      const d = dias.get(s.product_id);
      const fim = s.expires_at ?? (s.starts_at && d ? new Date(Date.parse(s.starts_at) + d * 864e5).toISOString() : null);
      if (fim && Date.parse(fim) <= agora) continue;
      ponha(s.contact?.email, s.contact?.full_name, `sub-${s.id}`, fim);
    }

    // avulsos (bônus e liberações do Hub) ativos agora
    const grants = await hubGetTodos(
      "access_grants?select=id,status,starts_at,ends_at,contact:contact_id(email,full_name)" +
        `&product_id=in.(${ids})&status=eq.active`,
    );
    for (const g of grants) {
      if (g.starts_at && Date.parse(g.starts_at) > agora) continue;
      if (g.ends_at && Date.parse(g.ends_at) <= agora) continue;
      ponha(g.contact?.email, g.contact?.full_name, `grant-${g.id}`, g.ends_at ?? null);
    }

    const r = await fetch(DIARIO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-token": DIARIO_TOKEN },
      body: JSON.stringify({ action: "sync", dry_run: corpo?.dry_run === true, itens: [...itens.values()] }),
      signal: AbortSignal.timeout(110000),
    });
    const resp = await r.json().catch(() => ({ erro: `diario ${r.status}` }));
    return json({ ok: r.ok, produtos: produtos.map((p) => p.slug), assinaturas: subs.length, avulsos: grants.length, na_lista: itens.size, diario: resp });
  } catch (e) {
    return json({ ok: false, erro: String(e).slice(0, 300) }, 500);
  }
});
