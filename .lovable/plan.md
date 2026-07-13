
## Parte 1 — Modalidades e Categorias de Treinamento

### 1.1 Migração de banco
Adicionar em `lia_attendances` colunas para o painel Stripe:
- `stripe_seller_id uuid` (FK opcional `omie_vendedores.id`)
- `stripe_first_payment_at timestamptz`
- `pre_ativacao_at timestamptz`, `pre_ativacao_status text`
- `ativacao_at timestamptz`, `ativacao_status text`
- `mensalidade_first_due date`, `mensalidade_status text`
- Índices em `stripe_customer_id`, `stripe_subscription_id`

### 1.2 Frontend — modalidades/categorias
- `src/types/courses.ts`: `modality` ganha `'acesso_remoto'`; `category` ganha `'avaliacao_pre_instalacao' | 'ativacao_software'`.
- `src/components/smartops/CourseCreateModal.tsx`: novas entradas em `MODALITY_OPTIONS` e `CATEGORY_OPTIONS`; `isOnline` e `public_enrollment_enabled` passam a incluir `acesso_remoto`.
- `src/components/smartops/CourseCard.tsx` e `TurmaCard.tsx`: `MODALITY_LABEL.acesso_remoto = 'Acesso Remoto'`.
- `src/components/smartops/EnrollmentModal.tsx`: `MODALITY_CONFIG.acesso_remoto` (ícone + rótulo).

---

## Parte 2 — Nova aba "Stripe / Pagamentos" (abaixo de Rayshape)

### 2.1 Sidebar & rota
- `src/components/AdminSidebar.tsx`: inserir logo abaixo de `so-rayshape`:
  `{ id: "so-stripe", title: "Stripe / Pagamentos", icon: CreditCard }`
- `src/pages/AdminViewSecure.tsx`: `case 'so-stripe': return <SmartOpsStripePayments ... />`

### 2.2 Componente `src/components/smartops/SmartOpsStripePayments.tsx`
Consulta única que mescla:
- `stripe_subscriptions` (assinaturas) — status, `current_period_end`, `stripe_customer_id`, `product`, `created_at`
- `lead_activity_log` filtrado por `source_channel='stripe'` e eventos de pagamento — dedupe por `stripe_customer_id`+minuto (mesma lógica já validada nesta thread)
- `lia_attendances` (nome, email, telefone_normalized, stripe_seller_id, pre_ativacao_*, ativacao_*, mensalidade_*)
- `omie_vendedores` para exibir nome do vendedor
- `deals` (fallback de vendedor via `owner_name` do deal mais recente do lead)

Colunas exatamente como pedidas:
Cliente • E-mail • Celular • Data pagamento • Vendedor associado • Data pré-ativação • Status pré-ativação • Data ativação • Status ativação • Vencimento 1ª mensalidade • Status atual da mensalidade

Recursos:
- Busca por nome/email/telefone
- Filtros: status Stripe, status ativação, vendedor
- Edição inline dos campos operacionais (pré-ativação, ativação, mensalidade) via `supabase.from('lia_attendances').update(...)`
- Botão "Abrir lead" → abre `LeadDetailPanel` (mesmo padrão de outras abas)
- Toolbar reusando `TreinamentosToolbar`
- Ícone `CreditCard` do `lucide-react`

Status da mensalidade derivado no cliente a partir de `stripe_subscriptions.status` + `current_period_end` + `cancel_at_period_end`, com labels PT-BR: Ativa • Vence em X dias • Vencida • Cancelada • Trial.

### 2.3 Fora de escopo (próxima iteração)
- Preenchimento automático de `stripe_seller_id` (regras de atribuição a definir com o time comercial)
- Automação de pré-ativação/ativação a partir de webhooks (por ora, edição manual pela aba)
- Alterações em `stripe-webhook` edge function

---

## Ordem de execução
1. Migração (Parte 1.1) — aguardar aprovação.
2. Edições de tipos + modais de curso (Parte 1.2).
3. Sidebar + rota + `SmartOpsStripePayments.tsx` (Parte 2).
4. Verificação: abrir `/admin?section=so-stripe`, conferir tabela contra os 13 pagamentos já identificados.
