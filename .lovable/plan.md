# Fix prefixo "🤖 Novo Lead - Dra. L.I.A." → "📊 Análise SmartOps"

## Diagnóstico (confirmado)

O envio para vendedores hoje (23/07 03:00–04:01) veio de uma **edge function fantasma**: `smart-ops-lia-notify-seller` (v32) — está **deployada no Supabase mas não existe no repositório git**.

Evidências:
- `message_logs` últimas 3h: 11 registros `tipo=briefing_vendedor`, `evolution_instance=Danilo Henrique`, todos começando com `🤖 *Novo Lead - Dra. L.I.A.*`.
- Edge function logs: `[notify-seller v32] Lock existente lead=41d59e99...`  — função ativa e chamada por `smart-ops-lia-assign/index.ts:4456`.
- `grep` no repo por `smart-ops-lia-notify-seller`: só aparece como **caller**, nunca como definição. A pasta `supabase/functions/smart-ops-lia-notify-seller/` não existe.
- `_shared/waleads-messaging.ts:310` e `smart-ops-lia-assign/index.ts:1406` já usam `📊 *Análise SmartOps*` — porém esses call-sites não são executados; quem manda é a função fantasma.

Por isso o "fix" anterior nunca chegou nos vendedores: mudamos o código do repo, mas a função que realmente envia está fora do repo.

## Escopo

1. **Criar `supabase/functions/smart-ops-lia-notify-seller/index.ts` no repo** (Lovable Cloud faz deploy automático e sobrescreve a versão fantasma v32).
2. A nova função reproduz o comportamento atual (dedup por lock, envio via Evolution instância "Danilo Henrique", log em `message_logs` com `tipo=briefing_vendedor`), mas **delega a construção do texto a `buildSellerNotification` do `_shared/waleads-messaging.ts`** — que já usa `📊 *Análise SmartOps*`.
3. Nada mais é alterado — o caller em `smart-ops-lia-assign` continua igual.

## Detalhes técnicos

Arquivo novo: `supabase/functions/smart-ops-lia-notify-seller/index.ts`

Contrato de entrada (mantém compatível com o caller atual):
```json
{ "lead_id": "uuid", "team_member_id": "uuid", "trigger": "lia_assign" }
```

Fluxo interno:
1. CORS + JWT skip (usa `SUPABASE_SERVICE_ROLE_KEY`).
2. Lock 90s: `SELECT ... FOR UPDATE` em `message_logs` filtrando por `lead_id`, `tipo IN ('briefing_vendedor','briefing_vendedor_block')`, últimas 24h. Se existir, retorna `{ skipped: true, reason: 'lock' }` (mantém a semântica atual do log "Lock existente").
3. Busca lead em `lia_attendances` e vendedor em `team_members` (`id, nome_completo, whatsapp_number, evolution_instance_name, evolution_api_key`).
4. Chama `buildSellerNotification(lead, supabase)` do shared → texto já com `📊 *Análise SmartOps*`.
5. Envia via Evolution API por instância do vendedor (fallback para instância "Danilo Henrique" se o vendedor não tiver `evolution_instance_name` — como acontece hoje). Segue a regra `mem://integration/evolution-per-instance-credentials`: usa `evolution_api_key`/`evolution_phone` do `team_members`; se faltar, usa `EVO_KEY` global como fallback.
6. Log em `message_logs`:
   ```
   { lead_id, team_member_id, whatsapp_number: seller.whatsapp_number,
     tipo: 'briefing_vendedor', status: 'enviado' | 'erro',
     evolution_instance, mensagem_preview: briefing.slice(0, 900) }
   ```
7. Retorna `{ success, message_preview }`.

## Verificação pós-deploy

1. Rodar reprocess em 1 lead de teste (via `smart-ops-lia-assign` com `trigger=manual`).
2. Query: `SELECT LEFT(mensagem_preview,60) FROM message_logs WHERE tipo='briefing_vendedor' ORDER BY created_at DESC LIMIT 1;` → deve começar com `📊 *Análise SmartOps*`.
3. Confirmar com o usuário que a próxima mensagem real chega correta.

## Fora de escopo

- Não alteramos o formato completo do template (o novo `buildSellerNotification` já é mais rico: inclui análise cognitiva, workflow diagnosis, HISTÓRICO/OPORTUNIDADE via IA). Se quiser preservar o layout antigo (com `🧺`, `📱 wa.me/link` clicável e `🎯` interesse simples) me avise antes que eu implemente — hoje o plano é padronizar no template "SmartOps" já usado no repo.
- Não removemos a chamada em `smart-ops-lia-assign` — só o destino muda de comportamento.
- Não mexemos em `smart-ops-lead-welcome` (função gêmea que manda boas-vindas ao lead — está funcionando).
