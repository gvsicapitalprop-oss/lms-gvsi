// Aula indicada pela IA do suporte (migração 20261006000032, pedido do dono em 06/10/2026).
// Partes puras (sem Deno nem rede), para o teste rodar com `npx tsx`: o link com o minuto é
// montado aqui, nunca pela IA, e a nota diz como indicar conforme a situação do aluno.
export const SITE = "https://www.giovannipaganini.com";
export const MARCADOR_LINK = "{{LINK_DA_AULA}}";
export function minuto(s) {
  const t = Math.max(0, Math.floor(Number(s) || 0));
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
}
export function dataBR(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
// Os trechos falados que mais combinam com a dúvida, na ordem da aula e com o minuto de cada um
// (lms_trechos_da_aula). É o que a IA usa para explicar e o que o Jev confere.
export function juntarTrechos(trechos, maximo = 3600) {
  const linhas = [];
  let total = 0;
  for (const t of trechos || []) {
    const texto = String(t.texto || "").replace(/\s+/g, " ").trim();
    if (!texto) continue;
    const linha = `[${minuto(t.inicio_s)}] ${texto}`;
    if (total + linha.length > maximo) break;
    linhas.push(linha);
    total += linha.length;
  }
  return linhas.join("\n");
}
export function montarAula(c, confianca) {
  const t = Math.max(0, Math.floor(Number(c.inicio_s) || 0));
  return {
    lesson_id: c.lesson_id,
    aula: c.aula,
    curso: c.curso,
    modulo: c.modulo,
    inicio_s: t,
    link: `${SITE}/curso/${c.curso_slug}/aula/${c.aula_slug}` + (t >= 20 ? `?t=${t}` : ""),
    situacao: c.situacao,
    libera_em: c.libera_em,
    // o trecho da transcrição que mais combina com a dúvida: é com ele que a IA explica
    trecho: c.trecho ? String(c.trecho).replace(/\s+/g, " ").slice(0, 3600) : null,
    confianca: Math.round(confianca * 100) / 100,
    similaridade: Math.round(Number(c.similaridade) * 1000) / 1000
  };
}
// O que a IA precisa saber para indicar a aula do jeito certo para ESTE aluno.
export function notaDaAula(aula) {
  if (!aula) return "";
  const quando = aula.inicio_s >= 20 ? ` (o assunto aparece a partir de ${minuto(aula.inicio_s)})` : "";
  const onde = `"${aula.aula}"${aula.modulo ? ", do módulo " + aula.modulo : ""}, do curso ${aula.curso}`;
  const linhas = [
    "",
    "## AULA PARA INDICAR (escolhida pela transcrição das aulas)",
    `A aula ${onde}${quando} explica o assunto desta dúvida.`
  ];
  if (aula.situacao === "liberada" && aula.trecho) {
    // A explicação do próprio Giovanni (06/10/2026: sem isto a resposta saía genérica, de cabeça).
    // Só de aula que o aluno já abre: conteúdo de curso que ele não tem não é entregue aqui.
    linhas.push("", "## O QUE O GIOVANNI EXPLICA NESTA AULA (transcrição do trecho)", aula.trecho, "",
      "- Responda a dúvida a partir deste trecho, com as ideias e o jeito do Giovanni. Não acrescente regra, número ou passo que não esteja aqui; se o trecho não basta para responder, diga o que ele cobre e indique a aula.");
  }
  if (aula.situacao === "liberada") {
    linhas.push(`- Responda a dúvida e indique esta aula numa frase natural (ex.: "isso está explicado na aula ${aula.aula}${aula.inicio_s >= 20 ? ", a partir de " + minuto(aula.inicio_s) : ""}"). Logo depois dessa frase, numa linha sozinha, escreva exatamente ${MARCADOR_LINK}. NUNCA escreva um link: o sistema troca o marcador pelo link certo.`);
  } else if (aula.situacao === "bloqueada") {
    linhas.push(`- Ela ainda não está liberada para este aluno${aula.libera_em ? " (libera em " + dataBR(aula.libera_em) + ")" : ""}. Indique a aula avisando quando ela libera. Não escreva link nem o marcador.`);
  } else {
    linhas.push(`- Ela é do curso ${aula.curso}, que este aluno ainda não tem. Pode mencionar, com naturalidade e sem empurrar venda, que esse assunto é aprofundado nessa aula do curso ${aula.curso}. Não escreva link nem o marcador.`);
  }
  linhas.push("- A indicação é um complemento curto, de uma frase. Não diga que um sistema escolheu a aula.");
  return linhas.join("\n");
}
// Troca o marcador pelo link (só aula liberada). Link de aula escrito pela própria IA sai sempre.
export function aplicarLink(answer, aula) {
  let t = String(answer || "").replace(/https?:\/\/\S*giovannipaganini\.com\/curso\/\S*/g, "");
  if (aula && aula.situacao === "liberada" && t) {
    if (t.indexOf(MARCADOR_LINK) >= 0) t = t.replace(MARCADOR_LINK, aula.link);
    else t = t.trim() + "\n\n" + `Aula: ${aula.aula}${aula.inicio_s >= 20 ? " (a partir de " + minuto(aula.inicio_s) + ")" : ""}\n${aula.link}`;
  }
  return t.split(MARCADOR_LINK).join("").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
