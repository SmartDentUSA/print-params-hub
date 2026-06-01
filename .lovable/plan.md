## Problema

`https://parametros.smartdent.com.br/f/-formulario-exocad-ia` retorna **502 Bad Gateway** (página em branco com texto "Bad Gateway"). Curl direto às vezes devolve 200, mas o navegador real recebe 502 — comportamento intermitente típico do proxy quando o path tem caracteres "ruins".

## Causa raiz

O slug começa com hífen: `-formulario-exocad-ia`. Isso veio do `generateSlug` em `src/components/SmartOpsFormBuilder.tsx`:

```ts
text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
```

O nome do formulário é `# - Formulário exocad I.A.`. O `#` é removido, sobra ` - Formulário…`, vira `-formulario-exocad-i-a`. O `.trim()` só remove **espaços**, não hífens.

Confirmado no banco: existem 2 formulários com slug começando em `-`:

| id | slug | name |
|----|------|------|
| fbe205b0… | `-formulario-exocad-ia` | # - Formulário exocad I.A. |
| 63ecb106… | `-formulario-exocad-ia-copia-1779133804525` | # - Formulário Padrão |

O hospedeiro atual do domínio (`parametros.smartdent.com.br` → Lovable/Express, cookie `lovable.app`) trata `/f/-...` de forma inconsistente e dispara 502 em parte das requisições. A nova regra `vercel.json` que adicionamos não atua mais porque o domínio não passa pela Vercel.

## Correção

### 1. Renomear slugs existentes (migration)

Remover hífens de início/fim e colapsar duplicados em todos os `smartops_forms.slug`:

```sql
UPDATE smartops_forms
SET slug = regexp_replace(regexp_replace(slug, '^-+|-+$', '', 'g'), '-+', '-', 'g')
WHERE slug ~ '^-' OR slug ~ '-$' OR slug ~ '--';
```

Slugs novos:
- `-formulario-exocad-ia` → `formulario-exocad-ia`
- `-formulario-exocad-ia-copia-1779133804525` → `formulario-exocad-ia-copia-1779133804525`

URL nova: `https://parametros.smartdent.com.br/f/formulario-exocad-ia` (funciona com qualquer proxy/UA, inclusive WhatsApp).

### 2. Endurecer `generateSlug` (frontend)

Em `src/components/SmartOpsFormBuilder.tsx`, ajustar para nunca mais gerar slug com hífen nas pontas:

```ts
const generateSlug = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")   // ← novo: remove hífen do início/fim
    .trim();
```

## Validação após apply

1. `curl -I https://parametros.smartdent.com.br/f/formulario-exocad-ia -A "Mozilla/5.0"` → 200.
2. `curl -I https://parametros.smartdent.com.br/f/formulario-exocad-ia -A "WhatsApp/2.0"` → 200.
3. Abrir o link no WhatsApp Mobile → carrega de primeira.
4. Criar um formulário de teste com nome começando em `#` ou `-` no editor → o slug gerado começa com letra.

## Fora de escopo

- Não mexe em `vercel.json`, edge functions ou no `PublicFormPage.tsx`.
- Não cria redirect da URL antiga (`/f/-formulario-exocad-ia`) porque ela já está 502 — links em campanhas anteriores precisam ser republicados com a URL nova. Se você quiser, posso adicionar uma rota cliente que aceite o slug com `-` inicial e redirecione, mas o ideal é trocar nas campanhas.

## Aviso ao time comercial

Qualquer link já distribuído com `/f/-formulario-exocad-ia` precisa ser atualizado para `/f/formulario-exocad-ia` nas campanhas ativas.
