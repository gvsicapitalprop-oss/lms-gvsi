// Orquestrador de IA (Bruno) no Suporte da Comunidade GVSI.
// Aluno manda msg no Suporte -> este worker chama o cérebro (n8n) como persona
// "barbara" (Bruno), grava a resposta em comu_messages (o aluno vê em realtime).
// Conta tentativas; se a IA pedir handoff, estourar o teto, OU o cérebro falhar,
// marca o ticket p/ humano (silencioso) e para de responder.
// KILL SWITCH: só age se comu_ai_support_config.enabled = true.
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, N8N_WEBHOOK_URL, AGENT_TOKEN } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !N8N_WEBHOOK_URL || !AGENT_TOKEN) {
  console.error('faltam envs: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / N8N_WEBHOOK_URL / AGENT_TOKEN');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const log = (...a) => console.log(new Date().toISOString(), ...a);

let CFG = null, SUPORTE = null;
const timers = new Map(); // ticketId -> debounce timer

async function loadConfig() {
  const { data, error } = await sb.from('comu_ai_support_config').select('*').eq('id', 1).maybeSingle();
  if (error) { log('erro config:', error.message); return CFG; }
  CFG = data; return CFG;
}

async function askBrain({ message, message_type, media_url, ticketId, history }) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 120000);
  let res;
  try {
    res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({
        token: AGENT_TOKEN, message: message || '', message_type: message_type || 'text',
        media_url: media_url || null, persona: (CFG && CFG.persona) || 'barbara',
        conversation_id: ticketId, session_id: ticketId, history: history || [], generate_tts: false,
      }),
    });
  } catch (e) { clearTimeout(t); return { ok: false, err: e.name === 'AbortError' ? 'timeout' : e.message }; }
  clearTimeout(t);
  const raw = await res.text();
  if (!res.ok || !raw.trim()) return { ok: false, status: res.status, raw: (raw || '').slice(0, 160) };
  let d; try { d = JSON.parse(raw); } catch { return { ok: false, raw: raw.slice(0, 160) }; }
  if (Array.isArray(d)) d = d[0] || {};
  if (d && d.json) d = d.json;
  const response = [d.response, d.output, d.text, d.message, d.reply].find(x => typeof x === 'string' && x.trim()) || '';
  return { ok: !!response, response, handoff: !!d.handoff_requested };
}

async function buildHistory(ticket) {
  const { data } = await sb.from('comu_messages')
    .select('author_id, body, kind, created_at').eq('ticket_id', ticket.id)
    .neq('status', 'deleted').order('created_at', { ascending: false }).limit(20);
  return (data || []).slice().reverse().map(m => ({
    role: m.author_id === ticket.user_id ? 'user' : 'assistant',
    text: m.body || (m.kind === 'audio' ? '(áudio)' : m.kind === 'image' ? '(imagem)' : m.kind === 'video' ? '(vídeo)' : ''),
  })).filter(m => m.text);
}

async function postBruno(ticket, text) {
  const { error } = await sb.from('comu_messages').insert({
    topic_id: SUPORTE, author_id: CFG.bot_user_id, ticket_id: ticket.id,
    kind: 'text', body: text, author_name: 'Bruno', author_avatar: CFG.bot_avatar || null,
  });
  if (error) log('erro ao postar Bruno:', error.message);
}

async function escalate(ticket, reason) {
  await sb.from('comu_support_tickets').update({ ai_active: false, needs_human: true, updated_at: new Date().toISOString() }).eq('id', ticket.id);
  log('HANDOFF', ticket.protocol || ticket.id, '->', reason);
}

async function handleTicket(ticketId) {
  if (!CFG || !CFG.enabled || !CFG.bot_user_id || !SUPORTE) return;
  const { data: ticket } = await sb.from('comu_support_tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!ticket || !ticket.ai_active || ticket.needs_human) return;
  const { data: last } = await sb.from('comu_messages')
    .select('author_id, body, kind, media_url').eq('ticket_id', ticketId)
    .neq('status', 'deleted').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!last || last.author_id !== ticket.user_id) return; // só responde se o ALUNO falou por último
  const history = await buildHistory(ticket);
  if (history.length) history.pop(); // a última (do aluno) vai como "message"
  const r = await askBrain({
    message: last.body || '', message_type: last.kind === 'audio' ? 'audio' : 'text',
    media_url: last.media_url, ticketId, history,
  });
  if (!r.ok) { // cérebro fora do ar/erro -> não deixa o aluno no vácuo
    log('brain falhou', ticketId, r.status || r.err || '', r.raw || '');
    if (CFG.hold_message) await postBruno(ticket, CFG.hold_message);
    await escalate(ticket, 'brain_error');
    return;
  }
  await postBruno(ticket, r.response);
  const attempts = (ticket.ai_attempts || 0) + 1;
  await sb.from('comu_support_tickets').update({ ai_attempts: attempts, updated_at: new Date().toISOString() }).eq('id', ticket.id);
  if (r.handoff || attempts >= (CFG.max_attempts || 4)) {
    if (CFG.hold_message) await postBruno(ticket, CFG.hold_message);
    await escalate(ticket, r.handoff ? 'ia_pediu_humano' : 'max_tentativas');
  }
}

function schedule(ticketId) {
  clearTimeout(timers.get(ticketId));
  timers.set(ticketId, setTimeout(() => {
    timers.delete(ticketId);
    handleTicket(ticketId).catch(e => log('erro handleTicket', ticketId, e.message));
  }, 2500));
}

async function catchUp() {
  if (!CFG || !CFG.enabled) return;
  const { data } = await sb.from('comu_support_tickets').select('id')
    .eq('status', 'aberto').eq('ai_active', true).eq('needs_human', false);
  (data || []).forEach(t => schedule(t.id));
  log('catch-up:', (data || []).length, 'tickets abertos');
}

async function main() {
  await loadConfig();
  const { data: topic } = await sb.from('comu_topics').select('id').eq('slug', 'suporte').maybeSingle();
  SUPORTE = topic && topic.id;
  if (!SUPORTE) { console.error('tópico "suporte" não encontrado'); process.exit(1); }
  log('start | enabled=' + (CFG && CFG.enabled) + ' persona=' + (CFG && CFG.persona) + ' suporte=' + SUPORTE);
  sb.channel('comu-ai-suporte')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comu_messages', filter: 'topic_id=eq.' + SUPORTE }, (p) => {
      const m = p.new; if (!m || !m.ticket_id) return;
      if (CFG && m.author_id === CFG.bot_user_id) return; // ignora o próprio Bruno
      schedule(m.ticket_id);
    })
    .subscribe(st => log('realtime:', st));
  await catchUp();
  setInterval(loadConfig, 30000); // recarrega config/kill switch a cada 30s
}
main().catch(e => { console.error(e); process.exit(1); });
