/**
 * Células do Workflow 7x3 usadas nos formulários (mesma lista usada em
 * smartops_forms.workflow_stage_target).
 */
export type WorkflowCell = { value: string; label: string };

export const WORKFLOW_7X3_CELLS: WorkflowCell[] = [
  { value: "1_captura_digital__scanner_intraoral", label: "1. Captura Digital — Scanner Intraoral" },
  { value: "1_captura_digital__scanner_bancada", label: "1. Captura Digital — Scanner de Bancada" },
  { value: "1_captura_digital__acessorios", label: "1. Captura Digital — Acessórios" },
  { value: "2_cad__software", label: "2. CAD — Software" },
  { value: "2_cad__servico", label: "2. CAD — Serviço" },
  { value: "2_cad__credito_ia", label: "2. CAD — Crédito IA" },
  { value: "3_impressao_3d__impressora_odontologica", label: "3. Impressão 3D — Impressora Odontológica" },
  { value: "3_impressao_3d__resinas", label: "3. Impressão 3D — Resinas" },
  { value: "3_impressao_3d__software", label: "3. Impressão 3D — Software" },
  { value: "4_pos_impressao__limpeza_acabamento", label: "4. Pós-impressão — Limpeza e Acabamento" },
  { value: "4_pos_impressao__equipamentos", label: "4. Pós-impressão — Equipamentos" },
  { value: "4_pos_impressao__insumos", label: "4. Pós-impressão — Insumos" },
  { value: "5_finalizacao__dentistica_orto", label: "5. Finalização — Dentística / Orto" },
  { value: "5_finalizacao__caracterizacao", label: "5. Finalização — Caracterização" },
  { value: "5_finalizacao__instalacao", label: "5. Finalização — Instalação" },
  { value: "6_cursos__online", label: "6. Cursos — Online" },
  { value: "6_cursos__presencial", label: "6. Cursos — Presencial" },
  { value: "6_cursos__academic", label: "6. Cursos — Academic" },
  { value: "7_fresagem__equipamento", label: "7. Fresagem — Equipamento" },
  { value: "7_fresagem__insumos", label: "7. Fresagem — Insumos" },
  { value: "7_fresagem__servico", label: "7. Fresagem — Serviço" },
];

export function workflowCellLabel(value?: string | null): string | null {
  if (!value) return null;
  return WORKFLOW_7X3_CELLS.find((c) => c.value === value)?.label ?? value;
}