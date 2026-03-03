

# Plano: Histórico de Mensagens no Card do Lead

## O que será feito

Adicionar duas seções colapsáveis no `KanbanLeadDetail` que carregam e exibem o histórico de mensagens da tabela `message_logs`, filtrado pelo `lead_id`:

1. **Sistema → Vendedor**: tipos `escalation_vendedor`, `escalation_especialista`, `escalation_cs_suporte`, `ecommerce_order_created`
2. **Vendedor → Lead**: tipos `handoff_seller_to_lead`, `handoff_unanswered`, `proactive_primeira_duvida`, `waleads_text`, `sellflux_text`

## Dados disponíveis

A tabela `message_logs` já contém todos os dados necessários:
- `lead_id` (UUID) — para filtrar por lead
- `tipo` — para separar mensagens sistema→vendedor vs vendedor→lead
- `mensagem_preview` — texto da mensagem
- `status` — enviado/erro/pendente
- `data_envio` — timestamp
- `team_member_id` — quem enviou
- `whatsapp_number` — destino

## Implementação

### Arquivo: `src/components/smartops/KanbanLeadDetail.tsx`

1. Adicionar `useEffect` com query ao Supabase quando `lead` muda — buscar `message_logs` filtrado por `lead_id`, ordenado por `data_envio DESC`, limit 50
2. Separar mensagens em dois arrays por `tipo`
3. Renderizar duas seções `Collapsible` após a seção "Origem & Meta":
   - **📨 Sistema → Vendedor** — mostra cada mensagem com data, status badge, preview truncado
   - **💬 Vendedor → Lead** — mesma estrutura
4. Cada mensagem mostra: data formatada, badge de status (verde=enviado, vermelho=erro), e `mensagem_preview` truncado em 200 chars com expand on click

### Componentes utilizados
- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` (já existem em `ui/collapsible.tsx`)
- `Badge` para status
- `ChevronDown` icon do lucide

Nenhuma mudança de banco de dados necessária — a tabela `message_logs` já tem RLS `admin_only` configurada.

