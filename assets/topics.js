/**
 * GVSI Comunidade — tópicos da comunidade (dados).
 * Fonte única usada tanto pela sidebar (desktop) quanto pela lista (mobile).
 * Na fase 2 isto vem do Supabase (tabela comu_topics).
 */
window.GVSI_TOPICS = [
  { id: "prints",     name: "Prints das Operações",   icon: "monitoring",          tone: "primary",   desc: "Compartilhe entradas, saídas e prints dos seus trades." },
  { id: "tutoriais",  name: "Tutoriais",              icon: "play_circle",         tone: "tertiary",  desc: "Vídeos e materiais de aprendizado." },
  { id: "suporte",    name: "Suporte",                icon: "support_agent",       tone: "secondary", desc: "Tire dúvidas com a equipe do Giovanni." },
  { id: "geral",      name: "Chat Geral",             icon: "forum",               tone: "primary",   desc: "Conversa aberta da comunidade." },
  { id: "resultados", name: "Resultados / Feedbacks", icon: "fact_check",          tone: "tertiary",  desc: "Resultados e feedbacks dos membros." },
  { id: "recados",    name: "Recados",                icon: "notifications_active", tone: "secondary", desc: "Avisos e atualizações importantes." },
  { id: "desafio",    name: "Desafio",                icon: "emoji_events",        tone: "primary",   desc: "Desafios e competições da comunidade." },
  { id: "arquivos",   name: "Arquivos",               icon: "folder_open",         tone: "tertiary",  desc: "Planilhas, indicadores e downloads." },
];
