/**
 * Normaliza nomes de instrutor/profissional para comparação:
 * remove acentos, pontuação e títulos (Dr., Dra., Prof. etc.).
 * Usado para associar treinamentos Smart Dent ao card do profissional.
 */
export function normalizeInstructorName(s?: string | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^((dr|dra|drs|prof|profa|professor|professora|cd|me|mestre|doutor|doutora)\s+)+/, "")
    .trim();
}

export function instructorNameMatches(a?: string | null, b?: string | null): boolean {
  const na = normalizeInstructorName(a);
  const nb = normalizeInstructorName(b);
  return na.length > 0 && na === nb;
}
