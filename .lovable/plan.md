## Problema

O `EmailRichEditor` (TipTap) só entende um conjunto pequeno de nós: parágrafo, heading, lista, link, imagem, alinhamento, cor. Emails HTML reais vêm com `<table>`, `<td>`, `style="..."`, `<font>`, `<center>`, `<div bgcolor>` etc. Ao carregar no editor, o TipTap **descarta tudo que não conhece** e reserializa como texto/paragrafos — por isso o email "vira texto puro" após qualquer edição.

Não dá para consertar isso com mais extensões do TipTap: WYSIWYG de email HTML é um problema diferente de edição de artigo. A saída é **não usar TipTap para o corpo bruto do email**.

## Plano

### 1. Trocar a aba "Visual" por um editor seguro para HTML de email
- Remover o `EmailRichEditor` do fluxo do corpo principal do email.
- Substituir por um editor de duas colunas:
  - **Esquerda:** `<textarea>` com o HTML bruto (fonte de verdade), mono, syntax simples.
  - **Direita:** preview ao vivo em `<iframe srcDoc={html}>` com sandbox, atualizando com debounce (~300ms).
- Isso garante 100% de preservação de tabelas, estilos inline, media queries, etc. — o HTML nunca é reparseado por um editor rich text.

### 2. Manter edições rápidas sem quebrar layout
Na aba Visual, oferecer ações que operam no HTML sem re-serializar:
- **Substituir texto** (find & replace com preview).
- **Editar assunto / pré-header** (campos separados, já existem).
- **Toggle de seções** (aba Seções — já funciona, continua igual).
- **Regerar bloco com IA** (opcional, fora deste plano).

### 3. Onde o TipTap pode continuar
`EmailRichEditor.tsx` permanece no projeto, mas só é usado quando o conteúdo é **gerado do zero pelo wizard** (template controlado que o TipTap consegue round-tripar). Para HTML importado/gerado por IA com tabelas, usar o editor de código+preview.

Decisão simples via prop: `mode: "rich" | "html"`. Default para emails vindos da IA = `"html"`.

### 4. Aviso na UI
Banner discreto na aba Visual quando `mode="html"`:
> "Este email usa layout HTML complexo. Edite o código à esquerda; o preview atualiza automaticamente. Alterações preservam todo o estilo original."

## Detalhes técnicos

- Novo componente `src/components/smartops/EmailHtmlEditor.tsx`:
  - `props: { value: string; onChange: (html:string)=>void }`.
  - `<textarea>` controlado + `<iframe srcDoc>` com `sandbox="allow-same-origin"` (sem `allow-scripts`).
  - Debounce no `onChange` do textarea para não redesenhar o iframe a cada tecla.
- Em `EmailCampaignWizard.tsx`:
  - Detectar se o HTML tem `<table` ou `style=` inline → usar `EmailHtmlEditor`.
  - Caso contrário (conteúdo simples) → manter `EmailRichEditor`.
- Nenhuma mudança em `emailSections.ts`, backend, ou template da IA.

## Fora do escopo
- Editor WYSIWYG real de email (MJML/Unlayer-like) — grande refactor, não pedido.
- Edição visual bloco a bloco.

## Validação
1. Abrir um email gerado pela IA com tabelas → aba Visual mostra código + preview lado a lado; preview renderiza igual ao "Preview" final.
2. Editar uma palavra no textarea → preview atualiza em ~300ms mantendo layout.
3. Enviar teste → email chega com estilo intacto.
4. Aba Seções continua funcionando (toggle liga/desliga blocos).
