## Objetivo
1. Gerar o card informativo da resina com **GPT‑5.6 Sol via Poe**, produzindo **3 imagens visualmente idênticas** (PT / EN / ES) — mesmo layout, mesmas cores, mesmos ícones, mesmo número e ordem de blocos/bullets; só o texto muda.
2. Exibir a imagem gerada **dentro do card "🧪 Pré e Pós Processamento"** da Base de Conhecimento (ex.: `Smart Print Bio Vitality`), **abaixo do texto** e com um botão **Baixar** para o usuário salvar o PNG.

## Estratégia para paridade visual (imagem)
Separar **estrutura** de **conteúdo**:
1. Uma única chamada ao GPT‑5.6 Sol devolve um **JSON trilíngue** com o mesmo esquema de blocos para PT/EN/ES.
2. Um **template HTML determinístico** (server-side, sem LLM) renderiza cada idioma a partir desse JSON. Como o template é o mesmo e o JSON tem a mesma forma, os 3 PNGs saem com layout idêntico — só o texto muda.

## Mudanças

### 1. `supabase/functions/generate-resin-info-card/index.ts` (reescrita parcial)
- **Remover** `parseInstructions` markdown atual e o `buildHtml` acoplado.
- **Manter** `escapeHtml`, `inlineFormat`, `renderPng`, upload/storage e update em `resins`.
- Nova função `planCardWithLLM({ resinName, instructionsPt, instructionsEn, instructionsEs })`:
  - Chamada única `callPoe`:
    - `model: "GPT-5.6-Sol"`, `temperature: 0.2`, `max_tokens: 8000`
    - `response_format: { type: "json_object" }`
  - **System prompt**: designer sênior de infográficos técnicos odontológicos; obrigação de manter estrutura idêntica entre idiomas.
  - **User prompt** entrega:
    - Nome da resina (PT / EN / ES).
    - Os 3 textos de `processing_instructions_*` (fallback para PT quando EN/ES vazios).
    - Contrato de saída JSON:
      ```json
      {
        "structure": {
          "blocks": [
            { "id":"pre",  "color":"blue",   "icon":"🌡️", "num":"1)" },
            { "id":"post", "color":"green",  "icon":"⚙️",  "num":"2)" },
            { "id":"cure", "color":"purple", "icon":"☀️",  "num":"3)" }
          ],
          "columns_per_block": { "pre": 3, "post": 3, "cure": 2 }
        },
        "content": {
          "pt": { "title":"...", "subtitle":"...", "important":"...",
                  "blocks": { "pre": { "heading":"PRÉ-PROCESSAMENTO",
                                       "columns":[ { "title":"Limpeza", "icon":"🧼",
                                                     "items":[ {"text":"...","bold":["5 min"]} ],
                                                     "note":"..." } ] }, ... } },
          "en": { ... mesma forma ... },
          "es": { ... mesma forma ... }
        }
      }
      ```
    - Regras rígidas no prompt: os três idiomas DEVEM ter exatamente os mesmos `blocks`, mesma quantidade de colunas por bloco, mesma quantidade de `items` por coluna, mesmos `icon`/`color`.
- Validador `assertStructuralParity(content)`:
  - Igualdade de contagens (blocos → colunas → items) e igualdade de ícones/cores nos 3 idiomas.
  - Se falhar → **1 retry** com mensagem correcional; se ainda falhar → fallback para o gerador determinístico anterior (parseInstructions + template estático).
- `renderCardHtml(structure, contentForLang, resinName, productImage, lang)`:
  - Template HTML/CSS fixo em código (mesmo já existente: header com logo + imagem do produto, blocos azul/verde/roxo, callouts vermelhos, footer azul), lendo apenas dados textuais.
- Loop pelos idiomas: `renderPng(renderCardHtml(...))` → upload em `product-images/resin-info-cards/{slug}-{lang}-{ts}.png` → grava `info_card_url_{lang}`.
- Log de uso: `logAIUsage({ functionName: "generate-resin-info-card", actionLabel: "resin_info_card", model: "poe/GPT-5.6-Sol", ... })` **uma vez** (não por idioma).
- Resposta inclui `model_used: "poe/GPT-5.6-Sol"` e `fallback_used: boolean`.

### 2. UI admin (`src/components/AdminModal.tsx`)
- Ajustar apenas o rótulo do botão **Gerar Card Informativo** durante geração para "Gerando com IA (GPT‑5.6 Sol)…". Nada muda no grid de preview trilíngue.

### 3. UI Base de Conhecimento (`src/components/knowledge/KbTabCatalogo.tsx`)
No diálogo **🧪 Pré e Pós Processamento — {resina}**:
- Manter o texto estruturado (`ProcessingInstructionsView`) no topo.
- **Ao final do conteúdo**, adicionar bloco `Card Informativo`:
  - Seletor efetivo de idioma = idioma ativo da KB (`pt|en|es`); usa `info_card_url_{lang}` da resina, com fallback para PT quando o idioma escolhido não tiver card gerado.
  - Se houver URL: exibir a imagem (`<img>` responsiva, `loading="lazy"`, `alt` com nome da resina) num container arredondado, com borda sutil e sombra leve para combinar com o card do produto.
  - Abaixo da imagem, um botão **Baixar** (variante `outline`, ícone `Download` do lucide) que dispara download do PNG:
    - Implementado como `fetch(url) → blob → URL.createObjectURL → <a download="{slug}-{lang}.png"> click`, para forçar download em vez de abrir em nova aba.
    - Label i18n: PT "Baixar card", EN "Download card", ES "Descargar tarjeta".
  - Se `info_card_url_{lang}` for `null` para todos os idiomas: não renderiza o bloco (comportamento atual preservado).
- Sem alteração no fallback textual: se a resina não tiver imagem, o texto continua sendo a única representação.

### 4. Traduções
- `src/locales/{pt,en,es}.json`: adicionar chaves `kb.resin.infoCard.title`, `kb.resin.infoCard.download`.

## Fora de escopo
- Sem mudanças em `ProcessingInstructionsView`, `processing_instructions*`, schema `resins` (já criado na iteração anterior), tradução automática de instruções, `social-generate-image`, `smart-ops-copilot`.
- Sem alteração no fluxo de disponibilizar cards para redes sociais.

## Riscos e mitigação
- **LLM devolver estruturas desiguais entre idiomas** → validador + 1 retry + fallback determinístico.
- **Latência**: uma chamada Poe (não 3).
- **Custo**: GPT‑5.6 Sol é premium; ação manual e sob demanda no Admin.
- **CORS no download**: bucket `product-images` é público; `fetch → blob` funciona sem preflight custom. Fallback: `<a href="{url}" download target="_blank">` caso o `fetch` falhe.

## Detalhes técnicos
```text
generate-resin-info-card
├─ callPoe("GPT-5.6-Sol", 1x, JSON trilíngue)
├─ assertStructuralParity → retry 1x → fallback determinístico
├─ para cada lang solicitado:
│   ├─ renderCardHtml(structure, content[lang], names[lang], image_url, lang)
│   ├─ renderPng(html)  ← puppeteer /api/render-template (mesmo template p/ todos)
│   ├─ upload product-images/resin-info-cards/{slug}-{lang}-{ts}.png
│   └─ results[lang] = publicUrl
├─ update resins.info_card_url_{pt,en,es} + info_card_generated_at
└─ logAIUsage(1x)

KbTabCatalogo → diálogo Pré/Pós
└─ após ProcessingInstructionsView:
    ├─ <img src={resin.info_card_url_[lang] || info_card_url_pt} />
    └─ <Button onClick={downloadBlob}> Baixar card </Button>
```
