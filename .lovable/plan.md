## Objetivo

Criar uma nova seção **"Automações LIA"** em `SmartOps → Automações` (componente `SmartOpsCSRules.tsx`), abaixo da listagem de automações por vendedor, com cards configuráveis para automações disparadas pela LIA (Boas-vindas ao Lead e Briefing ao Vendedor), reusando o design system existente (shadcn/ui, Tailwind, tokens semânticos).

## O que será construído

### 1. Nova tabela `lia_automations` (Supabase)

Armazena a configuração de cada automação. Migration cria a tabela + seed das 2 automações iniciais.

Colunas:
- `id uuid pk`, `slug text unique` (`boas_vindas_lead`, `briefing_vendedor`)
- `nome text`, `subtitulo text`, `icone text`, `cor text` (tokens: `blue`, `green`)
- `trigger_event text` (ex: `lead_assigned_to_seller`)
- `trigger_tags text[]` (chips exibidas no card)
- `canal text` (`whatsapp`), `horario_inicio time`, `horario_fim time`
- `mensagem_horario_comercial text`, `mensagem_fora_horario text`
- `ativo boolean default true`
- `function_name text` (referência ao `system_health_logs.function_name` para contar disparos — ex: `lia-welcome`, `lia-briefing`)
- `short_link_tag text` (filtro em `short_links` para contar cliques)

RLS: leitura/escrita restrita a admins (mesmo padrão de `cs_automation_rules`).

### 2. Edge function `automacoes-lia`

Endpoints (mesma function, roteados por método):
- `GET /functions/v1/automacoes-lia` → retorna lista com:
  - dados da automação
  - `enviadas_hoje`, `enviadas_total` (count em `system_health_logs` filtrando por `function_name` e `severity='info'`)
  - `cliques` (sum de `click_count` em `short_links` por `produto`/tag ou janela de tempo) e `taxa = cliques/enviadas`
- `PUT /functions/v1/automacoes-lia` body `{ id, ativo }` → toggle
- `PATCH /functions/v1/automacoes-lia` body `{ id, ...campos }` → editar mensagens/horários

### 3. Frontend — `SmartOpsLiaAutomations.tsx` (novo componente)

Renderizado dentro de `SmartOpsCSRules.tsx`, abaixo da listagem de regras por vendedor.

**Header da seção:**
- Ícone `Bot` (lucide) + título "Automações LIA" + `Badge` "N ativas"
- Botão `+ Nova automação` à direita (abre `Dialog` — inicialmente desabilitado/coming soon, ou cria entrada vazia)

**Card de automação (um por item):**
- Header do card:
  - Ícone colorido (`MessageSquareDot` para boas-vindas, `FileText` para briefing) com fundo `bg-blue-50/bg-green-50`
  - Nome + subtítulo
  - `Switch` ativo/inativo (PUT)
- Linha de métricas (grid 4 colunas, mesmo padrão do `SmartOpsSellerAutomations`):
  - Enviadas hoje | Total | Cliques | Taxa (%)
- Body:
  - Linha "Gatilho:" com `Badge`s das `trigger_tags`
  - `Tabs` com `Horário comercial` / `Fora do horário` mostrando preview da `mensagem_*` via `<HighlightVariables />` (já existe em `WaLeadsVariableBar.tsx`)
- Footer:
  - Texto pequeno: `08:00–18:00 · WhatsApp`
  - Botão `Editar` (abre `Dialog` com `Textarea` por variante + `WaLeadsVariableBar` para inserir variáveis)

**Integração:**
- Em `SmartOpsCSRules.tsx`, importar e renderizar `<SmartOpsLiaAutomations />` no final do JSX principal, separado por `<Separator />`.

### 4. Disparo real (fora do escopo do card visual, observação)

Os disparos efetivos de `lia-welcome` / `lia-briefing` já podem ser registrados em `system_health_logs` pelas functions existentes (ex: `smart-ops-lia-assign`). Se a flag `ativo=false`, a function consultora deve respeitar antes de enviar. Esta parte de execução não está no escopo deste plano — apenas a UI + leitura de métricas + toggle. Confirmar se devemos também ligar o respeito ao toggle nas functions de disparo.

## Detalhes técnicos

- Estilo: tokens semânticos (`bg-card`, `text-foreground`, `text-muted-foreground`); cores primárias por automação via classes utilitárias condicionais (`blue`/`green`) compatíveis com light/dark.
- Estado: `useState` + `useEffect` consumindo a edge function via `supabase.functions.invoke('automacoes-lia')`.
- Toggle otimista com rollback em erro + `toast` (`sonner`).
- Ícones: `Bot`, `MessageSquareDot`, `FileText`, `Pencil`, `Plus` (lucide-react).
- Reusar `HighlightVariables` para preview com `{nome}`, `{produto}` etc.

## Arquivos afetados

- `supabase/migrations/<timestamp>_lia_automations.sql` (novo)
- `supabase/functions/automacoes-lia/index.ts` (novo)
- `src/components/smartops/SmartOpsLiaAutomations.tsx` (novo)
- `src/components/SmartOpsCSRules.tsx` (renderiza o novo componente ao final)

## Perguntas em aberto

1. O botão **"+ Nova automação"** deve estar funcional já agora (criar entrada custom) ou apenas placeholder, dado que as 2 automações iniciais são fixas e ligadas a functions específicas?
2. Devo já modificar `smart-ops-lia-assign` (e outras) para respeitar o toggle `ativo=false` (suprimindo o envio), ou apenas entregar UI + métricas + persistência da flag nesta etapa?
