

## Plano: Melhorias no Form Builder

### 1. Editar nome do formulário (`SmartOpsFormBuilder.tsx`)
Atualmente não há como editar o nome após criação. Adicionar um botão de edição inline na tabela que abre um dialog para renomear o formulário (nome + finalidade).

**Alterações em `SmartOpsFormBuilder.tsx`:**
- Adicionar estado `editingMeta` para controlar dialog de edição
- Criar dialog com campos: nome, finalidade, cor tema, mensagem de sucesso
- Ao salvar, atualizar via `supabase.from("smartops_forms").update(...)` e recarregar

### 2. Categoria para campo customizado (`SmartOpsFormEditor.tsx`)
Quando o usuário seleciona "Campo customizado", adicionar um seletor de categoria (Contato / Profissional / Equipamentos / Interesse / SDR) para classificar o campo.

**Alterações em `SmartOpsFormEditor.tsx`:**
- Adicionar constante `CUSTOM_FIELD_CATEGORIES` com as 5 categorias
- Quando `custom_field_name !== null`, mostrar um `Select` de categoria antes do input de nome
- Salvar a categoria no campo `custom_field_name` com prefixo (ex: `contato.score_nps`) ou na coluna `options` como metadata `{ category: "contato" }`

**Nota:** Como a tabela `smartops_form_fields` já tem uma coluna `options` (jsonb), a categoria será armazenada lá: `options: { category: "contato", custom_name: "score_nps" }` — sem necessidade de migration.

### Resumo de arquivos
| Arquivo | Mudança |
|---|---|
| `src/components/SmartOpsFormBuilder.tsx` | Dialog para editar nome/config do formulário |
| `src/components/SmartOpsFormEditor.tsx` | Seletor de categoria ao escolher campo customizado |

