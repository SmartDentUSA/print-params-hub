/**
 * Consulta pública de CNPJ (BrasilAPI → dados da Receita Federal).
 * Retorna razão social, endereço e quadro de sócios (nomes públicos;
 * CPF dos sócios NÃO é exposto por nenhuma fonte legal — vem mascarado).
 */

export interface CnpjSocio {
  nome: string;
  qualificacao: string | null;
}

export interface CnpjInfo {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  socios: CnpjSocio[];
}

const clean = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
};

export async function lookupCnpj(cnpjRaw: string): Promise<CnpjInfo | null> {
  const cnpj = String(cnpjRaw ?? "").replace(/\D/g, "");
  if (cnpj.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d || !d.razao_social) return null;
    const socios: CnpjSocio[] = Array.isArray(d.qsa)
      ? d.qsa
          .map((s: Record<string, unknown>) => ({
            nome: String(s.nome_socio ?? "").trim(),
            qualificacao: clean(s.qualificacao_socio),
          }))
          .filter((s: CnpjSocio) => s.nome)
      : [];
    return {
      cnpj,
      razao_social: String(d.razao_social).trim(),
      nome_fantasia: clean(d.nome_fantasia),
      situacao: clean(d.descricao_situacao_cadastral),
      cep: clean(d.cep)?.replace(/\D/g, "") ?? null,
      logradouro: [clean(d.descricao_tipo_de_logradouro), clean(d.logradouro)].filter(Boolean).join(" ") || null,
      numero: clean(d.numero),
      complemento: clean(d.complemento),
      bairro: clean(d.bairro),
      cidade: clean(d.municipio),
      uf: clean(d.uf),
      socios,
    };
  } catch (e) {
    console.warn("[cnpj-lookup] falha", e);
    return null;
  }
}
