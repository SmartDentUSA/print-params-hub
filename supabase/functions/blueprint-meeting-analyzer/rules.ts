// Regras puras da análise pós-reunião (sem rede) — testadas em rules_test.ts.

export const MEET_NOTES_FOLDER_ID = "1yiMle9IVXelCuGBr-HVQnrJ0aIRxUsUJ"; // "Meet Recordings" de oraculosmartdent@gmail.com
export const DOC_MIME = "application/vnd.google-apps.document";
/** Espera após o fim previsto antes de procurar as anotações (o Google leva alguns minutos). */
export const GRACE_AFTER_END_MS = 10 * 60 * 1000;
/** Para de procurar depois de 3 dias sem documento. */
export const GIVE_UP_AFTER_MS = 3 * 24 * 3600 * 1000;

export type Due = "wait" | "search" | "give_up";

export function dueState(scheduledEndIso: string | null | undefined, now = new Date()): Due {
  const end = new Date(scheduledEndIso ?? "").getTime();
  if (!Number.isFinite(end)) return "give_up";
  const t = now.getTime();
  if (t < end + GRACE_AFTER_END_MS) return "wait";
  if (t > end + GIVE_UP_AFTER_MS) return "give_up";
  return "search";
}

/** Data/hora no formato que o Google usa no nome do documento ("2026/11/10 18:27"). */
export function googleDocStamp(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600000); // Brasília (sem horário de verão)
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export interface DriveDoc { id: string; name: string; mimeType?: string; createdTime?: string; modifiedTime?: string }

/**
 * Escolhe o documento de anotações da reunião. Prioridade:
 * 1) anexo do próprio evento da agenda (o Google anexa as anotações ao evento);
 * 2) documento da pasta cujo nome começa pelo título do evento.
 * Nunca escolhe por proximidade de horário apenas — evita atribuir a reunião errada ao lead.
 */
export function pickNotesDoc(i: { attachments: Array<{ fileId?: string; title?: string; mimeType?: string }>; folderDocs: DriveDoc[]; eventSummary: string }): { id: string; name: string; via: string } | null {
  const att = i.attachments.find((a) => a.fileId && (a.mimeType === DOC_MIME || /anota|notes|gemini/i.test(a.title ?? "")));
  if (att?.fileId) return { id: att.fileId, name: att.title ?? "", via: "calendar_attachment" };
  const title = norm(i.eventSummary);
  if (title.length < 8) return null;
  const hits = i.folderDocs.filter((d) => (d.mimeType ?? DOC_MIME) === DOC_MIME && norm(d.name).startsWith(title));
  if (hits.length === 0) return null;
  hits.sort((a, b) => String(b.createdTime ?? b.modifiedTime ?? "").localeCompare(String(a.createdTime ?? a.modifiedTime ?? "")));
  return { id: hits[0].id, name: hits[0].name, via: "folder_title" };
}

export interface Analysis {
  resumo: string;
  dores: string[];
  objecoes: string[];
  proximos_passos: Array<{ responsavel: string; acao: string }>;
  produtos_citados: string[];
  temperatura: "quente" | "morno" | "frio";
  perfil_comercial: { estilo_decisao: string; prioridades: string[]; sensibilidade_preco: string; nivel_tecnico: string; sinais_compra: string[]; riscos: string[] };
  avaliacao_vendedor: { nota_conducao: number; pontos_fortes: string[]; melhorias: string[]; resumo: string };
}

const list = (t: string, xs: string[] | undefined) => (xs?.length ? [`${t}`, ...xs.map((x) => `• ${x}`), ""] : []);

/** Nota do PipeRun com o relatório. Só o que veio da análise; sem preços inventados. */
export function buildReportNote(a: Analysis, docUrl: string, meetUrl: string | null): string {
  const L: string[] = ["🧠 Relatório da Apresentação · Blueprint Intelligence", ""];
  if (meetUrl) L.push(`🎥 Reunião: ${meetUrl}`);
  L.push(`📄 Anotações/transcrição: ${docUrl}`, "", "📝 Resumo", a.resumo, "");
  L.push(...list("😣 Principais dores", a.dores));
  L.push(...list("🚧 Objeções", a.objecoes));
  if (a.proximos_passos?.length) {
    L.push("➡️ Próximos passos", ...a.proximos_passos.map((p) => `• [${p.responsavel}] ${p.acao}`), "");
  }
  L.push(...list("📦 Produtos citados", a.produtos_citados));
  const p = a.perfil_comercial;
  L.push(`🌡️ Temperatura: ${a.temperatura}`, "", "👤 Perfil comercial do lead");
  L.push(`• Estilo de decisão: ${p.estilo_decisao}`, `• Sensibilidade a preço: ${p.sensibilidade_preco}`, `• Nível técnico: ${p.nivel_tecnico}`);
  if (p.prioridades?.length) L.push(`• Prioridades: ${p.prioridades.join("; ")}`);
  if (p.sinais_compra?.length) L.push(`• Sinais de compra: ${p.sinais_compra.join("; ")}`);
  if (p.riscos?.length) L.push(`• Riscos: ${p.riscos.join("; ")}`);
  const v = a.avaliacao_vendedor;
  L.push("", `🎯 Condução do vendedor: ${v.nota_conducao}/10`, v.resumo);
  if (v.pontos_fortes?.length) L.push(`• Pontos fortes: ${v.pontos_fortes.join("; ")}`);
  if (v.melhorias?.length) L.push(`• A melhorar: ${v.melhorias.join("; ")}`);
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
