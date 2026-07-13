export type EquipKey =
  | 'equip_scanner' | 'equip_scanner_bancada' | 'equip_notebook'
  | 'equip_cad' | 'equip_impressora' | 'equip_pos_impressao' | 'equip_fresadora'
  | `equip_outro_${number}`;

export interface EquipmentEntry {
  serial: string;
  ativacao: string;
  item_nome: string;
  proposal_ref: string;
  subtipo?: 'intraoral' | 'bancada';
  tipo_entrega?: 'enviar' | 'retirar';
  rastreamento?: string;
}

export type EquipmentData = Partial<Record<EquipKey, EquipmentEntry>>;

export interface TurmaDay {
  id?: string;
  turma_id?: string;
  day_number: number;
  date: string;
  start_time: string;
  end_time: string;
  topic?: string;
}

export interface Turma {
  id: string;
  course_id: string;
  label: string;
  slots: number;
  enrolled_count: number;
  sellflux_tag?: string;
  whatsapp_group_link?: string;
  active: boolean;
  sort_order?: number;
  days?: TurmaDay[];
  recurrence_parent_id?: string | null;
  recurrence_index?: number | null;
  vagas_disponiveis?: number;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  turma_number?: number | null;
  factory_status?: 'processando' | 'pronto' | 'publicando' | 'concluido' | 'erro' | string | null;
  factory_processed_at?: string | null;
}

export interface TurmaComVagas extends Turma {
  vagas_disponiveis: number;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  total_days?: number;
  course_title?: string;
  modality?: 'presencial' | 'online_ao_vivo' | 'online' | 'acesso_remoto';
  instructor_name?: string;
  location?: string;
  meeting_link?: string;
  pipeline_id_kanban?: number;
  stage_after_enroll?: string;
}

export interface SmartopsCourse {
  id: string;
  title: string;
  slug: string;
  description?: string;
  modality: 'presencial' | 'online_ao_vivo' | 'online' | 'acesso_remoto';
  category?: 'treinamento' | 'imersao' | 'workshop' | 'webinar' | 'avaliacao_pre_instalacao' | 'ativacao_software';
  instructor_name?: string;
  cover_image_url?: string;
  max_capacity: number;
  duration_days: number;
  duration_hours_per_day?: number;
  location?: string;
  meeting_link?: string;
  whatsapp_group_link?: string;
  sellflux_campaign_tag?: string;
  whatsapp_message_template?: string;
  pipeline_id_kanban: number;
  stage_after_enroll: string;
  public_visible: boolean;
  active: boolean;
  recurrence_enabled?: boolean;
  recurrence_type?: 'days' | 'weeks' | 'months';
  recurrence_interval?: number;
  recurrence_until?: string;
  recurrence_time_start?: string;
  recurrence_time_end?: string;
  recurrence_duration_h?: number;
  certificate_body_template?: string | null;
  created_at: string;
  updated_at: string;
  turmas?: Turma[];
}

export interface ProposalItem {
  proposal_id: string;
  item_idx: number;
  sku: string;
  nome: string;
  qtd: number;
  unit: number;
  total: number;
  equip_key: EquipKey | null;
  deal_ref?: string;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  turma_id: string;
  turma_snapshot: Turma & { days: TurmaDay[] };
  lead_id?: string;
  deal_id?: string;
  deal_title?: string;
  deal_pipeline_name?: string;
  deal_value?: number;
  person_name?: string;
  person_piperun_id?: string;
  especialidade?: string;
  area_atuacao?: string;
  numero_contrato?: string;
  empresa_cnpj?: string;
  empresa_pais?: string;
  empresa_estado?: string;
  empresa_cidade?: string;
  empresa_endereco?: string;
  empresa_telefone?: string;
  proposal_items_snapshot: ProposalItem[];
  equipment_data: EquipmentData;
  status: 'agendado' | 'confirmado' | 'presente' | 'ausente' | 'cancelado';
  validated_at?: string;
  wa_sent_at?: string;
  wa_error?: string;
  enrolled_at: string;
  notes?: string;
  instagram?: string;
  numero_proposta?: string;
  tipo_entrega?: 'enviar' | 'retirar';
  rastreamento?: string;
  equip_writeback_at?: string;
  equip_writeback_error?: string;
  created_at: string;
  course?: SmartopsCourse;
  turma?: Turma;
  companions?: EnrollmentCompanion[];
}

export interface EnrollmentCompanion {
  id: string;
  enrollment_id: string;
  name: string;
  email?: string;
  phone?: string;
  area_atuacao?: string;
  especialidade?: string;
  instagram?: string;
}

export interface DealSearchResult {
  found: boolean;
  lead_id: string;
  strategy?: string;
  warning?: string | null;

  nome: string | null;
  email: string | null;
  telefone: string | null;       // 5511999887744 — wa.me / Evolution
  telefone_br: string | null;    // 11999887744   — input form
  telefone_fmt: string | null;   // (11) 99988-7744
  telefone_e164: string | null;  // +5511999887744
  instagram: string | null;
  area_atuacao: string | null;
  especialidade: string | null;
  cargo: string | null;
  empresa_nome: string | null;
  empresa_cnpj: string | null;
  cpf: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  pais: string | null;
  produto_interesse: string | null;
  tem_scanner: string | null;
  tem_impressora: string | null;
  impressora_modelo: string | null;
  piperun_id: string | null;
  pessoa_piperun_id?: string | null;
  pipeline: string | null;
  etapa: string | null;
  proprietario: string | null;
  deal_value: number | null;
  piperun_link: string | null;

  // Hidratação cirúrgica do deal escolhido (para Equipamentos/Snapshot)
  matched_deal?: PiperunDeal | null;
}

export interface PiperunDeal {
  deal_id: string;
  deal_title?: string;
  status: string;
  pipeline_id?: number;
  pipeline_name?: string;
  owner_name?: string;
  value?: number;
  closed_at?: string;
  proposals: PiperunProposal[];
}

export interface PiperunProposal {
  id: string | number;
  sigla?: string;
  status?: string;
  items: PiperunProposalItem[];
  valor_ps?: number;
}

export interface PiperunProposalItem {
  item_id: string;
  sku?: string;
  nome: string;
  qtd: number;
  unit: number;
  total: number;
}

export type DealType = 'b2b' | 'b2c' | 'b2b2c';

export interface DealSearchListItem {
  lead_id: string;
  deal_id: string;
  piperun_id: string | null;
  deal_title: string | null;
  person_name: string | null;
  company_name: string | null;
  company_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  status: string | null;
  value: number | null;
  updated_at: string | null;
  closed_at: string | null;
  deal_type: DealType;
}
