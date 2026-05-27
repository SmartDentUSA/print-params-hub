## Objetivo
Remover os produtos "aleatórios"/legados de `workflow_cell_mappings` (apenas linhas `mapping_type='product'`) e popular o mapeamento 7×3 com a lista canônica que você enviou, respeitando as colunas reais já definidas em `SmartOpsWorkflowMapper.tsx`.

## Escopo
- Não altera schema, código ou outras `mapping_type` (`competitor`, `sdr_field`, etc.).
- Não altera o catálogo `system_a_catalog`.
- Apenas dados em `public.workflow_cell_mappings`.

## Passos

1. **Limpar produtos atuais**
   ```sql
   DELETE FROM public.workflow_cell_mappings WHERE mapping_type = 'product';
   ```

2. **Inserir lista canônica** (`mapping_type = 'product'`, `mapped_label = mapped_value`) nas células abaixo:

   **Etapa 1 — Captura Digital** (`etapa_1_scanner`)
   - `scanner_intraoral`: Medit i500, Medit i600, Medit i700, Medit i700 Wireless, Medit i900, BLZ INO 100 Plus, BLZ INO 200, BLZ Leap 500
   - `scanner_bancada`: Medit T100, Medit T310, BLZ LS100
   - `acessorios`: BLZ Dental DMC, ioConnect TruAbutment
   - `notebook`: Notebook
   - `pecas_partes`: Peças/Partes

   **Etapa 2 — CAD** (`etapa_2_cad`)
   - `software`: exocad DentalCAD, exocad exoplan, Medit Clinic App, BLZ Dental CAD
   - `creditos_ia`: Ativação exocad DentalCAD I.A., Crédito exocad DentalCAD I.A., Crédito BLZ I.A.
   - `servico`: Terceirização de projetos CAD

   **Etapa 3 — Impressão 3D** (`etapa_3_impressao`)
   - `resina`: Bio Vitality, Bio Temp, Bio Bite Splint, Bio Clear Guide, Modelo Plus, Modelo Precision, Modelo Láqua, Bio Vitality Classic, Bio Vitality HT, Bio Vitality All-On-X, Bio Temp B1, Bio Bite Splint Clear, Bio Bite Splint +Flex, Bio Clear Guide (variante), Bio Denture, Bio Denture Translúcida, Bio GOWhite, Bio Direct Aligner (prefixo "Resina 3D Smart Print" preservado)
   - `software_imp`: Smart Slicer
   - `impressora`: Asiga Ultra, Asiga MAX 2, Rayshape Edge Mini, Miicraft Alpha, Elegoo Mars 5 Ultra
   - `acessorios`: Acessórios
   - `pecas_partes`: Peças/Partes

   **Etapa 4 — Pós-Impressão** (`etapa_4_pos_impressao`)
   - `equipamentos`: Elegoo Wash & Cure Mercury 2-in-1 V2.0, UV ShapeCure D, UV Magna Box EDG, Asiga Cure, Pionext UV-02, Cuba Ultrassônica, Misturador de Resinas
   - `limpeza_acabamento`: NanoClean PoD, NanoClean (Caneta), GlazeON - Splint, NanoClean Clear

   **Etapa 5 — Finalização** (`etapa_5_finalizacao`)
   - `caracterizacao`: Smart Seal Glaze, SmartMake Shade A/B/C/D, SmartMake Intensivo (Brown/Ocre/Mahogany), Stains (Blue/Violet/White/Black), SmartBase Clear, SmartMake Efeito Mamelon, SmartWash, SmartGum (RED-Intense, PINK, ORANGE, RUBI, CREAM, BLACK), SmartGum SmartBase Clear, SmartGum SmartBase White, KIT Completo SmartGum, KIT Completo SmartMake
   - `instalacao`: Cimento UNIKK Veneer (A1, A2, A3.5, B1, BL2, TRS), Tryin UNIKK (A1, A2, A3.5, B1, BL2, TRS), Kit UNIKK Veneer
   - `dentistica_orto`: Resina Composta Direta Atos (linha completa de tonalidades), Resina Composta Atos Academic (10 cores), Kit Resina Composta Atos Academic - 06 cores, Adesivo ortodôntico SmartOrto

   **Etapa 6 — Cursos** (`etapa_6_cursos`)
   - `presencial`: Curso presencial, Imersão 3 Dias - Chair Side Print Make, Imersão clínica
   - `online`: Acesso Mensal, Acesso anual, Cursos Pay-per-view

   **Etapa 7 — Fresagem** (`etapa_7_fresagem`)
   - `equipamentos`: Fresadora Arum 4X-300, Fresadora Arum 5X-300 Pro
   - `insumos`: Blocos de Zircônia Smart Zr (Zirkonzahn, Amann, HT, ST, TT White, TT ML, TT GT), Berço para Sinterização de Zircônia, Spray Revelador para Escaneamento, Base para pigmentação de Zircônia (100ml/50ml), Blocos Dissilicato de Lítio Evolith CAD 14mm, Fresa para Dissilicato de Lítio, Fresas Smart-DLC para Zircônia, Efeitos para Pigmentação de Zircônia 20ml
   - `software`: Software Fresagem
   - `servico`: Serviço Fresagem
   - `acessorios`: Acessórios
   - `pecas_partes`: Peças/Partes

3. **Validação** — `SELECT workflow_stage, workflow_cell, count(*) FROM workflow_cell_mappings WHERE mapping_type='product' GROUP BY 1,2 ORDER BY 1,2;` para conferir as contagens por célula.

## Observações
- As variantes/cores são inseridas como linhas separadas (cada SKU/cor uma badge) para permitir regras de oportunidade granulares. Se preferir agrupar (uma badge "Linha SmartGum", outra "Linha UNIKK"), me avise antes do build.
- Itens genéricos do documento ("Acessórios", "Peças/Partes", "Notebook", "Software", "Serviço") entram como placeholders por célula — combinam com a estrutura de colunas existente.

## Detalhes técnicos
- Operação executada via `supabase--migration` num único INSERT … VALUES … ON CONFLICT DO NOTHING (chave `workflow_stage, workflow_cell, mapping_type, mapped_value`).
- Nenhuma alteração em RLS/grants/triggers.