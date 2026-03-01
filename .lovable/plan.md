

## Plano: Formulário Padrão + Melhorias no Editor

### 1. Migration: Adicionar colunas `title`, `subtitle` na tabela `smartops_forms`

A tabela já tem `name` (nome interno/admin) e `description`. Faltam `title` (título público na web) e `subtitle` (subtítulo público).

```sql
ALTER TABLE public.smartops_forms 
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS subtitle text;
```

### 2. Atualizar dialog de edição (`SmartOpsFormBuilder.tsx`)

Separar claramente:
- **Nome** (interno, para o admin identificar)
- **Título** (aparece na web para o lead)
- **Subtítulo** (aparece na web abaixo do título)
- **Descrição** (texto descritivo na web)
- Manter finalidade, cor, mensagem sucesso, redirect URL

### 3. Atualizar página pública (`PublicFormPage.tsx`)

Exibir `title` (ou fallback para `name`), `subtitle` e `description` no formulário público ao invés de usar apenas `name`.

### 4. Criar formulário padrão com TODOS os campos da tabela

Adicionar botão "Criar Formulário Base" no `SmartOpsFormBuilder.tsx` que cria automaticamente um formulário com todos os 27 campos mapeáveis do sistema, organizados por categoria:

**Contato (5):** Nome, E-mail, Telefone, Cidade, UF
**Profissional (4):** Especialidade, Área de atuação, Empresa, Cargo
**Equipamentos (5):** Tem impressora?, Modelo impressora, Tem scanner?, Software CAD, Como digitaliza
**Interesse (4):** Produto de interesse, Resina de interesse, Principal aplicação, Volume mensal peças
**SDR (9):** Scanner interesse, Impressora interesse, Software CAD interesse, Cursos interesse, Insumos lab interesse, Pós-impressão interesse, Soluções interesse, Dentística interesse, Caracterização interesse

Cada campo com tipo adequado (text, select, radio conforme fizer sentido) e mapeamento `db_column` correto. Os campos com opções conhecidas (tem_impressora: Sim/Não, UF: lista de estados) terão as opções pré-configuradas.

### 5. Botão de duplicar formulário

Adicionar ícone de duplicação na tabela de formulários que copia o formulário + todos os seus campos com novo slug.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Colunas `title`, `subtitle` |
| `SmartOpsFormBuilder.tsx` | Dialog com title/subtitle/description, botão criar base, botão duplicar |
| `PublicFormPage.tsx` | Exibir title, subtitle, description |
| `types.ts` | Atualizado automaticamente |

