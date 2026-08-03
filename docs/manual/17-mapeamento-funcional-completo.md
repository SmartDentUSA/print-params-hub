# 17 — Mapeamento Funcional Completo (Enterprise)

> Especificação técnica e operacional de **todas** as seções do menu do sistema SmartDent (Sistema B — Supabase `okeogjgqijbfkudfjadz`).
> Estrutura por item: **1) Descrição & objetivo de negócio · 2) Componentes internos · 3) Passo a passo (how-to) · 4) Arquitetura de dados & engenharia fullstack**.

## Convenções e roteamento

| Camada | Implementação |
|---|---|
| Shell administrativo | `src/pages/AdminViewSecure.tsx` — `switch(activeSection)` (linhas 277-350) monta cada seção via lazy import |
| Menu | `src/components/AdminSidebar.tsx:55-130` (grupos Catálogo, Conteúdo, Smart Ops, Ferramentas, Sistema) |
| Social Publisher | Rotas aninhadas em `src/App.tsx:82-97`, shell `src/components/social/SocialLayout.tsx` + `SocialSidebar.tsx` |
| Acesso a dados | `@/integrations/supabase/client` — PostgREST (`.from`), RPC (`.rpc`), Edge Functions (`functions.invoke`) |
| Autorização | `user_roles` (`app_role`: admin, user, author, distribuidor) + RLS; seções `adminOnly` filtradas no sidebar |

**Regras globais que atravessam todos os módulos**
- **Golden Rule (CRM):** nunca alterar o Funil CS nem o Funil Comercial; novo interesse sempre abre deal novo no **Funil de Vendas** (`_shared/golden-rule-guard.ts`, `smart-ops-lia-assign`).
- **CDP:** toda leitura de `lia_attendances` usa `WHERE merged_into IS NULL` (lead canônico).
- **Receita:** `Max(CRM ganho, Faturamento Omie) + LTV e-commerce`.
- **WhatsApp:** Evolution API = individual · EvolutionGO = grupos · sem fallback entre provedores · credenciais por instância em `team_members`.
- **Datas:** eventos externos gravam sempre a data real do fato, nunca `now()`.

---

# 1. Módulo: Catálogo

## 1.1 Modelos

**1) Descrição & objetivo de negócio**
Cadastro-mestre de equipamentos (impressoras/scanners) por marca. Sustenta as páginas públicas de parâmetros de impressão, os filtros do catálogo e a taxonomia de equipamento usada no CRM (`equip_*`). O usuário vê uma tabela plana de modelos com marca, status ativo/inativo e imagem.

**2) Componentes internos**
- Botão **Novo Modelo** (`AdminModels.tsx:265`), ações de linha **Editar** (`:442`) e **Excluir** com `AlertDialog` de confirmação (`:449-473`).
- Modal com 2 abas: **Informações Básicas** e **Imagem** (`:286-361`); `Switch` ativo/inativo (`:345`); upload via `ImageUpload` (bucket `model-images`).
- Sem filtros — listagem completa.

**3) Passo a passo**
1. Abrir **Catálogo → Modelos**. 2. **Novo Modelo** → escolher marca, nome, slug, specs. 3. Aba **Imagem** → upload. 4. Salvar (grava e invalida cache do `DataContext`). 5. Para desativar sem perder histórico, usar o `Switch` (não excluir). 6. Excluir só se o modelo nunca foi referenciado por parâmetros/artigos.

**4) Arquitetura de dados**
- **Inputs:** formulário (marca, nome, slug, descrição, ativo, imagem).
- **Processamento:** `DataContext` (`src/contexts/DataContext.tsx:58-90`) → `useSupabaseData` (leitura) + `useSupabaseCRUD` (escrita); geração de slug via `useSlugGeneration`.
- **Outputs:** linhas em `models`, arquivo em Storage, revalidação das páginas públicas de parâmetros.
- **Tabelas:** `brands`, `models`, `parameter_sets` (consumidora), Storage `model-images`.
- **Integrações externas:** nenhuma.

## 1.2 Produtos (Gestão de Catálogo)

**1) Descrição & objetivo**
Fonte pública de produtos comerciais (`system_a_catalog`) — controla visibilidade, taxonomia, preço, SEO, CTAs e documentos. É o catálogo que alimenta site, propostas de distribuição, RAG da Dra. LIA e resolução de SKU nas propostas do CRM.

**2) Componentes internos**
- Abas: **Catálogo** e **Mapeamento de SKU** (`AdminCatalog.tsx:282-286`, `SkuMappingTab`, com filtro **Fora do Catálogo** para itens de proposta do CRM sem correspondência).
- Botões: **Regenerar Descrições (Resinas)** (`:302`), **Migrar Imagens** (`:323`), **Novo Produto** (`:331`), **Exportar XLSX** (`:335`), **Mostrar/Ocultar todos** por categoria (`:397`).
- Filtros: busca, categoria, status (ativo/inativo/aprovado/pendente/visível/oculto), origem (produtos × espelho de resinas).
- Tabela (`AdminCatalogTable.tsx`): checkbox **Dist.** por variação (visibilidade granular no catálogo de distribuição); ordenação global **KIT primeiro**, depois ordem lógica de nome com variações agrupadas (`types.ts` → `isKitProduct`, `kitFirst`).
- Modal `AdminModal`: dados comerciais, specs técnicas, indicações clínicas, CTAs 1-3, SEO, documentos, apresentações.

**3) Passo a passo**
1. Filtrar por categoria/status. 2. **Novo Produto** ou editar. 3. Definir `active`/`approved`/`visible_in_ui` e `display_order`. 4. Anexar PDFs (vão para `catalog_documents`). 5. Marcar **Dist.** nas variações liberadas para distribuidores. 6. Em **Mapeamento de SKU**, vincular nomes de itens vindos do CRM a variações canônicas ou criar nome de match.

**4) Arquitetura de dados**
- **Inputs:** formulário, upload de PDFs/imagens, itens de proposta importados do PipeRun.
- **Processamento:** `useCatalogCRUD.ts`; espelhamento `resins → system_a_catalog` via COALESCE (política *Resinas Canonical Mirror*); resolução de SKU por `_shared/catalog-sku-resolver.ts`.
- **Outputs:** catálogo público, XLSX, descrições/traduções geradas por IA, documentos publicados.
- **Tabelas:** `system_a_catalog`, `catalog_product_variations`, `catalog_kit_components`, `catalog_documents`, `products_catalog`, `produto_aliases`, `product_taxonomy`, `resins`; Storage `catalog-documents`.
- **Edge functions:** `migrate-catalog-images`, `smart-ops-generate-card-descriptions`, `translate-card-row`, `format-processing-instructions`.
- **Integrações:** Lovable AI Gateway (descrições/traduções); Sistema A (espelho de conteúdo).

## 1.3 Docs Sistema

**1) Descrição & objetivo**
Repositório unificado de documentos técnicos (catálogo + resinas) com extração de texto por IA, usado como matéria-prima do RAG e da base de conhecimento.

**2) Componentes internos**
- Filtros: nome, idioma, tipo de documento, status (pending/processing/completed/failed), origem (resin/catalog).
- Ações por linha: **Extrair/Re-extrair PDF**, editar texto extraído inline, **limpar texto**, edição inline de nome/descrição/categoria/subcategoria via popovers, **Publicar no Conhecimento**.
- Modal `DocumentContentGeneratorModal` (gera artigo a partir do documento).

**3) Passo a passo**
1. Filtrar documentos `pending`. 2. **Extrair** → aguardar `completed`. 3. Revisar/ajustar o texto. 4. **Publicar** → escolher categoria/autor → cria registro em `knowledge_contents`.

**4) Arquitetura de dados**
- **Inputs:** PDFs em Storage, metadados do documento.
- **Processamento:** `useAllDocuments.ts` (tabela dinâmica resin/catalog) + `usePdfExtraction.ts`; extração/OCR e sumarização por IA.
- **Outputs:** `extracted_text`, artigos publicados, embeddings para RAG.
- **Tabelas:** `catalog_documents`, `resin_documents`, `system_a_catalog`, `resins`, `knowledge_contents` (⚠️ documentos de resina e de catálogo **nunca** são unificados).
- **Edge functions:** `extract-and-cache-pdf`, `ai-enrich-pdf-content`.

---

# 2. Módulo: Conteúdo

## 2.1 Artigos

**1) Descrição & objetivo**
Editor completo da Base de Conhecimento (categorias A-H) com SEO/GEO, FAQs, mídias, CTAs comerciais e traduções PT/EN/ES. Objetivo: tráfego orgânico, resposta a IA generativa (AI-first) e sustentação do RAG da Dra. LIA.

**2) Componentes internos**
- Abas de categoria dinâmicas (`knowledge_categories`) + abas fixas **roi-calculators**, **link-validator**, **support-cases** (`AdminKnowledge.tsx:1817-1992`).
- Modal do artigo com 6 abas: 📝 Conteúdo · 🤖 IA · 🔍 SEO · ❓ FAQs · 🎬 Mídias · 💰 Conversão (`:2012-2020`).
- Componentes: `KnowledgeEditor` (visual/HTML, PT/ES/EN), `ProductCTAMultiSelect`, `VideoSelector`, `HeroAudioUpload` (player com velocidade 1x/1.5x/2x), `PDFTranscription`, `BlogPreviewFrame`, `AdminLinkBuildingValidator`.

**3) Passo a passo**
1. Escolher categoria. 2. Novo artigo → título/slug/autor. 3. Escrever ou gerar com IA (aba IA). 4. Preencher SEO (title <60, description <160, JSON-LD) e FAQs. 5. Vincular vídeos, PDFs e CTAs de produto. 6. Traduzir (EN/ES). 7. Publicar → URL canônica `/base-conhecimento/{letra}/{slug}`.

**4) Arquitetura de dados**
- **Inputs:** texto/HTML, imagens (`knowledge-images`), PDFs, seleção de vídeos e produtos.
- **Processamento:** `useKnowledge.ts`; enriquecimento e tradução via IA; validador de link building; geração de embeddings para RAG.
- **Outputs:** páginas públicas, sitemap/llms.txt, indexação Google, contexto do RAG.
- **Tabelas:** `knowledge_contents`, `knowledge_categories`, `knowledge_videos`, `authors`, `agent_embeddings`, `google_indexing_log`.
- **Edge functions:** `ai-enrich-pdf-content`, `translate-content`, `extract-and-cache-pdf`, `enrich-article-seo`, `reformat-article-html`, `seo-proxy`.
- **Integrações:** Lovable AI Gateway, Google Indexing API, PandaVideo (vídeos).

## 2.2 Knowledge Hub

**1) Descrição & objetivo**
Base comercial de apoio ao time: FAQs comerciais, fichas técnicas (datasheets) e casos de sucesso — consumidos por vendedores, Copilot e Dra. LIA.

**2) Componentes internos** — 3 abas (`AdminKnowledgeHub.tsx:430-439`)
- **FAQs Comerciais:** formulário (pergunta, categoria, prioridade, tags, produtos), toggle ativo, excluir → `commercial_faqs`.
- **Fichas Técnicas:** busca de produto, upload de datasheet, URL manual → `products_catalog` + Storage `product-datasheets`.
- **Casos de Sucesso:** cliente, slug, cidade/UF, produtos, ROI (meses), economia mensal → `success_stories`.

**3) Passo a passo:** escolher aba → preencher formulário → **Adicionar** → revisar na tabela → desativar/excluir quando obsoleto.

**4) Arquitetura de dados**
- **Tabelas:** `commercial_faqs`, `products_catalog`, `success_stories`; Storage `product-datasheets`.
- **Consumo cruzado:** RAG da Dra. LIA (`search_knowledge_rag`) e Copilot (tools read-only de conhecimento).

## 2.3 Autores

**1) Descrição & objetivo**
Cadastro E-E-A-T dos autores (Person Schema) que assinam os artigos — requisito de autoridade para SEO/GEO.

**2) Componentes:** botão **Novo Autor**, ações Editar/Excluir, modal único com nome, bio, credenciais, redes sociais e foto (`AuthorImageUpload`).

**3) Passo a passo:** Novo Autor → dados + foto → Salvar → vincular no seletor de autor do artigo.

**4) Arquitetura de dados:** tabela `authors` (via `useAuthors.ts`); saída = assinatura HTML (`src/utils/authorSignatureHTML.ts`) e JSON-LD Person nas páginas públicas. Sem integrações externas.
