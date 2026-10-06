// aulas-indexar — a transcrição de cada aula vira trechos com embedding, para a IA do suporte
// indicar a aula certa com o minuto (migração 20261006000032, pedido do dono em 06/10/2026).
// Chamado de 10 em 10 minutos pelo cron (pg_net + x-mod-secret); no retroativo, à mão, várias
// vezes. Por rodada pega até `limite` aulas novas ou alteradas (lms_aulas_para_indexar).
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { cabecalho, juntarEmTrechos, segmentosDoSRT } from "./trechos.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const MOD_SECRET = Deno.env.get("MOD_SECRET") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Mesmo modelo da busca no support-draft; a coluna é vector(1536).
const MODELO = "text-embedding-3-small";
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

async function rest(path: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...(init || {}), headers: { ...H, ...((init && init.headers) || {}) } });
  if (!r.ok) throw new Error("rest " + r.status + " " + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function embeddings(textos: string[]): Promise<number[][]> {
  const saida: number[][] = [];
  for (let i = 0; i < textos.length; i += 64) {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELO, input: textos.slice(i, i + 64).map((t) => t.slice(0, 6000)) }),
    });
    if (!r.ok) throw new Error("openai " + r.status + " " + (await r.text()).slice(0, 160));
    const j = await r.json();
    saida.push(...j.data.map((d: { embedding: number[] }) => d.embedding));
  }
  return saida;
}

const ok = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
const vetor = (v: number[]) => "[" + v.join(",") + "]";

serve(async (req) => {
  if (req.headers.get("x-mod-secret") !== MOD_SECRET) return new Response("forbidden", { status: 403 });
  if (!OPENAI_KEY) return ok({ ok: false, error: "sem openai key" });
  const corpo = await req.json().catch(() => ({}));
  const limite = Math.min(Math.max(Number(corpo && corpo.limite) || 6, 1), 20);
  const inicio = Date.now();

  const lista = (await rest("rpc/lms_aulas_para_indexar", { method: "POST", body: JSON.stringify({ p_limite: limite }) })) || [];
  const feitas: unknown[] = [];
  const erros: unknown[] = [];
  for (const item of lista) {
    // teto de tempo da Edge Function: o que sobrar fica para a próxima rodada
    if (Date.now() - inicio > 100_000) break;
    try {
      const aula = ((await rest(`lms_lessons?id=eq.${item.lesson_id}&select=id,title,description,course_id,module_id`)) || [])[0];
      if (!aula) continue;
      const curso = ((await rest(`lms_courses?id=eq.${aula.course_id}&select=title`)) || [])[0];
      const modulo = aula.module_id ? ((await rest(`lms_modules?id=eq.${aula.module_id}&select=title`)) || [])[0] : null;
      const transcricao = ((await rest(`lms_settings?key=eq.${encodeURIComponent("aula_transcricao:" + aula.id)}&select=value`)) || [])[0];
      const trechos = juntarEmTrechos(segmentosDoSRT(transcricao && transcricao.value && transcricao.value.srt));
      const cab = cabecalho({ curso: (curso && curso.title) || "", modulo: modulo && modulo.title, aula: aula.title, descricao: aula.description });
      const vetores = await embeddings([cab, ...trechos.map((t) => t.texto)]);
      const linhas = [
        { lesson_id: aula.id, inicio_s: 0, fim_s: 0, texto: cab, cabecalho: true, embedding: vetor(vetores[0]), fonte_atualizada_em: item.transcricao_atualizada_em },
        ...trechos.map((t, i) => ({
          lesson_id: aula.id,
          inicio_s: t.ini,
          fim_s: t.fim,
          texto: t.texto,
          cabecalho: false,
          embedding: vetor(vetores[i + 1]),
          fonte_atualizada_em: item.transcricao_atualizada_em,
        })),
      ];
      // troca os trechos da aula; se o insert falhar, a aula fica sem cabeçalho e volta na próxima rodada
      await rest(`lms_aula_trechos?lesson_id=eq.${aula.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      await rest("lms_aula_trechos", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(linhas) });
      feitas.push({ aula: aula.title, trechos: trechos.length });
    } catch (e) {
      erros.push({ lesson_id: item.lesson_id, erro: String(e).slice(0, 200) });
    }
  }
  return ok({ ok: true, feitas, erros, ms: Date.now() - inicio });
});
