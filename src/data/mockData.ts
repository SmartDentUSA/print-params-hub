// Mock data for the 3D printing parameters app

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  isActive: boolean;
}

export interface Model {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  imageUrl?: string;
  isActive: boolean;
  notes?: string;
}

export interface Resin {
  id: string;
  name: string;
  manufacturer: string;
  color?: string;
  isActive: boolean;
}

export interface ParameterSet {
  id: string;
  modelResinId: string;
  label: string;
  altura_da_camada_mm: number;
  tempo_cura_seg: number;
  tempo_adesao_seg: number;
  camadas_transicao: number;
  intensidade_luz_pct: number;
  ajuste_x_pct: number;
  ajuste_y_pct: number;
  notes?: string;
  isPublished: boolean;
}

export interface ModelResin {
  id: string;
  modelId: string;
  resinId: string;
}

// Mock data
export const mockBrands: Brand[] = [
  { id: "1", name: "Elegoo", slug: "elegoo", isActive: true },
  { id: "2", name: "Anycubic", slug: "anycubic", isActive: true },
  { id: "3", name: "Phrozen", slug: "phrozen", isActive: true },
  { id: "4", name: "Formlabs", slug: "formlabs", isActive: true },
  { id: "5", name: "Prusa", slug: "prusa", isActive: false },
];

export const mockModels: Model[] = [
  {
    id: "1",
    brandId: "1",
    name: "Mars 5 Ultra",
    slug: "mars-5-ultra",
    isActive: true,
    notes: "Impressora de resina 8K com excelente precisão"
  },
  {
    id: "2",
    brandId: "1",
    name: "Saturn 3 Ultra",
    slug: "saturn-3-ultra",
    isActive: true,
    notes: "Impressora de grande formato com qualidade profissional"
  },
  {
    id: "3",
    brandId: "2",
    name: "Photon Mono X 6K",
    slug: "photon-mono-x-6k",
    isActive: true,
    notes: "Resolução 6K para detalhes impressionantes"
  },
  {
    id: "4",
    brandId: "3",
    name: "Sonic Mini 8K",
    slug: "sonic-mini-8k",
    isActive: true,
    notes: "Compacta com resolução 8K"
  },
  {
    id: "5",
    brandId: "4",
    name: "Form 3L",
    slug: "form-3l",
    isActive: true,
    notes: "Impressora profissional de grande volume"
  },
];

export const mockResins: Resin[] = [
  { id: "1", name: "Vitality", manufacturer: "VoxelPrint", color: "Cinza", isActive: true },
  { id: "2", name: "Standard Gray", manufacturer: "Elegoo", color: "Cinza", isActive: true },
  { id: "3", name: "ABS-Like", manufacturer: "Anycubic", color: "Preto", isActive: true },
  { id: "4", name: "Tough Resin", manufacturer: "Formlabs", color: "Transparente", isActive: true },
  { id: "5", name: "Water Washable", manufacturer: "Elegoo", color: "Branco", isActive: true },
];

export const mockModelResins: ModelResin[] = [
  { id: "1", modelId: "1", resinId: "1" },
  { id: "2", modelId: "1", resinId: "2" },
  { id: "3", modelId: "1", resinId: "5" },
  { id: "4", modelId: "2", resinId: "1" },
  { id: "5", modelId: "2", resinId: "2" },
  { id: "6", modelId: "3", resinId: "3" },
  { id: "7", modelId: "4", resinId: "1" },
  { id: "8", modelId: "5", resinId: "4" },
];

export const mockParameterSets: ParameterSet[] = [
  {
    id: "1",
    modelResinId: "1",
    label: "Vitality 0.100 mm",
    altura_da_camada_mm: 0.1,
    tempo_cura_seg: 3.7,
    tempo_adesao_seg: 25,
    camadas_transicao: 8,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: "Configuração padrão para impressões de qualidade",
    isPublished: true
  },
  {
    id: "2",
    modelResinId: "1",
    label: "Vitality 0.050 mm",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 4.4,
    tempo_adesao_seg: 25,
    camadas_transicao: 8,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: "Alta resolução para detalhes finos",
    isPublished: true
  },
  {
    id: "3",
    modelResinId: "2",
    label: "Standard Gray 0.100 mm",
    altura_da_camada_mm: 0.1,
    tempo_cura_seg: 2.8,
    tempo_adesao_seg: 20,
    camadas_transicao: 6,
    intensidade_luz_pct: 95,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    isPublished: true
  },
  {
    id: "4",
    modelResinId: "3",
    label: "Water Washable 0.100 mm",
    altura_da_camada_mm: 0.1,
    tempo_cura_seg: 3.2,
    tempo_adesao_seg: 22,
    camadas_transicao: 7,
    intensidade_luz_pct: 98,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: "Fácil limpeza com água",
    isPublished: true
  },
  {
    id: "5",
    modelResinId: "4",
    label: "Vitality 0.080 mm",
    altura_da_camada_mm: 0.08,
    tempo_cura_seg: 4.1,
    tempo_adesao_seg: 28,
    camadas_transicao: 9,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    isPublished: true
  },
];

// Helper functions
export function getModelsByBrand(brandSlug: string): Model[] {
  const brand = mockBrands.find(b => b.slug === brandSlug);
  if (!brand) return [];
  return mockModels.filter(m => m.brandId === brand.id && m.isActive);
}

export function getResinsByModel(modelSlug: string) {
  const model = mockModels.find(m => m.slug === modelSlug);
  if (!model) return [];

  const modelResins = mockModelResins.filter(mr => mr.modelId === model.id);
  
  return modelResins.map(mr => {
    const resin = mockResins.find(r => r.id === mr.resinId);
    const parameterSets = mockParameterSets.filter(ps => ps.modelResinId === mr.id && ps.isPublished);
    
    return {
      ...resin,
      parameterSets
    };
  }).filter(r => r.id && r.parameterSets.length > 0);
}

export function getBrandBySlug(slug: string): Brand | undefined {
  return mockBrands.find(b => b.slug === slug);
}

export function getModelBySlug(slug: string): Model | undefined {
  return mockModels.find(m => m.slug === slug);
}