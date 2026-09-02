// Vocabulário e helpers do Canal de Equipamentos Usados.
// Categorias e estados de conservação espelham os CHECKs de classified_listings.

export const CLASSIFIED_CATEGORIES = [
  { value: "scanner", label: "Scanner intraoral" },
  { value: "impressora_3d", label: "Impressora 3D" },
  { value: "fresadora", label: "Fresadora" },
  { value: "pos_cura", label: "Pós-cura" },
  { value: "cuba", label: "Cuba de lavagem" },
  { value: "compressor", label: "Compressor" },
] as const;

export const CLASSIFIED_CONDITIONS = [
  { value: "new", label: "Novo (nunca usado)" },
  { value: "excellent", label: "Excelente" },
  { value: "good", label: "Bom" },
  { value: "fair", label: "Regular" },
  { value: "na", label: "Não informado" },
] as const;

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR",
  "PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

export const CLASSIFIED_STATUS_LABEL: Record<string, string> = {
  pending: "Em revisão",
  active: "No ar",
  expired: "Expirado",
  sold: "Vendido",
  removed: "Removido",
};

export const MAX_CLASSIFIED_IMAGES = 10;
export const MAX_ACTIVE_FREE_LISTINGS = 5;
export const CLASSIFIEDS_BUCKET = "catalog-images";

/** Extensões aceitas no upload de mídia do anúncio (fotos + vídeos). */
export const CLASSIFIED_MEDIA_ACCEPT = "image/*,video/mp4,video/webm,video/quicktime";

/** Detecta vídeo pela extensão da URL pública salva em `images`. */
export function isVideoUrl(url?: string | null): boolean {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url || "");
}

export function categoryLabel(value?: string | null): string {
  return CLASSIFIED_CATEGORIES.find((c) => c.value === value)?.label ?? "Equipamento";
}

export function conditionLabel(value?: string | null): string {
  return CLASSIFIED_CONDITIONS.find((c) => c.value === value)?.label ?? "Não informado";
}

export function formatPrice(price?: number | null): string {
  if (price == null) return "Valor a combinar";
  return price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function listingUrl(slugOrId: string): string {
  return `/usados/${slugOrId}`;
}

/** Capa do anúncio: primeira foto real (ignora vídeos). */
export function firstImage(images: unknown): string | null {
  const all = imageList(images);
  return all.find((m) => !isVideoUrl(m)) ?? null;
}

export function imageList(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((i) =>
      typeof i === "string"
        ? i
        : i && typeof i === "object" && "url" in (i as Record<string, unknown>)
          ? String((i as Record<string, unknown>).url)
          : ""
    )
    .filter(Boolean);
}

/** Link de WhatsApp com mensagem pré-preenchida contendo o título do anúncio. */
export function whatsappLink(phone: string | null | undefined, title: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  const target = digits ? (digits.startsWith("55") ? digits : `55${digits}`) : "5516997501531";
  const msg = `Olá! Vi o anúncio "${title}" no Canal de Equipamentos Usados da Smart Dent e gostaria de mais informações.`;
  return `https://wa.me/${target}?text=${encodeURIComponent(msg)}`;
}

export interface SpecRow { label: string; value: string }

/**
 * Separa a descrição em ficha técnica ("Chave: valor") e texto corrido,
 * para renderizar especificações numa tabela legível em vez de um bloco cru.
 */
export function parseDescription(description?: string | null): { specs: SpecRow[]; text: string } {
  const lines = (description || "").split(/\r?\n/);
  const specs: SpecRow[] = [];
  const rest: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { rest.push(""); continue; }
    const m = line.match(/^([^:：]{2,40})[:：]\s*(.+)$/);
    if (m && m[2].trim().length <= 160) {
      specs.push({ label: m[1].trim(), value: m[2].trim() });
    } else {
      rest.push(line);
    }
  }

  // Só vale a pena a tabela se houver ficha técnica de verdade.
  if (specs.length < 3) return { specs: [], text: (description || "").trim() };
  return { specs, text: rest.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

// ---------- Campos estruturados do anúncio ----------
// Guardados como linhas "Rótulo: valor" na descrição para não exigir migração.
// O formulário lê/escreve esses rótulos canônicos; a página de detalhe consome
// via parseDescription.

export const CLASSIFIED_FIELD_LABELS = {
  year: "Ano de fabricação",
  payment: "Forma de pagamento",
  shipping: "Frete",
  training: "Treinamento",
  warranty: "Garantia",
} as const;

export type ClassifiedFieldKey = keyof typeof CLASSIFIED_FIELD_LABELS;

export interface ClassifiedStructuredFields {
  year: string;
  payment: string;
  shipping: string;
  training: string;
  warranty: string;
}

export const EMPTY_STRUCTURED_FIELDS: ClassifiedStructuredFields = {
  year: "", payment: "", shipping: "", training: "", warranty: "",
};

export const CLASSIFIED_SHIPPING_OPTIONS = [
  { value: "Por conta do comprador", label: "Por conta do comprador" },
  { value: "Frete incluso", label: "Frete incluso" },
  { value: "A combinar", label: "A combinar" },
] as const;

export const CLASSIFIED_YES_NO = [
  { value: "Incluso", label: "Incluso" },
  { value: "Não incluso", label: "Não incluso" },
  { value: "A combinar", label: "A combinar" },
] as const;

function normLabel(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const LABEL_TO_KEY = new Map<string, ClassifiedFieldKey>(
  (Object.keys(CLASSIFIED_FIELD_LABELS) as ClassifiedFieldKey[]).map((k) => [
    normLabel(CLASSIFIED_FIELD_LABELS[k]),
    k,
  ]),
);

/**
 * Lê a descrição e separa: campos estruturados (rótulos canônicos),
 * demais linhas "Chave: valor" (especificações técnicas) e texto livre.
 */
export function splitDescription(description?: string | null): {
  fields: ClassifiedStructuredFields;
  specs: SpecRow[];
  text: string;
} {
  const fields = { ...EMPTY_STRUCTURED_FIELDS };
  const specs: SpecRow[] = [];
  const rest: string[] = [];

  for (const raw of (description || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { rest.push(""); continue; }
    const m = line.match(/^([^:：]{2,40})[:：]\s*(.+)$/);
    if (m && m[2].trim().length <= 160) {
      const key = LABEL_TO_KEY.get(normLabel(m[1]));
      if (key) { fields[key] = m[2].trim(); continue; }
      specs.push({ label: m[1].trim(), value: m[2].trim() });
      continue;
    }
    rest.push(line);
  }

  return { fields, specs, text: rest.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

/**
 * Monta a descrição canônica: ficha técnica, campos estruturados e texto livre.
 * Linhas vazias são omitidas para não poluir o anúncio.
 */
export function composeDescription(input: {
  text: string;
  specsLines: string;
  fields: ClassifiedStructuredFields;
}): string {
  const blocks: string[] = [];
  const specs = input.specsLines
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[^:：]{2,40}[:：]\s*\S/.test(l));
  if (specs.length) blocks.push(specs.join("\n"));

  const fieldLines = (Object.keys(CLASSIFIED_FIELD_LABELS) as ClassifiedFieldKey[])
    .filter((k) => input.fields[k].trim())
    .map((k) => `${CLASSIFIED_FIELD_LABELS[k]}: ${input.fields[k].trim()}`);
  if (fieldLines.length) blocks.push(fieldLines.join("\n"));

  const text = input.text.trim();
  if (text) blocks.push(text);

  return blocks.join("\n\n");
}

export interface PublicListing {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  price: number | null;
  condition: string | null;
  category: string | null;
  location_city: string | null;
  location_state: string | null;
  images: unknown;
  published_at: string | null;
  view_count: number | null;
  seller_name: string | null;
  is_cliente: boolean | null;
}
