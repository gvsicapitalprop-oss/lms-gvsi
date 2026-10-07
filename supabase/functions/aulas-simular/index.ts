// aulas-simular — mostra o que a IA do suporte faria com perguntas de teste, sem ticket e sem gravar
// nada (pedido do dono em 06/10/2026: "gere uma simulação de 4 perguntas"). Repete o caminho do
// support-draft para dúvida de conteúdo: triagem do Jev, busca nas transcrições, escolha da aula
// pelo Jev, resposta com o prompt do suporte e o link montado pelo sistema.
// Diferença proposital: sem histórico de ticket, sem Hub e sem nome (a pergunta chega solta).
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { aplicarLink, juntarTrechos, montarAula, notaDaAula } from "../support-draft/aula-indicada.ts";
import { decidirAuto, estadoDoJuiz, INSTRUCAO_CONFERENCIA, lerConferencia } from "../support-draft/autonomia.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const MOD_SECRET = Deno.env.get("MOD_SECRET") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const JEV_KEY = Deno.env.get("JEV_API_KEY") ?? "";
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

async function rest(path: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...(init || {}), headers: { ...H, ...((init && init.headers) || {}) } });
  if (!r.ok) throw new Error("rest " + r.status + " " + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function openai(path: string, body: unknown) {
  const r = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("openai " + path + " " + r.status + " " + (await r.text()).slice(0, 160));
  return await r.json();
}
async function jev(state: string, questions: Record<string, unknown>) {
  const r = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${JEV_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ state: state.slice(0, 1500), model: "jev-latest", questions }),
  });
  if (!r.ok) throw new Error("jev " + r.status);
  const d = await r.json();
  return (d && d.answers) || {};
}
const pega = (x: any) => x && (x.choice ?? x.value ?? x.noul);
// Mesmas categorias e perguntas do support-draft (manter iguais).
const JEV_CATS = {
  cortesia: "Só agradecimento, saudação, despedida ou confirmação curta ('obrigado', 'bom dia', 'ok', 'entendi'). Não pede nada nem faz pergunta nova.",
  acesso: "Acesso, liberação, assinatura, Sala ao Vivo, login, senha, área de membros, link da aula.",
  plataforma: "Dúvida técnica do MetaTrader 5: instalação, configuração, gráfico, indicadores, conta demo.",
  financeiro: "Pagamento, boleto, cartão, reembolso, cobrança, renovação.",
  conteudo: "Dúvida sobre as aulas, estratégia, operação ou mercado.",
  outro: "Qualquer coisa que não caiba nas anteriores.",
};
const QUER_AULA = "O aluno tem uma dúvida de conteúdo (estratégia, operação, leitura do gráfico, mercado, gestão de risco, psicologia, ferramentas do método) ou pede uma aula ou explicação sobre um assunto que pode estar ensinado nas aulas dos cursos?";

const ok = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.headers.get("x-mod-secret") !== MOD_SECRET) return new Response("forbidden", { status: 403 });
  const corpo = await req.json().catch(() => ({}));
  const perguntas: string[] = (corpo && corpo.perguntas) || [];
  const cfg = ((await rest("comu_ai_support_config?select=*&limit=1")) || [])[0] || {};
  let aluno = corpo && corpo.aluno;
  if (!aluno) {
    // um aluno qualquer com o Programa Master Trader ativo: só para calcular o que ele abre
    const curso = ((await rest("lms_courses?slug=eq.programa-master-trader&select=id")) || [])[0];
    const sub = curso ? ((await rest(`lms_subscriptions?course_id=eq.${curso.id}&status=eq.active&select=student_id&limit=1`)) || [])[0] : null;
    aluno = sub && sub.student_id;
  }
  const hora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false });
  const h = parseInt(hora, 10);
  const saud = h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";

  const resultados = [];
  for (const pergunta of perguntas.slice(0, 8)) {
    const r: Record<string, unknown> = { pergunta };
    try {
      const tri = await jev(pergunta, {
        categoria: { type: "choice", instructions: "Em que assunto se encaixa a mensagem do aluno para o suporte?", criteria: JEV_CATS },
        quer_aula: { type: "noul", instructions: QUER_AULA },
        precisa_humano: { type: "noul", instructions: "Para responder isto é preciso consultar dados da conta do aluno (acesso, pagamento, datas) ou executar uma ação que só a equipe pode fazer?" },
        insatisfeito: { type: "noul", instructions: "O aluno diz que a resposta anterior não resolveu, repete a mesma dúvida, reclama do atendimento automático ou pede para falar com uma pessoa?" },
      });
      const categoria = pega(tri.categoria);
      const querAula = Number(pega(tri.quer_aula) ?? 0);
      r.jev = { categoria, categoria_conf: tri.categoria && tri.categoria.confidence, quer_aula: Math.round(querAula * 100) / 100 };
      const buscaria = ["conteudo", "plataforma", "outro"].includes(categoria) || querAula >= 0.4;
      r.buscaria_aula = buscaria;

      const emb = await openai("embeddings", { model: "text-embedding-3-small", input: pergunta });
      const vec = "[" + emb.data[0].embedding.join(",") + "]";
      const knowledge = (await rest("rpc/comu_match_support_knowledge", { method: "POST", body: JSON.stringify({ query_embedding: vec, match_count: cfg.knowledge_top_k || 6 }) })) || [];
      const candidatas = ((await rest("rpc/lms_buscar_aulas", { method: "POST", body: JSON.stringify({ p_embedding: vec, p_aluno: aluno, p_limite: 5, p_texto: pergunta }) })) || [])
        .filter((c: any) => Number(c.similaridade) >= Number(cfg.aulas_similaridade_min ?? 0.3));
      r.candidatas = candidatas.map((c: any) => ({ aula: c.aula, modulo: c.modulo, curso: c.curso, inicio_s: c.inicio_s, similaridade: Math.round(Number(c.similaridade) * 1000) / 1000, bonus: c.bonus, situacao: c.situacao }));

      let aula = null;
      if (buscaria && candidatas.length) {
        const criteria: Record<string, string> = {};
        candidatas.forEach((c: any, i: number) => {
          criteria["aula_" + (i + 1)] = `${c.curso}${c.modulo ? " > " + c.modulo : ""} > ${c.aula}: ${String(c.trecho || "").replace(/\s+/g, " ").slice(0, 300)}`;
        });
        criteria.nenhuma = "Nenhuma dessas aulas explica o assunto da dúvida do aluno.";
        const esc = await jev(pergunta, { aula: { type: "choice", instructions: "Qual destas aulas explica o assunto da dúvida do aluno, a ponto de valer indicar a aula para ele assistir? Escolha 'nenhuma' se nenhuma trata desse assunto.", criteria } });
        const escolha = esc.aula && (esc.aula.choice ?? esc.aula.value);
        const confianca = Number(esc.aula && esc.aula.confidence);
        r.escolha_do_jev = { escolha, confianca: Math.round(confianca * 100) / 100 };
        const c = escolha && escolha !== "nenhuma" ? candidatas[Number(String(escolha).replace("aula_", "")) - 1] : null;
        if (c && confianca >= Number(cfg.aulas_limiar ?? 0.7)) aula = montarAula(c, confianca);
        if (aula && aula.situacao === "liberada") {
          const trechos = (await rest("rpc/lms_trechos_da_aula", { method: "POST", body: JSON.stringify({ p_embedding: vec, p_aula: aula.lesson_id, p_limite: 3 }) })) || [];
          const junto = juntarTrechos(trechos);
          if (junto) aula.trecho = junto;
        }
      }
      r.aula_indicada = aula;

      const kblock = knowledge.length ? knowledge.map((k: any, i: number) => `(${i + 1}) P: ${k.question || ""}\nR: ${k.answer}`).join("\n\n") : "(sem base ainda)";
      const baseP = (cfg.system_prompt || "Você é Bruno, do suporte da GVSI.").replace(/\{saudacao\}/g, saud).replace(/\{hora_atual\}/g, hora).replace(/\{nome\}/g, "").replace(/\{context\}/g, "");
      const sys = [
        baseP,
        "\n\n## AGORA\n- A única saudação correta agora é \"" + saud + "\", sem nome.",
        "\n\n## CONHECIMENTO RECUPERADO (use se ajudar; não invente além disso)\n" + kblock,
        notaDaAula(aula),
        "\n\n## NUNCA RESPONDA COM MENSAGEM DE ESPERA\nNão escreva 'vou chamar alguém da equipe', 'só um momento', 'vou verificar e já te retorno' nem nada parecido. Se não der para responder com segurança, deixe answer vazio e needs_human=true: o sistema avisa o aluno, uma vez só, que a equipe vai responder.",
        "\n\n## FORMATO DE SAIDA (OBRIGATORIO)\nResponda SOMENTE com um JSON: {\"answer\": \"<resposta pro aluno>\", \"needs_human\": <true|false>, \"reason\": \"<se needs_human=true, o motivo curto>\"}. No campo answer, escreva em PARAGRAFOS CURTOS separados por uma linha em branco: use \\n\\n entre os paragrafos. Nada de bloco unico gigante; sem marcadores. Deixe answer vazio se precisar de humano.",
      ].join("");
      const sensivel = categoria === "acesso" || categoria === "financeiro";
      const categoriasAuto = Array.isArray(cfg.auto_resposta_categorias) ? cfg.auto_resposta_categorias : ["conteudo", "plataforma"];
      const podeSairSozinha = categoriasAuto.includes(categoria); // simulação: como se estivesse ligado
      const modelo = sensivel ? (cfg.draft_model_sensivel || "gpt-4.1-mini") : podeSairSozinha ? (cfg.draft_model_auto || "gpt-4.1-mini") : (cfg.draft_model || "gpt-4o-mini");
      const ai = await openai("chat/completions", {
        model: modelo,
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: [{ type: "text", text: "Aluno: " + pergunta }, { type: "text", text: "Escreva agora a resposta do suporte para a última mensagem do aluno." }] },
        ],
      });
      const j = JSON.parse(ai.choices[0].message.content);
      r.modelo = modelo;
      r.precisa_humano = !!j.needs_human;
      r.motivo = j.reason || null;
      r.resposta = aplicarLink(String(j.answer || "").trim(), aula);
      // a mesma decisão do support-draft, como se o envio sozinho estivesse ligado
      const kTop = knowledge.reduce((mx: number, k: any) => Math.max(mx, Number(k.similarity) || 0), 0);
      const temBase = !!(aula && aula.situacao === "liberada" && aula.trecho) || kTop >= Number(cfg.auto_base_min ?? 0.55);
      const entrada = {
        ligado: true, categorias: categoriasAuto, categoria, categoriaConf: Number((tri.categoria && tri.categoria.confidence) ?? 0),
        precisaHumano: Number(pega(tri.precisa_humano) ?? 1), insatisfeito: Number(pega(tri.insatisfeito) ?? 0),
        needsHuman: !!j.needs_human, resposta: String(r.resposta), visitante: false, temBase, humanoRecente: false,
        autoHoje: 0, maxDia: Number(cfg.auto_resposta_max_dia ?? 3), juiz: 1 as number | null,
      };
      let juiz: number | null = null;
      let semBase: string[] = [];
      if (decidirAuto(entrada).auto) {
        const cf = await openai("chat/completions", {
          model: "gpt-4.1-mini", temperature: 0, max_tokens: 300, response_format: { type: "json_object" },
          messages: [{ role: "system", content: INSTRUCAO_CONFERENCIA }, { role: "user", content: estadoDoJuiz({ pergunta, resposta: String(r.resposta), aula, conhecimento: knowledge }).slice(0, 9000) }],
        });
        const lido = lerConferencia(cf.choices[0].message.content);
        juiz = lido.nota;
        semBase = lido.sem_base;
      }
      r.decisao = { ...decidirAuto({ ...entrada, juiz }), juiz, sem_base: semBase, base: temBase, k_top: Math.round(kTop * 1000) / 1000 };
    } catch (e) {
      r.erro = String(e).slice(0, 300);
    }
    resultados.push(r);
  }
  return ok({ ok: true, aluno_simulado: !!aluno, resultados });
});
