## Objetivo

Quando o lead do ManyChat termina a qualificação (nome → email → telefone → produto → modelo → área → especialidade), o bridge deve **dispará-lo no mesmo pipeline de criação de lead usado pelos formulários** (`smart-ops-ingest-lead` → SellFlux → `smart-ops-lia-assign` → PipeRun Person+Deal) e responder **uma única mensagem final de handoff**:

> "Em instantes alguém do nosso time vai te chamar no WhatsApp."

Sem mais menu de 4 rotas (1–4), sem loop.

## Mudanças

### 1. `supabase/functions/manychat-lia-bridge/index.ts`

**a) Substituir o "passo 5" (perfil completo)** pelo handoff:
- Remover o `replyWithRoutes(...)` e qualquer reenvio do menu 1–4.
- Quando todos os campos estiverem preenchidos:
  1. Verificar flag `entities.handoff_dispatched === true` na sessão → se já enviado antes, apenas re-emite a mensagem final (idempotente, evita loop em re-deliveries do ManyChat).
  2. Caso contrário, montar payload e chamar `smart-ops-ingest-lead` via `supabase.functions.invoke("smart-ops-ingest-lead", { body: payload })`.
  3. Marcar `handoff_dispatched=true`, `handoff_at=now`, `current_state="handoff"` em `agent_sessions`.
  4. Logar `manychat_handoff_dispatched` (sucesso) ou `manychat_handoff_error` (falha — não bloqueia resposta).
- Responder com `textReply` único:
  ```
  Perfeito, {firstName}! ✅
  Recebi suas informações.
  Em instantes alguém do nosso time vai te chamar no WhatsApp. 📱
  ```

**b) Payload enviado a `smart-ops-ingest-lead`** (mesma forma de um form):
```ts
{
  source: "instagram_manychat_autoatendimento",
  form_name: "Instagram - Autoatendimento ManyChat",
  form_purpose: "qualificacao_inbound",
  commercial_override: true,            // habilita criação de Deal no PipeRun
  origem_primeiro_contato: "Instagram - autoatendimento",

  nome: nomeAtual,
  email: emailAtual,
  telefone: phoneAtual,                 // ingest aceita "telefone"/"phone"
  whatsapp: phoneAtual,

  area_atuacao: areaAtual,
  especialidade: especialidadeAtual,
  produto_interesse_auto: productCanonNow,
  produto_interesse_raw: lead.produto_interesse_raw, // já "canonical | modelo"
  modelo_interesse: modeloAtual,

  manychat_subscriber_id: subscriberId,
  lia_attendance_id: lead.id,           // permite ao ingest fazer merge no canônico
  platform_lead_id: `mc_${subscriberId}`,
}
```

**c) Limpeza do menu de rotas legado**: deletar/desabilitar `replyWithRoutes` no fluxo principal. Manter helper apenas se outras chamadas dependerem; senão remover do arquivo.

**d) Tratamento de mensagens depois do handoff**: se `handoff_dispatched=true` e o usuário continuar mandando mensagens livres, o bridge responde a mesma mensagem final (não dispara ingest de novo). Não há mais menu para parsear.

### 2. `smart-ops-ingest-lead` — verificação de compatibilidade

Já aceita:
- `form_name` / `commercial_override` (Commercial Intent Guard liberará Deal).
- Identidade por email + telefone → vai resolver com o lead canônico criado pelo bridge (mesmo `manychat_subscriber_id`).
- Campos extras (area, especialidade, modelo) caem em `form_data` JSONB (Form Catch-All) sem precisar de migration.

**Nenhuma alteração no ingest é necessária**. Caso o merge no canônico não aconteça pelo email sintético `mc_{id}@instagram.lead`, o `lia_attendance_id` enviado no payload força o ingest a atualizar o lead existente em vez de criar duplicado (já é comportamento do `mergeSmartLead`/`validateLeadIdentity`).

### 3. Sem migration de banco

Todos os campos já existem em `lia_attendances`. `agent_sessions.extracted_entities` é JSONB livre — novos flags entram direto.

## Validação

1. `curl` no bridge simulando subscriber novo: responde nome → email → telefone → "1" → "2" → "1" → "1" → handoff.
2. Conferir nos logs `manychat_handoff_dispatched` + log do `smart-ops-ingest-lead` com `form_name="Instagram - Autoatendimento ManyChat"`.
3. Conferir em `lia_attendances`: lead com `piperun_id`, `pessoa_piperun_id`, `crm_creation_blocked=false`, e Deal criado no funil de vendas (via lia-assign).
4. Re-enviar mensagem após handoff → bridge responde a frase final sem chamar ingest de novo (idempotência).
5. Lead com perfil já completo desde o início (re-engajado) → também dispara handoff uma única vez.

## Não muda

- Sequência de qualificação (já implementada).
- Persistência incremental campo a campo.
- Mapeamento ManyChat (`$.reply → chatgpt_resposta`).
- Lógica de PipeRun, SellFlux, lia-assign (reusados via ingest).
