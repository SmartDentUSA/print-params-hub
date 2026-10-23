export type BioEvent = "view" | "card_click" | "cta_click" | "whatsapp_click";

export interface BioEventPayload {
  page_id: string;
  event_type: BioEvent;
  item_id: string | null;
}

/** Supabase builders are lazy: awaiting the insert starts the request. */
export async function recordBioEvent(
  insert: (payload: BioEventPayload) => PromiseLike<{ error: unknown }>,
  pageId: string | undefined,
  eventType: BioEvent,
  itemId?: string,
): Promise<void> {
  if (!pageId) return;
  try {
    const { error } = await insert({ page_id: pageId, event_type: eventType, item_id: itemId ?? null });
    if (error) console.error("Falha ao registrar evento da Bio", error);
  } catch (error) {
    console.error("Falha ao registrar evento da Bio", error);
  }
}