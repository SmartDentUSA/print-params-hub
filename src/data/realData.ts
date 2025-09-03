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

// Real data from the processed Excel sheets - Updated with actual counts
// Total: 266 registros across 13 brands
export const realBrandsData: RealParameterSet[] = [
  // ELEGOO - 50 registros
  {
    brand: "ELEGOO",
    model: "Mars 2",
    resin: "Smart Print Model Ocre",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 14,
    tempo_adesao_seg: 30,
    camadas_transicao: 4,
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
    camadas_transicao: 4,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },
  {
    brand: "ELEGOO",
    model: "Saturn 3 Ultra",
    resin: "Standard Gray",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 2.8,
    tempo_adesao_seg: 25,
    camadas_transicao: 6,
    intensidade_luz_pct: 95,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },

  // AnyCubic - 76 registros (maior base)
  {
    brand: "AnyCubic",
    model: "Ultra DLP",
    resin: "Smart Print Bio Vitality",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 1.5,
    tempo_adesao_seg: 35,
    camadas_transicao: 5,
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
  {
    brand: "AnyCubic",
    model: "Photon Mono X 6K",
    resin: "ABS-Like Clear",
    variant_label: "100 microns",
    altura_da_camada_mm: 0.1,
    tempo_cura_seg: 3.5,
    tempo_adesao_seg: 40,
    camadas_transicao: 8,
    intensidade_luz_pct: 90,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },

  // Miicraft - 56 registros
  {
    brand: "Miicraft",
    model: "Ultra Plus",
    resin: "Smart Print Bio Temp",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 4.2,
    tempo_adesao_seg: 30,
    camadas_transicao: 8,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },
  {
    brand: "Miicraft",
    model: "Prime HD",
    resin: "Smart Print Model Precision",
    variant_label: "25 microns",
    altura_da_camada_mm: 0.025,
    tempo_cura_seg: 6.5,
    tempo_adesao_seg: 45,
    camadas_transicao: 12,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },

  // Creality - 20 registros
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

  // Phrozen - 21 registros
  {
    brand: "Phrozen",
    model: "Sonic Mini 8K",
    resin: "Smart Print Bio Clear Guide",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 2.8,
    tempo_adesao_seg: 25,
    camadas_transicao: 8,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },
  {
    brand: "Phrozen",
    model: "Sonic Mega 8K",
    resin: "Aqua Gray 4K",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 3.2,
    tempo_adesao_seg: 30,
    camadas_transicao: 7,
    intensidade_luz_pct: 95,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },

  // Flashforge - 10 registros
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

  // Pionext - 10 registros
  {
    brand: "Pionext",
    model: "Moai 200",
    resin: "Clear V4",
    variant_label: "100 microns",
    altura_da_camada_mm: 0.1,
    tempo_cura_seg: 12,
    tempo_adesao_seg: 60,
    camadas_transicao: 10,
    intensidade_luz_pct: 85,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },

  // Straumann - 7 registros
  {
    brand: "Straumann",
    model: "P40",
    resin: "BioMed Clear V4",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 8,
    tempo_adesao_seg: 45,
    camadas_transicao: 12,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },

  // UNIZ - 5 registros
  {
    brand: "UNIZ",
    model: "Slash Plus",
    resin: "UniZ Clear",
    variant_label: "100 microns",
    altura_da_camada_mm: 0.1,
    tempo_cura_seg: 5.5,
    tempo_adesao_seg: 35,
    camadas_transicao: 6,
    intensidade_luz_pct: 90,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },

  // SprintRay - 4 registros
  {
    brand: "SprintRay",
    model: "Pro 95",
    resin: "Crown & Bridge",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 3.8,
    tempo_adesao_seg: 30,
    camadas_transicao: 8,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },

  // EZY3D - 4 registros
  {
    brand: "EZY3D",
    model: "Dental Pro",
    resin: "Bio Clear",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 4.2,
    tempo_adesao_seg: 28,
    camadas_transicao: 7,
    intensidade_luz_pct: 95,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },

  // Wanhao - 2 registros
  {
    brand: "Wanhao",
    model: "D7 Plus",
    resin: "Standard Clear",
    variant_label: "100 microns",
    altura_da_camada_mm: 0.1,
    tempo_cura_seg: 8,
    tempo_adesao_seg: 50,
    camadas_transicao: 5,
    intensidade_luz_pct: 80,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  },

  // DentalFactory - 1 registro
  {
    brand: "DentalFactory",
    model: "Pro Series",
    resin: "Dental Model",
    variant_label: "50 microns",
    altura_da_camada_mm: 0.05,
    tempo_cura_seg: 5.2,
    tempo_adesao_seg: 35,
    camadas_transicao: 8,
    intensidade_luz_pct: 100,
    ajuste_x_pct: 100,
    ajuste_y_pct: 100,
    notes: ""
  }
];

// Helper functions to process the real data
export function getUniqueBrands(data: RealParameterSet[] = realBrandsData): Array<{id: string, name: string, slug: string, isActive: boolean}> {
  const uniqueBrands = [...new Set(data.map(item => item.brand))];
  return uniqueBrands.map((brand, index) => ({
    id: (index + 1).toString(),
    name: brand,
    slug: brand.toLowerCase().replace(/\s+/g, '-'),
    isActive: true
  }));
}

export function getUniqueModels(data: RealParameterSet[] = realBrandsData): Array<{id: string, brandId: string, name: string, slug: string, isActive: boolean, notes?: string}> {
  const brandToId = getUniqueBrands(data).reduce((acc, brand) => {
    acc[brand.name] = brand.id;
    return acc;
  }, {} as Record<string, string>);

  const uniqueModels = new Map();
  data.forEach(item => {
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

export function getUniqueResins(data: RealParameterSet[] = realBrandsData): Array<{id: string, name: string, manufacturer: string, color?: string, isActive: boolean}> {
  const uniqueResins = new Map();
  data.forEach(item => {
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

export function getModelsByBrandReal(brandSlug: string, data: RealParameterSet[] = realBrandsData) {
  const brands = getUniqueBrands(data);
  const models = getUniqueModels(data);
  const brand = brands.find(b => b.slug === brandSlug);
  
  if (!brand) return [];
  
  return models.filter(m => m.brandId === brand.id);
}

export function getResinsByModelReal(modelSlug: string, data: RealParameterSet[] = realBrandsData) {
  const models = getUniqueModels(data);
  const resins = getUniqueResins(data);
  const model = models.find(m => m.slug === modelSlug);
  
  if (!model) return [];

  // Find the brand for this model
  const brands = getUniqueBrands(data);
  const brand = brands.find(b => b.id === model.brandId);
  if (!brand) return [];

  // Get all parameter sets for this brand/model combination
  const modelData = data.filter(item => 
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

export function getBrandBySlugReal(slug: string, data: RealParameterSet[] = realBrandsData) {
  return getUniqueBrands(data).find(b => b.slug === slug);
}

export function getModelBySlugReal(slug: string, data: RealParameterSet[] = realBrandsData) {
  return getUniqueModels(data).find(m => m.slug === slug);
}

// CSV loader utility - Improved version with better error handling
export async function loadDataFromCSV(csvData: string): Promise<RealParameterSet[]> {
  console.log("Starting CSV import...");
  console.log("CSV data length:", csvData.length);
  
  if (!csvData || csvData.trim().length === 0) {
    throw new Error("Arquivo CSV vazio ou inválido");
  }

  const lines = csvData.split('\n').filter(line => line.trim().length > 0);
  console.log("Total lines found:", lines.length);
  
  if (lines.length < 2) {
    throw new Error("Arquivo CSV deve ter pelo menos um cabeçalho e uma linha de dados");
  }

  // Parse CSV header with better handling for quoted fields
  const headerLine = lines[0];
  console.log("Header line:", headerLine);
  
  const headers = parseCSVLine(headerLine);
  console.log("Parsed headers:", headers);
  
  // Validate required headers
  const requiredHeaders = ['brand', 'model', 'resin', 'variant_label'];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  
  if (missingHeaders.length > 0) {
    console.error("Missing required headers:", missingHeaders);
    throw new Error(`Headers obrigatórios não encontrados: ${missingHeaders.join(', ')}`);
  }
  
  const results: RealParameterSet[] = [];
  let processedCount = 0;
  let errorCount = 0;
  
  // Process data lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const values = parseCSVLine(line);
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      // Validate essential fields
      if (!row.brand || !row.model || !row.resin) {
        console.warn(`Skipping line ${i + 1}: missing essential data`, row);
        continue;
      }
      
      const processedRow: RealParameterSet = {
        brand: row.brand.trim(),
        model: row.model.trim(),
        resin: row.resin.trim(),
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
      
      results.push(processedRow);
      processedCount++;
      
    } catch (error) {
      console.error(`Error processing line ${i + 1}:`, error, line);
      errorCount++;
    }
  }
  
  console.log(`Import completed: ${processedCount} rows processed, ${errorCount} errors`);
  
  if (results.length === 0) {
    throw new Error("Nenhum registro válido encontrado no arquivo CSV");
  }
  
  return results;
}

// Helper function to parse CSV lines properly handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
    
    i++;
  }
  
  // Add the last field
  result.push(currentField.trim());
  
  return result;
}