

## Problema

O "Formulário Base" é criado com `active: false` na linha 149 de `SmartOpsFormBuilder.tsx`. A página pública (`PublicFormPage.tsx`) filtra por `.eq("active", true)`, então o formulário não aparece.

## Solução

Duas correções:

### 1. Criar formulário base já ativo (`SmartOpsFormBuilder.tsx`)
Alterar linha 149: `active: false` -> `active: true`.

### 2. Página pública com mensagem melhor (`PublicFormPage.tsx`)
Quando o formulário existe mas está inativo, exibir "Formulário temporariamente indisponível" em vez de "não encontrado".

| Arquivo | Mudança |
|---|---|
| `SmartOpsFormBuilder.tsx` | Linha 149: `active: true` |
| `PublicFormPage.tsx` | Busca sem filtro `active`, exibe mensagem diferente se inativo |

Para o formulário que já existe no banco com `active=false`, basta ativar via toggle no admin.

