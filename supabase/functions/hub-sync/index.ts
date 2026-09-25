// Edge Function: hub-sync — espelha na comunidade os acessos do Hub Central (assinaturas + acessos avulsos).
// CRIA quem tem acesso ATIVO (assinatura ou avulso). NUNCA exclui. Respeita a lista de bloqueio e nunca mexe em admin.
// BLOQUEIO (auth ban, reversível — NÃO é o "demitido"/comu_bans): quem TINHA avulso e ficou sem acesso ativo é
//   bloqueado, mas SÓ FORWARD-ONLY — só quem foi visto ativo a partir de agora (ledger comu_hub_seen_active).
//   Os inativos que já existiam no lançamento nunca entram no ledger => ficam de fora sozinhos (grandfather).
//   Renovou o acesso (voltou pra ativo) => desbloqueia sozinho.
// Assinatura vencida (quem NUNCA teve avulso) NÃO bloqueia, por decisão do dono.
// Protegida por x-mod-secret. ?dry=1 = só conta, não escreve nada.
const SECRET = Deno.env.get("MOD_SECRET") ?? "";
const HUB_URL = Deno.env.get("HUB_URL") ?? "";
const HUB_KEY = Deno.env.get("HUB_SERVICE_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TEMP = "gvsi!acesso-inicial#2026";
const BAN = "876000h"; // ~100 anos

// Tópicos restritos por produto (allowlist em comu_topic_access; RLS mostra/esconde sozinho).
const TOPIC_CR = "43451d98-5eb8-4f8d-a710-4d2d374d56db"; // Construindo Riqueza
const TOPIC_SALA = "7acf1d70-316b-4958-a037-3d39b0eda7c2"; // Sala Ao Vivo
const PROD_CR = new Set(["1267657e-570e-43bd-802c-045ffba79232", "7d32bbe8-1aac-482b-b5d1-6ddb0fbfe79e"]); // Construindo Riqueza + combo
const PROD_SALA = new Set(["75bca71b-d9fb-41fe-a36d-d5eb4f8e7892", "7d32bbe8-1aac-482b-b5d1-6ddb0fbfe79e"]); // Sala Ao Vivo + combo
// Bônus: quem comprou o Master Trader a partir da abertura das vendas (12/08/2026) ganha a Sala Ao Vivo
// por 6 meses contados da compra (Master + Bônus), enquanto o Master estiver ativo.
const PROD_MASTER = "61b9d5b6-76ed-46df-8e43-fb4c0812ce1d"; // Programa Master Trader
const MASTER_BONUS_DESDE = "2026-08-12";
const MASTER_BONUS_MESES = 6;
function masterBonusValido(createdAt: string | null | undefined): boolean {
  if (!createdAt || createdAt.slice(0, 10) < MASTER_BONUS_DESDE) return false;
  const fim = new Date(createdAt); fim.setMonth(fim.getMonth() + MASTER_BONUS_MESES);
  return fim.getTime() >= Date.now();
}

function clean(s: string): string {
  s = (s || "").replace(/[|_-]/g, " ").replace(/[^A-Za-zÀ-ÿ ]/g, "");
  return s.split(/\s+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

async function hubGet(path: string): Promise<any[]> {
  const out: any[] = []; let off = 0;
  for (;;) {
    const r = await fetch(`${HUB_URL}/rest/v1/${path}${path.includes("?") ? "&" : "?"}limit=1000&offset=${off}`, {
      headers: { apikey: HUB_KEY, Authorization: `Bearer ${HUB_KEY}` },
    });
    if (!r.ok) throw new Error("hub " + r.status + " " + (await r.text()).slice(0, 200));
    const d = await r.json();
    out.push(...d);
    if (d.length < 1000) break;
    off += 1000;
  }
  return out;
}

async function commGet(path: string): Promise<any[]> {
  const out: any[] = []; let off = 0;
  for (;;) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}${path.includes("?") ? "&" : "?"}limit=1000&offset=${off}`, {
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    });
    if (!r.ok) throw new Error("comm " + r.status + " " + (await r.text()).slice(0, 200));
    const d = await r.json();
    out.push(...d);
    if (d.length < 1000) break;
    off += 1000;
  }
  return out;
}

function authBan(id: string, duration: string): Promise<Response> {
  return fetch(`${SB_URL}/auth/v1/admin/users/${id}`, {
    method: "PUT",
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ban_duration: duration }),
  });
}

async function commWrite(method: string, path: string, body: unknown): Promise<void> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok && r.status !== 409) throw new Error("commWrite " + method + " " + r.status + " " + (await r.text()).slice(0, 150));
}

// Reconcilia a allowlist de UM tópico: adiciona quem deve ver e tira quem não deve mais. (dry = só conta.)
async function syncTopicAccess(topicId: string, wantIds: Set<string>, dry: boolean): Promise<{ add: number; del: number }> {
  const curRows = await commGet(`comu_topic_access?topic_id=eq.${topicId}&select=user_id`);
  const cur = new Set(curRows.map((r) => String(r.user_id)));
  const toAdd = [...wantIds].filter((id) => !cur.has(id));
  const toDel = [...cur].filter((id) => !wantIds.has(id));
  if (!dry) {
    if (toAdd.length) await commWrite("POST", "comu_topic_access", toAdd.map((id) => ({ topic_id: topicId, user_id: id })));
    if (toDel.length) await commWrite("DELETE", `comu_topic_access?topic_id=eq.${topicId}&user_id=in.(${toDel.join(",")})`, null);
  }
  return { add: toAdd.length, del: toDel.length };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.headers.get("x-mod-secret") !== SECRET) return new Response("forbidden", { status: 403 });
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const today = new Date().toISOString().slice(0, 10) + "T00:00:00";

    // 1) assinaturas do hub -> e-mails com acesso ATIVO (status=active, access_enabled!=false, não expirada)
    const subs = await hubGet("subscriptions?select=status,access_enabled,expires_at,created_at,product_id,contact:contact_id(email,full_name)");
    const active = new Map<string, string>(); // email -> nome
    const crEmails = new Set<string>(); const salaEmails = new Set<string>(); // acesso ATIVO por produto (para os tópicos restritos)
    // Quem tem direito de verdade, para BLOQUEAR/DESBLOQUEAR: assinatura ativa e não
    // vencida, com ou sem o "controle de acesso" do Hub ligado. access_enabled só diz se
    // o Hub sincroniza o acesso daquela assinatura (hub-central lib/subscription-access.ts),
    // não que o aluno perdeu o direito. Ler como "sem acesso" baniu 22 alunos com Master
    // Trader ativo quando o bônus da Sala acabou (corrigido em 25/09/2026, ok do dono).
    // A CRIAÇÃO de contas continua só com access_enabled != false.
    const comDireito = new Set<string>();
    for (const s of subs) {
      const c = s.contact || {}; const e = String(c.email || "").trim().toLowerCase();
      if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) continue;
      const valid = !s.expires_at || s.expires_at >= today;
      if (s.status === "active" && valid) comDireito.add(e);
      if (s.status === "active" && s.access_enabled !== false && valid) {
        if (!active.has(e)) active.set(e, clean(c.full_name || "") || clean(e.split("@")[0]));
        if (PROD_CR.has(s.product_id)) crEmails.add(e);
        if (PROD_SALA.has(s.product_id)) salaEmails.add(e);
        if (s.product_id === PROD_MASTER && masterBonusValido(s.created_at)) salaEmails.add(e); // bônus Master
      }
    }

    // 1b) acessos AVULSOS ATIVOS do hub (/assinaturas/acessos). Qualquer produto conta como acesso à comunidade.
    const grants = await hubGet("access_grants?select=status,ends_at,created_at,product_id,contact:contact_id(email,full_name)&status=eq.active");
    for (const g of grants) {
      const c = g.contact || {}; const e = String(c.email || "").trim().toLowerCase();
      if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) continue;
      const valid = !g.ends_at || g.ends_at >= today;
      if (valid) {
        comDireito.add(e);
        if (!active.has(e)) active.set(e, clean(c.full_name || "") || clean(e.split("@")[0]));
        if (PROD_CR.has(g.product_id)) crEmails.add(e);
        if (PROD_SALA.has(g.product_id)) salaEmails.add(e);
        if (g.product_id === PROD_MASTER && masterBonusValido(g.created_at)) salaEmails.add(e); // bônus Master
      }
    }

    // 1c) universo de quem TEM avulso (qualquer status) -> só essas pessoas podem ser bloqueadas por expiração de avulso.
    const allGrants = await hubGet("access_grants?select=contact:contact_id(email)");
    const grantPeople = new Set(allGrants.map((g) => String((g.contact || {}).email || "").trim().toLowerCase()).filter(Boolean));

    // 2) comunidade: membros (id/email/role) + blocklist + estado (ledger de vistos-ativos + já-bloqueados)
    const memberRows = await commGet("lms_students?select=id,email,role");
    const existing = new Set(memberRows.map((r) => String(r.email || "").trim().toLowerCase()));
    const emailToId = new Map<string, string>(memberRows.map((m) => [String(m.email || "").trim().toLowerCase(), String(m.id)]));
    const idsFor = (emails: Set<string>) => { const s = new Set<string>(); for (const e of emails) { const id = emailToId.get(e); if (id) s.add(id); } return s; };
    const crIds = idsFor(crEmails); const salaIds = idsFor(salaEmails);
    const blockRows = await commGet("comu_onboard_blocklist?select=email");
    const blocked = new Set(blockRows.map((r) => String(r.email || "").trim().toLowerCase()));
    const seenRows = await commGet("comu_hub_seen_active?select=email");
    const seen = new Set(seenRows.map((r) => String(r.email || "").trim().toLowerCase())); // vistos ativos antes DESTE run
    const blkRows = await commGet("comu_hub_blocked?select=email");
    const blockedNow = new Set(blkRows.map((r) => String(r.email || "").trim().toLowerCase()));

    // 3) quem CRIAR (tem acesso ativo e ainda não é membro)
    const toCreate: [string, string][] = [];
    for (const [e, n] of active) { if (!existing.has(e) && !blocked.has(e)) toCreate.push([e, n]); }

    // 3b) quem BLOQUEAR (forward-only): membro, teve avulso, sem acesso ativo, não-admin, JÁ foi visto ativo, ainda não bloqueado.
    const toBlock = memberRows.filter((m) => {
      const e = String(m.email || "").trim().toLowerCase();
      return e && m.role !== "admin" && grantPeople.has(e) && !comDireito.has(e) && seen.has(e) && !blockedNow.has(e);
    });
    // 3c) quem DESBLOQUEAR (renovou): membro que voltou a ter acesso ativo e está bloqueado por nós.
    const toUnblock = memberRows.filter((m) => {
      const e = String(m.email || "").trim().toLowerCase();
      return e && comDireito.has(e) && blockedNow.has(e);
    });

    if (dry) {
      const tCr = await syncTopicAccess(TOPIC_CR, crIds, true);
      const tSala = await syncTopicAccess(TOPIC_SALA, salaIds, true);
      return new Response(JSON.stringify({
        dry: true, hub_active: active.size, hub_grants: grants.length, avulso_pessoas: grantPeople.size,
        comunidade: existing.size, vistos_ativos: seen.size, ja_bloqueados: blockedNow.size,
        criaria: toCreate.length, amostra: toCreate.slice(0, 5).map((x) => x[0]),
        bloquearia: toBlock.length, amostra_bloqueio: toBlock.slice(0, 8).map((m) => m.email),
        desbloquearia: toUnblock.length,
        topico_cr: { tem: crIds.size, adiciona: tCr.add, remove: tCr.del },
        topico_sala: { tem: salaIds.size, adiciona: tSala.add, remove: tSala.del },
      }), { headers: { "Content-Type": "application/json" } });
    }

    // 4) cria os que faltam
    let created = 0; const errs: string[] = [];
    for (const [email, name] of toCreate) {
      const cr = await fetch(`${SB_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: TEMP, email_confirm: true }),
      });
      if (cr.ok) {
        const u = await cr.json();
        await fetch(`${SB_URL}/rest/v1/lms_students`, {
          method: "POST",
          headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ id: u.id, email, full_name: name, role: "student", needs_password: true }),
        });
        created++;
      } else if (errs.length < 5) { errs.push(email + ": " + cr.status); }
    }

    // 5) LEDGER forward-only: registra os ativos deste run (só os que ainda não estavam no ledger).
    const novosVistos = [...active.keys()].filter((e) => !seen.has(e)).map((e) => ({ email: e }));
    if (novosVistos.length) {
      await fetch(`${SB_URL}/rest/v1/comu_hub_seen_active`, {
        method: "POST",
        headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(novosVistos),
      });
    }

    // 6) BLOQUEIA (auth ban) + registra
    let banned = 0;
    for (const m of toBlock) {
      const e = String(m.email || "").trim().toLowerCase();
      const r = await authBan(String(m.id), BAN);
      if (r.ok) {
        await fetch(`${SB_URL}/rest/v1/comu_hub_blocked`, {
          method: "POST",
          headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify({ email: e, user_id: m.id }),
        });
        banned++;
      } else if (errs.length < 5) { errs.push("ban " + e + ": " + r.status); }
    }

    // 7) DESBLOQUEIA quem renovou (tira o ban + remove do registro)
    let unbanned = 0;
    for (const m of toUnblock) {
      const e = String(m.email || "").trim().toLowerCase();
      const r = await authBan(String(m.id), "none");
      if (r.ok) {
        await fetch(`${SB_URL}/rest/v1/comu_hub_blocked?email=eq.${encodeURIComponent(e)}`, {
          method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
        });
        unbanned++;
      }
    }

    // 8) TÓPICOS restritos por produto: reconcilia a allowlist (aparece/some sozinho pela RLS).
    const tCr = await syncTopicAccess(TOPIC_CR, crIds, false);
    const tSala = await syncTopicAccess(TOPIC_SALA, salaIds, false);

    return new Response(JSON.stringify({ ok: true, hub_active: active.size, hub_grants: grants.length, criados: created, bloqueados: banned, desbloqueados: unbanned, topico_cr: tCr, topico_sala: tSala, erros: errs }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
