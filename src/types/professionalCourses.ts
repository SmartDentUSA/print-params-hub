export interface ScheduleDay {
  date: string;
  start_time: string;
  end_time: string;
  topic?: string;
}

export interface SyllabusModule {
  title: string;
  items: string[];
}

export interface ProfessionalCourse {
  id: string;
  producer_lead_id: string;
  title: string;
  slug: string | null;
  subtitle: string | null;
  description: string | null;
  modality: string;
  category: string | null;
  cover_image_url: string | null;
  price_brl: number | null;
  promo_price_brl: number | null;
  installments: number | null;
  workload_hours: number | null;
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  schedule: ScheduleDay[];
  country: string | null;
  state: string | null;
  city: string | null;
  venue: string | null;
  address: string | null;
  online_platform: string | null;
  meeting_link: string | null;
  max_students: number | null;
  enrolled_count: number;
  registration_url: string | null;
  whatsapp_ddi: string | null;
  whatsapp_number: string | null;
  instagram: string | null;
  course_platform: string | null;
  video_url: string | null;
  target_audience: string | null;
  prerequisites: string | null;
  syllabus: SyllabusModule[];
  materials_included: string | null;
  certificate: boolean;
  language: string | null;
  tags: string[];
  status: string;
  public_visible: boolean;
  featured: boolean;
  views_count: number;
  interested_count: number;
  created_source: string;
  internal_notes: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfessionalCourseDraft = Partial<ProfessionalCourse> & { title: string };

export const COURSE_MODALITIES = [
  { value: "presencial", label: "Presencial" },
  { value: "online_ao_vivo", label: "Online ao vivo" },
  { value: "gravado", label: "Gravado (on-demand)" },
  { value: "hibrido", label: "Híbrido" },
  { value: "mentoria", label: "Mentoria / consultoria" },
];

export const COURSE_CATEGORIES = [
  { value: "escaneamento", label: "Escaneamento intraoral" },
  { value: "cad", label: "CAD / Planejamento digital" },
  { value: "impressao_3d", label: "Impressão 3D" },
  { value: "protese", label: "Prótese" },
  { value: "ortodontia", label: "Ortodontia / alinhadores" },
  { value: "implantodontia", label: "Implantodontia" },
  { value: "estetica", label: "Estética / facetas" },
  { value: "gestao", label: "Gestão de clínica" },
  { value: "outros", label: "Outros" },
];

export const COURSE_STATUS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "em_analise", label: "Em análise" },
  { value: "publicado", label: "Publicado" },
  { value: "encerrado", label: "Encerrado" },
  { value: "arquivado", label: "Arquivado" },
];

export const emptyCourseDraft = (): ProfessionalCourseDraft => ({
  title: "",
  subtitle: "",
  description: "",
  modality: "presencial",
  category: "",
  cover_image_url: "",
  price_brl: null,
  promo_price_brl: null,
  installments: null,
  workload_hours: null,
  duration_days: null,
  start_date: null,
  end_date: null,
  start_time: "",
  end_time: "",
  schedule: [],
  country: "Brasil",
  state: "",
  city: "",
  venue: "",
  address: "",
  online_platform: "",
  meeting_link: "",
  max_students: null,
  enrolled_count: 0,
  registration_url: "",
  whatsapp_ddi: "55",
  whatsapp_number: "",
  instagram: "",
  course_platform: "",
  video_url: "",
  target_audience: "",
  prerequisites: "",
  syllabus: [],
  materials_included: "",
  certificate: true,
  language: "pt-BR",
  tags: [],
  status: "rascunho",
  public_visible: false,
});