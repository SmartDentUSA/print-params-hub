## Objetivo
No modal **Editar Inscrição** (`EditEnrollmentDialog` em `src/components/SmartOpsCourses.tsx`), permitir **adicionar, editar e remover acompanhantes** vinculados ao participante. Hoje a seção "Acompanhantes" é apenas leitura (badges).

## Mudanças

### 1. `src/components/SmartOpsCourses.tsx` — `EditEnrollmentDialog`

**Estado local de acompanhantes**
- Adicionar `const [companionsList, setCompanionsList] = useState<any[]>(companions);` inicializado a partir de `enrollment.companions`.
- Adicionar `const [delIds, setDelIds] = useState<string[]>([])` para acumular exclusões (ids existentes removidos).
- Acompanhantes novos: sem `id`, ganham flag temporária `_new: true`.

**UI substituindo o bloco readonly atual (linhas 670–680)**
Lista editável com mesmos campos usados em `CompanionsInline` (`EnrollmentModal`):
- `name` (obrigatório), `especialidade` (TaxonomySelect), `area_atuacao` (TaxonomySelect), `email`, `phone`.
- Botão "Remover" por item (se tem `id`, empurra para `delIds` e tira da lista; se é novo, só tira).
- Botão "Adicionar acompanhante" (push `{ _new: true, name: '' }`).

**`handleSave` — persistência**
Após `update` do enrollment principal, executar de forma sequencial:
1. Para cada `id` em `delIds`: `delete().eq('id', id)` na tabela `smartops_enrollment_companions`.
2. Para cada acompanhante com `id` que teve algum campo alterado (comparar com `enrollment.companions`): `update({...campos}).eq('id', id)`.
3. Para cada acompanhante novo com `name.trim()` não vazio: `insert({ enrollment_id: enrollment.id, name, email, phone, especialidade, area_atuacao })`.
4. Tratar erros individualmente (`toast` com mensagem do primeiro erro encontrado).
5. Invalidar `smartops_enrollments` (já existe) **e** invalidar a query de companion counts no `useTurmaCompanionsMap` (queryKey `["smartops_companions_map"]` — verificar nome real durante implementação).

**Sem mudança de schema**: tabela `smartops_enrollment_companions` já existe com todos os campos (`name`, `email`, `phone`, `especialidade`, `area_atuacao`, `enrollment_id`).

### 2. Não alterar
- `EnrollmentModal.tsx` (criação inicial) — já tem CRUD.
- Backend/edge functions — `smartops-gerar-doc-turma`, `smartops-gerar-crachas-turma`, `generate-certificate`, `smartops-gerar-comprovante-imersao` já leem da tabela e refletirão automaticamente.

## Arquivos
- **Editado**: `src/components/SmartOpsCourses.tsx` (somente `EditEnrollmentDialog`).

## Validação
- Abrir um inscrito → adicionar acompanhante → salvar → reabrir e ver persistido.
- Editar nome/especialidade de um acompanhante existente → salvar → conferir no DB.
- Remover acompanhante → salvar → confirmar deleção e que counter da turma atualizou.
