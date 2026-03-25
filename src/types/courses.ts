export type EquipKey =
  | 'equip_scanner' | 'equip_scanner_bancada' | 'equip_notebook'
  | 'equip_cad' | 'equip_impressora' | 'equip_pos_impressao' | 'equip_fresadora';

export interface EquipmentEntry {
  serial: string;
  ativacao: string;
  item_nome: string;
  proposal_ref: string;
  subtipo?: 'intraoral' | 'bancada';
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
}

export interface TurmaComVagas extends Turma {
  vagas_disponiveis: number;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  total_days?: number;
  course_title?: string;
  modality?: 'presencial' | 'online_ao_vivo' | 'online';
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
  modality: 'presencial' | 'online_ao_vivo' | 'online';
  category?: 'treinamento' | 'imersao' | 'workshop' | 'webinar';
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
}

export interface DealSearchResult {
  lead_id: string;
  nome: string;
  email?: string;
  telefone_normalized?: string;
  piperun_id?: string;
  pessoa_piperun_id?: string;
  especialidade?: string;
  area_atuacao?: string;
  buyer_type?: string;
  empresa_cnpj?: string;
  cidade?: string;
  uf?: string;
  pais?: string;
  piperun_deals_history: PiperunDeal[];
  matched_deal: PiperunDeal;
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
