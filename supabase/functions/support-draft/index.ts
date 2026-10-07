// support-draft — gera a resposta OCULTA do "Bruno" pra revisão humana (HITL).
// MULTIMODAL: lê texto, IMAGEM (visão gpt-4o-mini) e ÁUDIO (transcrição Whisper) do histórico do ticket.
// NÃO envia nada ao aluno: só cria um rascunho pendente em comu_ai_drafts.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { aplicarLink, juntarTrechos, montarAula, notaDaAula } from "./aula-indicada.ts";
import { AVISO_PADRAO, decidirAuto, estadoDoJuiz, INSTRUCAO_CONFERENCIA, lerConferencia } from "./autonomia.ts";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const MOD_SECRET = Deno.env.get("MOD_SECRET") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHISPER_URL = Deno.env.get("WHISPER_URL") ?? "";
const WHISPER_SECRET = Deno.env.get("WHISPER_SECRET") ?? "";
const H = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json"
};
async function rest(path, init) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init || {},
    headers: {
      ...H,
      ...init && init.headers || {}
    }
  });
  if (!r.ok) throw new Error("rest " + r.status + " " + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function openai(path, body) {
  const r = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error("openai " + path + " " + r.status + " " + (await r.text()).slice(0, 160));
  return await r.json();
}
// transcreve um áudio do aluno. Nunca derruba o fluxo: falhou -> "".
// fallback: Whisper da OpenAI (whisper-1), usado se a VPS falhar/estiver fora.
async function transcribeOpenAI(url) {
  try {
    const a = await fetch(url);
    if (!a.ok) return "";
    const blob = await a.blob();
    const base = String(url).split("?")[0].split("/").pop() || "audio.webm";
    const name = /\.(webm|mp3|mp4|m4a|ogg|oga|wav|mpeg|mpga)$/i.test(base) ? base : "audio.webm";
    const fd = new FormData();
    fd.append("file", blob, name);
    fd.append("model", "whisper-1");
    fd.append("language", "pt");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: fd
    });
    if (!r.ok) return "";
    const j = await r.json();
    return (j.text || "").trim();
  } catch (_e) {
    return "";
  }
}
// primário: VPS faster-whisper (large-v3-turbo, barato e >= whisper-1). Cai pro OpenAI se falhar.
async function transcribe(url) {
  if (WHISPER_URL && WHISPER_SECRET) {
    try {
      const c = new AbortController();
      // teto curto: se a VPS demorar (ocupada/áudio longo), aborta e cai pro OpenAI,
      // pra caber no limite de 150s do gateway das Edge Functions.
      const to = setTimeout(()=>c.abort(), 60000);
      const r = await fetch(WHISPER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth": WHISPER_SECRET
        },
        body: JSON.stringify({
          url
        }),
        signal: c.signal
      });
      clearTimeout(to);
      if (r.ok) {
        const j = await r.json();
        return (j.text || "").trim();
      }
    } catch (_e) {}
  }
  return await transcribeOpenAI(url);
}
const ok = (o)=>new Response(JSON.stringify(o), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });

// ---------------------------------------------------------------------------
// Triagem com o Jev (TypeSafe). Devolve decisões curtas e CALIBRADAS em ~0,3s:
// assunto da mensagem, se é só cortesia e se o caso precisa de gente.
// Usamos isso para dois fins: responder cortesia na hora e, no resto, só anotar
// o veredito no rascunho (modo sombra) para o dono comparar antes de ligar mais.
// Nunca derruba o fluxo: se falhar ou demorar, devolve null e tudo segue como antes.
const JEV_KEY = Deno.env.get("JEV_API_KEY") ?? "";
const JEV_CATS = {
  cortesia: "Só agradecimento, saudação, despedida ou confirmação curta ('obrigado', 'bom dia', 'ok', 'entendi'). Não pede nada nem faz pergunta nova.",
  acesso: "Acesso, liberação, assinatura, Sala ao Vivo, login, senha, área de membros, link da aula.",
  plataforma: "Dúvida técnica do MetaTrader 5: instalação, configuração, gráfico, indicadores, conta demo.",
  financeiro: "Pagamento, boleto, cartão, reembolso, cobrança, renovação.",
  conteudo: "Dúvida sobre as aulas, estratégia, operação ou mercado.",
  outro: "Qualquer coisa que não caiba nas anteriores."
};
async function jevTriagem(pergunta) {
  if (!JEV_KEY || !pergunta) return null;
  try {
    const r = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${JEV_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        state: String(pergunta).slice(0, 1500),
        model: "jev-latest",
        questions: {
          categoria: { type: "choice", instructions: "Em que assunto se encaixa a mensagem do aluno para o suporte?", criteria: JEV_CATS },
          so_cortesia: { type: "noul", instructions: "A mensagem é apenas cortesia (agradecimento, saudação, 'ok', 'entendi'), sem nenhum pedido ou pergunta nova?" },
          insatisfeito: { type: "noul", instructions: "O aluno diz que a resposta anterior não resolveu, repete a mesma dúvida, reclama do atendimento automático ou pede para falar com uma pessoa?" },
          precisa_humano: { type: "noul", instructions: "Para responder isto é preciso consultar dados da conta do aluno (acesso, pagamento, datas) ou executar uma ação que só a equipe pode fazer?" },
          mesa: { type: "noul", instructions: "O aluno está pedindo acesso, ativação ou instruções da MESA PROPRIETÁRIA que comprou (conta de avaliação/teste), ou dizendo que comprou a mesa e não recebeu nada?" },
          quer_aula: { type: "noul", instructions: "O aluno tem uma dúvida de conteúdo (estratégia, operação, leitura do gráfico, mercado, gestão de risco, psicologia, ferramentas do método) ou pede uma aula ou explicação sobre um assunto que pode estar ensinado nas aulas dos cursos?" },
          tipo_cortesia: { type: "choice", instructions: "Se for cortesia, de que tipo é?", criteria: {
            agradecimento: "Agradece ou encerra ('obrigado', 'valeu', 'era isso mesmo').",
            saudacao: "Só cumprimenta, abrindo conversa ('bom dia', 'boa noite, tudo bem?').",
            confirmacao: "Confirma que entendeu ou que vai testar ('ok', 'entendi', 'vou testar').",
            nao_cortesia: "Não é cortesia."
          } }
        }
      })
    });
    if (!r.ok) return null;
    const d = await r.json();
    const a = (d && d.answers) || d || {};
    const pega = (x)=>x && (x.choice ?? x.value ?? x.noul);
    return {
      categoria: pega(a.categoria),
      categoria_conf: a.categoria && a.categoria.confidence,
      so_cortesia: pega(a.so_cortesia),
      mesa: pega(a.mesa),
      insatisfeito: pega(a.insatisfeito),
      quer_aula: pega(a.quer_aula),
      precisa_humano: pega(a.precisa_humano),
      tipo_cortesia: pega(a.tipo_cortesia),
      em: new Date().toISOString()
    };
  } catch (_e) {
    return null;
  }
}
// ---------------------------------------------------------------------------
// Aula indicada (migração 20261006000032, pedido do dono em 06/10/2026): a busca nas
// transcrições traz as aulas mais próximas da dúvida (lms_buscar_aulas) e o Jev escolhe qual
// explica o assunto, ou nenhuma. O link (com o minuto) é montado em aula-indicada.ts: a IA nunca
// escreve link.
// Antes de sair sozinha, a resposta é conferida afirmação por afirmação contra os trechos da aula
// e a base aprovada (autonomia.ts). Falhou ou demorou: nota null, e a resposta não sai sozinha.
async function conferirResposta(estado) {
  try {
    const r = await openai("chat/completions", {
      model: "gpt-4.1-mini",
      temperature: 0,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INSTRUCAO_CONFERENCIA },
        { role: "user", content: String(estado).slice(0, 9000) }
      ]
    });
    return lerConferencia(r.choices[0].message.content);
  } catch (_e) {
    return { nota: null, sem_base: [] };
  }
}
async function jevEscolheAula(pergunta, candidatas) {
  if (!JEV_KEY || !candidatas.length) return null;
  const criteria = {};
  candidatas.forEach((c, i)=>{
    criteria["aula_" + (i + 1)] = `${c.curso}${c.modulo ? " > " + c.modulo : ""} > ${c.aula}: ${String(c.trecho || "").replace(/\s+/g, " ").slice(0, 300)}`;
  });
  criteria.nenhuma = "Nenhuma dessas aulas explica o assunto da dúvida do aluno.";
  try {
    const r = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${JEV_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        state: String(pergunta).slice(0, 1500),
        model: "jev-latest",
        questions: { aula: { type: "choice", instructions: "Qual destas aulas explica o assunto da dúvida do aluno, a ponto de valer indicar a aula para ele assistir? Escolha 'nenhuma' se nenhuma trata desse assunto.", criteria } }
      })
    });
    if (!r.ok) return null;
    const d = await r.json();
    const a = (d && d.answers && d.answers.aula) || {};
    const escolha = a.choice ?? a.value;
    const confianca = Number(a.confidence);
    if (!escolha || escolha === "nenhuma") return { escolha: null, confianca };
    return { escolha: candidatas[Number(String(escolha).replace("aula_", "")) - 1] || null, confianca };
  } catch (_e) {
    return null;
  }
}
// Respostas curtas de cortesia. Texto fixo: não passa por modelo nenhum, não inventa nada.
function respostaCortesia(tipo, saud, nome) {
  const quem = nome ? ", " + nome : "";
  if (tipo === "saudacao") return `${saud}${quem}! Pode mandar sua dúvida por aqui que já te ajudo.`;
  if (tipo === "confirmacao") return `Combinado${quem}! Fico à disposição.`;
  return `Imagina${quem}! Qualquer coisa é só chamar por aqui.`;
}

// Acessos da pessoa no Hub Central: produtos, situação e até quando valem.
// Sem isto o Bruno respondia no escuro justamente no assunto mais comum do suporte
// (acesso: 28% das mensagens). Usa a hub-accesses pelo atalho de serviço.
async function acessosDoHub(email) {
  if (!email || email.indexOf("@") < 0) return null;
  try {
    const r = await fetch(`${SB_URL}/functions/v1/hub-accesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mod-secret": MOD_SECRET },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.ok ? d : null;
  } catch (_e) {
    return null;
  }
}
function dataBR(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch (_e) {
    return "";
  }
}

serve(async (req)=>{
  try {
    if (req.headers.get("x-mod-secret") !== MOD_SECRET) return new Response("forbidden", {
      status: 403
    });
    const { ticket_id, trigger_message_id, force } = await req.json();
    if (!ticket_id) return ok({
      ok: false,
      error: "sem ticket_id"
    });
    const cfgs = await rest(`comu_ai_support_config?select=*&limit=1`);
    const cfg = cfgs && cfgs[0];
    if ((!cfg || !cfg.enabled) && force !== true) return ok({
      ok: true,
      skipped: "disabled"
    });
    if (!OPENAI_KEY) return ok({
      ok: false,
      error: "sem openai key"
    });
    const tks = await rest(`comu_support_tickets?id=eq.${ticket_id}&select=id,user_id,status`);
    const tk = tks && tks[0];
    if (!tk) return ok({
      ok: false,
      error: "ticket inexistente"
    });
    if (tk.status && tk.status !== "aberto") return ok({
      ok: true,
      skipped: "ticket nao aberto"
    });
    // Economia: não refaz o rascunho à toa. MAS o de antes só pode ficar de pé se
    // ainda responde ao que o aluno perguntou. Ele mandava "bom dia", o rascunho nascia
    // em cima disso, e as perguntas que vinham depois NÃO geravam nada: a equipe via uma
    // sugestão genérica respondendo ao cumprimento (01/10/2026).
    let pendente = null;
    if (force !== true) {
      const pend = await rest(`comu_ai_drafts?ticket_id=eq.${ticket_id}&status=eq.pending&select=id,member_question&limit=1`);
      pendente = pend && pend[0] ? pend[0] : null;
    }
    // saudação correta pela HORA de Brasília + primeiro nome do aluno
    let hourSP = 12;
    try {
      hourSP = parseInt(new Date().toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        hour12: false
      }), 10);
    } catch (_e) {}
    if (!(hourSP >= 0 && hourSP <= 24)) hourSP = 12;
    const saud = hourSP >= 5 && hourSP < 12 ? "Bom dia" : hourSP >= 12 && hourSP < 18 ? "Boa tarde" : "Boa noite";
    let horaStr = "", diaSemana = "", dataStr = "";
    try {
      horaStr = new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    } catch (_e) {}
    try {
      diaSemana = new Date().toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "long"
      });
    } catch (_e) {}
    try {
      dataStr = new Date().toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    } catch (_e) {}
    // sala ao vivo = segunda, quarta e sexta 10h30 (fato fixo; espelha a secao 5 do prompt). Calculo o veredito do dia pra IA nao precisar raciocinar calendario.
    let wdEn = "";
    try {
      wdEn = new Date().toLocaleDateString("en-US", {
        timeZone: "America/Sao_Paulo",
        weekday: "long"
      });
    } catch (_e) {}
    const isSalaDay = wdEn === "Monday" || wdEn === "Wednesday" || wdEn === "Friday";
    let firstName = "";
    // A conta "Visitante (tela de login)" e COMPARTILHADA: todo mundo que escreve da tela de
    // login cai nela. Sem isto o Bruno lia a conversa de outra pessoa como se fosse do mesmo
    // aluno (chegou a chamar um aluno pelo nome de outro) e ainda vazava assunto alheio.
    let visitante = false;
    let emailAluno = "";
    try {
      const st = await rest(`lms_students?id=eq.${tk.user_id}&select=full_name,email`);
      emailAluno = String((st && st[0] && st[0].email) || "").trim().toLowerCase();
      visitante = emailAluno.indexOf("visitante-suporte@") === 0;
      const fn = st && st[0] && st[0].full_name;
      if (fn && String(fn).indexOf("@") < 0) {
        const p = String(fn).trim().split(/\s+/)[0];
        if (p && p.length >= 2) firstName = p;
      }
    } catch (_e) {}
    // nomes que a leitura/áudio erra: melhor NÃO falar o nome (cumprimenta sem ele)
    const NAME_OMIT = [
      "saymon",
      "saímon",
      "saimon"
    ];
    if (firstName && NAME_OMIT.indexOf(firstName.toLowerCase()) >= 0) firstName = "";
    if (visitante) firstName = ""; // "Visitante" nao e nome de ninguem
    // histórico recente do MESMO aluno, atravessando conversas (ele referencia coisas ditas em tickets anteriores)
    let tids = [
      ticket_id
    ];
    try {
      const others = visitante ? [] : await rest(`comu_support_tickets?user_id=eq.${tk.user_id}&select=id&order=created_at.desc&limit=8`);
      if (others && others.length) {
        tids = others.map((t)=>t.id);
        if (tids.indexOf(ticket_id) < 0) tids.unshift(ticket_id);
      }
    } catch (_e) {}
    const inList = "(" + tids.join(",") + ")";
    const raw = await rest(`comu_messages?ticket_id=in.${inList}&kind=in.(text,image,audio,video)&status=neq.deleted&select=id,author_id,body,kind,media_url,media_meta,ticket_id,created_at&order=created_at.desc&limit=22`);
    const msgs = (raw || []).slice().reverse();
    if (!msgs.length) return ok({
      ok: true,
      skipped: "sem mensagens"
    });
    const last = msgs[msgs.length - 1];
    if (last.author_id !== tk.user_id) return ok({
      ok: true,
      skipped: "ultima nao e do membro"
    });
    // transcreve os áudios do histórico (limita aos 4 mais recentes por custo/latência)
    const audioIdx = [];
    for(let i = msgs.length - 1; i >= 0 && audioIdx.length < 4; i--)if ((msgs[i].kind === "audio" || msgs[i].kind === "video") && msgs[i].media_url) audioIdx.push(i);
    const trans = {};
    await Promise.all(audioIdx.map(async (i)=>{
      const m = msgs[i];
      // cache: reusa a transcrição já salva em media_meta (evita re-chamar o transcritor)
      const cached = m.media_meta && typeof m.media_meta.transcript === "string" ? m.media_meta.transcript : null;
      if (cached !== null) {
        trans[i] = cached;
        return;
      }
      const t = await transcribe(m.media_url);
      trans[i] = t;
      // salva a transcrição de volta (best-effort; nunca derruba o fluxo)
      if (t && m.id) {
        try {
          const meta = Object.assign({}, m.media_meta || {}, {
            transcript: t,
            transcript_at: new Date().toISOString()
          });
          await rest(`comu_messages?id=eq.${m.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              media_meta: meta
            })
          });
        } catch (_e) {}
      }
    }));
    const whoOf = (m)=>m.author_id === tk.user_id ? "Aluno" : "Bruno";
    function lineText(m, i) {
      const who = whoOf(m);
      if (m.kind === "audio") {
        const t = trans[i];
        return `${who} (áudio): ${t || "(áudio, sem transcrição)"}`;
      }
      if (m.kind === "video") {
        const t = trans[i];
        return `${who} enviou um VÍDEO (gravação de tela)${m.body ? ' com a legenda: "' + String(m.body).trim() + '"' : ""}.` + (t ? ` Narração do vídeo: ${t}` : " (sem narração falada; você não consegue assistir o vídeo).");
      }
      if (m.kind === "image") return `${who} enviou uma imagem${m.body ? ' com a legenda: "' + String(m.body).trim() + '"' : ""}.`;
      return `${who}: ${(m.body || "").trim()}`;
    }
    // pergunta = últimas mensagens consecutivas do membro NO TICKET ATUAL (não cola o fim de uma conversa anterior)
    const q = [];
    for(let i = msgs.length - 1; i >= 0 && msgs[i].author_id === tk.user_id && msgs[i].ticket_id === ticket_id; i--){
      const m = msgs[i];
      if (m.kind === "audio") q.unshift(trans[i] || "");
      else if (m.kind === "video") q.unshift(((m.body ? String(m.body).trim() + " " : "") + (trans[i] ? trans[i] + " " : "") + "[vídeo]").trim());
      else if (m.kind === "image") q.unshift(((m.body ? String(m.body).trim() + " " : "") + "[imagem]").trim());
      else q.unshift((m.body || "").trim());
    }
    const member_question = q.join("\n").trim().slice(0, 1500) || "(o aluno enviou mídia)";

    // ---- Triagem (Jev) + resposta automática de cortesia -------------------
    // O veredito é guardado no rascunho mesmo quando não enviamos nada: é o modo
    // sombra, que deixa comparar o que a triagem TERIA feito antes de ligar mais.
    const jev = cfg.jev_enabled === false ? null : await jevTriagem(member_question);
    // pendente continua valendo se nada novo foi perguntado, ou se a última mensagem é
    // só cortesia (um "obrigado" no meio não invalida a resposta que já está pronta).
    if (pendente) {
      const mesmaPergunta = String(pendente.member_question || "") === member_question;
      const soCortesia = !!jev && Number(jev.so_cortesia ?? 0) >= 0.8 && cfg.auto_cortesia_enabled !== true;
      if (mesmaPergunta || soCortesia) return ok({
        ok: true,
        skipped: "rascunho pendente"
      });
    }
    if (jev && cfg.auto_cortesia_enabled === true) {
      const limite = Number(cfg.auto_cortesia_limite ?? 0.8);
      const doTicket = msgs.filter((m)=>m.ticket_id === ticket_id);
      const equipeJaFalou = doTicket.some((m)=>m.author_id !== tk.user_id);
      const tipo = jev.tipo_cortesia;
      // abertura ("bom dia") só no começo do atendimento; agradecimento/confirmação
      // só depois que a equipe falou — senão responderíamos "imagina" a quem ainda espera.
      const momentoOk = tipo === "saudacao" ? !equipeJaFalou : (tipo === "agradecimento" || tipo === "confirmacao") && equipeJaFalou;
      let jaAuto = 0;
      try {
        jaAuto = await rest(`rpc/comu_ai_auto_no_ticket`, { method: "POST", body: JSON.stringify({ p_ticket: ticket_id }) }) ?? 0;
      } catch (_e) {
        jaAuto = 99; // sem saber o teto, não arrisca
      }
      const pode = momentoOk && last.kind === "text" && member_question.length <= 160 && jaAuto < Number(cfg.auto_max_por_ticket ?? 2) && jev.categoria === "cortesia" && Number(jev.categoria_conf ?? 0) >= 0.8 && Number(jev.so_cortesia ?? 0) >= limite && Number(jev.precisa_humano ?? 1) < 0.5;
      if (pode) {
        const texto = respostaCortesia(tipo, saud, firstName);
        try {
          const ins0 = await rest(`comu_ai_drafts`, {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              ticket_id,
              member_id: tk.user_id,
              trigger_message_id: trigger_message_id || null,
              member_question,
              draft_body: texto,
              suggest_handoff: false,
              model: "jev-cortesia",
              auto_enviar_em: new Date(Date.now() + (25 + Math.floor(Math.random() * 50)) * 1000).toISOString(),
              knowledge_used: [],
              jev
            })
          });
          const id0 = ins0 && ins0[0] && ins0[0].id;
          if (id0) {
            return ok({ ok: true, auto: "cortesia agendada", draft_id: id0 });
          }
        } catch (e) {
          console.error("[support-draft] auto cortesia:", String(e).slice(0, 200));
        // cai no fluxo normal: vira sugestão para revisão humana
        }
      }
    }
    // status do aluno no desafio ativo (a IA precisa saber quem já está participando)
    let challengeNote = "";
    try {
      const chs = await rest(`comu_challenges?active=eq.true&select=id&order=start_date.desc&limit=1`);
      const ch = chs && chs[0];
      if (ch) {
        const p = await rest(`comu_challenge_participants?challenge_id=eq.${ch.id}&user_id=eq.${tk.user_id}&select=user_id&limit=1`);
        challengeNote = p && p.length ? "\n\n## STATUS DO ALUNO NO DESAFIO\nEste aluno JÁ ESTÁ PARTICIPANDO do desafio atual. Se ele perguntar sobre entrar/participar, apenas confirme que ele já está dentro e diga pra acompanhar o progresso no painel inicial. NUNCA peça pra ele se inscrever de novo." : "\n\n## STATUS DO ALUNO NO DESAFIO\nEste aluno AINDA NAO esta no desafio atual. Para entrar, ele precisa escrever no suporte exatamente a frase: quero participar do desafio. Oriente isso se ele quiser participar.";
      }
    } catch (_e) {}
    // conhecimento (RAG)
    let knowledge = [];
    let vecAulas = null; // a busca das aulas usa sempre text-embedding-3-small (coluna vector(1536))
    try {
      const emb = await openai("embeddings", {
        model: cfg.embed_model || "text-embedding-3-small",
        input: member_question
      });
      const vec = "[" + emb.data[0].embedding.join(",") + "]";
      if ((cfg.embed_model || "text-embedding-3-small") === "text-embedding-3-small") vecAulas = vec;
      knowledge = await rest(`rpc/comu_match_support_knowledge`, {
        method: "POST",
        body: JSON.stringify({
          query_embedding: vec,
          match_count: cfg.knowledge_top_k || 6
        })
      }) || [];
    } catch (_e) {
      knowledge = [];
    }
    // ---- Aula indicada --------------------------------------------------------
    // Só em dúvida de conteúdo, só para aluno identificado (o visitante da tela de login é uma
    // conta compartilhada: não dá para saber o que ele tem).
    let aula = null;
    const querAula = !visitante && !!jev && (["conteudo", "plataforma", "outro"].includes(jev.categoria) || Number(jev.quer_aula ?? 0) >= 0.4);
    if (querAula && cfg.aulas_enabled !== false) {
      try {
        if (!vecAulas) {
          const e2 = await openai("embeddings", { model: "text-embedding-3-small", input: member_question });
          vecAulas = "[" + e2.data[0].embedding.join(",") + "]";
        }
        const candidatas = (await rest(`rpc/lms_buscar_aulas`, {
          method: "POST",
          body: JSON.stringify({ p_embedding: vecAulas, p_aluno: tk.user_id, p_limite: 5, p_texto: member_question })
        }) || []).filter((c)=>Number(c.similaridade) >= Number(cfg.aulas_similaridade_min ?? 0.3));
        const ev = candidatas.length ? await jevEscolheAula(member_question, candidatas) : null;
        if (ev && ev.escolha && ev.confianca >= Number(cfg.aulas_limiar ?? 0.7)) aula = montarAula(ev.escolha, ev.confianca);
        if (aula && aula.situacao === "liberada") {
          // a explicação do Giovanni: os 3 trechos falados mais próximos da dúvida (20261007000035)
          const trechos = await rest(`rpc/lms_trechos_da_aula`, {
            method: "POST",
            body: JSON.stringify({ p_embedding: vecAulas, p_aula: aula.lesson_id, p_limite: 3 })
          }) || [];
          const junto = juntarTrechos(trechos);
          if (junto) aula.trecho = junto;
        }
      } catch (e) {
        console.error("[support-draft] aula indicada:", String(e).slice(0, 200));
      }
    }
    const kblock = knowledge.length ? knowledge.map((k, i)=>`(${i + 1}) P: ${k.question || ""}\nR: ${k.answer}`).join("\n\n") : "(sem base ainda — responda pelos FATOS FIXOS do seu prompt)";
    const corr = await rest(`comu_ai_corrections?inject_enabled=eq.true&select=member_question,reason,corrected_answer&order=created_at.desc&limit=${cfg.corrections_limit || 12}`) || [];
    const cblock = corr.length ? corr.map((c, i)=>`(${i + 1}) Pergunta: ${(c.member_question || "").slice(0, 160)}\nErro a evitar: ${c.reason}${c.corrected_answer ? `\nCerto: ${c.corrected_answer}` : ""}`).join("\n\n") : "(nenhuma)";
    const baseP = (cfg.system_prompt || "Você é Bruno, do suporte da GVSI.").replace(/\{saudacao\}/g, saud).replace(/\{hora_atual\}/g, horaStr).replace(/\{nome\}/g, firstName || "").replace(/\{context\}/g, "");
    const agora = "\n\n## AGORA — DATA, HORA, SAUDAÇÃO E NOME (OBRIGATÓRIO)\n- Agora em Brasília é " + (diaSemana || "?") + ", " + (dataStr || "") + ", " + (horaStr || "") + "h. A ÚNICA saudação correta agora é \"" + saud + "\" (nunca outra; ignore a hora que aparece nos prints do aluno, o que vale é esta)." + "\n- SALA AO VIVO HOJE: " + (isSalaDay ? "hoje (" + diaSemana + ") É dia de sala ao vivo (10h30). Se agora ja passou das 10h30, a de hoje ja aconteceu/esta rolando; se ainda nao, o link costuma sair perto do horario no topico Sala ao vivo, aqui na comunidade (nao existe mais grupo de WhatsApp da sala)." : "hoje (" + diaSemana + ") NAO tem sala ao vivo. A sala e SO segunda, quarta e sexta as 10h30.") + " Responda perguntas sobre a sala de HOJE com base nisso. NUNCA diga que o link de hoje foi enviado num dia que nao tem sala; nesse caso, avise que hoje nao tem e diga o proximo dia." + "\n- USE tambem o dia da semana e a hora pra qualquer outra pergunta que dependa disso, em vez de dar resposta generica." + (firstName ? "\n- O aluno se chama " + firstName + ". Ao cumprimentar, use o primeiro nome logo na primeira frase, assim: \"" + saud + ", " + firstName + ", tudo bem?\" e só depois vá ao assunto. Escreva o nome EXATAMENTE assim, letra por letra, sem trocar nenhuma letra: " + firstName + ". Se a conversa já estiver em andamento e não fizer sentido cumprimentar de novo, pode ir direto." : "\n- Se cumprimentar, use só \"" + saud + "\" SEM nome (não invente nem chute o nome do aluno).");
    // o e-mail aparece como autor das mensagens dele (a tela de login pede o e-mail)
    let visitanteNota = "";
    if (visitante) {
      let mail = "";
      for (let i = msgs.length - 1; i >= 0; i--) {
        const n = String(msgs[i].author_name || "");
        if (msgs[i].author_id === tk.user_id && n.indexOf("@") > 0) { mail = n.trim(); break; }
      }
      visitanteNota = [
        "",
        "## QUEM ESTA FALANDO (TELA DE LOGIN)",
        "Esta pessoa escreveu da TELA DE LOGIN, entao ainda NAO conseguiu entrar." + (mail ? " O e-mail que ela informou e " + mail + "." : " Ela ainda nao informou o e-mail; peca o e-mail da compra."),
        "- NUNCA a chame de 'Visitante': use o primeiro nome se ela disser, ou nao use nome nenhum.",
        "- O assunto e SEMPRE o acesso aos NOSSOS sistemas (area de membros e comunidade). NUNCA mande falar com a corretora (Global Prime) por senha, codigo ou login: a corretora nao tem nada a ver com isso.",
        "- Senha da area de membros: a pessoa usa 'Esqueci minha senha' / 'Criar minha senha' com o e-mail da compra e recebe um codigo por e-mail, que vale 1 hora. Se nao chegar, mande conferir spam e confirmar se e o mesmo e-mail da compra. O suporte tambem gera esse codigo pelo painel."
      ].join("\n");
    }
    // Mesa proprietária: a liberação é manual, feita pela equipe. Marca a tarefa no
    // atendimento (vira etiqueta "Ativar mesa" e cai na aba URGENTE) e deixa o Bruno
    // avisar a pessoa de que o pedido já está com a equipe.
    let mesaNota = "";
    if (jev && Number(jev.mesa ?? 0) >= 0.8) {
      mesaNota = [
        "",
        "## MESA PROPRIETARIA (LIBERACAO MANUAL)",
        "Este aluno esta pedindo acesso/ativacao da mesa proprietaria. A liberacao e MANUAL: a equipe cria e libera a conta depois do pedido.",
        "- Diga, com naturalidade, que a liberacao da mesa e feita manualmente pela equipe depois da solicitacao e que o pedido dele JA foi registrado e sera feito.",
        "- Nao prometa horario exato, prazo nem e-mail, e nao diga que ja esta liberado: diga que avisamos por aqui mesmo assim que estiver pronto.",
        "- Nao peca para ele falar com a corretora."
      ].join("\n");
      try {
        await rest(`comu_support_tickets?id=eq.${ticket_id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ tarefa: "ativar_mesa", needs_human: true })
        });
      } catch (_e) {}
    }
    // acessos reais no Hub (produtos e datas) — entra como FATO, acima do que o modelo "acha"
    let hubNota = "";
    let hubTemDados = false;
    try {
      const hub = visitante ? null : await acessosDoHub(emailAluno);
      if (hub) {
        const ac = (hub.acessos || []).map((a) => {
          const nome = a.produto || a.produto_id || "produto";
          const ate = dataBR(a.ate || a.ends_at || a.expires_at);
          const sit = a.status === "active" ? "ativo" : (a.status || "");
          return "- " + nome + ": " + sit + (ate ? " ate " + ate : " (sem data de fim)");
        });
        hubTemDados = ac.length > 0;
        hubNota = [
          "",
          "## O QUE ESTE ALUNO TEM (HUB CENTRAL - DADO REAL, NAO INVENTE)",
          ac.length
            ? ac.join("\n")
            : "- NENHUM acesso encontrado no Hub para " + emailAluno + ". NAO EXISTE DATA PARA INFORMAR.",
          ac.length ? "" : "- PROIBIDO inventar ou estimar validade, e PROIBIDO dizer que esta ativo: aqui nao consta nada.",
          ac.length ? "" : "- Responda exatamente nesta linha: 'Deixa eu conferir seu cadastro aqui e ja te falo certinho ate quando vai.' Nada alem disso sobre acesso.",
          hub.bloqueado ? "- ATENCAO: o acesso desta pessoa esta BLOQUEADO." : "",
          "Use isto para responder sobre acesso, validade e liberacao. So escreva uma data se ela estiver NA LISTA ACIMA, copiada igual.",
          "E PROIBIDO deduzir data a partir da data de hoje, do tempo de curso ou de qualquer outra coisa.",
          "Se ela diz que nao consegue entrar em algo que esta ATIVO aqui, trate como problema tecnico (senha, navegador, app), nao como falta de acesso.",
          "Se o que ela pede NAO aparece acima, diga que vai verificar com a equipe; nunca afirme que ela tem."
        ].filter(Boolean).join("\n");
      }
    } catch (_e) {}
    const sys = [
      baseP,
      visitanteNota,
      hubNota,
      mesaNota,
      agora,
      "\n\n## CONHECIMENTO RECUPERADO (use se ajudar; não invente além disso)\n" + kblock,
      notaDaAula(aula),
      "\n\n## CORRECOES — NAO REPITA ESTES ERROS\n" + cblock,
      challengeNote,
      "\n\n## NÃO INVENTE O CONTEXTO\nO histórico acima pode incluir conversas anteriores deste mesmo aluno. Se ele continua um assunto antigo (ex.: 'a lógica é essa, né?', 'consegui', 'e aí?') e você NÃO encontra no histórico do que ele fala, NÃO invente um tópico nem aplique um conhecimento só porque parece parecido. Nesse caso, confirme de forma geral ou pergunte a que ele se refere. Só afirme algo específico (módulo, prazo, passo, número) se estiver claramente na conversa ou no conhecimento recuperado.",
      "\n\n## O ALUNO PODE MANDAR IMAGEM, ÁUDIO OU VÍDEO\nAs imagens do aluno vêm anexadas nesta conversa; olhe o conteúdo delas (prints de tela, gráficos, mensagens de erro, QR codes) e responda com base no que realmente aparece. Os áudios já vêm transcritos no histórico como 'Aluno (áudio): ...'. VÍDEOS: você NÃO consegue assistir vídeo; ele aparece no histórico como 'Aluno enviou um VÍDEO...'. REGRA IMPORTANTE: se o aluno JÁ enviou uma imagem, áudio ou vídeo, NUNCA peça pra ele enviar de novo — ele já enviou. Se a dúvida depende do que aparece num VÍDEO e a narração transcrita não deixa claro, NÃO invente a causa: diga que vai olhar o vídeo dele e deixe um humano assumir (needs_human=true).",
      "\n\n## NUNCA RESPONDA COM MENSAGEM DE ESPERA\nNão escreva 'vou chamar alguém da equipe', 'só um momento', 'vou verificar e já te retorno' nem nada parecido. Se não der para responder com segurança, deixe answer vazio e needs_human=true: o sistema avisa o aluno, uma vez só, que a equipe vai responder.",
      "\n\n## FORMATO DE SAIDA (OBRIGATORIO)\nResponda SOMENTE com um JSON: {\"answer\": \"<resposta pro aluno>\", \"needs_human\": <true|false>, \"reason\": \"<se needs_human=true, o motivo curto>\"}. No campo answer, escreva em PARAGRAFOS CURTOS separados por uma linha em branco: use \\n\\n entre os paragrafos (duas quebras de linha de verdade no texto). Nada de bloco unico gigante; sem marcadores. Deixe answer vazio se precisar de humano. needs_human=true quando a dúvida exige uma ACAO que só a equipe executa, é intencao de compra, ou você nao sabe."
    ].join("");
    // conteúdo multimodal: cada linha do histórico + as imagens recentes anexadas
    const content = [];
    let imgCount = 0;
    for(let i = 0; i < msgs.length; i++){
      const m = msgs[i];
      content.push({
        type: "text",
        text: lineText(m, i)
      });
      if (m.kind === "image" && m.media_url && imgCount < 4) {
        content.push({
          type: "image_url",
          image_url: {
            url: m.media_url,
            detail: "auto"
          }
        });
        imgCount++;
      }
    }
    content.push({
      type: "text",
      text: "Escreva agora a resposta do suporte para a última mensagem do aluno."
    });
    // nano e barato mas desobedece "nao invente"; nos assuntos de acesso e dinheiro
    // o erro sai caro, entao esses vao no modelo melhor.
    const assuntoSensivel = !!jev && (jev.categoria === "acesso" || jev.categoria === "financeiro");
    const categoriasAuto = Array.isArray(cfg.auto_resposta_categorias) ? cfg.auto_resposta_categorias : ["conteudo", "plataforma"];
    const podeSairSozinha = cfg.auto_resposta_enabled === true && !!jev && categoriasAuto.includes(jev.categoria);
    const modelo = assuntoSensivel ? (cfg.draft_model_sensivel || "gpt-4.1-mini") : podeSairSozinha ? (cfg.draft_model_auto || "gpt-4.1-mini") : (cfg.draft_model || "gpt-4o-mini");
    const ai = await openai("chat/completions", {
      model: modelo,
      temperature: 0.3,
      max_tokens: 500,
      response_format: {
        type: "json_object"
      },
      messages: [
        {
          role: "system",
          content: sys
        },
        {
          role: "user",
          content
        }
      ]
    });
    let answer = "", needs_human = false, reason = "";
    // acesso sem dado no Hub e o caso classico de resposta inventada: vai para uma pessoa.
    const acessoSemDados = !!jev && jev.categoria === "acesso" && !hubTemDados;
    try {
      const j = JSON.parse(ai.choices[0].message.content);
      answer = (j.answer || "").trim();
      needs_human = !!j.needs_human;
      reason = (j.reason || "").trim();
    } catch (_e) {}
    answer = answer.replace(/\s*\[MSG\]\s*/g, "\n").trim(); // segurança: remove marcador residual
    // garante o nome certo na saudação: o modelo às vezes troca uma letra (Jomar -> Jamar).
    // pega "Saudação[,!] <Palavra maiúscula>" seguida de , ou ! (padrão de saudação com nome).
    const GREET = "(?:Bom dia|Boa tarde|Boa noite|Oi+|Ol[áa]|Opa|E a[íi])";
    if (firstName) {
      answer = answer.replace(new RegExp("^(\\s*" + GREET + "[,!]?\\s+)([A-ZÀ-Ý][a-zà-ÿ]+)(?=\\s*[,!])"), "$1" + firstName);
    } else {
      // nome omitido: se o modelo insistiu num nome, remove
      answer = answer.replace(new RegExp("^(\\s*" + GREET + ")[,!]?\\s+[A-ZÀ-Ý][a-zà-ÿ]+(?=\\s*[,!])"), "$1");
    }
    if (acessoSemDados && !needs_human) {
      needs_human = true;
      reason = reason || "Pergunta de acesso e o Hub nao tem nada no nome desta pessoa; confira o cadastro.";
    }
    answer = aplicarLink(answer, aula);
    // ---- Responde sozinha? (20261007000033) ------------------------------------------
    const agoraMs = Date.now();
    const humanoRecente = msgs.some((m)=>m.ticket_id === ticket_id && m.author_id !== tk.user_id && m.author_id !== cfg.bot_user_id && agoraMs - new Date(m.created_at).getTime() < 12 * 3600 * 1000);
    let autoHoje = 99; // sem saber quantas já saíram, não arrisca
    try {
      const ja = await rest(`comu_messages?ticket_id=eq.${ticket_id}&media_meta->>auto=eq.resposta&created_at=gte.${new Date(agoraMs - 24 * 3600 * 1000).toISOString()}&select=id`);
      autoHoje = (ja || []).length;
    } catch (_e) {}
    const kTop = knowledge.reduce((mx, k)=>Math.max(mx, Number(k.similarity) || 0), 0);
    const temBase = !!(aula && aula.situacao === "liberada" && aula.trecho) || kTop >= Number(cfg.auto_base_min ?? 0.55);
    const entradaAuto = {
      ligado: cfg.auto_resposta_enabled === true,
      categorias: categoriasAuto,
      categoria: jev && jev.categoria,
      categoriaConf: Number((jev && jev.categoria_conf) ?? 0),
      precisaHumano: Number((jev && jev.precisa_humano) ?? 1),
      insatisfeito: Number((jev && jev.insatisfeito) ?? 0),
      needsHuman: needs_human,
      resposta: answer,
      visitante,
      temBase,
      humanoRecente,
      autoHoje,
      maxDia: Number(cfg.auto_resposta_max_dia ?? 3),
      juiz: 1
    };
    let juiz = null;
    let semBase = [];
    // a conferência só roda se todas as outras travas deixarem
    if (decidirAuto(entradaAuto).auto) {
      const c = await conferirResposta(estadoDoJuiz({ pergunta: member_question, resposta: answer, aula, conhecimento: knowledge }));
      juiz = c.nota;
      semBase = c.sem_base;
    }
    const decisao = decidirAuto({ ...entradaAuto, juiz });
    const autoDecisao = { ...decisao, juiz, sem_base: semBase, base: temBase, k_top: Math.round(kTop * 1000) / 1000, auto_hoje: autoHoje, modelo_ia: modelo };
    const ins = await rest(`comu_ai_drafts`, {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        ticket_id,
        member_id: tk.user_id,
        trigger_message_id: trigger_message_id || null,
        member_question,
        draft_body: answer,
        aula_indicada: aula,
        suggest_handoff: !decisao.auto && (needs_human || !answer || decisao.aviso),
        handoff_reason: reason || null,
        // a resposta que passou pelas travas sai sozinha pelo mesmo caminho da cortesia
        // (comu-cortesia-tick), com atraso de pessoa digitando e cancelada se a conversa andar
        model: decisao.auto ? "auto-resposta" : modelo,
        auto_enviar_em: decisao.auto ? new Date(agoraMs + (30 + Math.floor(Math.random() * 30)) * 1000).toISOString() : null,
        auto_decisao: autoDecisao,
        jev,
        knowledge_used: knowledge.map((k)=>({
            id: k.id,
            sim: k.similarity
          }))
      })
    });
    // só depois de inserir: se o insert falhar, o rascunho antigo continua de pé
    // (antes era ao contrário e a falha deixava o ticket SEM rascunho).
    const newId = ins && ins[0] && ins[0].id;
    await rest(`comu_ai_drafts?ticket_id=eq.${ticket_id}&status=eq.pending&id=neq.${newId}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        status: "superseded"
      })
    });
    // Não conseguiu ajudar: UM aviso de que a equipe vai responder, e o atendimento vai para
    // URGENTE. Nunca de novo nas próximas 12 h (o banco também recusa o segundo).
    let aviso = false;
    if (decisao.aviso) {
      try {
        const desde = new Date(agoraMs - 12 * 3600 * 1000).toISOString();
        const jaAvisou = await rest(`comu_messages?ticket_id=eq.${ticket_id}&media_meta->>auto=eq.aviso_equipe&created_at=gte.${desde}&select=id&limit=1`);
        const avisoNaFila = await rest(`comu_ai_drafts?ticket_id=eq.${ticket_id}&model=eq.aviso-equipe&status=eq.pending&select=id&limit=1`);
        if (!(jaAvisou && jaAvisou.length) && !(avisoNaFila && avisoNaFila.length)) {
          await rest(`comu_ai_drafts`, {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              ticket_id,
              member_id: tk.user_id,
              trigger_message_id: trigger_message_id || null,
              member_question,
              draft_body: cfg.hold_message || AVISO_PADRAO,
              suggest_handoff: false,
              model: "aviso-equipe",
              auto_enviar_em: new Date(agoraMs + 20 * 1000).toISOString(),
              auto_decisao: { motivo: decisao.motivo },
              knowledge_used: [],
              jev
            })
          });
          aviso = true;
        }
        await rest(`comu_support_tickets?id=eq.${ticket_id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ needs_human: true })
        });
      } catch (e) {
        console.error("[support-draft] aviso de equipe:", String(e).slice(0, 200));
      }
    }
    return ok({
      ok: true,
      draft_id: newId,
      needs_human,
      auto: decisao.auto,
      motivo: decisao.motivo,
      aviso
    });
  } catch (e) {
    return ok({
      ok: false,
      error: String(e).slice(0, 200)
    });
  }
});