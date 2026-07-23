
## Objetivo

Na aba **Catálogo** da Base de Conhecimento, substituir a sidebar atual (que só mostra a letra "G") por uma lista fixa de categorias comerciais, cada uma filtrando a grade por combinação `product_category` + `product_subcategory` (ou nome).

## Categorias e mapeamento

| Rótulo na sidebar        | Filtro aplicado em `KbTabCatalogo`                                             |
|--------------------------|---------------------------------------------------------------------------------|
| Tudo                     | chip=all, sub=all                                                              |
| Resinas 3D               | chip=`RESINAS 3D`, sub=all                                                     |
| Scanners                 | chip=`SCANNERS 3D`, sub=all                                                    |
| Softwares CAD            | chip=`SOFTWARES`, sub=all                                                      |
| Impressoras 3D           | chip=`IMPRESSÃO 3D`, sub startswith `3.4`/`3.5` (IMPRESSORA)                   |
| Pós-impressão            | sub=`4.1 EQUIPAMENTOS` (equipamentos de cura)                                  |
| Limpeza e acabamento     | sub=`4.2 LIMPEZA/ACABAMENTO`                                                   |
| Caracterização           | chip=`CARACTERIZAÇÃO`, sub=all (SMARTMAKE + SMARTGUM)                          |
| Resinas diretas          | sub=`6.3 RESINAS COMPOSTAS` (Atos Composta + Unichroma)                        |
| Cimentos                 | sub=`6.2 CIMENTOS` (UNIKK Veneer + Try-in)                                     |
| Adesivos                 | filtro por nome contendo `ATOS Smart Ortho`                                    |

Contagens são calculadas em tempo real a partir de `system_a_catalog` (mesma query e allowlist já existentes — governança do catálogo é preservada).

## Implementação

1. **`src/pages/KnowledgeBase.tsx`**
   - Adicionar novo estado `catalogoFilter` (chave da categoria escolhida) — persistido em `?cat=`.
   - Buscar contagens por combinação `product_category` + `product_subcategory` uma única vez ao entrar na aba Catálogo, aplicando o mesmo filtro (active/approved/visible_in_ui) e a mesma allowlist `PRODUCT_CATALOG_ENTITY_TYPES` de `KbTabCatalogo`.
   - Montar `categories` da shell com os 11 itens acima quando `activeKey === 'catalogo'`, cada um com sua contagem calculada.
   - Passar `filterKey` para `<KbTabCatalogo filterKey={catalogoFilter} />`.

2. **`src/components/knowledge/KbTabCatalogo.tsx`**
   - Aceitar prop opcional `filterKey?: string`.
   - Em `useEffect([filterKey])`, mapear a chave para `{ chip, subChip, nameContains }` e aplicar via `setChip`/`setSubChip` + novo estado `nameContains`.
   - Estender o `useMemo` de filtro (linha ~697) para respeitar `nameContains` (case-insensitive, sem acento).
   - Ocultar a barra interna de `KbChips` quando `filterKey` estiver ativo, para evitar duplicidade de controles (a sidebar passa a ser a única fonte).

3. **Sem migração**: nada muda em banco. Apenas leitura.

## Fora de escopo

- Não alterar `system_a_catalog`, taxonomia canônica (`kbCategoryTaxonomy.ts`), nem a governança de produto (`PRODUCT_CATALOG_ENTITY_TYPES`).
- Não mexer em outras abas.
- SEO/SSR do `seo-proxy` não muda (rotas continuam iguais; filtro é apenas query param).

## Pontos a confirmar

- **"Adesivos = ATOS Smart Ortho"**: hoje esse produto não tem categoria/subcategoria mapeada — devo filtrar por nome contendo `ATOS Smart Ortho`. Ok?
- **"Pós-impressão (Equipamentos de cura)"**: mapear para `4.1 EQUIPAMENTOS` (curador Wash/Cure e afins). Confirma?
