// Quando a IA do suporte responde sozinha (migração 20261007000033, pedido do dono em 06/10/2026).
// Partes puras (sem Deno nem rede), para o teste rodar com `npx tsx`.
//
// Decisões do dono: só conteúdo e plataforma; ligado já, com as travas. E a trava que ele pediu
// com todas as letras: a IA não pode ficar "rendendo" com "vou chamar uma pessoa da equipe, só um
// momento" 10, 20 vezes. Então:
//   - resposta de espera NUNCA sai sozinha (frase de espera derruba o envio);
//   - quando a IA não consegue ajudar, sai UM aviso de que a equipe vai responder, no máximo uma
//     vez a cada 12 h por atendimento (e o banco confere de novo), e o atendimento vai para URGENTE;
//   - no máximo N respostas sozinha por atendimento em 24 h; depois disso, só a equipe;
//   - se alguém da equipe falou no atendimento nas últimas 12 h, a IA não responde por cima;
//   - aluno insatisfeito, repetindo a dúvida ou pedindo uma pessoa: vai para a equipe.

// Mensagens de espera / de passar para a equipe. Resposta com isso nunca sai sozinha.
const ESPERA =
  /(vou (te )?(chamar|passar|encaminhar|transferir|acionar|verificar|confirmar|checar|consultar)|algu[eé]m da (nossa )?equipe|(a|nossa) equipe (vai|ir[aá]|j[aá] vai|deve)|um (momento|minutinho|instante)|s[oó] um (momento|minuto|instante|minutinho)|aguarde|j[aá] j[aá]|j[aá] (te )?(retorno|volto|respondo)|vou te (retornar|responder) (em breve|j[aá])|assim que (eu )?(tiver|souber|receber) (um )?retorno)/i;

export function temFraseDeEspera(texto: string | null | undefined): boolean {
  return ESPERA.test(String(texto ?? ""));
}

export const AVISO_PADRAO = "Recebi sua dúvida e já deixei com a equipe. Alguém te responde por aqui assim que possível.";

export interface EntradaAuto {
  ligado: boolean;
  categorias: string[];
  categoria: string | null | undefined;
  categoriaConf: number;
  precisaHumano: number;
  insatisfeito: number;
  needsHuman: boolean;
  resposta: string;
  visitante: boolean;
  temBase: boolean;
  humanoRecente: boolean;
  autoHoje: number;
  maxDia: number;
  /** Probabilidade do Jev de a resposta estar apoiada na base (null = não perguntou ou falhou). */
  juiz: number | null;
}

export interface DecisaoAuto {
  /** envia a resposta sozinha */
  auto: boolean;
  /** manda o aviso de que a equipe vai responder (se ainda não mandou nas últimas 12 h) */
  aviso: boolean;
  motivo: string;
}

export const LIMIAR_CATEGORIA = 0.8;
export const LIMIAR_JUIZ = 0.8;

export function decidirAuto(e: EntradaAuto): DecisaoAuto {
  const nao = (motivo: string, aviso = false): DecisaoAuto => ({ auto: false, aviso, motivo });
  if (!e.ligado) return nao("desligado");
  if (e.visitante) return nao("visitante");
  if (!e.categoria || !e.categorias.includes(e.categoria) || e.categoriaConf < LIMIAR_CATEGORIA) return nao("fora_dos_assuntos");
  // a equipe está na conversa: a IA não atropela (nem avisa, a pessoa já está sendo atendida)
  if (e.humanoRecente) return nao("equipe_conversando");
  if (e.insatisfeito >= 0.6) return nao("aluno_insatisfeito", true);
  if (e.precisaHumano >= 0.5) return nao("precisa_da_equipe", true);
  if (e.needsHuman || !e.resposta.trim()) return nao("ia_pediu_equipe", true);
  if (temFraseDeEspera(e.resposta)) return nao("resposta_de_espera", true);
  if (e.autoHoje >= e.maxDia) return nao("teto_do_dia", true);
  if (e.precisaHumano >= 0.4) return nao("incerto");
  if (!e.temBase) return nao("sem_base", true);
  if (e.juiz === null || e.juiz < LIMIAR_JUIZ) return nao("juiz_recusou", true);
  return { auto: true, aviso: false, motivo: "ok" };
}

/** O que o Jev lê para conferir a resposta antes de ela sair sozinha. */
export function estadoDoJuiz(dados: {
  pergunta: string;
  resposta: string;
  aula?: { aula: string; curso: string; trecho?: string | null } | null;
  conhecimento: { question?: string | null; answer?: string | null }[];
}): string {
  const linhas = ["Dúvida do aluno:", dados.pergunta.slice(0, 1200), "", "Base que a resposta podia usar:"];
  if (dados.aula && dados.aula.trecho) {
    linhas.push(`- Aula "${dados.aula.aula}" (${dados.aula.curso}), trechos da transcrição:\n${dados.aula.trecho.slice(0, 3600)}`);
  }
  for (const k of dados.conhecimento.slice(0, 2)) {
    linhas.push(`- Resposta já aprovada da equipe. P: ${String(k.question ?? "").slice(0, 200)} R: ${String(k.answer ?? "").replace(/\s+/g, " ").slice(0, 400)}`);
  }
  if (linhas[linhas.length - 1] === "Base que a resposta podia usar:") linhas.push("(nenhuma)");
  linhas.push("", "Resposta proposta:", dados.resposta.slice(0, 1500));
  return linhas.join("\n");
}

export const PERGUNTA_DO_JUIZ =
  "A resposta proposta responde à dúvida do aluno usando só o que está na base acima, sem inventar " +
  "informação, sem contradizer a base e sem prometer nenhuma ação da equipe?";

// A conferência final é uma checagem de afirmações (06/10/2026): na simulação, o Jev dava 0,37 e
// 0,42 até para respostas tiradas da aula; ele é ótimo para classificar e escolher, não para
// conferir frase por frase 3 minutos de transcrição. A IA lista o que a resposta afirma sem base.
export const INSTRUCAO_CONFERENCIA =
  "Você confere respostas do suporte de um curso de trading antes de elas irem para o aluno. Compare a " +
  "RESPOSTA PROPOSTA com a BASE (trechos das aulas e respostas já aprovadas pela equipe). Liste cada " +
  "afirmação de conteúdo da resposta (regra, número, passo, definição, recomendação) que NÃO aparece na " +
  "base nem é consequência direta dela. Saudação, cortesia e a indicação da aula não contam. Diga também " +
  "se a resposta promete alguma ação da equipe (verificar, liberar, chamar alguém). Responda só JSON: " +
  '{"sem_base": ["..."], "promete_acao_da_equipe": true|false}';

/** Lê a conferência: nota 1 só sem nenhuma afirmação sem base e sem promessa da equipe. */
export function lerConferencia(bruto: unknown): { nota: number | null; sem_base: string[] } {
  let j: any = bruto;
  if (typeof bruto === "string") {
    try {
      j = JSON.parse(bruto);
    } catch (_e) {
      return { nota: null, sem_base: [] };
    }
  }
  if (!j || typeof j !== "object" || !Array.isArray(j.sem_base)) return { nota: null, sem_base: [] };
  const sem = j.sem_base.map((x: unknown) => String(x)).filter((x: string) => x.trim()).slice(0, 5);
  return { nota: sem.length === 0 && j.promete_acao_da_equipe !== true ? 1 : 0, sem_base: sem };
}
