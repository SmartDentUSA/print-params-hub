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
