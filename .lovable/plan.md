## Problemas

**1. Post recém-publicado não aparece no Dashboard nem no Calendário**

O post criado (`d9aa73d1...`) foi salvo com `publish_now=true`, `status='published'` e `scheduled_at=null`. As queries atuais filtram por `scheduled_at`:

- `useUpcomingPosts` — `.in('status', ['scheduled','publishing','failed'])` + `.gte('scheduled_at', now)`. Posts `published` ou com `scheduled_at=null` são excluídos.
- `useCalendarPosts` — `.gte('scheduled_at', from).lte(...)`. Posts com `scheduled_at=null` somem. A query secundária em `social_posts` (histórico Zernio) só popula depois do sync, então recém-publicados ficam invisíveis até a sincronização.

**2. Biblioteca de Conteúdo vazia**

`sync-content-from-a` depende do segredo `SISTEMA_A_ANON_KEY` (não configurado) para puxar das tabelas internas (`cs_messages`, `aftersales_messages`, etc.) e do `content_bridge` local (também vazio). Resultado: 0 itens. O usuário quer as mensagens de WhatsApp (CS/pós-venda) de cada produto vindas do endpoint público `knowledge-export-full` — o mesmo já usado pelo gerador de legendas.

---

## Plano de correção

### A. Tornar posts publicados visíveis imediatamente

**A1. `useUpcomingPosts`** — incluir publicados recentes como linha do tempo:
- Manter o bloco atual de agendados próximos.
- Adicionar segunda query: `status='published'` ordenado por `updated_at` desc, últimos 7 dias, limit 10. Mesclar e ordenar pela data efetiva (`scheduled_at ?? updated_at`).
- Dashboard exibirá o post recém-enfileirado/publicado sem esperar o sync Zernio.

**A2. `useCalendarPosts`** — não perder posts sem `scheduled_at`:
- No bloco `social_scheduled_posts`, usar `or('scheduled_at.gte.X,and(scheduled_at.is.null,updated_at.gte.X)')` e mapear `effective_at = scheduled_at ?? updated_at` para posicioná-los no calendário (no dia do publish_now).
- Garantir que `status='published'` também entra (hoje só `scheduled|publishing|failed|draft` aparecem porque o segundo bloco depende de `social_posts`, que ainda está vazio).

**A3. Métricas (`useSocialMetrics`)** — confirmar que `published` deste mês conta `social_scheduled_posts.status='published'` além de `social_posts` (ajuste mínimo se necessário).

> Nada do publisher real é alterado; apenas as leituras de exibição.

### B. Reescrever sync de conteúdo para usar `knowledge-export-full`

**B1. Reescrever `supabase/functions/sync-content-from-a/index.ts`**:
- Substituir as chamadas a tabelas internas (que exigem `SISTEMA_A_ANON_KEY`) por `POST` em `https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-export-full` com `{ limit: 500 }`.
- Para cada produto retornado, iterar `messages.cs[]` e `messages.aftersales[]` e gerar linhas para upsert em `system_a_content_library`:
  - `source_table` = `'knowledge_export_cs'` ou `'knowledge_export_aftersales'`
  - `source_id` = `${product.slug}:${m.message_order}` (estável)
  - `product_id`, `product_name`, `product_slug`, `product_category` ← do produto
  - `content_type` = `'cs'` ou `'aftersales'`
  - `channel` = `'whatsapp'`
  - `title` = `${product.name} — Msg ${order}`
  - `content_text` = `m.message_content`
  - `cta_url` = `product.ctas?.product_url || product.product_url`
  - `is_active` = `m.is_active !== false`
  - `content_data` = `{ message_order, raw: m }`
  - `synced_at` = `now()`
- Ingerir também (com `content_type` apropriado, todos `channel='whatsapp'` ou o canal natural):
  - `messages.spin[]` (se existir) → `content_type='spin'`
  - `seo.seo_description` → `content_type='seo'`, `channel='web'` (um por produto)
  - `google_ads` (headlines/descrições) → `content_type='google_ads'`, `channel='ads'` (um por item)
- Manter o bloco de fallback do `content_bridge` para não perder o que já funciona.
- Upsert com `onConflict: 'source_table,source_id,channel'` (índice já existente conforme a função atual).
- Retornar `{ inserted, products_processed, errors }`.

**B2. Sem novas migrações** — esquema atual já suporta tudo. Nenhum segredo novo (endpoint é público).

**B3. UI (`SmartOpsCampaigns › ContentLibrary`)** — sem mudança estrutural; após o sync, o botão "Sincronizar do Sistema A" passa a popular itens (`content_type` 'cs', 'aftersales', etc., filtros existentes já cobrem). Apenas garantir que o seletor `typeFilter` inclui as opções `cs` e `aftersales` (ler trecho de filtros para confirmar e ajustar se necessário).

### C. Validação

- Após deploy, clicar "Sincronizar do Sistema A" → toast com nº inserido > 0; itens com `channel=whatsapp` e mensagens CS/pós-venda aparecem.
- Criar novo post com `publish_now` → aparece imediatamente em Dashboard ("Próximos posts" ou nova seção "Recentes") e no Calendário no dia atual.
- Edge function logs sem erro 4xx.

---

## Fora de escopo

- Não mexer no publisher Zernio nem em schemas.
- Não alterar `social-caption-generator` nem `social-knowledge-fetch` (já funcionam).
- Não criar novos secrets nem novas tabelas.
- Ícones de canal, identidade visual etc. — fora.

## Arquivos afetados

- `src/hooks/social/useUpcomingPosts.ts` — incluir publicados recentes
- `src/hooks/social/useCalendarPosts.ts` — incluir posts `published` com `scheduled_at` nulo via `updated_at`
- `src/hooks/social/useSocialMetrics.ts` — ajuste se necessário (verificar)
- `supabase/functions/sync-content-from-a/index.ts` — reescrita para usar `knowledge-export-full`
- `src/components/SmartOpsCampaigns.tsx` — apenas adicionar opções `cs`/`aftersales` no filtro de tipo se faltarem
