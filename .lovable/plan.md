

# Fix: LIA não consulta `lia_attendances` ao identificar lead por email

## Problema

Quando o usuário fornece o email `ciclistadejaleco@gmail.com`, a LIA busca o lead na tabela `leads` (linha 1755). Esse lead **não existe** na tabela `leads`, mas existe na `lia_attendances` com nome completo "Allan Leonardo Rezende Coelho". Como o lookup falha, a LIA cai no fallback (linha 2061) e pergunta o nome — mesmo já tendo os dados.

A tabela `leads` é legada e muitos leads só existem em `lia_attendances` (o hub central do CDP).

## Solução

**File: `supabase/functions/dra-lia/index.ts`**

Alterar o bloco `needs_name` (linhas 1754-1766) para fazer um **fallback para `lia_attendances`** quando o lead não é encontrado na tabela `leads`:

```text
Fluxo atual:
  leads.email → encontrou? → returning lead
                não encontrou? → ASK_NAME ❌

Fluxo corrigido:
  leads.email → encontrou? → returning lead
                não encontrou? → lia_attendances.email → encontrou? → returning lead ✅
                                                         não encontrou? → ASK_NAME
```

Concretamente, após a query existente na tabela `leads` (linha 1755-1759), se `existingLead` for null, adicionar:

```typescript
// Fallback: check lia_attendances (many leads only exist here)
if (!existingLead) {
  const { data: liaLead } = await supabase
    .from("lia_attendances")
    .select("id, nome")
    .eq("email", leadState.email)
    .maybeSingle();
  if (liaLead && liaLead.nome) {
    existingLead = { id: liaLead.id, name: liaLead.nome };
  }
}
```

O restante do código (linha 1761+) já busca `lia_attendances` por email para o perfil completo, então não precisa de mais alterações — apenas o lookup inicial precisa do fallback.

## Impacto
- Todos os leads que existem em `lia_attendances` mas não em `leads` serão reconhecidos automaticamente
- Zero risco: é apenas um fallback — se o lead existir em `leads`, o comportamento atual é preservado
- O lead `ciclistadejaleco@gmail.com` (Allan) será reconhecido imediatamente ao fornecer o email

## Arquivo Alterado
1. `supabase/functions/dra-lia/index.ts` — adicionar fallback para `lia_attendances` no bloco `needs_name`

