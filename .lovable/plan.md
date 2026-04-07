

## Tornar o `ingest-lead` dinâmico para novos campos de formulário

### Problema atual

O frontend (`PublicFormPage.tsx`) já envia campos dinamicamente — se o form field tem `db_column = "novo_campo"`, ele envia `payload.novo_campo = valor`. Porém, o backend (`smart-ops-ingest-lead/index.ts`) constrói o objeto `incomingData` manualmente listando ~60 campos hardcoded (linhas 117-201). Qualquer campo novo criado no editor de formulários que não esteja nessa lista é **silenciosamente descartado**.

A nota HTML do PipeRun já funciona dinamicamente (usa `form_responses` inline). O card do lead já exibe todos os campos via Lead Fields Inventory. O único gargalo é o `ingest-lead`.

### Solução: Auto-forward de campos com `db_column`

Modificar o `ingest-lead` para aceitar **qualquer** campo que corresponda a uma coluna real da tabela `lia_attendances`, sem precisar listá-los manualmente.

### Mudança — 1 arquivo

**`supabase/functions/smart-ops-ingest-lead/index.ts`**

Após o bloco hardcoded de `incomingData` (linha ~201), adicionar um loop que percorre todas as chaves do payload e, se a chave não já estiver no `incomingData` e não for uma meta-chave do sistema (como `source`, `form_name`, `form_responses`, `raw_payload`), adiciona-a ao `incomingData`.

```text
Lógica:

1. Definir um Set de chaves "meta" que NÃO são colunas do lead:
   META_KEYS = { "source", "form_name", "form_purpose", "form_responses",
                 "raw_payload", "campaign", "formName", "form", "ip",
                 "full_name", "name", "user_name", "first_name", "last_name",
                 "phone_number", "phone", "mobile", "celular", "user_phone",
                 "user_email", "specialty", "product" }

2. Após construir incomingData, iterar sobre Object.entries(payload):
   for (const [key, value] of Object.entries(payload)) {
     if (value == null || value === "") continue;
     if (META_KEYS.has(key)) continue;
     if (key in incomingData) continue;  // já mapeado explicitamente
     if (typeof value === "object") continue;  // skip objetos complexos
     incomingData[key] = value;
   }

3. Se a coluna não existir na tabela, o Supabase retornará erro no insert/update.
   Para evitar isso, adicionar um try-catch no insert/update que, em caso
   de "column X does not exist", remove a chave e retenta UMA vez.
```

### O que isso resolve

- Novos campos criados no SmartOpsFormEditor com `db_column` mapeado para uma coluna existente no `lia_attendances` serão automaticamente salvos no lead
- O HTML do PipeRun já funciona (usa `form_responses`)
- O card do lead já exibe qualquer campo preenchido (Lead Fields Inventory)
- O ALWAYS_UPDATE set no `lead-enrichment.ts` continua controlando a política de merge — campos novos que não estão no set seguem a regra padrão (só atualizam se vazio)

### Segurança

- Apenas valores primitivos (string, number, boolean) são aceitos — objetos são ignorados
- Chaves meta do sistema são explicitamente excluídas
- O Supabase rejeita qualquer coluna inexistente (proteção natural)
- O retry com remoção de coluna inválida previne falhas silenciosas

### Escopo

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/smart-ops-ingest-lead/index.ts` | Adicionar auto-forward loop após `incomingData` (~15 linhas) |

Nenhum outro arquivo precisa mudar. O sistema todo já consome os dados dinamicamente.

