import type { DistributorFormValue } from "../components/smartops/DistributorForm";

export interface DistributorEventField {
  id: string;
  label: string;
  db_column: string | null;
  custom_field_name: string | null;
}

export function distributorEventAnswers(value: DistributorFormValue, fields: DistributorEventField[]) {
  const phone = (ddi?: string | null, number?: string | null) => number?.trim()
    ? `${ddi || "+55"}${number.replace(/\D/g, "")}` : "";
  const scope = Object.entries(value.authorized_scope || {})
    .map(([category, subs]) => subs.length ? `${category}: ${subs.join(", ")}` : category).join("; ");
  const mapped: Record<string, string> = {
    empresa_razao_social: value.razao_social || "", empresa_nome: value.nome_fantasia || "",
    empresa_pais: value.pais || "", empresa_uf: value.estado || "", empresa_cidade: value.cidade || "",
    empresa_endereco: value.endereco || "", empresa_website: value.site_url || "",
    empresa_facebook: value.facebook || "", empresa_linkedin: value.linkedin || "",
    nome: value.owner_name || "", email: value.owner_email || "",
    telefone_raw: phone(value.owner_whatsapp_ddi, value.owner_whatsapp),
    distribuidor_cep: value.cep || "", distribuidor_unidades: String(value.numero_unidades ?? 1),
    distribuidor_instagram: value.instagram || "", distribuidor_youtube: value.youtube || "",
    distribuidor_compras_nome: value.buyer_name || "", distribuidor_compras_email: value.buyer_email || "",
    distribuidor_compras_whatsapp: phone(value.buyer_whatsapp_ddi, value.buyer_whatsapp),
    distribuidor_linhas: scope, distribuidor_idioma: value.language_preference || "pt",
    distribuidor_moeda: value.preferred_currency || "BRL", distribuidor_observacoes: value.notes || "",
  };
  const answers: Record<string, string> = {};
  for (const field of fields) {
    const key = field.db_column || field.custom_field_name;
    if (key && Object.prototype.hasOwnProperty.call(mapped, key)) answers[field.id] = mapped[key];
  }
  return { answers, scope };
}