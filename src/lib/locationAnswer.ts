// Resposta de localização (país, estado, cidade) usada no formulário público
// com as mesmas listas do cadastro de distribuidor.
export type LocationAnswer = { pais?: string; estado?: string; estadoSigla?: string; cidade?: string };

export const isLocationAnswer = (v: unknown): v is LocationAnswer =>
  !!v && typeof v === "object" && !Array.isArray(v) && ("pais" in (v as object) || "cidade" in (v as object) || "estado" in (v as object));

/** "Cidade, Estado, País" — só as partes preenchidas. */
export function formatLocation(v: LocationAnswer | null | undefined): string {
  if (!v) return "";
  return [v.cidade, v.estado, v.pais].map((s) => String(s ?? "").trim()).filter(Boolean).join(", ");
}

/** Colunas do lead: cidade, UF (sigla no Brasil) e país. */
export function locationColumns(v: LocationAnswer | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v) return out;
  const cidade = String(v.cidade ?? "").trim();
  const pais = String(v.pais ?? "").trim();
  if (cidade) out.cidade = cidade;
  if (pais) out.pais_origem = pais;
  const isBrazil = /^bra[sz]il$/i.test(pais);
  const uf = isBrazil ? String(v.estadoSigla ?? "").trim().toUpperCase() : String(v.estado ?? "").trim();
  if (uf) out.uf = uf;
  return out;
}
