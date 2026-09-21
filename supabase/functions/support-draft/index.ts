// support-draft — gera a resposta OCULTA do "Bruno" pra revisão humana (HITL).
// MULTIMODAL: lê texto, IMAGEM (visão gpt-4o-mini) e ÁUDIO (transcrição Whisper) do histórico do ticket.
// NÃO envia nada ao aluno: só cria um rascunho pendente em comu_ai_drafts.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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
    // economia: só UM rascunho pendente por ticket. Se já existe, não gasta
    // transcrição/embedding/LLM de novo (o cron redraftava a cada mensagem
    // do aluno e ~85% dos rascunhos viravam "superseded" sem revisão).
    if (force !== true) {
      const pend = await rest(`comu_ai_drafts?ticket_id=eq.${ticket_id}&status=eq.pending&select=id&limit=1`);
      if (pend && pend.length) return ok({
        ok: true,
        skipped: "rascunho pendente"
      });
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
    try {
      const st = await rest(`lms_students?id=eq.${tk.user_id}&select=full_name`);
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
    // histórico recente do MESMO aluno, atravessando conversas (ele referencia coisas ditas em tickets anteriores)
    let tids = [
      ticket_id
    ];
    try {
      const others = await rest(`comu_support_tickets?user_id=eq.${tk.user_id}&select=id&order=created_at.desc&limit=8`);
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
    try {
      const emb = await openai("embeddings", {
        model: cfg.embed_model || "text-embedding-3-small",
        input: member_question
      });
      const vec = "[" + emb.data[0].embedding.join(",") + "]";
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
    const kblock = knowledge.length ? knowledge.map((k, i)=>`(${i + 1}) P: ${k.question || ""}\nR: ${k.answer}`).join("\n\n") : "(sem base ainda — responda pelos FATOS FIXOS do seu prompt)";
    const corr = await rest(`comu_ai_corrections?inject_enabled=eq.true&select=member_question,reason,corrected_answer&order=created_at.desc&limit=${cfg.corrections_limit || 12}`) || [];
    const cblock = corr.length ? corr.map((c, i)=>`(${i + 1}) Pergunta: ${(c.member_question || "").slice(0, 160)}\nErro a evitar: ${c.reason}${c.corrected_answer ? `\nCerto: ${c.corrected_answer}` : ""}`).join("\n\n") : "(nenhuma)";
    const baseP = (cfg.system_prompt || "Você é Bruno, do suporte da GVSI.").replace(/\{saudacao\}/g, saud).replace(/\{hora_atual\}/g, horaStr).replace(/\{nome\}/g, firstName || "").replace(/\{context\}/g, "");
    const agora = "\n\n## AGORA — DATA, HORA, SAUDAÇÃO E NOME (OBRIGATÓRIO)\n- Agora em Brasília é " + (diaSemana || "?") + ", " + (dataStr || "") + ", " + (horaStr || "") + "h. A ÚNICA saudação correta agora é \"" + saud + "\" (nunca outra; ignore a hora que aparece nos prints do aluno, o que vale é esta)." + "\n- SALA AO VIVO HOJE: " + (isSalaDay ? "hoje (" + diaSemana + ") É dia de sala ao vivo (10h30). Se agora ja passou das 10h30, a de hoje ja aconteceu/esta rolando; se ainda nao, o link costuma sair perto do horario no grupo de WhatsApp." : "hoje (" + diaSemana + ") NAO tem sala ao vivo. A sala e SO segunda, quarta e sexta as 10h30.") + " Responda perguntas sobre a sala de HOJE com base nisso. NUNCA diga que o link de hoje foi enviado num dia que nao tem sala; nesse caso, avise que hoje nao tem e diga o proximo dia." + "\n- USE tambem o dia da semana e a hora pra qualquer outra pergunta que dependa disso, em vez de dar resposta generica." + (firstName ? "\n- O aluno se chama " + firstName + ". Ao cumprimentar, use o primeiro nome logo na primeira frase, assim: \"" + saud + ", " + firstName + ", tudo bem?\" e só depois vá ao assunto. Escreva o nome EXATAMENTE assim, letra por letra, sem trocar nenhuma letra: " + firstName + ". Se a conversa já estiver em andamento e não fizer sentido cumprimentar de novo, pode ir direto." : "\n- Se cumprimentar, use só \"" + saud + "\" SEM nome (não invente nem chute o nome do aluno).");
    const sys = [
      baseP,
      agora,
      "\n\n## CONHECIMENTO RECUPERADO (use se ajudar; não invente além disso)\n" + kblock,
      "\n\n## CORRECOES — NAO REPITA ESTES ERROS\n" + cblock,
      challengeNote,
      "\n\n## NÃO INVENTE O CONTEXTO\nO histórico acima pode incluir conversas anteriores deste mesmo aluno. Se ele continua um assunto antigo (ex.: 'a lógica é essa, né?', 'consegui', 'e aí?') e você NÃO encontra no histórico do que ele fala, NÃO invente um tópico nem aplique um conhecimento só porque parece parecido. Nesse caso, confirme de forma geral ou pergunte a que ele se refere. Só afirme algo específico (módulo, prazo, passo, número) se estiver claramente na conversa ou no conhecimento recuperado.",
      "\n\n## O ALUNO PODE MANDAR IMAGEM, ÁUDIO OU VÍDEO\nAs imagens do aluno vêm anexadas nesta conversa; olhe o conteúdo delas (prints de tela, gráficos, mensagens de erro, QR codes) e responda com base no que realmente aparece. Os áudios já vêm transcritos no histórico como 'Aluno (áudio): ...'. VÍDEOS: você NÃO consegue assistir vídeo; ele aparece no histórico como 'Aluno enviou um VÍDEO...'. REGRA IMPORTANTE: se o aluno JÁ enviou uma imagem, áudio ou vídeo, NUNCA peça pra ele enviar de novo — ele já enviou. Se a dúvida depende do que aparece num VÍDEO e a narração transcrita não deixa claro, NÃO invente a causa: diga que vai olhar o vídeo dele e deixe um humano assumir (needs_human=true).",
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
    const ai = await openai("chat/completions", {
      model: cfg.draft_model || "gpt-4o-mini",
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
        suggest_handoff: needs_human || !answer,
        handoff_reason: reason || null,
        model: cfg.draft_model || "gpt-4o-mini",
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
    return ok({
      ok: true,
      draft_id: newId,
      needs_human
    });
  } catch (e) {
    return ok({
      ok: false,
      error: String(e).slice(0, 200)
    });
  }
});