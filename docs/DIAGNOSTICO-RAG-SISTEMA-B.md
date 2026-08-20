# Diagnóstico — a RAG do Sistema B tem a profundidade dos produtos?

**Resposta curta: não, e agora sabemos exatamente por quê.**

Você está certo: as fichas que entreguei foram rasas. Elas vieram de `products_repository` (Sistema A), que é um repositório de e-commerce — descrição de vitrine, não documentação técnica. A profundidade do seu exemplo do INO200 não estava lá, e também **não está na RAG do Sistema B**.

---

## 1. O que a RAG do Sistema B realmente tem

A tabela `catalog_documents` é a RAG documental do catálogo. Estado real:

| Status de extração | Documentos | Com texto | Média de caracteres |
|---|---|---|---|
| `pending` | **384** | 0 | — |
| `success` | 80 | 80 | 17.318 |
| `completed` | 2 | 2 | 21.720 |
| `failed` | 1 | 0 | — |
| **Total** | **467** | **82** | — |

**82 de 467 documentos (17,5%) têm texto extraído.** Os outros 384 são arquivos que foram enviados ao storage e nunca processados — o PDF está lá, o texto nunca foi lido.

E `agent_embeddings` tem exatamente **80 registros**, batendo com os 80 documentos extraídos. Ou seja: **a RAG vetorial só enxerga esses 80.**

## 2. O caso do INO200, especificamente

O Scanner Intraoral BLZ INO200 tem **1 documento** vinculado na RAG:

- **Nome**: `Comparativo INO 200 BLZ`
- **Arquivo**: `FINAl COMPARATIVO - BLZ.pdf`
- **URL**: `.../storage/v1/object/public/catalog-documents/scanner-intraoral-blz-ino200-1784114554850.pdf`
- **Status de extração**: **`pending`**
- **Texto na RAG**: **nenhum**

Então a resposta é literal: a RAG do Sistema B tem o *arquivo* do INO200, mas **zero texto** sobre ele.

## 3. O que os 82 documentos extraídos cobrem

Só a **linha Atos/UNIKK** — que é justamente a Etapa 5:

- Atos Resina Composta Direta (todas as 20 tonalidades): ~50.000 caracteres cada
- Resina Atos Academic (11 itens): ~24.000 caracteres cada
- Cimentos UNIKK Veneer (13 itens): ~14.500 caracteres cada
- ATOS Smart Ortho: 52.052 caracteres
- Atos Unichroma: 28.689 caracteres

**Nenhum equipamento** — scanner, impressora, pós-impressão, fresagem — tem texto extraído. Eles têm documentos, todos `pending`.

Isso explica a assimetria: a Etapa 5, que eu tratei com ficha-mãe resumida, é justamente a **única** com material profundo disponível na RAG. Inverti a prioridade.

## 4. Onde a profundidade está de verdade: Google Drive

Busquei no Drive e encontrei **as fontes exatas que o seu exemplo cita**:

| Documento | ID do Drive | Corresponde a |
|---|---|---|
| 🦷 BLZ INO200: O Scanner Intraoral que Transforma sua Clínica em Digital | `17gtJwE63ZJGTn_wSmw1aYXiEhvavKVuFIwUGIiviDSg` | sua referência **[1]** |
| Comparativo Técnico: Medit i600, i700, i900 vs. BLZ INO200 | `1ALt1NatyY2XJZu0OlM7B7ODP1TfyNde1PJiOmaNnrN8` | sua referência **[2]** |
| BLZDental INO 200 — workflow de protocolo All-on-X | `1YmheSfFFFn-jnqptNIqRTGbFiEujKdRI56nLjUCXGAQ` | — |
| relatorio_validacao_oclusal_BLZ_ino200 | `1f2QNI1VYMpRginWHLJjjcD50I3zvB44tPwtQAX4eldI` | — |
| Tabela Comparativa – Scanners Intraorais (Medit i600/i700/i700W/INO200/i900) | `1axuVpPypej17naRg2v46hMd-5zzb7QKxC0Xkg1aUVhE` | — |
| blog-blz-ino200-comparativo-depoimento.md | `18mPCmruJZ1x3nfJL-dhMcjox3emkHGCIGKTq10zqq0I` | — |

Eu li os dois primeiros e reconstruí a ficha profunda do INO200 a partir deles — está em `PADRAO-FICHA-PROFUNDA-blz-ino200.md`. Ela bate com o seu exemplo e vai um pouco além (as 14 ferramentas do software descritas uma a uma, o ecossistema, os 3 testes de estresse clínico).

**Conclusão do diagnóstico**: a fonte de profundidade da SmartDent é o **Google Drive**, não o Supabase. A RAG do Sistema B foi desenhada para receber esse material, mas o pipeline parou nos 82 primeiros documentos.

---

## 5. Contradições encontradas nas próprias fontes

Encontrei divergências **dentro do mesmo documento do Drive**. Isso precisa ser resolvido antes de a agência escrever campanha, senão cada peça sai com um número diferente.

| # | Divergência | Onde | Qual usar |
|---|---|---|---|
| 1 | **Peso: 165 g × 270 g** | O doc [1] diz "cerca de 270 g" em duas seções de texto corrido, mas a tabela de especificações do mesmo doc diz **165 g**. O comparativo [2] confirma **165 g** ("comparado aos 245 g da linha Medit"). | **165 g** — é o valor da tabela técnica e do comparativo. Corrigir os dois trechos que dizem 270 g. |
| 2 | **Dimensões das ponteiras** | Tabela de specs: M 17,15 × 15 mm / S 13 × 14 mm. Seção posterior do mesmo doc: Standard 17 × 15,5 / 90° 17 × 15,5 / Mini 14 × 12,5. | Indefinido — precisa de confirmação do fabricante. |
| 3 | **Quantidade de ponteiras** | Seu exemplo diz "5 ponteiras autoclaváveis". O doc do Drive descreve **3 modelos** (Standard, 90°, Mini). | O "5" veio da sua fonte [3], que não consultei. Conferir se são 5 unidades de 3 modelos. |
| 4 | **Custo do cabo** | Seu exemplo diz "R$ 200,00 a R$ 260,00". As duas fontes do Drive dizem **R$ 260,00**. | **R$ 260,00**. Não achei R$ 200 em fonte nenhuma. |
| 5 | **Posicionamento: entry-level × elite** | O doc [1] abre chamando o INO200 de "scanner intraoral **de entrada (entry-level)**". O comparativo [2] conclui que ele é "**competidor de elite**", que "bate de frente com o Medit i700" e "iguala a precisão do i900". | Decisão de marketing, não de engenharia. Mas os dois textos não podem coexistir no material da agência. |

A contradição 5 é a mais séria. Ela muda preço, público-alvo e criativo.

---

## 6. Como resolver de forma sistêmica

O Sistema B **já tem** as edge functions de extração:
`extract-pdf-batch`, `extract-pdf-text`, `extract-pdf-deepseek`, `extract-pdf-specialized`, `extract-and-cache-pdf`, `ai-enrich-pdf-content`.

O pipeline existe e funcionou nos 82 documentos da linha Atos. **Ele só não foi rodado nos 384 restantes.**

Rodar `extract-pdf-batch` sobre os `pending` resolveria a profundidade de todos os produtos de uma vez — e ainda alimentaria a Dra. L.I.A., que hoje só "sabe" falar da linha Atos com profundidade documental.

Essa é uma mudança em produção que eu não fiz por conta própria. Se você autorizar, eu executo o batch e depois regenero as fichas a partir da RAG já preenchida.

---

## 7. Caminhos para as fichas da agência

| Opção | Como funciona | Prazo | Qualidade |
|---|---|---|---|
| **A — Rodar o batch de extração** | Processar os 384 `pending`, depois gerar as fichas a partir da RAG | Depende do batch | Melhor: resolve RAG + fichas + L.I.A. de uma vez |
| **B — Ir direto ao Drive** | Eu busco e leio os documentos de cada produto no Drive, como fiz com o INO200 | ~4 a 6 produtos por rodada | Alta, mas manual e não alimenta a RAG |
| **C — Só os produtos-âncora** | Fichas profundas apenas para equipamentos e resinas 3D (~30 produtos); variantes de cor seguem com ficha-mãe | Intermediário | Suficiente para campanha, com foco no que tem ticket alto |

**Minha recomendação: A, com B para o que o batch não cobrir.** O batch conserta a causa; o Drive cobre o resto.
