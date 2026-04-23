

## Diagnóstico — Cobertura dos HTMLs publicados

Auditei os artigos da Base de Conhecimento, o SSR (`seo-proxy`) e o frontend (`OrganizationSchema`/`useCompanyData`). Resultado: **a maior parte dos HTMLs JÁ está atualizada**, mas há gaps específicos.

### Cobertura nos artigos publicados (770 totais)

| Marcador da Fonte da Verdade | Artigos com o dado | % |
|---|---|---|
| Marca "Smart Dent" / "MMTech" | 767 | 99,6% |
| CNPJ real `10.736.894/0001-36` | 749 | 97,3% |
| Wikidata `Q139535514` | 748 | 97,1% |
| Fundadores (Del Guerra/Cestari) | 748 | 97,1% |
| ORCID + autoridade FAPESP | 748 | 97,1% |
| Entidade EUA (MMTech NC LLC) | 746 | 96,9% |
| Regulatório (FDA/ANVISA) | 750 | 97,4% |

### SSR / Schema (seo-proxy + OrganizationSchema)

- ✅ `legalName`, `taxID`, `vatID`, Wikidata Q-number, MMTech NA LLC, fundadores como `Person Schema` → todos presentes.
- ✅ `useCompanyData.ts` injeta dados dinamicamente.
- ✅ Bloco `SMARTDENT_AUTHORITY_CONTEXT` no system prompt da IA.

### Catálogo de produtos

- ✅ Produtos ATOS, UNIKK, SmartMake, Smart Ortho com `regulatory.anvisa` populado (25+ verificados).
- ⚠️ Campo `udi_hibcc` (FDA HIBCC) está **NULL** em todos os produtos checados — mesmo onde o documento v2.0 lista UDIs.

### Gaps identificados

| # | Gap | Impacto | Volume |
|---|---|---|---|
| 1 | **22 artigos antigos sem dados da Fonte da Verdade** (criados antes da política E-E-A-T) | LLMs não vão citar autoridade nesses artigos | 22 / 770 (2,9%) |
| 2 | **309 artigos sem `author_id`** | Person Schema do autor não renderiza no HTML | 309 / 770 (40%) |
| 3 | **Marcelo Cestari, Renato Sousa e "Equipe Smart Dent" sem artigos vinculados** | Autores cadastrados mas sem uso | 3 autores |
| 4 | **`udi_hibcc` (FDA) ausente em produtos** | Schema `MedicalDevice` incompleto para mercado EUA | catálogo inteiro |
| 5 | **Renato Sousa não tem `academic_title`/`orcid`/`lattes`** | Bio incompleta vs. fundadores | 1 autor |

## Plano de Remediação

### Onda A — Reformatar 22 artigos legados
Edge function existente: `reformat-article-html` (já vista no contexto). Vou disparar um **batch loop** que para cada um dos 22 artigos:
1. Lê `content_html`
2. Chama `ai-orchestrate-content` ou `enrich-article-seo` com o `SMARTDENT_AUTHORITY_CONTEXT` injetado
3. Faz `UPDATE knowledge_contents` salvando a nova versão

Resultado esperado: 770/770 (100%) com Fonte da Verdade.

### Onda B — Atribuir autores aos 309 artigos órfãos
Migration SQL com regra:
- Artigos de **odontologia clínica/reabilitação/prótese** → `Prof. Dr. Weber Adad Ricci`
- Artigos de **resinas/materiais/química** → `Marcelo Cestari` (MSc)
- Artigos de **CAD/CAM/impressão 3D/manufatura** → `Dr. Marcelo Del Guerra`
- Fallback genérico → `Equipe Smart Dent`

Roteamento por keywords no título + categoria.

### Onda C — Popular `udi_hibcc` no catálogo
Migration `UPDATE system_a_catalog SET extra_data = jsonb_set(...)` por produto, usando o mapa UDI da Fonte da Verdade v2.0 (FDA HIBCC). Atualiza linhas com SKU correspondente.

### Onda D — Completar autor Renato Sousa
Migration curta atualizando `academic_title`, `specialty`, `bio_credentials` (ou marcar como inativo se não fizer parte do time científico atual).

### Onda E — Re-deploy SSR / Validação
1. Disparar novamente `generate-knowledge-sitemap` (PT/EN/ES) para o Google reindexar.
2. Curl em 5 URLs amostrais simulando bot Googlebot via `seo-proxy` → confirmar Person Schema + Organization Schema completos.
3. Verificar uma URL no [Schema.org Validator](https://validator.schema.org/).

## Arquivos Afetados

- **Migrations novas** (`supabase/migrations/`):
  - `..._assign_authors_orphan_articles.sql` (Onda B)
  - `..._populate_udi_hibcc_products.sql` (Onda C)
  - `..._complete_renato_sousa_author.sql` (Onda D)
- **Script de batch** (`supabase/functions/reformat-article-html` invocado em loop pelo Lovable durante execução — sem novo código)
- **Sitemap regen** (chamadas `generate-knowledge-sitemap*` — sem código novo)

## Resultado Esperado

- 100% dos 770 artigos com dados da Fonte da Verdade no HTML servido
- 100% com `author_id` → Person Schema completo
- Catálogo com `udi_hibcc` preenchido onde aplicável (mercado EUA)
- Sitemaps regenerados → Google/LLMs reindexam com autoridade científica completa

