

## Plano: Atualizar smart-ops-sync-piperun com mapeamento expandido

### Problema
O sync usa `mapDealToAttendance()` que mapeia ~20 campos básicos. O webhook usa `extractIds()` + lógica expandida que mapeia ~60+ campos (pessoa, empresa, deal metadata, raw payload). Resultado: leads do sync ficam com `piperun_raw_payload`, `empresa_porte`, `piperun_hash`, `pessoa_rdstation` etc. todos `null`.

### Abordagem
Duas mudanças coordenadas:

**1. Expandir `mapDealToAttendance()` no `_shared/piperun-field-map.ts`**

Adicionar ao mapeamento existente todos os campos que a API retorna (com os `with[]` já usados):

- **Person deep fields**: `pessoa_cpf`, `pessoa_cargo`, `pessoa_genero`, `pessoa_linkedin`, `pessoa_facebook`, `pessoa_observation`, `pessoa_website`, `pessoa_nascimento`, `pessoa_endereco`, `pessoa_hash`, `pessoa_rdstation`
- **Company deep fields**: `empresa_nome`, `empresa_razao_social`, `empresa_cnpj`, `empresa_ie`, `empresa_cnae`, `empresa_website`, `empresa_facebook`, `empresa_linkedin`, `empresa_porte` (size), `empresa_pais` (country), `empresa_email_nf`, `empresa_data_abertura`, `empresa_cnaes`, `empresa_endereco`, `empresa_custom_fields`, `empresa_hash`, `empresa_touch_model`, `empresa_telefone`, `empresa_email`
- **Deal metadata**: `piperun_hash`, `piperun_title`, `piperun_description`, `piperun_observation`, `piperun_deleted`, `piperun_frozen`, `piperun_probability`, `piperun_lead_time`, `piperun_value_mrr`, `piperun_last_contact_at`, `piperun_stage_changed_at`, `piperun_closed_at`, `piperun_probably_closed_at`, `piperun_custom_fields`, `piperun_involved_users`, `piperun_tags_raw`, `piperun_origin_sub_name`
- **Raw payload**: `piperun_raw_payload` = deal object completo

Expandir `PipeRunDealData` interface para incluir os campos adicionais (`hash`, `description`, `observation`, `deleted`, `freezed`, `probability`, `lead_time`, `value_mrr`, `last_contact`, `stage_changed_at`, `probably_closed_at`, `involved_users`, `custom_fields` no nível person/company, `tags`, etc.)

**2. Atualizar `smart-ops-sync-piperun` para buscar proposals**

- Adicionar `"proposals"` ao array `with[]` na chamada `fetchDealsForPipeline`
- Após `mapDealToAttendance()`, chamar a lógica de proposals aggregation (já existe como `parseProposalItems` no shared)
- Manter a lógica existente de person-centric resolution e deals_history upsert

### Arquivos modificados
1. `supabase/functions/_shared/piperun-field-map.ts` — expandir `PipeRunDealData` interface e `mapDealToAttendance()`
2. `supabase/functions/smart-ops-sync-piperun/index.ts` — adicionar `"proposals"` ao `with[]`, usar campos expandidos do `mapDealToAttendance`, gravar `piperun_raw_payload`

### Sem impacto colateral
- `piperun-full-sync` também usa `mapDealToAttendance()`, portanto herda automaticamente os novos campos
- Todos os campos usam `if (value)` pattern, então `null`/`undefined` do API são ignorados sem sobrescrever dados existentes

