// Testes das partes puras do aulas-indexar. Roda com `npx tsx supabase/functions/aulas-indexar/trechos.test.ts`.
//  1. O SRT é lido com início e fim (o início vira o ?t= do link).
//  2. Os trechos ficam entre ~1 e 2 minutos, fecham no fim de frase e o último curto é colado.
//  3. A descrição do WordPress perde as tags.
import { cabecalho, juntarEmTrechos, segmentosDoSRT, textoDoHtml } from "./trechos.ts";

let passou = 0;
const falhas: string[] = [];
function eq(caso: string, obtido: unknown, esperado: unknown) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) passou++;
  else falhas.push(`${caso}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
}

const srt = [
  "1\n00:00:01,000 --> 00:00:04,500\nBom dia, pessoal.",
  "3\n00:00:10,000 --> 00:00:14,000\nHoje a gente vai falar\nde suporte e resistência.",
  "2\n00:00:05,000 --> 00:00:09,000\nVamos começar.",
  "lixo sem tempo",
].join("\n\n");
const segs = segmentosDoSRT(srt);
eq("lê e ordena pelo início", segs.map((s) => s.ini), [1, 5, 10]);
eq("texto em várias linhas vira uma", segs[2].texto, "Hoje a gente vai falar de suporte e resistência.");
eq("fim lido", segs[0].fim, 4.5);
eq("SRT vazio", segmentosDoSRT(null), []);

// 20 frases de 10 s cada = 200 s
const longas = Array.from({ length: 20 }, (_, i) => ({ ini: i * 10, fim: i * 10 + 9.5, texto: `Frase ${i}.` }));
const t = juntarEmTrechos(longas);
eq("trechos de ~80 s", t.map((x) => [x.ini, x.fim]), [[0, 80], [80, 160], [160, 200]]);
eq("o texto vai junto", t[0].texto.startsWith("Frase 0. Frase 1."), true);
const semPonto = Array.from({ length: 30 }, (_, i) => ({ ini: i * 5, fim: i * 5 + 4.8, texto: `palavra ${i}` }));
eq("sem fim de frase, corta no máximo de 110 s", juntarEmTrechos(semPonto).every((x) => x.fim - x.ini <= 110), true);
const curtoNoFim = [...longas.slice(0, 8), { ini: 80, fim: 85, texto: "Tchau." }];
eq("último trecho curto é colado no anterior", juntarEmTrechos(curtoNoFim).map((x) => [x.ini, x.fim]), [[0, 85]]);

eq("html do WordPress", textoDoHtml("<p>Aula de <strong>suporte</strong>&nbsp;e resistência</p><p>Parte 2</p>"), "Aula de suporte e resistência\nParte 2");
eq("cabeçalho", cabecalho({ curso: "Programa Master Trader", modulo: "Contexto de entrada", aula: "Suporte e resistência", descricao: "<p>Como marcar.</p>" }),
  "Curso: Programa Master Trader. Módulo: Contexto de entrada. Aula: Suporte e resistência. Como marcar.");

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s), ${passou} ok\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`✓ aulas-indexar (trechos): ${passou} casos`);
