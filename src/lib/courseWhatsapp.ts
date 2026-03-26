import type { SmartopsCourse, Turma, TurmaDay } from '@/types/courses';
import { resolveLocal, formatDuration, formatDatePtBr, formatWeekday } from './courseUtils';

export const DEFAULT_ENROLLMENT_TEMPLATE = `Olá, {{nome}}! 👋

Seu treinamento foi confirmado. Aqui estão os detalhes:

📚 *{{curso}}*
🏷 Turma: *{{turma_label}}*
👨‍🏫 Instrutor: {{instrutor}}
📍 {{local}}

{{cronograma}}

{{grupo_whatsapp}}

Qualquer dúvida, estou à disposição!

*{{cs_nome}}*
_Equipe SmartDent_ 🦷`;

export const TEMPLATE_VARIABLES = [
  { key: '{{nome}}',           desc: 'Nome do participante' },
  { key: '{{curso}}',          desc: 'Título do curso' },
  { key: '{{turma_label}}',    desc: 'Ex: Turma Abril 2026' },
  { key: '{{instrutor}}',      desc: 'Nome do instrutor' },
  { key: '{{local}}',          desc: 'Local ou link' },
  { key: '{{cronograma}}',     desc: 'Todos os dias com horários e tópicos' },
  { key: '{{duracao}}',        desc: 'Ex: 3 dias' },
  { key: '{{data_inicio}}',    desc: 'DD/MM/AAAA' },
  { key: '{{data_fim}}',       desc: 'DD/MM/AAAA' },
  { key: '{{horario_inicio}}', desc: 'HH:MM do 1º dia' },
  { key: '{{grupo_whatsapp}}', desc: 'CTA + link do grupo WhatsApp' },
  { key: '{{cs_nome}}',        desc: 'Nome do CS' },
] as const;

export function buildCronogramaText(days: TurmaDay[], turmaLabel: string): string {
  if (!days?.length) return '';
  const sorted = [...days].sort((a, b) => a.day_number - b.day_number);
  const t = (s: string) => s?.substring(0, 5) ?? '';

  if (sorted.length === 1) {
    const d = sorted[0];
    return `📅 *Data:* ${formatDatePtBr(d.date)} (${formatWeekday(d.date)})\n⏰ *Horário:* ${t(d.start_time)} às ${t(d.end_time)}`;
  }
  const lines = sorted.map((d, i) => {
    const label = d.topic ? `*${d.topic}*` : `*Dia ${i + 1}*`;
    return `📅 ${label}\n    ${formatDatePtBr(d.date)} (${formatWeekday(d.date)}) | ${t(d.start_time)}–${t(d.end_time)}`;
  });
  return `🗓 *Cronograma — ${turmaLabel}*\n\n${lines.join('\n\n')}`;
}

export function interpolateTemplate(template: string, vars: {
  nome: string; curso: string; turma_label: string; instrutor: string;
  local: string; cronograma: string; duracao: string; data_inicio: string;
  data_fim: string; horario_inicio: string; grupo_whatsapp: string; cs_nome: string;
}): string {
  const grupoLine = vars.grupo_whatsapp
    ? `📱 *Entre no grupo de WhatsApp do seu treinamento:*\n👉 ${vars.grupo_whatsapp}`
    : '';
  const fmt = (d: string) => d ? d.split('-').reverse().join('/') : '';
  return template
    .replace(/\{\{nome\}\}/g,           vars.nome)
    .replace(/\{\{curso\}\}/g,          vars.curso)
    .replace(/\{\{turma_label\}\}/g,    vars.turma_label)
    .replace(/\{\{instrutor\}\}/g,      vars.instrutor)
    .replace(/\{\{local\}\}/g,          vars.local)
    .replace(/\{\{cronograma\}\}/g,     vars.cronograma)
    .replace(/\{\{duracao\}\}/g,        vars.duracao)
    .replace(/\{\{data_inicio\}\}/g,    fmt(vars.data_inicio))
    .replace(/\{\{data_fim\}\}/g,       fmt(vars.data_fim))
    .replace(/\{\{horario_inicio\}\}/g, vars.horario_inicio)
    .replace(/\{\{grupo_whatsapp\}\}/g, grupoLine)
    .replace(/\{\{cs_nome\}\}/g,        vars.cs_nome)
    .replace(/\n{3,}/g, '\n\n').trim();
}

export function buildTemplateVars(
  course: SmartopsCourse, turma: Turma, days: TurmaDay[], personName: string, csName: string
) {
  const sorted = [...(days ?? [])].sort((a, b) => a.day_number - b.day_number);
  const first = sorted[0];
  const last  = sorted[sorted.length - 1];
  const t = (s?: string) => s?.substring(0, 5) ?? '';
  return {
    nome: personName, curso: course.title, turma_label: turma.label,
    instrutor: course.instructor_name || '', local: resolveLocal(course),
    cronograma: buildCronogramaText(sorted, turma.label),
    duracao: formatDuration(course),
    data_inicio: first?.date || '', data_fim: last?.date || '',
    horario_inicio: t(first?.start_time),
    grupo_whatsapp: turma.whatsapp_group_link || course.whatsapp_group_link || '',
    cs_nome: csName,
  };
}
