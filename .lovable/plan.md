
## Diagnóstico

O usuário forneceu um **documento "Fonte da Verdade"** (Smart Dent / MMTech) com dados corporativos sensíveis e currículos completos dos fundadores (Marcelo Del Guerra e Marcelo Cestari, com ORCID, Lattes, FAPESP, publicações). Quer saber:

1. Se essas informações estão sendo usadas nos artigos
2. Se o conteúdo gerado serve como **fonte da verdade para IAs** (E-E-A-T)

Preciso auditar:
- O `OrganizationSchema.tsx` (já vi: usa `useCompanyData` mas tem coordenadas hardcoded e não tem fundadores como Person Schema)
- A tabela/fonte de `useCompanyData` (provavelmente `company_data` ou `system_settings`)
- O system prompt de geração (`_shared/system-prompt.ts` — vi que tem regras E-E-A-T mas não menciona fundadores nem credenciais)
- Edge functions de SEO/IA: `seo-proxy`, `ai-orchestrate-content`, `ai-metadata-generator`, `enrich-article-seo`
- AuthorBio / AuthorSignature (autores aparecem mas estão desconectados dos fundadores reais)

## Auditoria Planejada

### Passo 1 — Mapear estado atual (read-only)
1. `code--view src/hooks/useCompanyData.ts` — verificar quais campos estão modelados
2. `supabase--read_query` em `company_data` / `system_settings` — ver se MMTech BR+EUA, ORCID, Lattes, FAPESP estão preenchidos
3. `code--view supabase/functions/seo-proxy/index.ts` — ver se o SSR injeta Person Schema dos fundadores e Organization completo
4. `code--view supabase/functions/ai-orchestrate-content/index.ts` + `_shared/system-prompt.ts` — checar se o prompt enriquece artigos com credenciais dos fundadores como autoridade
5. `code--view src/components/AuthorBio.tsx` — ver se autores carregam credenciais acadêmicas
6. `code--search_files "ORCID|Lattes|FAPESP|Del Guerra|Cestari|MMTech"` — ver se algo já existe

### Passo 2 — Comparar contra o documento
Para cada bloco do documento, marcar:
- ✅ presente e usado
- ⚠️ presente mas subutilizado (não chega ao SEO/IA)
- ❌ ausente

Blocos a verificar: Razão Social BR, MMTech NC LLC (EUA), CRO Ricardo Casale, ORCID/Lattes Del Guerra, ORCID/Lattes Cestari, FAPESP PIPE, publicações científicas, produtos (ATOS, Smart Print, Smart Ortho), endereços completos.

### Passo 3 — Apresentar plano de remediação
Com base no gap, propor:

**A) Migration `company_data`** (se faltarem campos): adicionar `legal_entities[]` (BR + EUA), `responsible_technician`, `founders[]` (com ORCID, Lattes, FAPESP, formação, publicações chave), `research_grants[]`, `product_developments[]`.

**B) Atualizar `OrganizationSchema.tsx`**:
- Adicionar `parentOrganization` MMTech NC LLC
- Adicionar `founder[]` como Person Schema com `identifier` (ORCID), `sameAs` (Lattes, FAPESP), `alumniOf` (USP, UFSCar), `knowsAbout`
- Remover coordenadas hardcoded → usar `company.contact.geo`
- Adicionar `responsibleTechnician` (CRO-SP 78005)

**C) Atualizar `seo-proxy` SSR** (mem://seo/ai-first-semantic-architecture):
- Injetar Person Schema dos 2 fundadores em todas as páginas de artigo
- Adicionar bloco `<meta name="author-credentials">` com ORCID
- Reforçar `<address>` semântico com razão social completa

**D) Atualizar `_shared/system-prompt.ts`** — adicionar bloco `SMARTDENT_AUTHORITY_CONTEXT`:
```
- Empresa: MMTech Projetos Tecnológicos (CNPJ 10.736.894/0001-36) + MMTech NA LLC (NC, EUA)
- Resp. Técnico: Ricardo Casale (CRO-SP 78005)
- Fundadores PhD: Del Guerra (EESC-USP, ORCID 0000-0003-1537-3742) e Cestari (UFSCar Materiais, ORCID 0000-0002-1985-209X, 979 citações)
- Pesquisa: 5 projetos FAPESP PIPE / CNPq sobre resinas 3D, CoCr, zircônia
- Quando relevante para autoridade do tema, citar "desenvolvido pela equipe de PhDs da Smart Dent" sem inventar dados.
```

**E) `AuthorBio.tsx` + tabela `authors`**: vincular fundadores como autores oficiais com `orcid`, `lattes_url`, `bio_credentials`, exibir badge "PhD · Pesquisador FAPESP".

**F) Novo `FounderSchema.tsx`** componente Helmet para injetar Person Schema em páginas institucionais (About, ProductPage de produtos desenvolvidos por eles: Smart Print, ATOS, Smart Ortho).

**G) Página `/sobre` enriquecida** com seção "Time de Pesquisa" linkando ORCID/Lattes (E-E-A-T máximo).

## Próximo Passo

Vou primeiro **executar a auditoria (Passo 1+2)** de forma read-only e voltar com o relatório de gaps + plano detalhado de ação aprovável. Isso evita propor mudanças sobre suposições.

## Arquivos a Inspecionar (Passo 1)

- `src/hooks/useCompanyData.ts`
- `src/components/AuthorBio.tsx`, `src/components/AuthorSignature.tsx`
- `supabase/functions/seo-proxy/index.ts` (geradores de schema)
- `supabase/functions/ai-orchestrate-content/index.ts`
- `supabase/functions/_shared/system-prompt.ts` (já vi parcialmente)
- Tabelas: `company_data`, `authors`, `articles`/`knowledge_articles`

## Resultado Esperado da Auditoria

Relatório de cobertura por bloco do documento (BR, EUA, fundadores, pesquisa, produtos) com plano executivo dividido em 3 ondas:
1. **Onda 1 (dados)**: popular `company_data` + `authors` com tudo do documento
2. **Onda 2 (schema/SSR)**: Organization + Person Schema completo no `seo-proxy`
3. **Onda 3 (IA)**: enriquecer system prompt para citar autoridade científica em artigos relevantes
