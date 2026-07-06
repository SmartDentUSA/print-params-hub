## Objetivo

Adicionar a função **Marketing** no cadastro de membros da equipe e aplicar essa role ao `Smart Dent Marketing` (`+55 16 99750-1531`) para que ele **não** entre no rodízio de leads.

## Diagnóstico rápido

- `supabase/functions/smart-ops-lia-assign/index.ts` já filtra rigorosamente `role='vendedor'` para atribuir leads (linhas 1126 e 1177). Qualquer outra role (`cs`, `suporte`, e a nova `marketing`) é **automaticamente ignorada** — nenhuma mudança no backend de distribuição é necessária.
- O único ponto que limita a UI hoje é o `<Select>` de Função em `src/components/SmartOpsTeam.tsx` (linha 342-344), que só oferece Vendedor / CS / Suporte.

## Mudanças

**1. `src/components/SmartOpsTeam.tsx`** — adicionar a opção no seletor:

```tsx
<SelectItem value="vendedor">Vendedor</SelectItem>
<SelectItem value="cs">CS</SelectItem>
<SelectItem value="suporte">Suporte</SelectItem>
<SelectItem value="marketing">Marketing</SelectItem>
```

**2. SQL (via `supabase--insert`)** — aplicar a role ao membro correto:

```sql
UPDATE team_members
SET role = 'marketing'
WHERE evolution_instance_name = 'smartdent_marketing'
   OR whatsapp_number IN ('+5516997501531','5516997501531','16997501531');
```

Retorno esperado: 1 linha atualizada (o registro do Smart Dent Marketing).

## Fora de escopo

- `smart-ops-lia-assign`, `_shared/evolution.ts`, `wa-dispatcher`, RPCs SQL, credenciais Evolution e demais membros da equipe permanecem intocados.
- Nenhuma migração DDL — `team_members.role` já é `text` livre.

## Validação

1. Abrir cadastro de team member → confirmar que "Marketing" aparece no select.
2. Rodar SELECT para confirmar `role='marketing'` no registro do Smart Dent Marketing.
3. Próxima execução de `smart-ops-lia-assign` naturalmente ignora esse membro (filtro `.eq("role","vendedor")` já ativo).
