## Escopo

Substituir o botão único "👥 Grupo WA" por **dois botões separados** no rodapé do `TurmaCard`, ao lado do "Gerar Doc":

1. **"➕ Gerar Grupo"** — cria o grupo WhatsApp da turma
2. **"👥 Add Participantes"** — adiciona os inscritos ao grupo já existente

## Componentes

### 1. `src/components/smartops/CreateTurmaWaGroupButton.tsx` (novo)

- Props: `turmaId: string`, `turmaLabel: string`, `onCreated?: () => void`
- Consulta `wa_groups` por `turma_id`:
  - **Se já existir grupo:** botão desabilitado com tooltip "Grupo já criado: {nome}"
  - **Se não existir:** botão habilitado "➕ Gerar Grupo"
- Loading: "Criando..." com `Loader2`
- Ao clicar: `supabase.functions.invoke('smartops-create-turma-wagroup', { body: { turma_id } })`
- Resposta esperada: `{ ok, grupo?, group_id?, invite_link?, error? }`
- Toast: `✅ Grupo '{grupo}' criado` ou `toast.error`
- Após sucesso, refaz query (ou chama `onCreated`) para revelar o botão de adicionar participantes

### 2. `src/components/smartops/AddTurmaToWaGroupButton.tsx` (já existe — manter, ajustar label)

- Mudar label para **"👥 Add Participantes"** (loading: "Adicionando...")
- Comportamento atual já está correto (consulta `wa_groups`, chama `smartops-add-turma-to-wagroup`, mostra toast com `adicionados`/`erros`)
- Tooltip quando desabilitado: "Crie o grupo WA primeiro"

### 3. `src/components/smartops/TurmaCard.tsx`

No rodapé, sequência:

```tsx
<GerarDocButton ... />
<CreateTurmaWaGroupButton turmaId={turma.id} turmaLabel={turma.label} />
<AddTurmaToWaGroupButton turmaId={turma.id} />
<Button>Agendar</Button>
```

Os dois botões consultam `wa_groups` independentemente; o "Add Participantes" reage ao realtime/refetch quando o grupo passa a existir (refetch ao montar é suficiente — usuário recarrega o card se necessário, ou usamos `supabase.channel` se quiser reatividade — **decidir abaixo**).

## Pendências para confirmar

1. **Reatividade entre os dois botões:** quando "Gerar Grupo" cria o grupo, o "Add Participantes" precisa habilitar automaticamente? Opções:
   - (a) **Simples:** após criar, recarrega a página/aba (pior UX)
   - (b) **Estado compartilhado via hook:** criar `useTurmaWaGroup(turmaId)` que ambos os botões usam, e o "Create" invalida o estado após sucesso (recomendado)
   - (c) **Realtime Supabase** na tabela `wa_groups` (overkill para este caso)

2. **Edge functions:** **NENHUMA das duas existe** em `supabase/functions/`:
   - `smartops-create-turma-wagroup` — precisa criar grupo via Evolution API
   - `smartops-add-turma-to-wagroup` — precisa adicionar membros via Evolution API
   
   Opções:
   - **A)** Só os botões agora (frontend), edge functions depois
   - **B)** Crio as duas edge functions também — preciso saber: instância Evolution API a usar, secret name (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`?), e se o nome do grupo deve ser `{course_title} — {turma_label}` ou outro padrão.

Confirme (1) e (2) para eu seguir.
