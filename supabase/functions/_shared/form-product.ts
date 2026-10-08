// Meta inputs retain their existing ingestion rules.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMERCIAL_TYPES = ["product", "resin", "Resinas", "consumables", "Serviços"];

export async function resolveFormProduct(
  db: any,
  input: { source?: unknown; form_id?: unknown; product_catalog_id?: unknown; product?: unknown },
): Promise<{ id: string; name: string } | null> {
  if (/meta/i.test(String(input.source ?? "")) || !UUID.test(String(input.form_id ?? ""))) return null;
  const { data: form, error } = await db.from("smartops_forms")
    .select("product_catalog_id, capture_buttons_enabled, capture_buttons, event_product_buttons")
    .eq("id", input.form_id).maybeSingle();
  if (error) throw new Error("Não foi possível consultar o produto do formulário.");
  if (!form) return null;
  const buttons = [
    ...(form.capture_buttons_enabled && Array.isArray(form.capture_buttons) ? form.capture_buttons : []),
    ...(Array.isArray(form.event_product_buttons) ? form.event_product_buttons : []),
  ];
  const requested = String(input.product_catalog_id ?? "");
  const selected = buttons.find((b: any) =>
    requested ? b.product_catalog_id === requested : b.product_name === input.product || b.label === input.product);
  const id = selected?.product_catalog_id || form.product_catalog_id;
  if (!id) return null;
  const { data: product, error: productError } = await db.from("system_a_catalog")
    .select("id, name").eq("id", id).in("category", COMMERCIAL_TYPES).maybeSingle();
  if (productError || !product?.name) throw new Error("Produto vinculado indisponível no catálogo.");
  return { id: product.id, name: product.name };
}