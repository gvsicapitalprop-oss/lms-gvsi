// trocar-email — o aluno troca o proprio e-mail de acesso (13/10/2026, pedido do dono).
//
// Duas etapas, sempre com o JWT do proprio aluno (verify_jwt=true, e o usuario e
// conferido aqui dentro pelo /auth/v1/user):
//   { acao: "pedir", novo_email }  -> codigo de 6 digitos vai para o e-mail ANTIGO
//   { acao: "confirmar", codigo }  -> com o codigo certo, troca em TUDO
//
// "Tudo" (o Hub identifica as pessoas pelo e-mail, e a hub-sync cria conta para
// e-mail ativo no Hub que nao existe aqui e bloqueia quem some do Hub):
//   1. contatos do Hub com o e-mail antigo;
//   2. login (auth.users) e lms_students;
//   3. registros da hub-sync (comu_hub_seen_active, comu_hub_blocked,
//      comu_onboard_blocklist), para ela nao estranhar a troca.
// Durante a troca os dois e-mails ficam em comu_onboard_blocklist: assim a
// hub-sync nao cria conta nova se rodar bem no meio (ela roda a cada 2 min).
//
// O codigo vale 15 minutos e 5 tentativas; so o hash fica gravado
// (lms_trocas_email, migracao/troca-email.sql na area-de-membros).
const HUB_URL = Deno.env.get("HUB_URL") ?? "";
const HUB_KEY = Deno.env.get("HUB_SERVICE_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const MOD = Deno.env.get("MOD_SECRET") ?? "";

const VALIDADE_MIN = 15;
const MAX_TENTATIVAS = 5;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const SH = { apikey: SVC, Authorization: `Bearer ${SVC}` };
const HH = { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}` };

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
async function rpc(fn: string, args: unknown): Promise<any> {
  return await rest("POST", `rpc/${fn}`, args, "return=representation");
}
async function hub(method: string, path: string, body?: unknown): Promise<any> {
  const r = await fetch(`${HUB_URL}/rest/v1/${path}`, {
    method,
    headers: { ...HH, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`hub ${method} ${r.status} ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// ilike acha o e-mail com maiusculas no Hub; o filtro exato tira os falsos
// positivos do "_" (curinga do LIKE). Igual a hub-accesses.
async function contatosDoHub(e: string): Promise<{ id: string; email: string }[]> {
  const lista = await hub("GET", `contacts?select=id,email&email=ilike.${encodeURIComponent(e)}&limit=20`);
  return (lista ?? []).filter((c: any) => String(c.email ?? "").trim().toLowerCase() === e);
}

async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function codigoNovo(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, "0");
}
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function mascarar(e: string): string {
  const [u, d] = e.split("@");
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}

async function enviar(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/functions/v1/notify-email`, {
      method: "POST",
      headers: { "x-mod-secret": MOD, "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    });
    // a notify-email responde 200 mesmo quando falha: vale o "ok" do corpo
    const d = await r.json().catch(() => ({}));
    return r.ok && d?.ok === true;
  } catch (_e) {
    return false;
  }
}

const CAIXA = 'style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#191c1f"';
function emailDoCodigo(codigo: string, novo: string): string {
  return `<div ${CAIXA}>
  <h2 style="margin:0 0 12px;font-size:20px">Confirme a troca do seu e-mail</h2>
  <p style="margin:0 0 20px;line-height:1.5">Recebemos um pedido para trocar o e-mail de acesso da sua conta para <strong>${esc(novo)}</strong>. Para confirmar, digite este codigo na tela do seu perfil:</p>
  <div style="margin:0 0 8px;padding:18px 12px;border:1px solid #e6e9ed;border-radius:12px;background:#f7f9fa;text-align:center;font-size:34px;font-weight:bold;letter-spacing:8px;color:#191c1f">${codigo}</div>
  <p style="margin:0 0 20px;color:#707780;font-size:13px;text-align:center">O codigo vale por ${VALIDADE_MIN} minutos e so funciona uma vez.</p>
  <p style="margin:0;color:#707780;font-size:13px;line-height:1.5">Se voce nao pediu essa troca, nao passe este codigo para ninguem e troque a sua senha: sem ele, o e-mail continua o mesmo.</p>
</div>`;
}
function emailDeAviso(antigo: string, novo: string): string {
  return `<div ${CAIXA}>
  <h2 style="margin:0 0 12px;font-size:20px">Seu e-mail de acesso foi trocado</h2>
  <p style="margin:0 0 12px;line-height:1.5">O e-mail de acesso da sua conta passou de <strong>${esc(antigo)}</strong> para <strong>${esc(novo)}</strong>. A partir de agora, entre com o novo e-mail. Sua senha continua a mesma.</p>
  <p style="margin:0;color:#707780;font-size:13px;line-height:1.5">Se voce nao fez essa troca, fale com o nosso suporte o quanto antes.</p>
</div>`;
}

async function pedir(u: { id: string; email: string }, novoBruto: unknown, ip: string | null) {
  const antigo = u.email.trim().toLowerCase();
  const novo = String(novoBruto ?? "").trim().toLowerCase();
  if (!EMAIL_OK.test(novo) || novo.length > 200) return J({ ok: false, erro: "email-invalido" });
  if (novo === antigo) return J({ ok: false, erro: "mesmo-email" });

  // 3 pedidos a cada 15 minutos por aluno: cada pedido manda um e-mail.
  const livre = await rpc("lms_rate_limit_hit", { p_chave: `troca-email:${u.id}`, p_limite: 3, p_janela: "15 minutes" });
  if (livre === false) return J({ ok: false, erro: "muitos-pedidos" });

  if (await rpc("lms_email_em_uso", { p_email: novo })) return J({ ok: false, erro: "email-em-uso" });
  // O e-mail novo ja tem cadastro proprio no Hub (outra compra, por exemplo):
  // juntar dois contatos e caso para o suporte, nao para a troca automatica.
  if ((await contatosDoHub(novo)).length > 0) return J({ ok: false, erro: "email-no-hub" });

  // Um pedido por vez: o anterior deixa de valer.
  await rest("PATCH", `lms_trocas_email?student_id=eq.${u.id}&confirmado_em=is.null&cancelado_em=is.null`, {
    cancelado_em: new Date().toISOString(),
  });

  const id = crypto.randomUUID();
  const codigo = codigoNovo();
  await rest("POST", "lms_trocas_email", {
    id,
    student_id: u.id,
    email_antigo: antigo,
    email_novo: novo,
    codigo_hash: await sha256(id + codigo),
    expira_em: new Date(Date.now() + VALIDADE_MIN * 60_000).toISOString(),
    ip_address: ip,
  });

  const foi = await enviar(antigo, `${codigo} e o seu codigo para trocar o e-mail`, emailDoCodigo(codigo, novo));
  if (!foi) {
    await rest("PATCH", `lms_trocas_email?id=eq.${id}`, { cancelado_em: new Date().toISOString() });
    return J({ ok: false, erro: "envio-falhou" });
  }
  return J({ ok: true, enviado_para: mascarar(antigo), novo_email: novo, validade_min: VALIDADE_MIN });
}

async function confirmar(u: { id: string; email: string }, codigoBruto: unknown, ip: string | null) {
  const codigo = String(codigoBruto ?? "").replace(/\D/g, "");
  const agora = new Date().toISOString();
  const [pedido] = (await rest(
    "GET",
    `lms_trocas_email?select=*&student_id=eq.${u.id}&confirmado_em=is.null&cancelado_em=is.null&order=criado_em.desc&limit=1`,
  )) ?? [];
  if (!pedido) return J({ ok: false, erro: "sem-pedido" });
  if (new Date(pedido.expira_em).getTime() < Date.now()) {
    await rest("PATCH", `lms_trocas_email?id=eq.${pedido.id}`, { cancelado_em: agora });
    return J({ ok: false, erro: "codigo-expirado" });
  }

  const tentativas = (pedido.tentativas ?? 0) + 1;
  const certo = codigo.length === 6 && iguais(await sha256(pedido.id + codigo), pedido.codigo_hash);
  if (!certo) {
    const esgotou = tentativas >= MAX_TENTATIVAS;
    await rest("PATCH", `lms_trocas_email?id=eq.${pedido.id}`, {
      tentativas,
      ...(esgotou ? { cancelado_em: agora } : {}),
    });
    return J({ ok: false, erro: esgotou ? "tentativas-esgotadas" : "codigo-errado", restantes: MAX_TENTATIVAS - tentativas });
  }
  // Marca o uso antes de trocar: um segundo clique nao repete a troca.
  await rest("PATCH", `lms_trocas_email?id=eq.${pedido.id}`, { tentativas, confirmado_em: agora });

  const antigo = String(pedido.email_antigo);
  const novo = String(pedido.email_novo);
  const desfazerPedido = () => rest("PATCH", `lms_trocas_email?id=eq.${pedido.id}`, { confirmado_em: null, cancelado_em: agora });

  // O e-mail da conta mudou depois do pedido (outra troca, o suporte): o codigo nao vale mais.
  if (u.email.trim().toLowerCase() !== antigo) {
    await desfazerPedido();
    return J({ ok: false, erro: "sem-pedido" });
  }
  // Alguem pode ter ocupado o e-mail novo nesses minutos.
  if ((await rpc("lms_email_em_uso", { p_email: novo })) || (await contatosDoHub(novo)).length > 0) {
    await desfazerPedido();
    return J({ ok: false, erro: "email-em-uso" });
  }

  // Trava da hub-sync durante a troca. So apaga no fim o que ela mesma inseriu.
  const travas: string[] = [];
  for (const e of [antigo, novo]) {
    const ja = await rest("GET", `comu_onboard_blocklist?select=email&email=eq.${encodeURIComponent(e)}`);
    if (!ja?.length) {
      await rest("POST", "comu_onboard_blocklist", { email: e, reason: "troca de e-mail em andamento" });
      travas.push(e);
    }
  }

  const contatos = await contatosDoHub(antigo);
  let hubTrocado = false;
  try {
    // 1) Hub primeiro: se falhar, nada mudou em lugar nenhum.
    if (contatos.length) {
      await hub("PATCH", `contacts?id=in.(${contatos.map((c) => c.id).join(",")})`, { email: novo });
      hubTrocado = true;
    }

    // 2) Login. Se falhar, devolve o Hub como estava.
    const r = await fetch(`${SB_URL}/auth/v1/admin/users/${u.id}`, {
      method: "PUT",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ email: novo, email_confirm: true }),
    });
    if (!r.ok) throw new Error(`auth ${r.status} ${(await r.text()).slice(0, 200)}`);

    // 3) Cadastro e registros da hub-sync. A partir daqui o login ja mudou:
    // erro em algum destes so vai para o log, nao desfaz a troca.
    const passos: [string, string][] = [
      ["lms_students", `id=eq.${u.id}`],
      ["comu_hub_seen_active", `email=eq.${encodeURIComponent(antigo)}`],
      ["comu_hub_blocked", `email=eq.${encodeURIComponent(antigo)}`],
    ];
    for (const [tabela, filtro] of passos) {
      try {
        await rest("PATCH", `${tabela}?${filtro}`, { email: novo });
      } catch (e) {
        console.error(`[trocar-email] ${tabela}: ${e}`);
      }
    }
    // A blocklist antiga (quem nao deve ganhar conta) acompanha a pessoa, se
    // ja existia antes desta troca.
    if (!travas.includes(antigo)) {
      try {
        await rest("PATCH", `comu_onboard_blocklist?email=eq.${encodeURIComponent(antigo)}`, { email: novo });
      } catch (e) {
        console.error(`[trocar-email] blocklist: ${e}`);
      }
    }
  } catch (e) {
    console.error(`[trocar-email] ${u.id}: ${e}`);
    if (hubTrocado) {
      try {
        await hub("PATCH", `contacts?id=in.(${contatos.map((c) => c.id).join(",")})`, { email: antigo });
      } catch (e2) {
        console.error(`[trocar-email] NAO DESFEZ O HUB ${antigo} -> ${novo}: ${e2}`);
      }
    }
    await desfazerPedido();
    return J({ ok: false, erro: "troca-falhou" });
  } finally {
    for (const e of travas) {
      try {
        await rest("DELETE", `comu_onboard_blocklist?email=eq.${encodeURIComponent(e)}`);
      } catch (e2) {
        console.error(`[trocar-email] trava ${e} ficou: ${e2}`);
      }
    }
  }

  try {
    await rest("POST", "lms_access_logs", {
      event: "email_changed",
      student_id: u.id,
      details: { de: antigo, para: novo, contatos_hub: contatos.length },
      ip_address: ip,
    });
  } catch (e) {
    console.error(`[trocar-email] diario: ${e}`);
  }
  // Aviso nos dois enderecos: o antigo fica sabendo se nao foi ele.
  await Promise.all([
    enviar(antigo, "Seu e-mail de acesso foi trocado", emailDeAviso(antigo, novo)),
    enviar(novo, "Seu e-mail de acesso foi trocado", emailDeAviso(antigo, novo)),
  ]);
  return J({ ok: true, email: novo });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const ur = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: req.headers.get("Authorization") || "" },
    });
    if (!ur.ok) return J({ ok: false, erro: "nao-logado" }, 401);
    const user = await ur.json();
    if (!user?.id || !user?.email) return J({ ok: false, erro: "nao-logado" }, 401);

    const body = await req.json().catch(() => ({}));
    // Quem chama e o servidor da area de membros: o IP do aluno vem no corpo
    // (so para o registro; a coluna e inet, entao precisa ter cara de IP).
    const bruto = String(body?.ip ?? "").trim();
    const ip = /^[0-9a-f:.]+$/i.test(bruto) && bruto.length <= 45 ? bruto : null;
    if (body?.acao === "pedir") return await pedir(user, body.novo_email, ip);
    if (body?.acao === "confirmar") return await confirmar(user, body.codigo, ip);
    return J({ ok: false, erro: "acao-desconhecida" }, 400);
  } catch (e) {
    console.error(`[trocar-email] ${e}`);
    return J({ ok: false, erro: "erro-interno" }, 500);
  }
});
