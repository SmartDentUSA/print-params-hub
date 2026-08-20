# Ficha de Produto: Scanner Intraoral BLZ INO200
### Padrão de profundidade para todas as fichas da N7

> **Categoria N7**: `1. Captura Digital > Scanner Intraoral (IOS)`
> **Fontes**: Google Drive — doc `17gtJwE63ZJGTn_wSmw1aYXiEhvavKVuFIwUGIiviDSg` (visão geral e specs) e `1ALt1NatyY2XJZu0OlM7B7ODP1TfyNde1PJiOmaNnrN8` (comparativo técnico e testes de estresse).
> Nada nesta ficha foi inferido: cada dado vem de um dos dois documentos.

---

## Descrição do Produto

O **BLZ Dental INO200** é um scanner intraoral digital full color desenvolvido para substituir os métodos convencionais de moldagem por captura 3D em tempo real, com precisão de **10,9 μm ± 0,98** em arco integral. Projetado para clínicas e consultórios que estão ingressando ou evoluindo no fluxo digital, combina ergonomia, velocidade de captura e um ecossistema de software com inteligência artificial nativa — **sem cobrança de anuidades ou taxas recorrentes**.

Sua tecnologia de captura em vídeo 3D contínuo garante escaneamento fluido e reduz falhas de alinhamento e retrabalhos, característica especialmente relevante para quem está começando no fluxo digital. A arquitetura aberta, com exportação irrestrita em STL, OBJ e PLY, elimina dependência de ecossistemas fechados e integra o equipamento a qualquer software CAD e impressora 3D do mercado.

O INO200 é o resultado de um processo de validação conduzido pela Smart Dent ao longo de **2 anos de pesquisa, com mais de 9 equipamentos de diversas marcas testados clinicamente** por um comitê técnico sem vínculo comercial, seguido de **6 meses de validação contínua na Clínica Vioto**, ambiente de altíssimo fluxo e extrema exigência estética.

---

## Posicionamento — decisão pendente ⚠️

As duas fontes se contradizem e isso precisa ser resolvido antes de qualquer peça de campanha:

- O documento de visão geral abre chamando o INO200 de **"scanner intraoral de entrada (entry-level)"**, com foco em "custo-benefício" e "consultórios de pequeno e médio porte".
- O comparativo técnico conclui que ele é um **"competidor de elite"**, que "bate de frente com o Medit i700 em densidade bruta" e "iguala-se à precisão dimensional do topo de linha Medit i900".

**Não usar os dois.** A escolha muda preço-âncora, público e criativo. A evidência técnica (seção de densidade de malha, abaixo) sustenta o posicionamento de elite.

---

## Atributos Específicos do Produto

### 1. Especificações físicas e de hardware

| Atributo | Especificação |
|---|---|
| Modelo | BLZ INO200 |
| Tipo de dispositivo | Scanner intraoral digital |
| Tecnologia de captura | Vídeo 3D em movimento |
| Dimensões do scanner | 264 × 37 × 46 mm |
| **Peso** | **165 g** ⚠️ ver nota abaixo |
| Sistema anti-embaçamento | Adaptativo, ativo por ventoinha (FAN) |
| Controle remoto integrado | Sim — Smart Motion Control (por gestos) |
| Cabo | Destacável e substituível pelo próprio usuário na clínica |
| Sistema operacional | Windows 64-bit |
| Hardware recomendado | Intel Core i7 ou superior, 32 GB RAM, GPU dedicada (NVIDIA GTX/RTX) |

> ⚠️ **Divergência de peso na fonte**: a tabela de especificações e o comparativo técnico dizem **165 g** (contra 245 g da linha Medit). Duas seções de texto corrido do mesmo documento dizem "cerca de 270 g". **Usar 165 g** e corrigir o documento de origem.

**Smart Motion Control**: sensor que permite rotacionar e manipular o modelo 3D na tela apenas com movimentos do scanner na mão, sem tocar em mouse ou teclado — preserva a biossegurança durante o atendimento.

### 2. Capacidade óptica e de captura

| Atributo | Especificação |
|---|---|
| Precisão (arco integral) | 10,9 μm ± 0,98 |
| Densidade de malha (arco total) | 599.060 vértices / 198.898 triângulos |
| Profundidade de campo (Deep Scan) | Até 25 mm |
| Velocidade de escaneamento | Arcada completa em menos de 40 segundos (até 30 s conforme operador) |
| Taxa de quadros | 40 FPS |
| Profundidade de cor | Full color — True Color Texture Scan / captura HD |
| Fonte de iluminação | LED integrado RGB |

**Deep Scan de 25 mm**: profundidade que viabiliza a captura de margens subgengivais, caixas profundas e scanbodies de implantes — regiões onde scanners de menor profundidade de campo falham.

### 3. Densidade de malha — a prova matemática

Comparação de um mesmo arco total escaneado por quatro equipamentos:

| Scanner | Vértices | Triângulos | Densidade relativa |
|---|---|---|---|
| **BLZ INO200** | **599.060** | **198.898** | **100%** |
| Medit i700 | 597.789 | 199.253 | 99,8% |
| Medit i900 | 518.324 | 195.108 | 86,5% |
| Medit i600 | 417.201 | 139.067 | 69,6% |

Quanto maior a densidade de polígonos, mais fiel a reprodução anatômica e mais nítidos os términos de preparo. Com baixa densidade, o software precisa **interpolar** os dados faltantes nas bordas — origem do efeito de arredondamento em quinas de preparo. O INO200 entrega quase 30% mais densidade que o i600 e empata com o i700.

### 4. Testes de estresse clínico

**Teste 1 — Scanbodies metálicos.** Componentes metálicos polidos geram reflexo especular que "cega" as câmeras. O INO200 entregou uma das renderizações mais nítidas e retilíneas do metal, com transição milimetricamente delineada entre a base do componente e o modelo — resultado do filtro de reflexo ativo. O i600, no mesmo teste, arredondou visivelmente as quinas superiores dos scanbodies.

**Teste 2 — Sobreposição de malhas contra o Medit i900.** Sobreposição micrométrica em software de metrologia 3D entre as malhas dos dois scanners, sobre modelo gabarito de implantes. Em cortes transversais microscópicos nos pilares e corpos de escaneamento, as linhas de contorno se sobrepuseram de forma virtualmente perfeita. **Desvio tridimensional clinicamente insignificante** — significa que uma barra de protocolo ou ponte sobre implantes assenta com a exatidão passiva exigida, independentemente de qual dos dois foi usado.

**Teste 3 — Pior cenário óptico.** Manequim ortodôntico reunindo três inimigos dos sensores ópticos: acrílico altamente translúcido, superfície lisa e brilhante, e braquetes com fios metálicos cheios de nichos e sombras. O INO200 desenhou com precisão as aletas dos braquetes e o perfil exato do fio ortodôntico, sem "fechar" nem criar pontes de ruído digital nas ameias interproximais, mantendo estável a leitura de cor e textura na resina translúcida.

### 5. Software e ecossistema digital

**Licenciamento**: sistema aberto, **100% livre de anuidades** e taxas de atualização.
**Formatos exportáveis**: STL, PLY e OBJ — compatibilidade irrestrita com softwares CAD (exocad, 3Shape), sistemas de alinhadores, plataformas de planejamento, impressoras 3D e fresadoras.
**Plataforma cloud**: armazenamento em nuvem com backup automático, acesso remoto, sincronização entre computadores e compartilhamento instantâneo com o laboratório.

#### Recursos de Inteligência Artificial

| Recurso | O que faz |
|---|---|
| **AI Crown Design** | Desenho automatizado de coroas anatômicas, com contatos proximais inteligentes e ajuste oclusal inicial — **coroa em aproximadamente 60 segundos** |
| **Digital Trimming** | Recorte digital do modelo, removendo áreas desnecessárias; gera arquivos menores e processamento mais rápido |
| **Adjust and Verify** | Validação do desenho protético: contatos proximais, espaço para cimento, espessura mínima, interferências |
| **3D Model Creation** | Converte os dados do escaneamento em modelo pronto para impressão 3D, fresagem, planejamento cirúrgico e arquivamento |

#### As 14 ferramentas clínicas do software

1. **BLZ DMC Edentulous** *(novo)* — módulo para escaneamento de pacientes totalmente desdentados, um dos maiores desafios da odontologia digital pela ausência de pontos anatômicos de referência. Usa marcadores proprietários ("scan buddies") que concentram os pontos de referência numa área pequena: **tipo L** para região posterior, **tipo S/M** para região anterior, sempre agrupados o mais próximo possível. Aplicações: prótese total digital, protocolos sobre implantes, overdentures, planejamento cirúrgico. Benefícios: melhor rastreamento da mucosa, menor perda de referência, redução de distorções.
2. **Copia ScanBody** — copia digitalmente a posição de um scanbody para outro implante, reduzindo trabalho manual em protocolos e próteses múltiplas.
3. **A.I. Scanbody & Abutment Matching** — identifica automaticamente scanbodies, componentes protéticos, abutments e conexões, comparando a geometria escaneada com a biblioteca digital; encontra o eixo do implante e corrige pequenas imperfeições do escaneamento.
4. **Margin Line Creation** — marcação da linha de término do preparo, com detecção automática por IA e refinamento manual. Essencial para coroas, facetas, inlays, onlays e pontes.
5. **Denture Scanning** — digitaliza próteses removíveis existentes (total, parcial, bases de prova, moldes) para reprodução, modificação ou confecção de nova prótese.
6. **Smart Scan Guide** — assistente que orienta o operador em tempo real, apontando áreas faltantes, regiões incompletas, locais de baixa qualidade e a direção ideal do scanner.
7. **Captura de múltiplas oclusões** — registra diversas posições de mordida. Aplicável a reabilitações extensas, ortodontia, disfunções temporomandibulares e ajustes oclusais.
8. **F.A.I. — Filtros de tecido mole** — IA que diferencia tecidos moles das estruturas dentárias e remove automaticamente língua, bochecha, lábios, saliva e artefatos de movimento do paciente.
9. **Escaneamento HD** — modo de altíssima resolução para facetas, lentes de contato, prótese estética, implantes e preparos delicados.
10. **Impression Scanning** — digitaliza moldagens convencionais (silicone de adição, de condensação e alginato, conforme estabilidade), convertendo o molde físico em modelo digital e eliminando o gesso.
11. **Verificação de oclusão** — mapeia automaticamente os contatos oclusais: pontos de contato, intensidade, distribuição e interferências.
12. **Medidas** — metrologia digital sobre o modelo 3D: distâncias, alturas, espessuras, ângulos e diâmetros.
13. **Smart Stitching** — alinha automaticamente as milhares de imagens capturadas em um único modelo, corrigindo movimentos, removendo sobreposições e eliminando distorções.
14. **Simulação ortodôntica** — simula movimentação dentária, alinhamento, fechamento de diastemas e correção de apinhamentos. Ferramenta de comunicação e aceitação de tratamento.

**Gestão de pacientes**: cadastro, histórico de escaneamentos, organização por caso clínico, comparação de exames, compartilhamento com laboratórios e controle de datas.

### 6. Biossegurança e insumos

**Ponteiras** — removíveis e autoclaváveis, em três modelos:

| Modelo | Dimensões (tabela de specs) | Dimensões (seção descritiva) ⚠️ | Aplicação |
|---|---|---|---|
| Standard / M | 17,15 × 15 mm | 17 × 15,5 mm | Escaneamento geral, uso diário |
| Mini / S | 13 × 14 mm | 14 × 12,5 mm | Odontopediatria, pacientes com limitação de abertura bucal |
| 90° | não consta | 17 × 15,5 mm | Acesso às regiões posteriores, escaneamentos complexos |

> ⚠️ **Divergência na fonte**: o mesmo documento apresenta dois conjuntos de dimensões. Confirmar com o fabricante antes de publicar.

**Módulo calibrador** — bloco calibrador incluso, para calibração dos sensores ópticos e manutenção da referência absoluta de precisão, feita no próprio consultório. Garante fidelidade das imagens e maior longevidade do equipamento.

### 7. Custo operacional — argumento comercial central

| Insumo | BLZ INO200 | Concorrente importado |
|---|---|---|
| Ponteira (unidade) | **R$ 400,00** | ~R$ 825,00 |
| Cabo de conexão | **R$ 260,00** | ~R$ 2.200,00 |

O cabo destacável é substituível pelo próprio usuário na clínica: não é preciso enviar o equipamento inteiro para manutenção, o que elimina o tempo de parada. Os insumos originais custam **menos da metade** dos concorrentes importados tradicionais.

> ⚠️ Seu exemplo cita "R$ 200,00 a R$ 260,00" para o cabo. As duas fontes do Drive dizem **R$ 260,00**. Não localizei o valor de R$ 200 em fonte nenhuma.

### 8. Aplicações clínicas

Odontologia restauradora · prótese fixa · prótese removível · protocolos sobre implantes · overdentures · ortodontia digital · planejamento de alinhadores invisíveis · guias cirúrgicos para implantes · facetas e lentes de contato · inlays e onlays · coroas e pontes · próteses totais e parciais · odontopediatria · reabilitação oral · planejamento digital · impressão 3D odontológica · documentação e comunicação clínica.

### 9. Público-alvo

Cirurgiões-dentistas · clínicas e consultórios de pequeno e médio porte migrando do fluxo analógico para o digital · implantodontistas · ortodontistas · protesistas · laboratórios de prótese dentária · profissionais que já usam impressoras e resinas Smart Dent e precisam de captura confiável para alimentar o fluxo chairside print.

### 10. Fluxo clínico integrado

1. Escaneamento intraoral → 2. Processamento inteligente das imagens → 3. Limpeza automática com IA (F.A.I.) → 4. Identificação de implantes e scanbodies → 5. Definição automática das margens → 6. Verificação da oclusão → 7. Medições digitais → 8. Simulação ortodôntica (quando aplicável) → 9. Criação do modelo 3D → 10. Desenho automatizado de coroa com IA → 11. Armazenamento em nuvem → 12. Exportação para CAD/CAM e laboratório.

---

## Links do produto e pack de fotos

- **Link de venda**: https://loja.smartdent.com.br/scanner-intraoral-blz-ino200
- **Foto principal**: `https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/products/53703608-9abf-4e53-968b-94274074dc55-1768352756996.webp`
- **Galeria**: não há fotos adicionais cadastradas na base — o pack precisa vir do Drive.
- **Documentação técnica no Drive**:
  - Visão geral e especificações: `17gtJwE63ZJGTn_wSmw1aYXiEhvavKVuFIwUGIiviDSg`
  - Comparativo técnico e testes de estresse: `1ALt1NatyY2XJZu0OlM7B7ODP1TfyNde1PJiOmaNnrN8`
  - Workflow de protocolo All-on-X: `1YmheSfFFFn-jnqptNIqRTGbFiEujKdRI56nLjUCXGAQ`
  - Relatório de validação oclusal: `1f2QNI1VYMpRginWHLJjjcD50I3zvB44tPwtQAX4eldI`
  - Tabela comparativa de scanners intraorais: `1axuVpPypej17naRg2v46hMd-5zzb7QKxC0Xkg1aUVhE`
- **Preço**: venda consultiva — **não publicar valor**.

---

## Como esta ficha foi construída (aplicar aos demais produtos)

1. Buscar no **Google Drive** todos os documentos do produto (`title contains` e `fullText contains` com o nome e códigos do modelo).
2. Ler cada documento e extrair: especificação técnica medida, prova comparativa, teste clínico, funcionalidade de software descrita uma a uma, custo operacional, aplicação clínica.
3. **Nunca resumir uma tabela de especificações** — ela é o insumo mais valioso para a IA da agência.
4. Marcar com ⚠️ toda divergência entre fontes, em vez de escolher em silêncio.
5. Cruzar com `products_repository` apenas para preço, link de venda e foto principal.
