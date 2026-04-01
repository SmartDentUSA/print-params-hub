

## Problema

Dois problemas identificados na imagem:

1. **Respostas do formulário não aparecem na nota principal do deal** — o `buildSellerNotification` (dentro de `lia-assign`) cria a nota ANTES das respostas existirem, e o `deal-form-note` que envia as respostas separadamente parece não estar funcionando ou chegando depois
2. **Formatação ruim** — as notas usam `\n` (quebra de linha) e `*bold*` (sintaxe WhatsApp), mas o PipeRun renderiza notas com suporte a HTML. Resultado: tudo fica em uma linha só, sem estrutura visual

3. **Quantidade de deals existentes não é informada** — o vendedor não sabe quantos deals anteriores o lead já teve

### Solução

#### 1. Reformatar notas para HTML (`lia-assign` + `deal-form-note`)

Substituir a formatação plain text por HTML com `<br>`, `<b>`, `<hr>` etc., que o PipeRun renderiza corretamente nas notas.

**Arquivo:** `supabase/functions/smart-ops-lia-assign/index.ts` — função `buildSellerNotification` (linhas 598-628)

Alterar de:
```
🤖 *Novo Lead atribuído - Dra. L.I.A.*\n👤 Lead: Nome...
```
Para HTML:
```html
<b>🤖 Novo Lead atribuído - Dra. L.I.A.</b><br><br>
<b>👤 Lead:</b> Nome<br>
<b>📧 Email:</b> email@...<br>
...
<hr>
<b>HISTÓRICO:</b> ...<br>
<b>OPORTUNIDADE:</b> ...<br>
<hr>
<b>🧠 Análise Cognitiva:</b><br>
...
```

**Arquivo:** `supabase/functions/smart-ops-deal-form-note/index.ts` — formatação da nota (linhas 70-73)

Alterar de:
```
📝 Respostas do Formulário: Nome\n\n• Campo: Valor
```
Para HTML:
```html
<b>📝 Respostas do Formulário: Nome</b><br><br>
• <b>Campo:</b> Valor<br>
• <b>Campo2:</b> Valor2<br>
```

#### 2. Incluir contagem de deals existentes na nota principal

**Arquivo:** `supabase/functions/smart-ops-lia-assign/index.ts` — dentro de `buildSellerNotification`

Antes de montar o template, buscar a contagem de deals do lead:
```typescript
const { count: dealsCount } = await supabase
  .from("deals")
  .select("id", { count: "exact", head: true })
  .eq("lead_id", lead.id as string);
```

Adicionar linha no template:
```html
<b>📊 Deals existentes:</b> 3 deal(s) no histórico<br>
```

#### 3. Incluir respostas do formulário na nota principal (quando disponíveis)

**Arquivo:** `supabase/functions/smart-ops-lia-assign/index.ts` — dentro de `buildSellerNotification`

Buscar respostas do formulário que possam já existir:
```typescript
const { data: formResponses } = await supabase
  .from("smartops_form_field_responses")
  .select("value, workflow_cell_target")
  .eq("lead_id", lead.id as string);
```

Se existirem, adicionar seção na nota. Se não existirem (caso comum pois são gravadas em paralelo), o `deal-form-note` separado cobre isso.

### Arquivos alterados

1. `supabase/functions/smart-ops-lia-assign/index.ts` — `buildSellerNotification`: HTML + deals count + form responses
2. `supabase/functions/smart-ops-deal-form-note/index.ts` — HTML formatting
3. `supabase/functions/_shared/waleads-messaging.ts` — manter WhatsApp com formatação plain text (NÃO alterar, pois WhatsApp não suporta HTML)

### Detalhe importante

A função `buildSellerNotification` existe em DOIS lugares:
- `smart-ops-lia-assign/index.ts` (linhas 534-629) — usada para nota do deal no PipeRun E WhatsApp
- `_shared/waleads-messaging.ts` (linhas 113-206) — usada por outros fluxos

Como a nota do deal precisa de HTML mas o WhatsApp precisa de plain text, vamos criar uma variante `buildDealNoteHTML` dentro do `lia-assign` para o PipeRun, e manter `buildSellerNotification` inalterada para WhatsApp.

### Resultado esperado
- Nota do deal no PipeRun com layout limpo e organizado (HTML)
- Respostas do formulário visíveis na nota (via `deal-form-note` com HTML)
- Quantidade de deals anteriores visível para o vendedor
- WhatsApp continua funcionando com plain text

