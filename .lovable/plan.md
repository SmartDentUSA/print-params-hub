
## Plano: Remover WaLeads e Integrar SellFlux

### Contexto

Voce ja tem o SellFlux integrado com a Loja Integrada e recebe as vendas la. O objetivo agora e usar o SellFlux como canal de automacao para os leads/clientes, substituindo completamente o WaLeads. O SellFlux usa **template_id** (templates criados no painel deles) e um **Bearer Token global**, diferente do WaLeads que usava API Key por vendedor e texto livre.

### Inventario de Arquivos Afetados

```text
DELETAR
├── supabase/functions/smart-ops-send-waleads/index.ts       → Funcao inteira removida

CRIAR
├── supabase/functions/smart-ops-send-sellflux/index.ts      → Nova edge function

MODIFICAR (Backend)
├── supabase/functions/smart-ops-cs-processor/index.ts        → Remover bloco WaLeads, chamar SellFlux

MODIFICAR (Frontend)
├── src/components/SmartOpsCSRules.tsx                        → Trocar WaLeads → SellFlux (template_id + canal)
├── src/components/SmartOpsTeam.tsx                           → Remover waleads_api_key, trocar teste
├── src/components/smartops/WaLeadsVariableBar.tsx            → Renomear → SellFluxVariableBar.tsx
├── src/components/smartops/WaLeadsMediaPreview.tsx           → Renomear → MediaPreview.tsx

SEM ALTERACAO
├── supabase/functions/smart-ops-stagnant-processor/index.ts  → Usa apenas ManyChat, sem WaLeads
├── src/components/SmartOpsSellerAutomations.tsx              → Sem referencias WaLeads
```

### Detalhes Tecnicos

#### 1. Secret necessario
- `SELLFLUX_API_TOKEN` — Bearer token da API SellFlux (global, nao por vendedor)

#### 2. Nova edge function `smart-ops-send-sellflux`
```text
POST body:
  channel: "whatsapp" | "sms" | "email"
  phone: "+5511999999999"        (para whatsapp/sms)
  email: "x@y.com"              (para email)
  template_id: 123               (obrigatorio — template criado no painel SellFlux)
  data: { nome: "X", produto: "Y" }  (variaveis para o template)
  lead_id: "uuid"               (opcional, para buscar dados do lead automaticamente)
  test_mode: false

Endpoint SellFlux:
  POST https://apis.sellflux.app/automation/v1/{channel}/phone
  Authorization: Bearer <SELLFLUX_API_TOKEN>
  Body: { data: {...}, template_id: N, phone: "..." }

Log em message_logs com tipo: sellflux_whatsapp, sellflux_sms, sellflux_email
```

Se o secret `SELLFLUX_API_TOKEN` nao estiver configurado, retorna erro informativo sem quebrar.

#### 3. Atualizar `smart-ops-cs-processor`
- Remover constante `WALEADS_BASE_URL` e todo o bloco de envio WaLeads (linhas 8, 117-201)
- Substituir por chamada interna ao endpoint SellFlux usando `fetch` para a propria edge function `smart-ops-send-sellflux`
- Reutilizar campos existentes do banco: `waleads_ativo` → semanticamente "sellflux ativo", `waleads_tipo` → `channel`

#### 4. Frontend — `SmartOpsCSRules.tsx`
- Trocar label "WaLeads" por "SellFlux"
- Remover campo de mensagem de texto livre (SellFlux usa templates)
- Remover campos `waleads_media_url` e `waleads_media_caption`
- Adicionar campo "Template ID" (numerico, obrigatorio quando SellFlux ativo)
- Adicionar seletor de Canal: WhatsApp / SMS / Email
- Manter referencia visual das variaveis disponiveis (para o usuario saber o que configurar no template SellFlux)
- Atualizar imports: `WaLeadsVariableBar` → `SellFluxVariableBar`, `WaLeadsMediaPreview` → removido do form

#### 5. Frontend — `SmartOpsTeam.tsx`
- Remover campo `waleads_api_key` do formulario de membro (SellFlux usa token global)
- Remover botao "Testar WL" e dialog de teste WaLeads
- Adicionar botao "Testar SellFlux" que chama `smart-ops-send-sellflux` com `test_mode: true`
- Remover badge "WL" da coluna Integracoes

#### 6. Renomear componentes
- `WaLeadsVariableBar.tsx` → novo arquivo `SellFluxVariableBar.tsx` com exports renomeados
- `WaLeadsMediaPreview.tsx` → novo arquivo `MediaPreview.tsx` (generico, sem referencia a WaLeads)
- Deletar os arquivos antigos

#### 7. Banco de dados
Nenhuma migracao SQL necessaria. Os campos `waleads_*` na tabela `cs_automation_rules` serao reutilizados semanticamente:
- `waleads_ativo` → indica se SellFlux esta ativo na regra
- `waleads_tipo` → armazena o canal (`whatsapp`, `sms`, `email`)
- `mensagem_waleads` → armazena o `template_id` (como string)
- `waleads_media_url` e `waleads_media_caption` → nao utilizados (ignorados)

O campo `team_members.waleads_api_key` permanece no banco mas nao sera mais exibido na UI.

### Fluxo Apos Implementacao

```text
Admin cria template no painel SellFlux
  ↓ recebe template_id (ex: 42)
Admin cria regra no Smart Ops
  ↓ Trigger: "ganho", Canal: "whatsapp", Template ID: 42, SellFlux: ✓
cs-processor roda (cron ou manual)
  ↓ encontra lead com status "ganho" + regra ativa
  ↓ chama smart-ops-send-sellflux
     ↓ POST apis.sellflux.app/automation/v1/whatsapp/phone
        { data: { nome, produto_interesse, ... }, template_id: 42, phone: "+55..." }
  ↓ registra em message_logs
```
