# Post Grupos — alinhar com Campanhas WA (mesma fonte de instâncias)

## Diferença encontrada
- **Campanhas WA grupos** (`SmartOpsWaGroupCampaigns.tsx`, linhas 92-133): lista instâncias de `team_members` onde `ativo=true` e `evolution_instance_name IS NOT NULL`. **Não exige `evolution_phone`.**
- **Post Grupos** (`PostGrupos.tsx` após a última mudança): mesma consulta, porém com filtro extra `evolution_phone IS NOT NULL` — por isso `smartdent_marketing` (que está sem telefone em `team_members`) não aparece.

## Mudança
Um único arquivo: `src/components/social/PostGrupos.tsx`.

No auto-provisionamento dentro de `load()`:

1. Remover o filtro `.not('evolution_phone', 'is', null)`.
2. Passar a deduplicar apenas por `evolution_instance_name` (trim, ignora vazio).
3. `evolution_phone` continua sendo gravado quando existir; quando não existir, insere `null`. O card do `PostGruposInstanceCard` já trata `evolution_phone: string | null`.
4. Manter o insert só das instâncias que ainda não existem em `post_group_instance_config`, com `enabled=false`, `is_primary=false`.

## Resultado
- `smartdent_marketing` aparece no Post Grupos com os mesmos 3 grupos ativos que já estão em `wa_groups` (`v_post_group_targets_detail` já filtra por `instance_name`).
- Qualquer outra instância presente nas campanhas WA passa a aparecer também.
- Linhas existentes (Danilo/Lia/cs_principal) permanecem intactas.

## Fora de escopo
- Não altera schema, RLS, edge functions.
- Não força `enabled=true`; você habilita cada instância manualmente no card.
