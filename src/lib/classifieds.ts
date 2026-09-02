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

export function firstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const first = images[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "url" in (first as Record<string, unknown>)) {
    return String((first as Record<string, unknown>).url);
  }
  return null;
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
