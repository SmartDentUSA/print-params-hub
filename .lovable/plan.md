## Problema

Na aba **Visual** do editor de email (Passo 2), quando o HTML contém `<table>` ou `style="…"` (praticamente todos os emails gerados), o componente renderiza o `EmailHtmlEditor` — que é um **editor de código + preview lado a lado**. Resultado: o usuário vê código HTML na aba "Visual", o que contradiz o nome da aba.

A aba **HTML** ao lado já cumpre esse papel (textarea de código puro).

## Solução

Fazer a aba **Visual** mostrar **apenas o preview do email** (iframe `srcDoc`), sem código. O código continua disponível na aba **HTML** (que já existe) para edição avançada.

### Mudanças

**`src/components/smartops/EmailCampaignWizard.tsx`** — no `<TabsContent value="visual">`:
- Remover o bloco condicional `EmailHtmlEditor` / `EmailRichEditor`.
- Renderizar somente o preview em `<iframe srcDoc={html}>` (mesma altura expansível: `h-[calc(100vh-260px)] min-h-[500px]` quando `expanded`, senão `h-[600px]`).
- Manter a nota de "Seções desligadas continuam visíveis aqui…" abaixo do preview.
- Manter o aviso "Este email usa layout HTML complexo — edite na aba HTML" apenas quando o HTML for complexo (com tabelas/estilos inline), como orientação.

**`src/components/smartops/EmailHtmlEditor.tsx`** — sem mudanças (segue sendo usado se um dia quisermos re-habilitar edição inline; hoje fica ocioso).

**Aba HTML** — sem mudanças. Textarea de código puro (fonte de verdade).

**Aba Seções** — sem mudanças.

### Fora de escopo

- Rich text editor WYSIWYG real sobre HTML de tabela (arriscado quebrar layout de email).
- Modal "Expandir" (continua funcionando).
- Passo 1, 3, e demais abas do SmartOpsCampaigns.
- Layout de largura do wizard (mantido como está).

### Validação

`/admin?sub=criar&tab=campanhas` → Passo 2 → aba **Visual** mostra somente o email renderizado (sem código). Aba **HTML** mostra o textarea de código. Botão "Expandir" continua funcionando. Preview atualiza ao editar o HTML.