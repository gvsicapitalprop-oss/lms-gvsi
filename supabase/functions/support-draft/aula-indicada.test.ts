// Testes da aula indicada pela IA do suporte. Roda com
// `npx tsx supabase/functions/support-draft/aula-indicada.test.ts`.
//  1. O link é do sistema: domínio, curso, aula e o minuto (?t=) a partir de 20 s.
//  2. Aula liberada: o marcador vira o link; sem marcador, o link vai no fim; link inventado sai.
//  3. Aula bloqueada ou de outro curso: nunca vai link; a nota diz a data ou o curso.
import { aplicarLink, dataBR, MARCADOR_LINK, minuto, montarAula, notaDaAula } from "./aula-indicada.ts";

let passou = 0;
const falhas: string[] = [];
function eq(caso: string, obtido: unknown, esperado: unknown) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) passou++;
  else falhas.push(`${caso}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
}

const candidata = {
  lesson_id: "a1", curso: "Programa Master Trader", curso_slug: "programa-master-trader", modulo: "Contexto de Entrada",
  aula: "Suporte e Resistência", aula_slug: "suporte-e-resistencia", inicio_s: 754.6, trecho: "...", similaridade: 0.61234,
  situacao: "liberada", libera_em: null,
};

// ── 1. link ──
const aula = montarAula(candidata, 0.8312);
eq("link com o minuto", aula.link, "https://www.giovannipaganini.com/curso/programa-master-trader/aula/suporte-e-resistencia?t=754");
eq("confiança arredondada", aula.confianca, 0.83);
eq("começo da aula não leva ?t", montarAula({ ...candidata, inicio_s: 12 }, 0.9).link, "https://www.giovannipaganini.com/curso/programa-master-trader/aula/suporte-e-resistencia");
eq("minuto", [minuto(754), minuto(59), minuto(3600)], ["12:34", "0:59", "60:00"]);
eq("data", dataBR("2026-10-20"), "20/10/2026");

// ── 2. aula liberada ──
eq("marcador vira o link",
  aplicarLink(`Isso está na aula Suporte e Resistência, a partir de 12:34.\n${MARCADOR_LINK}\n\nQualquer dúvida me chama.`, aula),
  `Isso está na aula Suporte e Resistência, a partir de 12:34.\n${aula.link}\n\nQualquer dúvida me chama.`);
eq("sem marcador, o link vai no fim",
  aplicarLink("Isso está explicado na aula de suporte.", aula),
  `Isso está explicado na aula de suporte.\n\nAula: Suporte e Resistência (a partir de 12:34)\n${aula.link}`);
eq("link inventado pela IA sai, o certo entra",
  aplicarLink(`Veja aqui: https://www.giovannipaganini.com/curso/x/aula/inventada\n${MARCADOR_LINK}`, aula),
  `Veja aqui:\n${aula.link}`);
eq("dois marcadores: só um link", aplicarLink(`a\n${MARCADOR_LINK}\nb\n${MARCADOR_LINK}`, aula).split(aula.link).length - 1, 1);
eq("resposta vazia (vai para a equipe) continua vazia", aplicarLink("", aula), "");
eq("sem aula, nada muda", aplicarLink("Oi, tudo bem?", null), "Oi, tudo bem?");

// ── 3. bloqueada ou de outro curso ──
const bloqueada = montarAula({ ...candidata, situacao: "bloqueada", libera_em: "2026-10-20" }, 0.8);
eq("bloqueada: marcador some, link não entra", aplicarLink(`Está na aula X.\n${MARCADOR_LINK}`, bloqueada), "Está na aula X.");
eq("bloqueada: a nota diz quando libera", notaDaAula(bloqueada).includes("libera em 20/10/2026"), true);
const outro = montarAula({ ...candidata, situacao: "sem_acesso", curso: "Construindo Riqueza" }, 0.8);
eq("outro curso: nada de link", aplicarLink("Isso é aprofundado no Construindo Riqueza.", outro), "Isso é aprofundado no Construindo Riqueza.");
eq("outro curso: a nota diz de qual curso é", notaDaAula(outro).includes("que este aluno ainda não tem"), true);
eq("liberada: a nota pede o marcador", notaDaAula(aula).includes(MARCADOR_LINK), true);
eq("bloqueada: a nota proíbe o link", notaDaAula(bloqueada).includes("Não escreva link"), true);
eq("sem aula, sem nota", notaDaAula(null), "");
eq("nota sem travessão", /—/.test(notaDaAula(aula) + notaDaAula(bloqueada) + notaDaAula(outro)), false);

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s), ${passou} ok\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`✓ aula indicada (link e nota): ${passou} casos`);
