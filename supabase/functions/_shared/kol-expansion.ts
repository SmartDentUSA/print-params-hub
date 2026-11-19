// Formulário "Interessados em ser KOL" de cada evento (form_purpose = kol_expansao).
// Regras de negócio compartilhadas pela página pública (src/lib/kolExpansion.ts)
// e pela edge function kol-expansao-crm-sync.

/** Funil PipeRun KOL Expansão, etapa "Interesse". */
export const KOL_EXPANSION_PIPELINE_ID = 109840;
/** Beatriz Marketing Smart Dent. */
export const KOL_EXPANSION_OWNER_PIPERUN_ID = 104356;
/** custom_field_name da pergunta "Como você gostaria de participar?". */
export const KOL_EXPANSION_PARTICIPATION_FIELD = "kol_participacao";
/** Danilo Henrique — WhatsApp da mensagem final. */
export const KOL_EXPANSION_WHATSAPP = "5519992612348";

export const KOL_PARTICIPATION = {
  demo: "Ver uma demonstração",
  implant: "Avaliar a implantação na minha clínica",
  training: "Participar de um treinamento",
  partnership: "Conversar sobre parceria clínica ou educacional",
} as const;

const INTEREST_BY_PARTICIPATION: Record<string, string> = {
  [KOL_PARTICIPATION.demo]: "Ver uma demonstração",
  [KOL_PARTICIPATION.implant]: "Implementar fluxo digital",
  [KOL_PARTICIPATION.training]: "Participar de um treinamento",
  [KOL_PARTICIPATION.partnership]: "Fazer parceria",
};

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Produto de interesse do CRM a partir da resposta "Como você gostaria de participar?". */
export function kolExpansionInterest(answer: unknown): string | null {
  const a = norm(answer);
  if (!a) return null;
  for (const [opt, interest] of Object.entries(INTEREST_BY_PARTICIPATION)) {
    if (norm(opt) === a) return interest;
  }
  return null;
}

/** Origem do deal: "[KOLEXPANSÃO] - {nome do evento}". */
export function kolExpansionOrigin(eventName: string | null | undefined): string {
  const name = String(eventName ?? "").trim();
  return name ? `[KOLEXPANSÃO] - ${name}`.slice(0, 190) : "[KOLEXPANSÃO]";
}

/** Etapa "Interesse" do funil; sem ela, a primeira etapa pela ordem. */
export function kolExpansionStageId(stages: Array<{ id: unknown; name?: unknown; order?: unknown; pipeline_id?: unknown }>): number | null {
  const list = stages.filter((s) => Number(s.pipeline_id) === KOL_EXPANSION_PIPELINE_ID);
  if (!list.length) return null;
  const named = list.find((s) => /^interess/i.test(norm(s.name)));
  if (named) return Number(named.id);
  const sorted = [...list].sort((a, b) => (Number(a.order ?? 0) - Number(b.order ?? 0)) || (Number(a.id) - Number(b.id)));
  return Number(sorted[0].id);
}

const firstName = (name: string | null | undefined) => String(name ?? "").trim().split(/\s+/)[0] || "";

/** Mensagem da tela final. */
export function kolExpansionThanks(name: string | null | undefined): string {
  const n = firstName(name);
  return `Obrigado${n ? `, ${n}` : ""}! Recebemos seu interesse no Chairside Print. Se quiser adiantar a conversa, fale diretamente com o Danilo no WhatsApp.`;
}

/** Link do WhatsApp do Danilo com a mensagem pronta. */
export function kolExpansionWhatsappUrl(name: string | null | undefined, eventName?: string | null): string {
  const n = firstName(name);
  const ev = String(eventName ?? "").trim();
  const text = `Olá, Danilo! ${n ? `Sou ${n}. ` : ""}Acabei de enviar meu interesse no Chairside Print${ev ? ` no ${ev}` : ""}.`;
  return `https://wa.me/${KOL_EXPANSION_WHATSAPP}?text=${encodeURIComponent(text)}`;
}
