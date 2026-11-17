// Escolha do cadastro quando o mesmo telefone aparece em mais de um lead.
type Row = { email?: string | null; created_at?: string | null };

/** Prefere o cadastro cujo e-mail é o enviado; senão mantém o mais antigo (linhas já vêm ordenadas). */
export function pickPhoneMatch<T extends Row>(rows: T[], email?: string | null): T | null {
  if (!rows.length) return null;
  const wanted = String(email ?? "").trim().toLowerCase();
  if (wanted) {
    const sameEmail = rows.find((r) => String(r.email ?? "").trim().toLowerCase() === wanted);
    if (sameEmail) return sameEmail;
  }
  return rows[0];
}

/** Escapa curingas do ILIKE para comparar e-mail sem diferenciar maiúsculas. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
