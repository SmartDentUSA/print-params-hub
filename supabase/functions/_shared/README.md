# Envio para grupos de WhatsApp — estado em 12/11/2026

## Por onde o envio sai
- O provedor é escolhido pelo dono do grupo: `wa_groups.instance_name` →
  `team_members.evolution_instance_name` → credenciais `evo_go_*` daquele membro.
- O WhatsApp migrou 100% dos participantes dos grupos para identificadores `@lid`.
  A Evolution clássica 2.2.3 (porta 8080) não abre sessão Signal com `@lid`
  (`SessionError: No sessions`), e um único participante sem sessão derruba o envio
  do grupo inteiro. Último envio em grupo bem-sucedido por ela: 11/11 às 03:26.
- **Envio para grupo só funciona pelo Evolution GO** (porta 8081, imagem
  `evolution-go:local-lid`) enquanto a clássica não tratar `@lid`.
- Instância conectada no EvoGo: **`evo_cel_comercial_5516981596947`** (Celular Comercial).

## Admin não é requisito
- Os grupos de público têm `IsAnnounce=false`: qualquer participante posta.
- `postTargetStatus` (`post-group-eligibility.ts`, espelhado em `src/lib/postGroupStatus.ts`)
  e o filtro de `wa-group-blast` exigem só grupo ligado e vinculado ao número.
- Onde `IsAnnounce=true` o próprio WhatsApp recusa e o erro aparece em
  `wa_message_queue.error_message`.

## `wa_group_instance_pin` + `trg_pin_group_instance`
- Algum caminho de pós-envio reescrevia `wa_groups.instance_name` de volta para
  `cs_principal` segundos depois de cada disparo (o 1º post saía, o 2º falhava).
  A causa não foi identificada.
- O trigger `BEFORE INSERT OR UPDATE` em `wa_groups` força `instance_name` ao valor
  fixado em `wa_group_instance_pin` para os grupos listados (52 em 12/11/2026).
- A função é `SECURITY DEFINER` com `search_path` fixo, para que um `UPDATE` em
  `wa_groups` feito por qualquer papel não falhe ao ler a tabela de pins. A tabela tem
  RLS: só administradores leem e só o service role altera.
- Os pins são configuração operacional (dados), não schema.

## Ponto único de falha
- Só uma instância está conectada no EvoGo. Se ela cair ou for desvinculada no
  celular, não há rota alternativa. Em 11/11 às 08:43 o `Suporte_tecnico` foi
  desvinculado assim (`<conflict type="device_removed"/>`).
- Redundância: parear um segundo número no EvoGo. Como os grupos aceitam post de
  qualquer participante, basta um número que já seja membro.

## Não mexer
- `wa-dispatcher` não filtra `is_admin` e está correto.
- Disjuntor de sessão: um `SessionError` grava `wa_groups.session_health = 'session_broken'`
  e o grupo passa a ser bloqueado sem tentativa; o cron `wa-warmup-groups-3h` cura sozinho.
- Backups `_bkp_wa_groups_20261111`, `_bkp_post_targets_20261112` e
  `_bkp_inst_config_20261112`: apagar só depois de 30 dias.
