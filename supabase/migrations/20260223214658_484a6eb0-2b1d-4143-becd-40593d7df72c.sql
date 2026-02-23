
-- ============================================================
-- Camada 1: Enriquecer extra_data dos 3 produtos da Apostila SPIN
-- ============================================================

-- 1a. Rayshape Edge Mini
UPDATE system_a_catalog
SET extra_data = COALESCE(extra_data, '{}'::jsonb) || '{
  "spin_apostila": true,
  "anti_hallucination": {
    "never_claim": [
      "Que a Rayshape Edge Mini realiza escaneamento intraoral ou de modelos",
      "Que realiza design CAD de próteses ou guias",
      "Que é um equipamento de fresagem",
      "Que dispensa o uso de resinas 3D",
      "Que as peças impressas não precisam de pós-processamento (lavagem e cura UV)",
      "Que pode imprimir com materiais que não sejam resinas fotopolimerizáveis",
      "Que é um dispositivo para restaurações diretas na boca do paciente",
      "Que é um scanner 3D"
    ],
    "never_mix_with": [
      "Resinas compostas para restaurações diretas (Atos Resina Composta Direta)",
      "Blocos de cerômero para fresagem (ATOS Block)",
      "Cimentos odontológicos (Cimento UNIKK Veneer)",
      "Adesivos odontológicos (ATOS Smart Ortho)"
    ],
    "always_require": [
      "Arquivo digital 3D (STL, OBJ) gerado por software CAD ou scanner 3D",
      "Resinas 3D fotopolimerizáveis compatíveis com 405 nm",
      "Equipamento de lavagem e pós-cura UV"
    ],
    "always_explain": [
      "É uma impressora 3D que requer resinas fotopolimerizáveis como consumível",
      "Peças necessitam pós-processamento (lavagem e cura UV) para propriedades finais",
      "Qualidade final depende do arquivo de design, resina e pós-cura",
      "ShapeWare 2.0 é software de fatiamento, NÃO de design CAD",
      "Tecnologia MSLA cura camadas inteiras de resina de uma vez"
    ]
  },
  "required_products": [
    "Resina 3D Smart Print Modelo Universal (Salmão)",
    "Resina 3D Smart Print Bio Temp B1",
    "Resina 3D Smart Print Bio Bite Splint Clear",
    "Resina 3D Smart Print Bio Vitality",
    "Resina 3D Smart Print Gengiva",
    "Resina 3D Smart Print Modelo Precision",
    "Resina Smart 3D Print Bio Clear Guide",
    "Resina Smart Print Modelo Láqua",
    "Resina 3D Smart Print Try-In Calcinável",
    "Resina 3D Smart Print Bio Bite Splint +Flex",
    "Resina 3D Smart Print Model Plus",
    "Resina 3D Smart Print Bio Denture",
    "Resina 3D Smart Print Bio Denture Translúcida",
    "Elegoo Wash & Cure Mercury 2-in-1 V2.0",
    "Asiga Cure — Pós-Cura",
    "Pionext UV-02 - Pós Cura UV",
    "Magna Box EDG - Pós Cura",
    "Cuba Ultrassônica",
    "NanoClean PoD",
    "Misturador de Resinas Smart Dent"
  ],
  "prohibited_products": [
    "ATOS Block (cerômero para fresagem)",
    "Atos Resina Composta Direta (todas as cores - restaurações diretas)",
    "Resina Atos Academic (todas as cores - restaurações diretas)",
    "Impressora 3D Elegoo Mars 5 Ultra (concorrente)",
    "Miicraft Alpha (concorrente)",
    "Scanners Intraorais (não são consumíveis da impressora)",
    "Cimentos UNIKK Veneer (não são materiais de impressão 3D)",
    "ATOS Smart Ortho (adesivo)"
  ],
  "competitor_comparison": {
    "title": "Edge Mini vs Elegoo Mars 5 Ultra vs Phrozen Sonic Mighty REVO 14K",
    "features": {
      "Posicionamento automático IA": {"edge_mini": true, "elegoo": false, "phrozen": false},
      "Geração automática suportes IA": {"edge_mini": true, "elegoo": false, "phrozen": false},
      "Plataformas intercambiáveis MiniVat": {"edge_mini": true, "elegoo": false, "phrozen": false},
      "Aquecimento inteligente plataforma": {"edge_mini": true, "elegoo": false, "phrozen": false},
      "Auto nivelamento": {"edge_mini": true, "elegoo": false, "phrozen": false}
    }
  },
  "print_times": {
    "facetas_20_unidades": "12-13 min",
    "coroas_35_unidades": "17 min",
    "placas_miorrelaxantes_2": "38 min",
    "guias_cirurgicos_4": "29 min",
    "modelos_proteticos_3": "25 min"
  },
  "platforms": {
    "MiniVat": {"dimensions": "74 × 64 × 100 mm", "ideal_for": "coroas, pontes e restaurações"},
    "Normal": {"dimensions": "130 × 80 × 100 mm", "ideal_for": "placas miorrelaxantes, guias cirúrgicas, dentaduras, alinhadores"}
  }
}'::jsonb,
updated_at = now()
WHERE id = 'faa43292-9ceb-4441-afc5-4757e88fed3b';

-- 1b. Resina Bio Vitality (ambos registros)
UPDATE system_a_catalog
SET extra_data = COALESCE(extra_data, '{}'::jsonb) || '{
  "spin_apostila": true,
  "anti_hallucination": {
    "never_claim": [
      "Que é para uso temporário",
      "Que pode ser usada para restaurações diretas (aplicação direta na boca)",
      "Que não requer pós-cura ou lavagem",
      "Que é um material fresável (CAD/CAM de usinagem)",
      "Que é a única resina biocompatível do mercado",
      "Que é compatível com qualquer tipo de impressora 3D"
    ],
    "never_mix_with": [
      "Álcool isopropílico de baixa pureza (abaixo de 90%)",
      "Solventes orgânicos não especificados pelo fabricante",
      "Qualquer resina 3D de outro fabricante na mesma peça"
    ],
    "always_require": [
      "Impressora 3D DLP/LCD de sistema aberto",
      "Equipamento de pós-cura UV",
      "Cimento adesivo apropriado para instalação"
    ],
    "always_explain": [
      "Destinada a restaurações DEFINITIVAS de longa duração",
      "Necessidade de pós-cura e lavagem rigorosos para biocompatibilidade",
      "Comprovação clínica de 5 ANOS de durabilidade",
      "Certificação ISO 10993 completa (mutagenicidade, genotoxicidade, sensibilização)",
      "Resistência flexural 147 MPa e carga inorgânica 59.3% wt",
      "Vitality Classic (35% translucidez) vs Vitality HT (45% translucidez) - diferença ÓPTICA, não mecânica"
    ]
  },
  "required_products": [
    "Elegoo Wash & Cure Mercury 2-in-1 V2.0",
    "Asiga Cure — Pós-Cura",
    "Pionext UV-02 - Pós Cura UV",
    "Magna Box EDG - Pós Cura",
    "Cuba Ultrassônica",
    "NanoClean PoD",
    "SmartMake Seal Glaze",
    "Cimento UNIKK Veneer (A2, A3.5, B1, BL2, TRS)",
    "Rayshape Edge Mini (impressora compatível)",
    "Elegoo Mars 5 Ultra (impressora compatível)",
    "Miicraft Alpha (impressora compatível)"
  ],
  "prohibited_products": [
    "Resina Bio Temp B1 (temporárias, NÃO definitivas)",
    "Resina Bio Bite Splint Clear (placas oclusais, NÃO restaurações)",
    "Resina Bio Bite Splint +Flex (placas oclusais)",
    "Resina Bio Denture (bases de próteses totais)",
    "Resina Bio Denture Translúcida (bases de próteses totais)",
    "ATOS Block (cerômero para fresagem, NÃO impressão 3D)",
    "Atos Resina Composta Direta (restaurações diretas, NÃO indiretas)"
  ],
  "competitor_comparison": {
    "title": "Comparativo de Resistência à Flexão (MPa)",
    "data": [
      {"name": "Smart Print Bio Vitality", "flexural_mpa": 147, "filler_wt": 59.3, "intl_certs": true, "clinical_years": 5, "biocompat_certs": true},
      {"name": "Voxel Print", "flexural_mpa": 135, "filler_wt": 57.8, "intl_certs": false, "clinical_years": 1, "biocompat_certs": false},
      {"name": "PriZma 3D Bio Crown Diamond", "flexural_mpa": 143, "filler_wt": 52.0, "intl_certs": false, "clinical_years": 1, "biocompat_certs": false},
      {"name": "PrintaX AA Master", "flexural_mpa": 105.4, "filler_wt": 15.0, "intl_certs": false, "clinical_years": 2, "biocompat_certs": false},
      {"name": "Rodin Sculpture", "flexural_mpa": 180, "filler_wt": 51.0, "intl_certs": true, "clinical_years": 2, "biocompat_certs": true},
      {"name": "OnX Tough 2", "flexural_mpa": 135, "filler_wt": 38.0, "intl_certs": true, "clinical_years": 2, "biocompat_certs": true},
      {"name": "VerseoSmile", "flexural_mpa": 120, "filler_wt": 33.0, "intl_certs": true, "clinical_years": 3, "biocompat_certs": true},
      {"name": "CrownTec", "flexural_mpa": 130, "filler_wt": 32.0, "intl_certs": true, "clinical_years": 5, "biocompat_certs": true}
    ]
  },
  "mechanical_specs": {
    "flexural_strength_mpa": 147,
    "flexural_modulus_gpa": 5.49,
    "shore_d": ">92",
    "filler_weight_pct": 59.3,
    "water_sorption": "1.5 μg/mm³",
    "radiopacity": "1.048 mm Al",
    "certifications": ["ISO 10993", "ANVISA", "FDA"]
  },
  "optical_variants": {
    "Classic": {"translucency": "35%", "use_case": "Neutralizar substratos escurecidos, coroas totais, próteses sobre implantes, dentes endodonticamente tratados"},
    "HT": {"translucency": "45%", "use_case": "Laminados finos/ultrafinos, lentes de contato dental, facetas, onlays, overlays"}
  }
}'::jsonb,
updated_at = now()
WHERE name ILIKE '%Vitality%' AND category ILIKE '%RESINAS%';

-- 1c. NanoClean PoD (complementar dados existentes)
UPDATE system_a_catalog
SET extra_data = COALESCE(extra_data, '{}'::jsonb) || '{
  "spin_apostila": true,
  "anti_hallucination": {
    "never_claim": [
      "Que é um material de impressão 3D",
      "Que é um equipamento de impressão 3D",
      "Que é um cimento ou adesivo odontológico",
      "Que pode limpar peças que não sejam impressas em 3D",
      "Que é um produto à base de álcool",
      "Que é inflamável",
      "Que elimina a necessidade de pós-cura UV",
      "Que é compatível com todas as resinas 3D (apenas alta carga inorgânica/cerâmicas)",
      "Que é um produto de caracterização ou glazeamento"
    ],
    "never_mix_with": [
      "Álcool Isopropílico (IPA)",
      "Outros solventes não especificados pelo fabricante",
      "Água"
    ],
    "always_require": [
      "Peças impressas em 3D com resinas de alta carga inorgânica (nanohíbridas ou cerâmicas)",
      "Equipamento de pós-cura UV para etapa subsequente"
    ],
    "always_explain": [
      "É um solvente de limpeza PÓS-IMPRESSÃO 3D",
      "Substitui o IPA na limpeza",
      "Formulado especificamente para resinas com ALTA CARGA INORGÂNICA",
      "Benefícios: não inflamável, menos tóxico que IPA",
      "Tecnologia PoD (PreCure Optical Dissolution) para reorganização química superficial",
      "Necessária pós-cura UV após a limpeza"
    ]
  },
  "required_products": [
    "Impressora 3D (Elegoo Mars 5 Ultra, Rayshape Edge Mini ou Miicraft Alpha)",
    "Resina 3D Smart Print Bio Vitality (alta carga inorgânica compatível)",
    "Asiga Cure — Pós-Cura",
    "Pionext UV-02 - Pós Cura UV",
    "Magna Box EDG - Pós Cura"
  ],
  "prohibited_products": [
    "Álcool Isopropílico (IPA) - NanoClean PoD o substitui",
    "Resina 3D Smart Print Modelo Universal (não é alta carga inorgânica)",
    "Resina 3D Smart Print Modelo Precision (não é alta carga inorgânica)",
    "Resina Smart Print Modelo Láqua (não é alta carga inorgânica)",
    "Resina 3D Smart Print Modelo Ocre (não é alta carga inorgânica)",
    "Resina 3D Smart Print Gengiva (não é alta carga inorgânica)"
  ],
  "competitor_comparison": {
    "title": "NanoClean PoD vs Lavagem Manual/IPA vs NanoClean Caneta",
    "data": [
      {
        "method": "Lavagem Manual/Tradicional (IPA)",
        "solvent": "Álcool >90%",
        "capacity": "1 a 4 peças",
        "alcohol_required": true,
        "immersion_time": "1 a 3 minutos ou mais",
        "chalk_risk": "Alto",
        "difficulty": "Alta (múltiplas lavagens)",
        "flammable": true,
        "primary_use": "Lavagem inicial genérica e manual"
      },
      {
        "method": "NanoClean Caneta (Aplicação Localizada)",
        "solvent": "IPA na 1ª etapa",
        "capacity": "Uso pontual/corretivo",
        "alcohol_required": true,
        "immersion_time": "30s IPA + aplicação manual",
        "chalk_risk": "Reduzido (corrigido pela caneta)",
        "difficulty": "Média",
        "flammable": true,
        "primary_use": "Corrigir chalk effect residual e limpar cavidades internas"
      },
      {
        "method": "NanoClean PoD (Tecnologia PoD)",
        "solvent": "Solução Sem Álcool",
        "capacity": "Até 35 elementos por ciclo",
        "alcohol_required": false,
        "immersion_time": "60 segundos (banho único com agitação)",
        "chalk_risk": "Eliminado 100%",
        "difficulty": "Baixa (banho único)",
        "flammable": false,
        "primary_use": "Limpeza total, em lote, pós-impressão e otimização da superfície"
      }
    ]
  }
}'::jsonb,
updated_at = now()
WHERE id = '19bc59de-a1f0-4994-b5ab-4c1a2464b7e0';
