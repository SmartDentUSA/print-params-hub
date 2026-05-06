## Plano: Corrigir vulnerabilidades críticas do scan de segurança

Dois grupos de findings críticos detectados pelo scanner Supabase:

1. **RLS Disabled in Public** — 9 tabelas
2. **Security Definer View** — 60 views

Tudo será resolvido em **uma única migration SQL** (sem alterações de código no frontend/edge functions), pois nenhuma dessas tabelas/views é consumida pelo cliente anônimo — todas servem dashboards admin (que já passam por `is_admin()`) ou pipelines internos rodando com `service_role`.

---

### Parte 1 — RLS Disabled (9 tabelas)

| Tabela | Tratamento |
|---|---|
| `_backup_qid_migration_20260427` | **DROP TABLE** (backup obsoleto de migração já aplicada) |
| `_backup_qid_migration_aux_20260427` | **DROP TABLE** |
| `_backup_category_f_20260427` | **DROP TABLE** |
| `vitality_gen_control` | ENABLE RLS + policy `service_role only` (controle interno de geração de conteúdo) |
| `produto_aliases` | ENABLE RLS + policy `service_role` para escrita, `is_admin()` para leitura |
| `system_a_content_library` | ENABLE RLS + `service_role` (full) + `is_admin()` (select) |
| `google_indexing_log` | ENABLE RLS + `service_role` (full) + `is_admin()` (select) |
| `kg_entities` | ENABLE RLS + `service_role` (full) + `is_admin()` (select) — knowledge graph interno |
| `kg_relations` | ENABLE RLS + `service_role` (full) + `is_admin()` (select) |

Antes de DROPar os 3 backups, faço um `SELECT count(*)` de validação na migration (comentado) e confirmo que não há FK apontando para eles.

### Parte 2 — Security Definer Views (60 views)

Todas as 60 views listadas serão **recriadas com `WITH (security_invoker = true)`**. Isso faz com que a view passe a respeitar as permissões e RLS do **usuário que consulta**, em vez de rodar com privilégios do owner (postgres). Comportamento idêntico do ponto de vista funcional, pois:

- Views consumidas pelo painel admin → o admin lê via JWT autenticado e passa nas RLS das tabelas-base (`lia_attendances`, `piperun_deals_history` etc., que já têm policies `is_admin()` ou `authenticated_full_access`).
- Views consumidas por edge functions → rodam com `service_role`, que ignora RLS de qualquer forma.

Estratégia técnica: para cada view, executo `ALTER VIEW public.<nome> SET (security_invoker = true);` (Postgres 15+, suportado no Supabase). Isso evita ter que reescrever 60 definições — mantém o SQL da view intacto e só inverte o modo de execução.

Lista completa das 60 views (do scan): `v_equipment_field_map`, `v_produtos_vendidos`, `vw_alertas_faturamento`, `v_h2_as_questions`, `v_content_library_by_product`, `vw_vendas_ganhas`, `v_receita_por_categoria`, `vw_saude_leads`, `v_phone_duplicates`, `vw_leads_qualidade_ruim`, `v_workflow_portfolio`, `v_customer_graph`, `v_lead_commercial`, `v_open_opportunities`, `v_pipeline_atual`, `v_portfolio_mensal_comparativo`, `v_lead_cognitive`, `v_form_health`, `v_person_company_graph`, `v_portfolio_em_aberto_por_vendedor`, `vw_vendas_por_produto`, `v_portfolio_ganhos_vs_pipeline`, `vw_reconciliacao_financeira`, `v_parameter_ranking`, `v_lead_financeiro`, `v_lead_ecommerce`, `vw_deal_items_dedup`, `v_omie_nfs_sem_deal`, `v_leads_pendentes_atribuicao`, `lead_model_routing`, `v_opportunity_engine`, `vw_faturamento_consolidado`, `v_turmas_com_vagas`, `v_form_responses_enriched`, `v_portfolio_historico`, `v_lead_timeline`, `vw_dashboard_financeiro`, `company_ltv`, `v_receita_mensal`, `v_deal_items_normalized`, `v_leads_correto`, `v_behavioral_health`, `vw_produtos_faturados`, `vw_leads_orfaos_recentes`, `v_portfolio_mensal_com_abertos`, `v_portfolio_mensal`, `vw_omie_vendas_mes`, `v_workflow_timeline`, `v_portfolio_em_aberto`, `v_timing_alerts`, `v_lead_academy`, `v_receita_mensal_total`, `person_ltv`, etc.

Caso alguma view específica precise mesmo do owner-bypass (ex: agregações sobre `auth.users`), eu abro uma exceção pontual e documento na security memory — mas a expectativa é que **todas** funcionem com `security_invoker=true`.

### Parte 3 — Marcar findings como Fixed + atualizar Security Memory

Após a migration:
- Chamar `manage_security_finding` para marcar `SUPA_rls_disabled_in_public` e `SUPA_security_definer_view` como `mark_as_fixed`.
- Atualizar `@security-memory` com:
  - Padrão para futuras views: sempre criar com `WITH (security_invoker=true)`.
  - Política para tabelas internas: RLS habilitado + `service_role` para escrita + `is_admin()` para leitura.
  - Backups obsoletos devem ser dropados após validação, não mantidos com RLS desabilitado.

### Findings de severidade menor (não inclusos nesta rodada)

Permanecem como `warn`/`info` e não bloqueiam: `leaked_password_protection_disabled`, `vulnerable_postgres_version`, `function_search_path_mutable`, `extension_in_public`, `rls_enabled_no_policy` (4 tabelas). Posso atacá-los em uma segunda rodada se você quiser — diga "fix the warnings too".

### Arquivos afetados
- **1 nova migration**: `supabase/migrations/<timestamp>_fix_rls_and_definer_views.sql`
- **`@security-memory`**: atualizado via `update_memory`
- Nenhum código TS/TSX alterado.