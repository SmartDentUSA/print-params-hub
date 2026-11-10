// Regras puras do formulário Inserção CRM (testadas em rules_test.ts).
export const VENDAS_PIPELINE_ID = 18784;

export type DealView = {
  deal_id: string;
  lead_id: string | null;
  pipeline_id: number | null;
  pipeline_name: string | null;
  stage_id: number | null;
  stage_name: string | null;
  status: string | null;
  owner_id: number | null;
  owner_name: string | null;
  owner_team_member_id?: string;
  owner_email?: string | null;
  value: unknown;
  title?: string | null;
  product: string | null;
  origin_name: string | null;
  created_at: string | null;
  closed_at: string | null;
  person_id?: number;
  fonte: string;
};

/** Regra de Ouro das origens: [INDKOL] ativa / [PROSPKOL] fria + nome do profissional. */
export function buildOriginName(tipo: "ativa" | "fria", kolName: string): string {
  const name = kolName.replace(/\s+/g, " ").trim();
  return `# - ${tipo === "ativa" ? "INDICALEADKOL" : "PROSPLEADKOL"} - ${name}`;
}

/** Deal aberto no Funil de vendas com dono diferente do vendedor do KOL → bloqueia. */
export function isOpenVendasConflict(d: Pick<DealView, "status" | "pipeline_id" | "owner_id">, targetOwnerId: number): boolean {
  return d.status === "aberta" && Number(d.pipeline_id) === VENDAS_PIPELINE_ID && Number(d.owner_id) !== Number(targetOwnerId);
}

/** Deal aberto no Funil de vendas de outro vendedor (não de quem está cadastrando) → usar os dados fica bloqueado. */
export function ownedByAnotherSeller(d: Pick<DealView, "status" | "pipeline_id" | "owner_team_member_id">, registrantTeamMemberId: string): boolean {
  return d.status === "aberta" && Number(d.pipeline_id) === VENDAS_PIPELINE_ID && d.owner_team_member_id !== registrantTeamMemberId;
}

/** Sufixos locais (DDD + número, com e sem o 9º dígito) para casar telefones gravados em formatos diferentes. */
export function phoneVariants(raw: string): string[] {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return [];
  const out = new Set<string>([d]);
  if (d.length === 11 && d[2] === "9") out.add(d.slice(0, 2) + d.slice(3));
  if (d.length === 10) out.add(d.slice(0, 2) + "9" + d.slice(2));
  return [...out];
}

// ── Pessoa física / pessoa jurídica ──
const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** CPF com máscara; devolve o valor original quando não tem 11 dígitos. */
export function formatCpf(v: unknown): string {
  const d = onlyDigits(v);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : String(v ?? "").trim();
}

/** CNPJ com máscara; devolve o valor original quando não tem 14 dígitos. */
export function formatCnpj(v: unknown): string {
  const d = onlyDigits(v);
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : String(v ?? "").trim();
}

export type DocKind = "fisica" | "juridica" | "ambas" | "nenhuma";
export type DocInfo = { kind: DocKind; cpf: string | null; cnpj: string | null; badge: string; label: string };

/**
 * Diz se o registro é pessoa física ou jurídica a partir do que está gravado.
 * 11 dígitos é sempre CPF e 14 é sempre CNPJ, mesmo que estejam no campo
 * trocado (acontece em fichas antigas); sem número, o card avisa.
 */
export function documentInfo(parts: { cpf?: unknown; cnpj?: unknown }): DocInfo {
  const cpfs: string[] = [];
  const cnpjs: string[] = [];
  for (const [raw, field] of [[parts.cpf, "cpf"], [parts.cnpj, "cnpj"]] as const) {
    const d = onlyDigits(raw);
    if (!d) continue;
    if (d.length === 11) cpfs.push(d);
    else if (d.length === 14) cnpjs.push(d);
    else if (field === "cpf") cpfs.push(d);
    else cnpjs.push(d);
  }
  const cpf = cpfs.length ? formatCpf(cpfs[0]) : null;
  const cnpj = cnpjs.length ? formatCnpj(cnpjs[0]) : null;
  if (cpf && cnpj) return { kind: "ambas", cpf, cnpj, badge: "Física e jurídica", label: `Pessoa física e jurídica · CPF ${cpf} · CNPJ ${cnpj}` };
  if (cpf) return { kind: "fisica", cpf, cnpj: null, badge: "Pessoa física", label: `Pessoa física · CPF ${cpf}` };
  if (cnpj) return { kind: "juridica", cpf: null, cnpj, badge: "Pessoa jurídica", label: `Pessoa jurídica · CNPJ ${cnpj}` };
  return { kind: "nenhuma", cpf: null, cnpj: null, badge: "Sem CPF/CNPJ", label: "" };
}
