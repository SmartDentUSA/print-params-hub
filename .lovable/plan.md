

## Diagnostico dos Problemas no Envio WaLeads

Analisei o codigo e os dados. Existem **3 bugs criticos**:

### Bug 1: `send-waleads` sempre retorna HTTP 200
A funcao `smart-ops-send-waleads` retorna `status: 200` mesmo quando a API WaLeads rejeita a mensagem (linha 149-158). Por isso, o `dra-lia` sempre marca o `escalation_vendedor` como "enviado", mesmo quando o WaLeads retornou `INVALID_PHONE_NUMBER`.

Prova: O caso "Teste 01" tem `escalation_vendedor=enviado` mas `waleads_text=erro (INVALID_PHONE_NUMBER)`.

### Bug 2: Auto-mensagem (FROM seller TO seller)
A escalation envia a notificacao PARA o `teamMember.whatsapp_number` USANDO a `waleads_api_key` do MESMO membro. Ou seja, WaLeads tenta enviar do celular da Patricia PARA o celular da Patricia. Isso pode nao funcionar ou aparecer apenas como "nota" no WhatsApp.

### Bug 3: Falta de logging detalhado
Nao ha log do phone e message exatos enviados ao WaLeads, dificultando debug.

---

## Plano de Correcao

### 1. Corrigir `smart-ops-send-waleads` para retornar status HTTP real
- Quando WaLeads retorna erro, retornar HTTP 4xx (nao 200)
- Isso faz o `dra-lia` detectar falhas corretamente

### 2. Adicionar logging detalhado no `send-waleads`
- Logar phone exato, message (primeiros 100 chars), e resposta WaLeads completa
- Incluir o `apiBody` enviado

### 3. Corrigir escalation no `dra-lia` para ler o response body
- Mesmo com HTTP 200, verificar `success` no JSON de retorno
- Marcar como "erro" quando `success=false`

### 4. Resolver o problema de auto-mensagem
- Opcao: usar um team_member diferente (ex: numero da empresa) para enviar TO o vendedor
- Ou: adicionar campo `notification_phone` separado no `team_members` para receber notificacoes

---

## Arquivos a editar

| # | Arquivo | Mudanca |
|---|---------|---------|
| 1 | `supabase/functions/smart-ops-send-waleads/index.ts` | Retornar HTTP real + logging detalhado |
| 2 | `supabase/functions/dra-lia/index.ts` (linhas 2222-2256) | Verificar `success` no response body, nao so HTTP status |

## Detalhes tecnicos

**send-waleads**: Mudar linha 149 de `status: 200` para `status: waRes.ok ? 200 : waRes.status`. Adicionar `console.log` com phone, message preview, apiBody antes da chamada fetch.

**dra-lia escalation**: Apos `sendResp.ok`, fazer `const sendResult = await sendResp.json()` e verificar `sendResult.success === true` antes de marcar como "enviado".

