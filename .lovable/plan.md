## Problema

A turma #144 aparece sim na lista de Agendamentos (linha "#144 Chairside Print - Odontologia Digital ... 10 de Jun de 2026"), mas **sem o badge "✨ Factory: pronto"** que adicionamos.

Causa-raiz identificada via inspeção do schema: a aba Agendamentos consome a **view `v_turmas_com_vagas`** (não a tabela direta). Essa view **não expõe** as colunas `factory_status` e `factory_processed_at`, então o campo chega `undefined` no `TurmaListRow` e o badge nunca renderiza.

## Correção proposta

### 1. Migração SQL — recriar a view incluindo os campos

`CREATE OR REPLACE VIEW public.v_turmas_com_vagas` adicionando ao `SELECT`:

- `t.factory_status`
- `t.factory_processed_at`

(mantendo todas as 39 colunas atuais e os mesmos joins/filtros).

### 2. Tipos TypeScript

Acrescentar em `TurmaComVagas` (`src/types/courses.ts`):

```ts
factory_status?: 'processando' | 'pronto' | 'publicando' | 'concluido' | 'erro' | string | null;
factory_processed_at?: string | null;
```

### 3. UI (nada a mudar)

`TurmaListRow.tsx` já lê `(turma as any).factory_status` e renderiza o badge azul "✨ Factory: pronto". Após a view ser atualizada, o badge aparecerá automaticamente na #144.

## Resultado esperado

Após aplicar a migração, ao filtrar por **"Encerrados"** ou **"Todos"** e buscar por **`144`**, a linha aparecerá com o badge azul **"✨ Factory: pronto"**, deixando claro que ela está disponível para publicação via o diálogo Factory.

## Fora do escopo

- Não vou mover a turma para outra aba de filtro (Encerrados é o status temporal correto).
- Não vou adicionar a coluna `factory_status` ao CourseCard do Catálogo — Catálogo é por curso, não por turma.