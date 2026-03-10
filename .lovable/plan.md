

# Fluxo de Suporte Técnico com Tickets Automatizados — Dra. L.I.A.

## Situação Atual

Hoje, quando o lead menciona um problema técnico, o `isSupportQuestion` intercepta e redireciona imediatamente para WhatsApp com uma mensagem estática. Não há diagnóstico, não há coleta de contexto, e o suporte recebe zero informação prévia.

## Solução: Fluxo Estruturado de Suporte com Ticket Automático

### 1. Novas Tabelas (Migration)

**`technical_tickets`** — Registro de chamados

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | ID interno |
| lead_id | uuid FK→lia_attendances | Lead associado |
| ticket_sequence | integer | Número sequencial do lead |
| ticket_version | char(1) | Letra (A, B, C...) para retornos |
| ticket_full_id | text UNIQUE | Ex: "0000000001-A" |
| equipment | text | Equipamento reportado |
| client_summary | text | Resumo escrito pelo lead |
| ai_summary | text | Resumo gerado pela IA |
| conversation_log | jsonb | Log completo da conversa |
| status | text | open, in_progress, resolved, closed |
| created_at | timestamptz | Criação |
| resolved_at | timestamptz | Resolução |

**`technical_ticket_messages`** — Mensagens do chamado

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| ticket_id | uuid FK→technical_tickets | |
| sender | text | 'client' ou 'ai' |
| message | text | Conteúdo |
| created_at | timestamptz | |

### 2. Mudança no `dra-lia/index.ts`

**Substituir o `support_guard` simples** por um fluxo conversacional controlado via `extracted_entities` na sessão:

```text
Estado na sessão (extracted_entities):
  support_flow_stage: 
    "select_equipment" → "diagnosing" → "awaiting_summary" → "ticket_pending"
  support_equipment: "RayShape Cure D"
  support_answers: { behavior: "...", when: "...", screen_msg: "..." }
```

**Fluxo dentro do interceptor:**

1. Lead seleciona rota "Suporte Técnico" → `support_flow_stage = "select_equipment"`
2. LIA consulta `lia_attendances` para buscar equipamentos registrados do lead (campos `ativo_print`, `ativo_scan`, `ativo_cura`, `impressora_modelo`, `equipamentos_registrados`) e apresenta lista
3. Lead escolhe equipamento → stage = `"diagnosing"`, LIA faz perguntas obrigatórias (qual erro, quando começou, mensagem na tela)
4. Após coletar respostas → stage = `"awaiting_summary"`, LIA pede resumo livre
5. Lead envia resumo → stage = `"ticket_pending"`, ativa timer de 3min via `setTimeout` no inactivity check existente

**Timer de inatividade (3 min):** O sistema já tem inactivity detection. Adicionar lógica: se `support_flow_stage === "ticket_pending"` e 180s sem nova msg → disparar criação do ticket.

### 3. Nova Edge Function: `create-technical-ticket`

Responsabilidades:
1. Buscar dados completos do lead (`lia_attendances` + histórico)
2. Gerar ticket_full_id sequencial (busca último ticket do lead, incrementa versão)
3. Chamar Gemini Flash Lite para gerar resumo técnico estruturado
4. Salvar `technical_tickets` + `technical_ticket_messages`
5. Montar mensagem formatada com todos os dados do lead
6. Enviar para WhatsApp suporte via `smart-ops-send-waleads` (team_member de suporte)
7. Confirmar ao lead no chat: "Seu chamado #0000000001-A foi criado"

### 4. Dados do Lead Consultados

A consulta contextual usa campos já existentes em `lia_attendances`:
- `impressora_modelo`, `ativo_print`, `ativo_scan`, `ativo_cura`
- `lojaintegrada_ultimo_pedido`, `lojaintegrada_ultimo_pedido_valor`
- `proposals_won_data` (produtos de propostas ganhas)
- `astron_courses_total`, `astron_active_courses`
- `historico_resumos` (atendimentos anteriores)
- `total_sessions`, `total_messages`

### 5. Mensagem para o Suporte (WhatsApp)

Formato estruturado com: ticket ID, dados do cliente, equipamentos registrados, compras, cursos, histórico de atendimentos, resumo do cliente, resumo IA, log da conversa, ação recomendada.

### 6. Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Criar tabelas `technical_tickets` e `technical_ticket_messages` |
| `supabase/functions/dra-lia/index.ts` | Substituir `support_guard` por fluxo conversacional com 5 stages. Adicionar lógica de timer 3min para ticket. |
| `supabase/functions/create-technical-ticket/index.ts` | **Nova** edge function para geração de ticket, resumo IA e envio WhatsApp |
| `supabase/config.toml` | Adicionar `[functions.create-technical-ticket]` com `verify_jwt = false` |

