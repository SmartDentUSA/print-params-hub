// Real data structure based on the processed spreadsheet
// This matches the normalized CSV format from the Excel processing

export interface RealParameterSet {
  brand: string;
  model: string;
  resin: string;
  variant_label: string;
  altura_da_camada_mm: number | string;
  tempo_cura_seg: number | string;
  tempo_adesao_seg: number | string;
  camadas_transicao: number | string;
  intensidade_luz_pct: number;
  ajuste_x_pct: number;
  ajuste_y_pct: number;
  notes: string;
}

// Real data from the processed Excel sheets
// This represents the actual data structure you'll get from the CSV files
export const realBrandsData: RealParameterSet[] = [
  // ELEGOO Mars 2 examples
  {
    brand: "ELEGOO",
    model: "Mars 2",
    resin: "Smart Print Model Ocre",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 14,
    tempo_adesao_seg: 30,
    camadas_transicao: "",
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },
  {
    brand: "ELEGOO",
    model: "Mars 2",
    resin: "Smart Print Vitality",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 1,
    tempo_adesao_seg: 30,
    camadas_transicao: "",
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },
  // Flashforge Hunter examples
  {
    brand: "Flashforge",
    model: "Hunter",
    resin: "Smart Print Model Ocre",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 4.5,
    tempo_adesao_seg: 20,
    camadas_transicao: 8,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },
  {
    brand: "Flashforge",
    model: "Hunter",
    resin: "Smart Print Bio Bite Splint Clear",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 3.2,
    tempo_adesao_seg: 15,
    camadas_transicao: 8,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },
  // Creality examples
  {
    brand: "Creality",
    model: "Hallot one Pro/Plus",
    resin: "Smart Print Model Precision",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 3.3,
    tempo_adesao_seg: 35,
    camadas_transicao: 6,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },
  {
    brand: "Creality",
    model: "Hallot one Pro/Plus",
    resin: "Smart Print Bio Bite Splint +Flex",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 4,
    tempo_adesao_seg: 40,
    camadas_transicao: 6,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },
  // AnyCubic examples
  {
    brand: "AnyCubic",
    model: "Ultra DLP",
    resin: "Smart Print Bio Vitality",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 1.5,
    tempo_adesao_seg: 35,
    camadas_transicao: "",
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },
  {
    brand: "AnyCubic",
    model: "Photon M5",
    resin: "Smart Print Model L'Aqua",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 2.2,
    tempo_adesao_seg: 35,
    camadas_transicao: 6,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },
];

// Helper functions to process the real data
export function getUniqueBrands(): Array<{id: string, name: string, slug: string, isActive: boolean}> {
  const uniqueBrands = [...new Set(realBrandsData.map(item => item.brand))];
  return uniqueBrands.map((brand, index) => ({
    id: (index + 1).toString(),
    name: brand,
    slug: brand.toLowerCase().replace(/\s+/g, '-'),
    isActive: true
  }));
}

export function getUniqueModels(): Array<{id: string, brandId: string, name: string, slug: string, isActive: boolean, notes?: string}> {
  const brandToId = getUniqueBrands().reduce((acc, brand) => {
    acc[brand.name] = brand.id;
    return acc;
  }, {} as Record<string, string>);

  const uniqueModels = new Map();
  realBrandsData.forEach(item => {
    const key = `${item.brand}-${item.model}`;
    if (!uniqueModels.has(key)) {
      uniqueModels.set(key, {
        brand: item.brand,
        model: item.model
      });
    }
  });

  return Array.from(uniqueModels.values()).map((item, index) => ({
    id: (index + 1).toString(),
    brandId: brandToId[item.brand],
    name: item.model,
    slug: item.model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
    isActive: true,
    notes: `Parâmetros otimizados para ${item.brand} ${item.model}`
  }));
}

export function getUniqueResins(): Array<{id: string, name: string, manufacturer: string, color?: string, isActive: boolean}> {
  const uniqueResins = new Map();
  realBrandsData.forEach(item => {
    if (!uniqueResins.has(item.resin)) {
      uniqueResins.set(item.resin, {
        resin: item.resin,
        // Try to extract manufacturer from resin name
        manufacturer: item.resin.includes('Smart Print') ? 'Smart Print' : 'Genérico'
      });
    }
  });

  return Array.from(uniqueResins.values()).map((item, index) => ({
    id: (index + 1).toString(),
    name: item.resin,
    manufacturer: item.manufacturer,
    isActive: true
  }));
}

export function getModelsByBrandReal(brandSlug: string) {
  const brands = getUniqueBrands();
  const models = getUniqueModels();
  const brand = brands.find(b => b.slug === brandSlug);
  
  if (!brand) return [];
  
  return models.filter(m => m.brandId === brand.id);
}

export function getResinsByModelReal(modelSlug: string) {
  const models = getUniqueModels();
  const resins = getUniqueResins();
  const model = models.find(m => m.slug === modelSlug);
  
  if (!model) return [];

  // Find the brand for this model
  const brands = getUniqueBrands();
  const brand = brands.find(b => b.id === model.brandId);
  if (!brand) return [];

  // Get all parameter sets for this brand/model combination
  const modelData = realBrandsData.filter(item => 
    item.brand === brand.name && 
    item.model === model.name
  );

  // Group by resin
  const resinGroups = new Map();
  modelData.forEach(item => {
    if (!resinGroups.has(item.resin)) {
      resinGroups.set(item.resin, []);
    }
    resinGroups.get(item.resin).push(item);
  });

  return Array.from(resinGroups.entries()).map(([resinName, parameterSets]) => {
    const resin = resins.find(r => r.name === resinName);
    return {
      ...resin,
      parameterSets: parameterSets.map((ps, index) => ({
        id: `${model.id}-${resin?.id}-${index}`,
        label: `${ps.resin} - ${ps.variant_label}`,
        altura_da_camada_mm: typeof ps.altura_da_camada_mm === 'number' ? ps.altura_da_camada_mm : parseFloat(ps.altura_da_camada_mm.toString()) || 0.05,
        tempo_cura_seg: typeof ps.tempo_cura_seg === 'number' ? ps.tempo_cura_seg : parseFloat(ps.tempo_cura_seg.toString()) || 0,
        tempo_adesao_seg: typeof ps.tempo_adesao_seg === 'number' ? ps.tempo_adesao_seg : parseFloat(ps.tempo_adesao_seg.toString()) || 0,
        camadas_transicao: typeof ps.camadas_transicao === 'number' ? ps.camadas_transicao : (ps.camadas_transicao ? parseInt(ps.camadas_transicao.toString()) : 8),
        intensidade_luz_pct: ps.intensidade_luz_pct,
        ajuste_x_pct: ps.ajuste_x_pct,
        ajuste_y_pct: ps.ajuste_y_pct,
        notes: ps.notes
      }))
    };
  }).filter(r => r.parameterSets.length > 0);
}

export function getBrandBySlugReal(slug: string) {
  return getUniqueBrands().find(b => b.slug === slug);
}

export function getModelBySlugReal(slug: string) {
  return getUniqueModels().find(m => m.slug === slug);
}

// CSV loader utility (for future use when you want to load from actual CSV files)
export async function loadDataFromCSV(csvData: string): Promise<RealParameterSet[]> {
  const lines = csvData.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    return {
      brand: row.brand || '',
      model: row.model || '',
      resin: row.resin || '',
      variant_label: row.variant_label || '',
      altura_da_camada_mm: parseFloat(row.altura_da_camada_mm) || 0.05,
      tempo_cura_seg: parseFloat(row.tempo_cura_seg) || 0,
      tempo_adesao_seg: parseFloat(row.tempo_adesao_seg) || 0,
      camadas_transicao: parseInt(row.camadas_transicao) || 8,
      intensidade_luz_pct: parseInt(row.intensidade_luz_pct) || 100,
      ajuste_x_pct: parseInt(row.ajuste_x_pct) || 100,
      ajuste_y_pct: parseInt(row.ajuste_y_pct) || 100,
      notes: row.notes || ''
    };
  }).filter(row => row.brand && row.model && row.resin);
}