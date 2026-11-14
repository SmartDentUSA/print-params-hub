// Leitura de mensagens diretas recebidas em webhooks da Evolution (clássica v2 e GO).
// Usado pelo evolution-webhook-fanout para decidir se a Dra. LIA deve responder.

export type EvolutionInbound = {
  instance: string;
  messageId: string;
  remoteJid: string;
  /** Telefone real (somente dígitos) quando o payload traz; null para @lid sem número. */
  phoneDigits: string | null;
  /** Dígitos do @lid quando o WhatsApp esconde o número. */
  lidDigits: string | null;
  text: string;
  pushName: string | null;
  timestampMs: number | null;
};

const PHONE_SUFFIX = /@(s\.whatsapp\.net|c\.us)$/i;

function digits(v: unknown): string {
  return String(v ?? "").replace(/@.*$/, "").replace(/\D/g, "");
}

function asPhone(v: unknown): string | null {
  const s = String(v ?? "");
  if (!s || s.includes("@lid") || s.includes("@g.us")) return null;
  const d = digits(s);
  return d.length >= 10 && d.length <= 13 ? d : null;
}

function extractText(message: any): string {
  if (!message || typeof message !== "object") return "";
  return String(
    message.conversation ??
      message.extendedTextMessage?.text ??
      message.imageMessage?.caption ??
      message.videoMessage?.caption ??
      message.documentMessage?.caption ??
      message.buttonsResponseMessage?.selectedDisplayText ??
      message.listResponseMessage?.title ??
      message.templateButtonReplyMessage?.selectedDisplayText ??
      "",
  ).trim();
}

export function evolutionInstanceName(body: any): string {
  const v = typeof body?.instance === "string"
    ? body.instance
    : body?.instance?.instanceName ?? body?.instanceName ?? body?.instance_name ?? "";
  return String(v ?? "").trim();
}

/** Mensagens diretas de terceiros (não enviadas por nós, não grupos) com texto. */
export function parseEvolutionInbound(body: any): EvolutionInbound[] {
  const event = String(body?.event ?? body?.type ?? "").toLowerCase().replace(/_/g, ".");
  if (event !== "messages.upsert") return [];
  const instance = evolutionInstanceName(body);
  if (!instance) return [];

  const data = body?.data;
  const items: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.messages)
    ? data.messages
    : data
    ? [data]
    : [];

  const out: EvolutionInbound[] = [];
  for (const m of items) {
    const key = m?.key ?? {};
    const remoteJid = String(key.remoteJid ?? m?.remoteJid ?? "");
    const messageId = String(key.id ?? m?.id ?? "");
    if (!remoteJid || !messageId) continue;
    if (key.fromMe === true || m?.fromMe === true) continue;
    if (remoteJid.endsWith("@g.us") || remoteJid.includes("@broadcast") || remoteJid.includes("@newsletter")) continue;

    const text = extractText(m?.message);
    if (!text) continue;

    const isLid = remoteJid.endsWith("@lid");
    const phoneDigits = isLid
      ? asPhone(key.senderPn) ?? asPhone(key.remoteJidAlt) ?? asPhone(m?.senderPn) ?? asPhone(m?.remoteJidAlt) ??
        asPhone(key.participantPn) ?? asPhone(body?.sender && PHONE_SUFFIX.test(String(body.sender)) ? null : null)
      : asPhone(remoteJid);

    const ts = Number(m?.messageTimestamp ?? 0);
    out.push({
      instance,
      messageId,
      remoteJid,
      phoneDigits,
      lidDigits: isLid ? digits(remoteJid) : null,
      text,
      pushName: typeof m?.pushName === "string" && m.pushName.trim() ? m.pushName.trim() : null,
      timestampMs: Number.isFinite(ts) && ts > 0 ? (ts > 1e12 ? ts : ts * 1000) : null,
    });
  }
  return out;
}

/** Mensagens antigas (sincronização de histórico/reconexão) nunca recebem resposta automática. */
export function isFreshInbound(m: EvolutionInbound, nowMs: number, maxAgeMs = 120_000): boolean {
  if (m.timestampMs == null) return false;
  return nowMs - m.timestampMs <= maxAgeMs;
}
