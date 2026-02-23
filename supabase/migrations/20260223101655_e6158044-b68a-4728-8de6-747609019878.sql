
-- Camada 2: Inserir entradas no Brain Feeder (company_kb_texts)
-- A re-indexação (Camada 3) será feita via index-embeddings depois

INSERT INTO company_kb_texts (title, category, source_label, content, active)
VALUES
(
  'Edge Mini — Ficha Técnica Completa',
  'comercial',
  'playbook-edge-mini',
  'Rayshape Edge Mini — Ficha Técnica Completa

Tecnologia: MSLA (Masked Stereolithography Apparatus)
Resolução XY: 34,4 µm de pixel
Altura de camada: 0,05 a 0,15 mm — próteses com encaixe perfeito
Fonte de luz: LED UV 405 nm
Formatos de arquivo: STL, OBJ

Plataformas de Construção:
• MiniVat (Pequeno): 74 × 64 × 100 mm — ideal para coroas, pontes e restaurações
• Vat Normal: 130 × 80 × 100 mm — indicado para placas miorrelaxantes, guias cirúrgicas, dentaduras, alinhadores
• Volume de construção: 144 × 81 × 150 mm

Dimensões e peso da impressora: 340 × 300 × 500 mm; aproximadamente 15 kg
Conectividade: USB, Wi-Fi, Ethernet
Software: ShapeWare 2.0 com IA — posicionamento automático, geração de suportes, fatiamento one-click
Garantia: 12 meses do fabricante com assistência técnica especializada

Tempos de Impressão (valores exatos do fabricante):
• Facetas: 12 minutos
• 35 Coroas: 17 minutos
• 2 Placas miorrelaxantes: 38 minutos
• 4 Guias cirúrgicos: 29 minutos
• 3 Modelos protéticos: 25 minutos

Diferenciais técnicos:
• Nivelamento automático — sem ajustes manuais
• Aquecimento de tanque e resina — consistência em qualquer condição
• Tanque com fixação magnética — fácil encaixe e estabilidade
• Engate e liberação rápida da plataforma
• Espessura de camada dinâmica
• Automação inteligente do processo de impressão

Público-alvo: Dentistas, Laboratórios de Prótese Odontológica, Radiologias, Clínicas de estética dental, Professores e universidades

Aplicações clínicas: Facetas, lentes de contato, coroas e pontes provisórias, placas miorrelaxantes, guias cirúrgicas, modelos de estudo, modelos ortodônticos, bases de prótese, próteses híbridas fixas',
  true
),
(
  'Edge Mini — Pitch SDR e Argumentação Comercial',
  'sdr',
  'playbook-edge-mini',
  'Rayshape Edge Mini — Pitch SDR e Argumentação Comercial

Problema identificado: O dentista digital que implementa impressão 3D enfrenta dor de cabeça, insegurança e desperdício. Compra uma impressora e se torna escravo de processos complicados — posicionamento de peças, fatiamento, tentativa e erro. Gasta horas do consultório que deveriam ser do paciente.

Solução Edge Mini: Não vendemos uma impressora. Vendemos solução. A Edgemini foi feita para o dentista, não para engenheiros ou técnicos.

Pilares da argumentação:

1. ZERO DOR DE CABEÇA
• Nivelamento automático — esqueça ajustes manuais
• Aquecimento de tanque — consistência sem preocupação com temperatura
• Cada impressão sai igual, com confiabilidade

2. FLUXO SIMPLIFICADO
• ShapeWare 2.0 com IA torna o processo tão intuitivo que o dentista pode delegar para a equipe
• Posicionamento automático, geração de suportes automática, one-click para imprimir
• Mais tempo para atendimento e relacionamento com paciente

3. ECONOMIA REAL
• Tanque reduzido e suportes mínimos = menos desperdício de resina
• Tempos rápidos: coroa 17 min, faceta 12 min
• Eficiência clínica no mais alto nível

Respostas para objeções:
• PREÇO: A Edgemini não é uma impressora. É um investimento na sua produtividade, na sua confiança e na sua tranquilidade.
• COMPLEXIDADE: Nivelamento automático, aquecimento e IA tornam tão simples que qualquer membro da equipe opera.
• DESPERDÍCIO: Tanque reduzido e suportes mínimos = menos resina, mais lucro.

USPs (Diferenciais Únicos):
• Nivelamento Automático
• Aquecimento de Tanque e Resina
• Software ShapeWare 2.0 com IA
• Plataformas intercambiáveis (MiniVat + Normal)
• Conectividade versátil (USB/Wi-Fi/Ethernet)
• Independência de treinamento técnico — o operador não precisa ser expert',
  true
),
(
  'Edge Mini — Comparativo Concorrentes',
  'comercial',
  'playbook-edge-mini',
  'Rayshape Edge Mini — Comparativo com Concorrentes

Tabela comparativa: Edge Mini vs Elegoo Mars 5 Ultra vs Phrozen Sonic Mighty REVO 14K

1. Posicionamento automático das peças (IA)
   Edge Mini: SIM | Elegoo: NÃO | Phrozen: NÃO

2. Geração automática de suportes (IA)
   Edge Mini: SIM | Elegoo: NÃO | Phrozen: NÃO

3. Plataformas intercambiáveis (MiniVat)
   Edge Mini: SIM | Elegoo: NÃO | Phrozen: NÃO

4. Aquecimento inteligente da plataforma
   Edge Mini: SIM | Elegoo: NÃO | Phrozen: NÃO

5. Independência de treinamento técnico do operador
   Edge Mini: SIM | Elegoo: NÃO | Phrozen: NÃO

6. Auto nivelamento
   Edge Mini: SIM | Elegoo: NÃO | Phrozen: NÃO

Resumo da vantagem competitiva:
A Edge Mini é a ÚNICA impressora do comparativo que oferece automação completa via IA (posicionamento + suportes), plataformas intercambiáveis para otimizar uso de resina, aquecimento integrado para consistência, e auto nivelamento para eliminar erros do operador. As concorrentes exigem treinamento técnico e processos manuais que aumentam o risco de erro e desperdício.

REGRA ANTI-ALUCINAÇÃO: Esta comparação é baseada em dados do playbook oficial do produto. Não inventar dados sobre concorrentes que não estejam documentados aqui.',
  true
),
(
  'Edge Mini — Workflow e Produtos Complementares',
  'workflow',
  'playbook-edge-mini',
  'Rayshape Edge Mini — Workflow Odontológico Digital e Produtos Complementares

ETAPAS DO WORKFLOW:

1. IMPRESSÃO 3D (Etapa Principal — Edge Mini)
   Transforma modelos digitais (STL, OBJ) em objetos físicos. Tecnologia MSLA com aquecimento de tanque. Precisão de 34,4 µm. Dores resolvidas: complexidade, falta de consistência, tempos longos, dificuldade em delegar.

2. PROCESSAMENTO / PÓS-CURA (Etapa Acessória)
   Lavagem para remover excesso de resina não curada. Pós-cura UV para propriedades mecânicas e biocompatibilidade.

3. ACABAMENTO / POLIMENTO (Etapa Acessória)
   Dependendo da aplicação: acabamento, polimento ou caracterização.

PRODUTOS OBRIGATÓRIOS (complementares à Edge Mini):

Resinas para impressão:
• Smart Print Modelo Universal (Salmão) — modelos
• Smart Print Bio Temp B1 — provisórios
• Smart Print Bio Bite Splint Clear — placas
• Smart Print Bio Vitality — alta resistência
• Smart Print Gengiva — simulação gengival
• Smart Print Modelo Precision — modelos de precisão
• Smart Print Bio Clear Guide — guias cirúrgicas
• Smart Print Modelo Láqua — modelos
• Smart Print Try-In Calcinável — calcinável
• Smart Print Bio Bite Splint +Flex — placas flexíveis
• Smart Print Model Plus — modelos avançados
• Smart Print Bio Denture — bases de prótese
• Smart Print Modelo Ocre — modelos
• Smart Print Bio Denture Translúcida — prótese translúcida

Equipamentos de pós-processamento:
• Elegoo Wash & Cure Mercury 2-in-1 V2.0
• Asiga Cure — Pós-Cura
• Pionext UV-02 - Pós-Cura UV (365/385/405 nm)
• Magna Box EDG - Pós Cura (390 a 440 nm)
• Cuba Ultrassônica
• NanoClean
• Misturador de Resinas Smart Dent

PRODUTOS PROIBIDOS (NÃO recomendar junto com a Edge Mini):
• ATOS Block — bloco cerômero para fresagem, NÃO para impressão 3D
• Resinas Atos Composta Direta (todas as cores) — restaurações diretas, NÃO para impressão
• Resinas Atos Academic (todas as cores) — restaurações diretas
• Impressora Elegoo Mars 5 Ultra — concorrente
• Impressora Miicraft Alpha — concorrente
• Scanners intraorais MEDIT/BLZ — não são consumíveis da impressora
• Cimentos UNIKK Veneer — cimentos odontológicos, não resinas 3D
• ATOS Smart Ortho — adesivo, não resina 3D',
  true
),
(
  'Edge Mini — FAQ Técnico-Comercial',
  'faq',
  'playbook-edge-mini',
  'Rayshape Edge Mini — Perguntas Frequentes (FAQ)

P: Qual a diferença entre a Edge Mini e alternativas tradicionais?
R: A Edge Mini foca em simplicidade e automação para o dentista. Tem nivelamento automático e aquecimento de tanque, eliminando ajustes manuais. Qualquer membro da equipe pode operar.

P: Como a conectividade se integra ao consultório?
R: Oferece USB, Wi-Fi e Ethernet para integração com sistemas CAD/CAM dentais.

P: Quais procedimentos pode realizar?
R: Facetas, lentes de contato, coroas e pontes provisórias, placas miorrelaxantes, guias cirúrgicas, modelos de estudo, modelos ortodônticos, bases de prótese.

P: O ShapeWare 2.0 simplifica o fluxo?
R: Sim. Com IA para posicionamento automático, geração de suportes e fatiamento one-click. Permite delegar para equipe sem perda de qualidade.

P: Oferece suporte técnico e garantia?
R: Sim. 12 meses de garantia com assistência técnica especializada incluída.

P: Qual a precisão da tecnologia MSLA?
R: Resolução de 34,4 µm de pixel com camadas de 0,05-0,15 mm. Próteses com encaixe perfeito.

P: É compatível com diferentes resinas?
R: Sim. Compatível com resinas de marcas renomadas e certificadas. Tanque aquecido com fixação magnética garante estabilidade.

P: Quais os tempos de impressão?
R: Faceta 12 min, 35 coroas 17 min, 2 placas miorrelaxantes 38 min, 4 guias cirúrgicos 29 min, 3 modelos protéticos 25 min.

P: Oferece flexibilidade de tamanho?
R: Sim. Plataforma MiniVat (74×64×100 mm) para peças menores e Plataforma Normal (130×80×100 mm) para peças maiores. Otimiza uso de resina.

P: Para qual público é indicada?
R: Dentistas, Laboratórios de Prótese, Radiologias, Clínicas de estética dental, Professores e universidades.

P: Como otimiza o ROI?
R: Economia de resina com tanque reduzido e suportes mínimos. Tempos rápidos. Processo delegável. Menos desperdício = mais lucro.',
  true
)
ON CONFLICT (title, source_label) DO UPDATE SET
  content = EXCLUDED.content,
  category = EXCLUDED.category,
  active = true;
