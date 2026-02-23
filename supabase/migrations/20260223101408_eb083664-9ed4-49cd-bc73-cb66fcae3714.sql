
-- Camada 1+4: Enriquecer extra_data + atualizar campos diretos da Rayshape Edge Mini
UPDATE system_a_catalog SET
  extra_data = jsonb_set(
    COALESCE(extra_data, '{}'::jsonb),
    '{playbook_data}',
    '{
      "technical_specs": {
        "technology": "MSLA (Masked Stereolithography Apparatus)",
        "xy_resolution": "34,4 µm",
        "layer_height": "0,05-0,15 mm",
        "light_source": "LED UV 405 nm",
        "platform_minivat": "74 x 64 x 100 mm (coroas, pontes, restauracoes)",
        "platform_normal": "130 x 80 x 100 mm (placas miorrelaxantes, guias, alinhadores, dentaduras)",
        "build_volume": "144 x 81 x 150 mm",
        "dimensions": "340 x 300 x 500 mm",
        "weight": "aprox. 15 kg",
        "connectivity": "USB, Wi-Fi, Ethernet",
        "software": "ShapeWare 2.0 com IA",
        "warranty": "12 meses do fabricante",
        "file_formats": "STL, OBJ",
        "print_times": {
          "facetas": "12 min",
          "coroas_35": "17 min",
          "placas_miorrelaxantes_2": "38 min",
          "guias_cirurgicos_4": "29 min",
          "modelos_proteticos_3": "25 min"
        }
      },
      "competitor_comparison": {
        "title": "Comparativo Edge Mini vs Concorrentes",
        "competitors": ["Elegoo Mars 5 Ultra", "Phrozen Sonic Mighty REVO 14K"],
        "features": [
          {"feature": "Posicionamento automatico das pecas (IA)", "edge_mini": true, "elegoo": false, "phrozen": false},
          {"feature": "Geracao automatica de suportes (IA)", "edge_mini": true, "elegoo": false, "phrozen": false},
          {"feature": "Plataformas intercambiaveis (MiniVat)", "edge_mini": true, "elegoo": false, "phrozen": false},
          {"feature": "Aquecimento inteligente da plataforma", "edge_mini": true, "elegoo": false, "phrozen": false},
          {"feature": "Independencia de treinamento tecnico", "edge_mini": true, "elegoo": false, "phrozen": false},
          {"feature": "Auto nivelamento", "edge_mini": true, "elegoo": false, "phrozen": false}
        ]
      },
      "clinical_brain": {
        "mandatory_products": [
          "Resina 3D Smart Print Modelo Universal (Salmao)",
          "Resina 3D Smart Print Bio Temp B1",
          "Resina 3D Smart Print Bio Bite Splint Clear",
          "Resina 3D Smart Print Bio Vitality",
          "Resina 3D Smart Print Gengiva",
          "Resina 3D Smart Print Modelo Precision",
          "Resina Smart 3D Print Bio Clear Guide",
          "Resina Smart Print Modelo Laqua",
          "Resina 3D Smart Print Try-In Calcinavel",
          "Resina 3D Smart Print Bio Bite Splint +Flex",
          "Resina 3D Smart Print Model Plus",
          "Resina 3D Smart Print Bio Denture",
          "Resina 3D Smart Print Modelo Ocre",
          "Resina 3D Smart Print Bio Denture Translucida",
          "Elegoo Wash & Cure Mercury 2-in-1 V2.0",
          "Asiga Cure - Pos-Cura",
          "Pionext UV-02 - Pos-Cura UV (365/385/405 nm)",
          "Magna Box EDG - Pos Cura (390 a 440 nm)",
          "Cuba Ultrassonica",
          "NanoClean",
          "Misturador de Resinas Smart Dent"
        ],
        "prohibited_products_summary": [
          "ATOS Block (bloco ceromero para fresagem)",
          "Resinas Atos Composta Direta (todas as cores)",
          "Resinas Atos Academic (todas as cores)",
          "Impressora Elegoo Mars 5 Ultra (concorrente)",
          "Impressora Miicraft Alpha (concorrente)",
          "Scanners intraorais MEDIT e BLZ (nao sao consumiveis)",
          "Scanners de bancada Medit T310 e BLZ LS100",
          "Cimentos UNIKK Veneer (todos)",
          "ATOS Smart Ortho (adesivo)"
        ],
        "anti_hallucination_rules": [
          "NUNCA recomendar resinas compostas diretas como material para impressao 3D",
          "NUNCA recomendar impressoras concorrentes como complemento",
          "NUNCA confundir scanners com consumiveis da impressora",
          "NUNCA inventar tempos de impressao - usar APENAS os valores exatos do playbook",
          "NUNCA inventar especificacoes tecnicas - usar APENAS dados documentados"
        ]
      },
      "workflow_stages": [
        {"stage": "Impressao 3D", "role": "Principal", "description": "Transforma modelos digitais (STL, OBJ) em objetos fisicos usando resinas fotopolimerizaveis. Tecnologia MSLA com aquecimento de tanque."},
        {"stage": "Processamento/Pos-cura", "role": "Acessorio", "description": "Lavagem para remover excesso de resina + pos-cura UV para propriedades mecanicas e biocompatibilidade."},
        {"stage": "Acabamento/Polimento", "role": "Acessorio", "description": "Dependendo da aplicacao, pecas podem necessitar acabamento, polimento ou caracterizacao apos pos-cura."}
      ],
      "objection_handling": {
        "price": "A Edgemini nao e uma impressora. E um investimento na sua produtividade, na sua confianca e na sua tranquilidade.",
        "complexity": "Nivelamento automatico, aquecimento de tanque e ShapeWare 2.0 com IA tornam o processo tao simples que qualquer membro da equipe pode operar.",
        "waste": "Tanque reduzido e suportes minimos significam menos desperdicio de resina e mais lucro."
      }
    }'::jsonb
  ),
  meta_description = 'Impressora 3D odontologica com IA: zero dor de cabeca e impressoes precisas em minutos. Invista em produtividade para seu consultorio.',
  keywords = ARRAY['impressora 3D odontologica','Rayshape Edge Mini','impressora 3D para dentistas','MSLA odontologia','ShapeWare 2.0','impressora 3D dental','odontologia digital','impressora 3D consultorio','impressora 3D resolucao 34um','nivelamento automatico','tanque aquecido'],
  promo_price = 28500,
  price = 35000,
  updated_at = now()
WHERE id = 'faa43292-9ceb-4441-afc5-4757e88fed3b';
