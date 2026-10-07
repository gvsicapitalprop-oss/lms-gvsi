// Testes de quando a IA do suporte responde sozinha. Roda com
// `npx tsx supabase/functions/support-draft/autonomia.test.ts`.
//  1. Só conteúdo e plataforma, com certeza do Jev; o resto passa pela equipe.
//  2. Resposta de espera ("vou chamar a equipe", "só um momento") NUNCA sai sozinha.
//  3. Não consegue ajudar: um aviso só (a repetição é barrada aqui e no banco).
//  4. Teto do dia, equipe na conversa, aluno insatisfeito, sem base e juiz recusando.
import { decidirAuto, estadoDoJuiz, lerConferencia, temFraseDeEspera, type EntradaAuto } from "./autonomia.ts";

let passou = 0;
const falhas: string[] = [];
function eq(caso: string, obtido: unknown, esperado: unknown) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) passou++;
  else falhas.push(`${caso}\n    esperado: ${JSON.stringify(esperado)}\n    obtido:   ${JSON.stringify(obtido)}`);
}

const base: EntradaAuto = {
  ligado: true,
  categorias: ["conteudo", "plataforma"],
  categoria: "conteudo",
  categoriaConf: 0.95,
  precisaHumano: 0.1,
  insatisfeito: 0.05,
  needsHuman: false,
  resposta: "Pullback é a correção dentro da tendência. Isso está explicado na aula Pullback.",
  visitante: false,
  temBase: true,
  humanoRecente: false,
  autoHoje: 0,
  maxDia: 3,
  juiz: 0.92,
};
const d = (e: Partial<EntradaAuto>) => decidirAuto({ ...base, ...e });

// ── 1 ──
eq("conteúdo com base e juiz ok sai sozinha", d({}), { auto: true, aviso: false, motivo: "ok" });
eq("plataforma também", d({ categoria: "plataforma" }).auto, true);
eq("acesso passa pela equipe", d({ categoria: "acesso" }), { auto: false, aviso: false, motivo: "fora_dos_assuntos" });
eq("financeiro passa pela equipe", d({ categoria: "financeiro" }).motivo, "fora_dos_assuntos");
eq("categoria sem certeza", d({ categoriaConf: 0.7 }).motivo, "fora_dos_assuntos");
eq("desligado", d({ ligado: false }).motivo, "desligado");
eq("visitante da tela de login", d({ visitante: true }).auto, false);

// ── 2 ──
for (const t of [
  "Vou chamar uma pessoa da equipe, só um momento.",
  "Vou verificar com a equipe e já te retorno.",
  "Um momento, por favor.",
  "Aguarde que alguém da equipe vai te responder.",
  "Já já te respondo!",
  "A equipe vai te chamar.",
  "Assim que eu tiver retorno te aviso.",
]) eq(`espera: ${t}`, temFraseDeEspera(t), true);
for (const t of ["O pullback é a correção dentro da tendência.", "Instale o MT5 pelo instalador da corretora e entre com a conta demo."])
  eq(`não é espera: ${t.slice(0, 30)}`, temFraseDeEspera(t), false);
eq("resposta de espera nunca sai sozinha", d({ resposta: "Vou chamar uma pessoa da equipe, só um momento." }), { auto: false, aviso: true, motivo: "resposta_de_espera" });

// ── 3 ──
eq("IA pediu a equipe: avisa", d({ needsHuman: true, resposta: "" }), { auto: false, aviso: true, motivo: "ia_pediu_equipe" });
eq("precisa de dado da conta: avisa", d({ precisaHumano: 0.7 }).motivo, "precisa_da_equipe");
eq("na dúvida (0,4 a 0,5): só rascunho, sem aviso", d({ precisaHumano: 0.45 }), { auto: false, aviso: false, motivo: "incerto" });

// ── 4 ──
eq("teto do dia", d({ autoHoje: 3 }), { auto: false, aviso: true, motivo: "teto_do_dia" });
eq("equipe conversando: nem responde nem avisa", d({ humanoRecente: true }), { auto: false, aviso: false, motivo: "equipe_conversando" });
eq("aluno insatisfeito vai para a equipe", d({ insatisfeito: 0.8 }).motivo, "aluno_insatisfeito");
eq("sem base não sai sozinha", d({ temBase: false }).motivo, "sem_base");
eq("juiz recusou", d({ juiz: 0.6 }).motivo, "juiz_recusou");
eq("juiz não respondeu", d({ juiz: null }).motivo, "juiz_recusou");

// o que o juiz lê
const est = estadoDoJuiz({
  pergunta: "O que é pullback?",
  resposta: "É a correção.",
  aula: { aula: "Pullback", curso: "Programa Master Trader", trecho: "O pullback é quando o preço volta..." },
  conhecimento: [{ question: "pullback?", answer: "É a correção dentro da tendência." }],
});
eq("juiz lê a aula", est.includes('Aula "Pullback"'), true);
eq("juiz lê o conhecimento", est.includes("Resposta já aprovada da equipe"), true);
eq("juiz sem base", estadoDoJuiz({ pergunta: "x", resposta: "y", aula: null, conhecimento: [] }).includes("(nenhuma)"), true);

// a conferência final (afirmações sem base)
eq("sem afirmação sem base: nota 1", lerConferencia('{"sem_base": [], "promete_acao_da_equipe": false}'), { nota: 1, sem_base: [] });
eq("afirmação sem base: nota 0 e o motivo", lerConferencia({ sem_base: ["região de 30%"], promete_acao_da_equipe: false }), { nota: 0, sem_base: ["região de 30%"] });
eq("promete ação da equipe: nota 0", lerConferencia({ sem_base: [], promete_acao_da_equipe: true }).nota, 0);
eq("resposta quebrada: não decide", lerConferencia("não é json"), { nota: null, sem_base: [] });
eq("formato errado: não decide", lerConferencia({ ok: true }).nota, null);

if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s), ${passou} ok\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`✓ IA responde sozinha (travas): ${passou} casos`);
