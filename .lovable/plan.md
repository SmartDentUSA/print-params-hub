## Objetivo

Permitir que o usuário escolha **data e hora de início** da automação ao criar/ativar uma campanha (régua) no `WaGroupFlowBuilder`. Hoje, ao clicar em "Ativar", a primeira mensagem é agendada para `now() + 15s` (ou data do primeiro nó `wait`). A nova opção deixará o usuário definir explicitamente quando a régua começa a rodar.

## Como funcionará

1. No painel lateral "Configuração" do builder, adicionar um campo **"Início da automação"** com:
   - Toggle: **"Iniciar agora"** (padrão, comportamento atual) **vs "Agendar início"**.
   - Quando "Agendar início" estiver ativo, exibir:
     - DatePicker (shadcn) — não permite datas no passado.
     - Input de hora (`HH:MM`) — padrão `09:00`.
   - Texto auxiliar: "A régua começa a enviar a partir desta data/hora. Os nós 'Aguardar' continuam contando a partir desse ponto."

2. Ao salvar como rascunho ou ativar, gravar `wa_campaigns.started_at` com o timestamp ISO escolhido (ou `null` quando "Iniciar agora").

3. A edge function `wa-campaign-builder` **já respeita `camp.started_at`** (`const startTs = camp.started_at ? ... : Date.now() + 15_000`). Logo, basta passar o valor — nenhuma mudança no backend.

4. Ao ativar com data futura, o toast já mostra "primeira mensagem em ...", então a experiência fica natural.

## Arquivos afetados

- `src/components/smartops/wa-groups/WaGroupFlowBuilder.tsx`
  - Novo state `scheduleEnabled: boolean`, `scheduleDate: Date | undefined`, `scheduleTime: string`.
  - Carregar `started_at` existente ao editar (incluir no `select` do `useEffect`).
  - UI nova na sidebar de configuração (após "Atraso entre mensagens").
  - `handleSave`: incluir `started_at` no `payload` (ISO ou `null`).
  - Validação: se "Agendar início" estiver ativo, exigir data preenchida e timestamp futuro antes de ativar.

## Fora de escopo

- Nenhuma mudança em edge functions, schema do banco ou dispatcher.
- Não muda comportamento dos nós `wait`.
- Não altera campanhas blast (`WaGroupBlastModal`) — apenas réguas (flow builder).

## Validação

- Criar nova régua, escolher data amanhã 14:00, ativar → `wa_campaigns.started_at` = amanhã 14:00; primeira mensagem na fila com `scheduled_at` ≈ 14:00.
- Editar régua existente → datepicker pré-preenchido com `started_at` salvo.
- Ativar com "Iniciar agora" → comportamento idêntico ao atual.