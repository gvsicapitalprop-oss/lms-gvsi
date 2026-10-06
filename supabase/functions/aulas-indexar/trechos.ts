// Partes puras do aulas-indexar (sem Deno nem rede), para o teste rodar com `npx tsx`.
// A transcrição da aula (SRT) vira trechos de 1 a 2 minutos com o segundo em que começam: é esse
// segundo que vai no link (?t=) quando a IA indica a aula.

export interface Segmento {
  ini: number;
  fim: number;
  texto: string;
}

/** SRT → segmentos com início e fim em segundos (aceita numeração fora de ordem e texto em várias linhas). */
export function segmentosDoSRT(srt: string | null | undefined): Segmento[] {
  if (!srt) return [];
  const tempo = (h: string, m: string, s: string, ms: string) =>
    Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, "0")) / 1000;
  const saida: Segmento[] = [];
  for (const bloco of srt.split(/\r?\n\r?\n/)) {
    const linhas = bloco.split(/\r?\n/).filter((l) => l.trim() !== "");
    const i = linhas.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const m = linhas[i].match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
    if (!m) continue;
    const texto = linhas.slice(i + 1).join(" ").replace(/\s+/g, " ").trim();
    if (!texto) continue;
    saida.push({ ini: tempo(m[1], m[2], m[3], m[4]), fim: tempo(m[5], m[6], m[7], m[8]), texto });
  }
  return saida.sort((a, b) => a.ini - b.ini);
}

const FIM_DE_FRASE = /[.?!…]["')\]]?$/;

/**
 * Junta os segmentos em trechos de ~`alvo` segundos, fechando de preferência no fim de uma frase.
 * Nunca passa de `maximo`; trecho final curto demais é colado no anterior.
 */
export function juntarEmTrechos(segmentos: Segmento[], alvo = 75, maximo = 110, minimo = 30): Segmento[] {
  const trechos: Segmento[] = [];
  let atual: Segmento | null = null;
  for (const s of segmentos) {
    if (!atual) {
      atual = { ...s };
      continue;
    }
    const passaria = s.fim - atual.ini;
    const fechaAqui = atual.fim - atual.ini >= alvo && FIM_DE_FRASE.test(atual.texto);
    if (fechaAqui || passaria > maximo) {
      trechos.push(atual);
      atual = { ...s };
    } else {
      atual = { ini: atual.ini, fim: s.fim, texto: `${atual.texto} ${s.texto}` };
    }
  }
  if (atual) {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && atual.fim - atual.ini < minimo) {
      trechos[trechos.length - 1] = { ini: ultimo.ini, fim: atual.fim, texto: `${ultimo.texto} ${atual.texto}` };
    } else {
      trechos.push(atual);
    }
  }
  return trechos.map((t) => ({ ini: Math.floor(t.ini), fim: Math.ceil(t.fim), texto: t.texto }));
}

/** A descrição da aula vem do editor do WordPress: tira as tags e as entidades mais comuns. */
export function textoDoHtml(html: string | null | undefined): string {
  return String(html ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** O trecho de cabeçalho: o que a aula é, para a busca achar pelo nome e pelo assunto. */
export function cabecalho(dados: { curso: string; modulo?: string | null; aula: string; descricao?: string | null }): string {
  const partes = [`Curso: ${dados.curso}.`];
  if (dados.modulo) partes.push(`Módulo: ${dados.modulo}.`);
  partes.push(`Aula: ${dados.aula}.`);
  const d = textoDoHtml(dados.descricao).slice(0, 800);
  if (d) partes.push(d);
  return partes.join(" ");
}
