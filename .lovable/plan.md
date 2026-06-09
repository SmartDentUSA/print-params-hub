## Problema

No Passo 1 do agendamento, o campo aceita o **ID do Deal**. Buscar pelo deal `59620258` retornou 50 deals da RISUS — porque esse número aparece como `deal_id` no `piperun_deals_history` de 3 leads diferentes (lixo de sync), e a `fn_search_deals_for_training` expande **todos** os deals desses leads em vez de devolver só o deal pedido.

## Solução

No ramo não-email da função, marcar cada lead com `match_deal_id` indicando como ele entrou:

- Match via `piperun_id = v_query` → `match_deal_id = NULL` → emite todos os deals daquele lead (caso alguém digite o piperun_id de uma pessoa).
- Match via `deals.piperun_deal_id = v_query` ou `dh->>'deal_id' = v_query` → `match_deal_id = v_query` → emite **apenas** aquele deal específico.

Aplicar o filtro nas duas pernas do `deal_rows`. O `DISTINCT ON (deal_id)` final consolida em 1 linha por deal, preferindo o lead com `updated_at` mais novo (canônico — Raquel, no caso).

Ramo de e-mail permanece inalterado.

## Migração

Recriar `public.fn_search_deals_for_training(text)` reescrevendo só o bloco `ELSE`:

- CTE `leads`: 3 UNIONs, cada um adicionando `match_deal_id` (NULL no match por `piperun_id`; `v_query` nos demais).
- CTE `deal_rows`: cláusulas WHERE recebem `(l.match_deal_id IS NULL OR <deal_id> = l.match_deal_id)` tanto na junção com `deals` quanto na expansão de `piperun_deals_history`.
- Restante (DISTINCT ON, ORDER BY, LIMIT 50, envelope `jsonb_build_object`) idêntico ao atual.

## Validação

- `fn_search_deals_for_training('59620258')` → 1 linha do deal `59620258` (vencedor: lead Raquel, mais recente).
- `fn_search_deals_for_training('18746304')` (deal da RISUS) → só esse deal.
- `fn_search_deals_for_training('<piperun_id de pessoa com N deals>')` → continua retornando os N deals reais.
- Busca por e-mail (`empresa_email`, `astron_email`, etc.) inalterada.
