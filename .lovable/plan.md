
## Situação atual (verificada no banco)

- **Parent rico** — `ATOS Block - caixa com 5 unidades` (`63d0a419…`) em `7. Fresagem / 7.2 Insumos`
  - 1 imagem, descrição (170 chars), **5 documentos** ativos em `catalog_documents`, **11 variações** em `catalog_product_variations`, `extra_data` completo (benefits, features, sales_pitch, applications, clinical_brain, technical_specifications, loja_integrada SKU `N94Y9FAUW`)
  - **0 usos** em `deal_items` (nome "caixa com 5 unidades" nunca foi vendido — o CRM vende as tonalidades individuais)
- **11 filhos vazios** — `ATOS Block HT A1/A2/A3/B1`, `LT A1/A2/A3/A3.5/B1/Bleach/C2` em `2. CAD / 2.2 SERVIÇO`
  - Sem imagem, sem descrição, sem docs. Já têm variações próprias (11 filhas × cada, provavelmente uma linha default por SKU).

Sua sugestão está correta: o parent é o "cartão mestre" e as 11 tonalidades são os SKUs reais que o cliente compra. Fazer o merge preserva conteúdo editorial rico e mantém a granularidade comercial.

## Categoria correta

Recomendo mover as 11 tonalidades para **`7. Fresagem / 7.2 Insumos`** (não manter em `2. CAD / 2.2 SERVIÇO`). Motivos:
- ATOS Block é insumo de fresagem, não serviço CAD.
- Todos os documentos, imagem e ficha técnica do parent foram catalogados sob 7.2 Insumos.
- A sidebar do KB Catálogo já tem chip "Fresagem" — mantém consistência com resto do catálogo.

Se preferir deixar em 2.2 SERVIÇO, é só me dizer antes de aprovar.

## Plano

### 1. Backfill dos 11 filhos a partir do parent (migração SQL)
Para cada uma das 11 tonalidades ATOS Block HT/LT, popular a partir do parent:
- `image_url`, `description`, `brand`, `manufacturer`
- `product_category = '7. Fresagem'`, `product_subcategory = '7.2 Insumos'` (se aprovado)
- `extra_data` = merge do `extra_data` do parent com o existente do filho (parent como base, filho sobrescreve). Ajustar `extra_data.loja_integrada` para NULL nos filhos (o SKU `N94Y9FAUW` é da caixa de 5, não das tonalidades individuais — mantê-lo replicado poluiria a reconciliação Loja Integrada).
- `active = true`, `visible_in_ui = true`, `approved = true`

Só sobrescreve campos vazios no filho — nunca destrói dado existente.

### 2. Republicar os 5 documentos para os 11 filhos
`catalog_documents` hoje aponta 5 docs ao parent. Duplicar cada documento para os 11 filhos via `INSERT ... SELECT` (mesmo `storage_path`/URL, novo `product_id`). Total: 5 × 11 = 55 novos registros de `catalog_documents`.

Alternativa mais enxuta: criar tabela de link `catalog_document_shares` — mas isso muda schema e afeta UI. Fico com a duplicação simples de linhas (docs em Storage não são copiados, só a referência), mantém o `KbTabCatalogo` funcionando sem alteração.

### 3. Retirar o parent de circulação
- `active = false`, `visible_in_ui = false`, `approved = false` no parent `63d0a419…`
- **Não** dar `DELETE` físico. Motivos:
  - Preserva histórico e o `slug` `/atos-block-caixa-com-5-unidades` (pode existir link externo / SEO indexado)
  - `catalog_product_variations` do parent (11 linhas) ficam intactas — podem ter valor histórico
  - Reversível se algo der errado
- Adicionar `extra_data.deprecated = { reason: 'consolidated_into_variants', consolidated_at: now(), successors: [11 ids] }` para auditoria

Se você quiser deleção física depois de validar visualmente, faço em segunda etapa.

### 4. Redirect do slug antigo
Adicionar redirect `/atos-block-caixa-com-5-unidades` → primeira tonalidade (ex.: `/atos-block-ht-a1`) ou para a página de categoria Fresagem/Insumos. Confirme qual preferir.

### 5. Validação
- Reconsultar `system_a_catalog` das 11 tonalidades e conferir imagem/descrição/docs.
- Abrir `/base-conhecimento?tab=catalogo` e chip "Fresagem" → esperar ver 11 cards ATOS Block com foto e docs.
- Rodar reconciliação Loja Integrada de novo para confirmar que o SKU `N94Y9FAUW` continua ligado ao parent (não migrado para filhos).

## Escopo — o que NÃO muda

- Nenhum outro produto do catálogo.
- Nada em `deal_items`, PipeRun, Omie, ou pipelines de vendas.
- Estrutura de tabelas (só migração de dados via `supabase--insert`, sem `supabase--migration`).
- Governança do catálogo (`PRODUCT_CATALOG_ENTITY_TYPES`) permanece.

## Confirmações antes de executar

1. Mover as 11 tonalidades para **7. Fresagem / 7.2 Insumos** (recomendo), ou manter em **2. CAD / 2.2 SERVIÇO**?
2. Redirect de `/atos-block-caixa-com-5-unidades` → apontar para qual destino?
3. OK em desativar o parent (soft-delete) ao invés de apagar fisicamente?
