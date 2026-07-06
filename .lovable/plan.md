## Diagnóstico rápido

- `wa_groups` ainda está parado em `Danilo-Henrique`: 298 grupos, último `synced_at` em 25/06, 0 atualizados nas últimas 24h.
- A função nova `smart-ops-evogo-groups-webhook` não recebeu chamadas recentes: não há logs nem tráfego registrado.
- O webhook que já existe para grupos (`sentinela-webhook-receiver`) recebe mensagens, mas hoje só registra mensagem e, quando o grupo não existe, apenas loga `wa_groups not found`; ele não cria/atualiza `wa_groups`.
- Há risco de alias: `sentinela-webhook-receiver` grava como `Danilo Henrique`, enquanto a UI e os grupos atuais usam `Danilo-Henrique`.
- `wa_groups.name` é obrigatório; o webhook novo pode falhar se o payload trouxer apenas `@g.us` sem nome.

## Plano de correção

1. **Usar o webhook que já recebe eventos como fonte de descoberta**
   - Atualizar `sentinela-webhook-receiver` para fazer upsert em `wa_groups` sempre que chegar mensagem de grupo `@g.us`.
   - Normalizar qualquer alias (`Danilo Henrique`, `Danilo-Henrique`, etc.) para o nome canônico `Danilo-Henrique`.

2. **Criar/atualizar grupo de forma segura**
   - Se o grupo ainda não existir, criar em `wa_groups` com:
     - `group_jid`
     - `instance_name = Danilo-Henrique`
     - `name` vindo do payload quando existir; senão usar fallback técnico baseado no JID
     - `ativo = true`, `enabled = true`, `is_admin = true`
     - `synced_at` e `updated_at` atuais
   - Se já existir, atualizar `synced_at`, `updated_at`, `instance_name` canônico e preencher nome/foto quando vierem melhores.
   - Preservar campanha ativa, enabled, histórico e configurações existentes.

3. **Fortalecer o webhook EvoGo dedicado**
   - Ajustar `smart-ops-evogo-groups-webhook` com a mesma normalização e fallback de nome obrigatório.
   - Trocar a lógica para respeitar a unicidade atual por `group_jid`, evitando conflito quando o mesmo grupo aparece com alias diferente de instância.

4. **Melhorar retorno/logs operacionais**
   - Logar quantos grupos foram descobertos/atualizados por payload.
   - Registrar quando veio payload sem grupo, para facilitar auditoria.

5. **Validar após implementação**
   - Enviar um payload de teste controlado para confirmar que um grupo novo aparece em `wa_groups` como `Danilo-Henrique`.
   - Consultar o banco para confirmar `synced_at` atualizado.
   - Conferir logs das funções.

## Resultado esperado

A lista da UI passa a atualizar com os grupos reais conforme mensagens/eventos chegam da instância Danilo-Henrique no EvoGo, sem depender do endpoint inexistente de listagem de grupos do EvoGo.