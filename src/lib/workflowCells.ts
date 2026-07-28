/**
 * Células do Workflow 7x3 usadas nos formulários (mesma lista usada em
 * smartops_forms.workflow_stage_target).
 */
export type WorkflowCell = { value: string; label: string };

export const WORKFLOW_7X3_CELLS: WorkflowCell[] = [
  { value: "1_captura_digital_scanner_intraoral", label: "1. Captura Digital — Scanner Intraoral" },
  { value: "1_captura_digital_scanner_bancada", label: "1. Captura Digital — Scanner de Bancada" },
  { value: "1_captura_digital_acessorios", label: "1. Captura Digital — Acessórios" },
  { value: "2_cad_software", label: "2. CAD — Software" },
  { value: "2_cad_servico", label: "2. CAD — Serviço" },
  { value: "2_cad_credito_ia", label: "2. CAD — Crédito IA" },
  { value: "3_impressao_3d_impressora_odontologica", label: "3. Impressão 3D — Impressora Odontológica" },
  { value: "3_impressao_3d_resinas", label: "3. Impressão 3D — Resinas" },
  { value: "3_impressao_3d_software", label: "3. Impressão 3D — Software" },
  { value: "4_pos_impressao_limpeza_acabamento", label: "4. Pós-impressão — Limpeza e Acabamento" },
  { value: "4_pos_impressao_equipamentos", label: "4. Pós-impressão — Equipamentos" },
  { value: "4_pos_impressao_insumos", label: "4. Pós-impressão — Insumos" },
  { value: "5_finalizacao_dentistica_orto", label: "5. Finalização — Dentística / Orto" },
  { value: "5_finalizacao_caracterizacao", label: "5. Finalização — Caracterização" },
  { value: "5_finalizacao_instalacao", label: "5. Finalização — Instalação" },
  { value: "6_cursos_online", label: "6. Cursos — Online" },
  { value: "6_cursos_presencial", label: "6. Cursos — Presencial" },
  { value: "6_cursos_academic", label: "6. Cursos — Academic" },
  { value: "7_fresagem_equipamento", label: "7. Fresagem — Equipamento" },
  { value: "7_fresagem_insumos", label: "7. Fresagem — Insumos" },
  { value: "7_fresagem_servico", label: "7. Fresagem — Serviço" },
];

export function workflowCellLabel(value?: string | null): string | null {
  if (!value) return null;
  return WORKFLOW_7X3_CELLS.find((c) => c.value === value)?.label ?? value;
}