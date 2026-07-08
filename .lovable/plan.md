## Objetivo

No passo "2. Revisar & Ajustar" do `EmailCampaignWizard`, substituir o textarea único de HTML por um editor com três modos e controle de seções ligáveis/desligáveis.

## O que o usuário verá

No card "Revisar & Ajustar", acima do campo HTML, aparecem três abas:

- **Visual** — editor rico WYSIWYG (negrito, itálico, links, listas, títulos, alinhamento, cor, imagens embutidas via URL, desfazer/refazer). Edita o corpo do email diretamente com formatação clicável.
- **HTML** — editor de código com destaque monoespaçado (mantém o textarea atual, melhorado).
- **Seções** — lista das seções detectadas no HTML (hero, benefícios, CTA, prova social, rodapé, etc.), cada uma com um switch ligar/desligar e botão para reordenar (subir/descer). Seções desligadas somem do HTML final e do preview.

Preview lateral continua funcionando em todos os modos e atualiza em tempo real.

Ao alternar entre abas, o conteúdo é sincronizado: editar no Visual atualiza o HTML; editar o HTML e voltar ao Visual re-renderiza; ligar/desligar seções aplica tanto no Visual quanto no HTML.

## Como as seções são detectadas

O HTML gerado pela IA será marcado com `<section data-section="hero">…</section>`, `data-section="benefits"`, `data-section="cta"`, `data-section="social-proof"`, `data-section="footer"`, etc. O parser lê essas marcações para montar a lista de toggles. Seções sem marcação viram uma única seção "conteúdo" (não removível). O prompt do `smart-ops-generate-email` será ajustado para sempre emitir `data-section` nos blocos principais.

## Detalhes técnicos

- Biblioteca WYSIWYG: **TipTap** (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-text-align`, `@tiptap/extension-color`) — leve, headless, integra com Tailwind e permite HTML in/out fiel. Já compatível com a stack.
- Novo componente `src/components/smartops/EmailRichEditor.tsx` recebe `value`, `onChange`, `sections`, `onSectionsChange`.
- Novo utilitário `src/components/smartops/emailSections.ts`:
  - `parseSections(html)` → `Array<{ id, key, label, enabled, order, html }>`
  - `serializeSections(sections, wrapperHtml)` → HTML final preservando `<head>`, estilos e wrapper `<body>`.
- Wizard (`EmailCampaignWizard.tsx` linhas 573–586): substituir o grid HTML/Preview por `<Tabs>` (shadcn) com `Visual | HTML | Seções` + coluna de preview mantida. Estado local `sections` derivado de `html` no primeiro parse; edições no Visual/HTML re-parseiam para manter a lista atualizada.
- Regeneração por IA: prompt em `supabase/functions/smart-ops-generate-email/index.ts` recebe instrução explícita para envolver blocos em `<section data-section="…">` com `label` textual (`data-section-label="Benefícios"`) usada na aba Seções.
- Preview (`previewHtml`) passa a usar o HTML serializado a partir das seções ativas, não o textarea bruto.
- Sanitização mantida: continua exigindo `<body>`, sem `<script>`.

## Fora do escopo

- Fluxos de campanha SMS/WhatsApp (só email).
- Editor de sequências (`EmailSequenceBuilder`) — se você quiser lá também, incluímos numa iteração seguinte.
- Upload de imagem no editor (por ora só URL); podemos plugar Supabase Storage depois.

## Validação

- Gerar email → alternar Visual/HTML/Seções sem perda de conteúdo.
- Desligar "Prova social" → some do preview e do HTML enviado no teste.
- Editar título no Visual (negrito + link) → HTML reflete; preview atualiza.
- Enviar teste (`handleTest`) usa o HTML final com seções aplicadas.
