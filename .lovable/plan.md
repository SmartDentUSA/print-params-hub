
# Adicionar campo "ID Vendedor Piperun" ao cadastro de membros da equipe

## O que sera feito

Adicionar o campo `piperun_owner_id` na tabela `team_members` e no formulario de cadastro/edicao de membros. Esse campo permite vincular cada membro da equipe ao seu ID de proprietario no Piperun, essencial para a atribuicao automatica de leads.

## Alteracoes

### 1. Migration -- nova coluna na tabela `team_members`

```sql
ALTER TABLE team_members ADD COLUMN piperun_owner_id TEXT;
```

Coluna nullable, pois nem todo membro tera ID no Piperun.

### 2. Arquivo: `src/components/SmartOpsTeam.tsx`

- Adicionar `piperun_owner_id: string | null` na interface `TeamMember`
- Expandir o estado `form` para incluir `piperun_owner_id: ""`
- Adicionar campo "ID Vendedor Piperun" no dialog de edicao/criacao, entre WhatsApp e Funcao
- Adicionar coluna "Piperun ID" na tabela principal, exibindo o valor em fonte mono
- Atualizar `openAdd` e `openEdit` para incluir o novo campo
