# Step 2 — Renomear "Produto âncora" → "Produto de Interesse" + correções

## Diagnóstico

1. **Step 2 funciona**: a contagem de leads roda em tempo real via `useEffect` (`SmartOpsCampaigns.tsx:384-418`) consultando `lia_attendances` com todos os filtros aplicados, respeitando `merged_into IS NULL`. O botão "Próximo" só destrava quando há leads (`leadCount > 0`).

2. **Filtro "Produto âncora" usa a coluna errada para o que o usuário quer**: hoje filtra `anchor_product` (campo derivado/agregado). O campo que o time popula via formulários e CRM é **`produto_interesse`** (e seu agregado `produto_interesse_auto`), conforme as memórias de Behavioral Ingestion e Form Enrichment.

3. **Bug residual do passo anterior**: `handleCreate` (linha 421) ainda exige `selectedContent`, e a inserção em `campaign_sessions` força `content_id`/`content_type`. Como agora o conteúdo é opcional, isso quebra ao tentar criar.

## Mudanças (apenas `src/components/SmartOpsCampaigns.tsx`)

### A. Rótulo + fonte de dados
- Trocar label `"Produto âncora"` → `"Produto de Interesse"`.
- Trocar a coluna fonte das opções de `anchor_product` → `produto_interesse` (com fallback `produto_interesse_auto` quando o primeiro estiver vazio).
- Trocar o filtro de contagem de `ilike("anchor_product", …)` → `or("produto_interesse.ilike.%X%,produto_interesse_auto.ilike.%X%")` para casar ambos os campos.
- Persistir em `lead_filters.produto_interesse` (em vez de `anchor_product`) — chave nova, sem migração.
- Renomear estado `anchorProduct/anchorOptions` → `produtoInteresse/produtoInteresseOptions` para clareza.

### B. Step 3 (Revisar)
- Atualizar o badge de filtros para usar o novo rótulo "Produto: X".

### C. Permitir criar sem conteúdo
- Em `handleCreate`: remover `if (!selectedContent) return;`, manter só `!campaignName.trim()`.
- No insert: `content_id: selectedContent?.id ?? null`, `content_type: selectedContent?.content_type ?? null`.

## Fora de escopo
- Nenhuma mudança no backend, no schema ou no edge function de disparo.
- Nenhuma mudança nos demais filtros (especialidade, UF etc.).
