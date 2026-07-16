## Objetivo

Substituir a pipeline atual (LLM → JSON → HTML/CSS → SVG frágil) por **geração real de PNG via imagegen premium (GPT-image-2)**, replicando o layout do infográfico de referência anexado (Smart Print Bio Bite Splint +Flex).

## Referência visual

Layout do infográfico enviado como base fixa:
- Cabeçalho: logo Smart Dent (topo esquerdo) + foto do frasco da resina (topo direito) + título "Processo de Uso e Pós-Processamento — {Nome da Resina}" + subtítulo "Guia visual para manual de instruções"
- 3 blocos verticais empilhados, cada um com borda colorida e ícone circular:
  1. **Pré-Processamento** (azul) — ícone termômetro
  2. **Pós-Processamento** (verde) — ícone engrenagem
  3. **Pós-Cura UV** (roxo) — ícone sol
- Cada bloco com sub-etapas numeradas (1.1, 1.2…), cada uma com ícone próprio, título e bullets
- Alertas em caixas rosa-claro com ícone de triângulo (⚠️)
- Rodapé "Importante" com escudo azul + texto de fechamento
- Paleta: azul #1E3A8A, verde #10B981, roxo #7C3AED, rosa alerta #FEE2E2, texto #0F172A, fundo branco com padrão sutil

## Nova pipeline

**Etapa 1 — LLM estrutura o conteúdo (mantida, simplificada)**
- Prompt do GPT-5.6-Sol agora só gera **JSON estruturado** com as 3 seções, sub-etapas, bullets e alertas — sem HTML/CSS.
- Schema fixo por idioma (PT/EN/ES), paridade estrutural obrigatória (mesmo número de sub-etapas e alertas nos 3).

**Etapa 2 — Geração da imagem via imagegen premium**
- Chamar `openai/gpt-image-2` via `https://ai.gateway.lovable.dev/v1/images/generations` com `LOVABLE_API_KEY`.
- `size: "1024x1536"` (proporção retrato próxima da referência), `quality: "high"`, `stream: false` (edge function grava direto no bucket).
- Prompt de imagem combina:
  - Descrição visual detalhada do layout de referência (blocos, cores, ícones circulares, tipografia)
  - Nome da resina + conteúdo JSON serializado como texto do infográfico
  - Instrução explícita: "renderizar como infográfico vetorial estilo Smart Dent, layout idêntico à referência, tipografia sans-serif limpa, todos os textos em {idioma}"
- 3 chamadas paralelas (PT/EN/ES).

**Etapa 3 — Upload e persistência (mantida)**
- Decodificar `b64_json` → PNG binário
- Upload para bucket `model-images` em `resin-info-cards/{resin_id}/{lang}.png`
- Atualizar `resins.info_card_url_pt/en/es` + `info_card_generated_at`

## Arquivos a alterar

1. **`supabase/functions/generate-resin-info-card/index.ts`**
   - Remover: pipeline SVG/HTML fallback, `render-template`, foreignObject
   - Manter: chamada Poe/GPT-5.6-Sol apenas para gerar JSON estrutural
   - Adicionar: função `generateInfographicPNG(resin, contentJson, lang)` que chama `openai/gpt-image-2` via Gateway
   - Manter: upload no bucket + update em `resins`
   - Logar modelo em `ai_usage_logs` (`poe/gpt-5.6-sol` + `openai/gpt-image-2`)

2. **`src/components/AdminModal.tsx`** — nenhuma alteração (já mostra preview + status)

3. **`src/components/knowledge/KbTabCatalogo.tsx`** — ajustar download para `.png` (remover branch SVG)

## Prompt de imagem (rascunho — GPT-image-2)

```
Vertical infographic poster, 1024x1536, dental resin technical guide.
Style: clean vector illustration, Smart Dent brand (dark navy #1E3A8A logo top-left,
resin bottle photo top-right). Title "Processo de Uso e Pós-Processamento —
{RESIN_NAME}" in bold navy, subtitle "Guia visual para manual de instruções".

Three stacked rounded rectangle sections with colored borders and circular icon badges:
1) "1) PRÉ-PROCESSAMENTO" (navy #1E3A8A, thermometer icon)
2) "2) PÓS-PROCESSAMENTO" (green #10B981, gear icon)
3) "3) PÓS-CURA UV" (purple #7C3AED, sun icon)

Each section contains numbered sub-steps with small circular icons, titles and
bullet lists. Warning callouts on soft pink background with ⚠️ triangle icon.
Bottom "Importante" strip with blue shield icon.

Content (render exact text, language={LANG}):
{JSON_SERIALIZED_STEPS}

Typography: sans-serif, high legibility. White background with faint geometric
pattern top-right. No commercial info, no prices.
```

## Validação

1. Trigger "Gerar Card Informativo" em uma resina com `processing_instructions_pt/en/es` preenchidas
2. Conferir logs edge: 1× chamada Poe + 3× chamadas gateway `/v1/images/generations`
3. Conferir `resins.info_card_url_*` populados apontando para PNGs no bucket
4. Abrir Base de Conhecimento → aba Catálogo → confirmar imagem renderizando + botão download baixando `.png`

## Fora de escopo

- Migração para outros modelos de imagem (Gemini nano-banana etc.)
- Editor visual manual do card
- Cache/regeneração automática por mudança em `processing_instructions`
