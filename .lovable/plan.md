# Post Grupos — mostrar todas as instâncias ativas

## Problema
`PostGrupos.tsx` lê apenas `post_group_instance_config` (hoje só 3 linhas: `cs_principal`, `Danilo-Henrique`, `Dra. Lia`). Instâncias como `smartdent_marketing` existem em `team_members` mas nunca foram cadastradas nessa tabela, então não aparecem.

## Solução (mesmo formato que Danilo-Henrique já tem hoje)
Auto-provisionar linhas em `post_group_instance_config` no load da página, apenas para instâncias válidas.

### Mudanças
Um único arquivo: `src/components/social/PostGrupos.tsx`.

No início de `load()`, antes de buscar `post_group_instance_config`:

1. `SELECT evolution_instance_name, evolution_phone FROM team_members WHERE ativo = true AND evolution_instance_name IS NOT NULL AND evolution_phone IS NOT NULL`.
2. Deduplicar por `evolution_instance_name` (pegando o primeiro `evolution_phone` encontrado).
3. `SELECT instance_name FROM post_group_instance_config` para descobrir o que já existe.
4. Fazer `INSERT` das faltantes com `{ instance_name, evolution_phone, enabled: false, is_primary: false }`.
5. Seguir com o `SELECT` existente que popula os cards.

### Comportamento resultante
- Cards passam a listar todas as instâncias ativas com telefone (ex.: `smartdent_marketing` aparece).
- Instâncias sem `evolution_phone` (`p`, `t`, `smartdent_marketing` sem telefone) são ignoradas — atendendo ao filtro que você aprovou.
- Novas linhas nascem `enabled=false` para você habilitar manualmente (mesmo padrão da UI atual, sem forçar disparo).
- Linhas já existentes (Danilo/Lia/cs_principal) permanecem intactas — não sobrescreve `enabled`/`is_primary`.

## Fora de escopo
- Não altera schema, edge functions, nem lógica de disparo.
- Não mexe em `wa_groups`/campanhas.
