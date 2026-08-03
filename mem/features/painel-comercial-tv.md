---
name: Painel Comercial (TV)
description: Dashboard de TV em /painel-comercial lê apenas painel_comercial_cache, atualizado por cron a cada 15 min
type: feature
---
Rota `/painel-comercial` (sem anotações na tela, badges ok/parcial/gap por bloco).

Regras:
- O painel NUNCA consulta `deals` / `piperun_stage_transitions` / `v_bi_*` diretamente: 971k+ transições estouram o statement timeout do PostgREST. Toda leitura passa pelas RPCs `painel_comercial_kpis_cache`, `painel_comercial_funil`, `painel_comercial_vendedores`, `painel_comercial_atividades`, `painel_comercial_origens`, `painel_comercial_top_produtos`, que apenas leem `public.painel_comercial_cache`.
- `public.painel_comercial_refresh(p_mes)` recalcula os 6 blocos; cron `painel-comercial-refresh` roda a cada 15 min.
- Fontes: receita do mês = `v_receita_mensal`; produtos/equip vs insumos = `vw_produtos_faturados` (Omie) casado com `product_taxonomy` via `painel_match_taxonomy`; funil/tempos = `piperun_stage_transitions` (últimos 90 dias) + `deals`; atividades/reuniões = `v_bi_atividades_unnested`.
- `piperun_stage_transitions.deal_status` é INTEGER (0/1), não texto: perda por etapa vem de `deals.status = 'perdida'`.
- Trajetória contínua: leads reativados = deal novo em Vendas para lead com deal anterior em Estagnados; nunca sobrescreve histórico.