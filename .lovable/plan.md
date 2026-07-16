## Diagnóstico

O `openai/gpt-image-2` é um modelo **generativo de imagem** — ele não é um renderizador de texto. Por isso:

1. **Omite conteúdo**: mesmo com prompt verbatim, o modelo resume/reescreve/pula bullets quando o texto é longo (você perdeu Lavagem, Pós-cura UV, Tratamento térmico, Polimento, Caracterização estética, Condicionamento, Cimentação).
2. **Ignora URLs**: não consegue baixar `https://.../logo.png` nem `https://loja.smartdent.com.br/...`. Ele "imagina" um logo SD e uma bisnaga preta genérica.
3. **Alucina texto**: já vimos "NanoClea" cortado, "80 nos equipos" etc.

Não há tuning de prompt que resolva isso — a arquitetura está errada para o objetivo.

## Correção

Trocar `openai/gpt-image-2` por **HTML/CSS renderizado a PNG** via `api/render-template.ts` (Puppeteer/Chromium já existente no projeto). Isso garante:

- 100% do texto do plano (nada omitido).
- Logo SD **real** (`product-images/h7stblp3qxn_1760720051743.png`) via `<img src>`.
- Foto **real** do frasco vinda do produto (`loja.smartdent.com.br/resina-smart-print-bio-vitality`) via `<img src>`.
- Layout pixel-perfect igual à referência que você anexou (barra navy, badges circulares, cores por seção, callouts ⚠️, footer pink com escudo).
- Tipografia nítida, sem alucinação.

### 1. `supabase/functions/generate-resin-info-card/index.ts`

- **Remover** `generateInfographicPNG`, `buildImagePrompt`, `serializePlanContent`, `IMAGE_MODEL`, `IMAGE_GATEWAY`, chamadas ao gateway de imagem, e `logAIUsage` de `resin_info_card_image`.
- **Manter** `planCardWithLLM` (Poe → JSON estruturado trilíngue) — ele já entrega o conteúdo íntegro.
- **Adicionar** `renderCardHtml(plan, lang, resin)` que gera HTML/CSS fiel à referência:
  - Header: barra navy 8px, logo SD (URL do storage), título grande navy, subtítulo cinza com linha, foto do frasco à direita.
  - Corpo: N seções (blue/green/purple) com badge circular, heading numerado, colunas 2–4 com sub-numeração (`1.1`, `1.2`…), bullets em `<ul>`, tokens em `<strong>`, callouts ⚠️ pink.
  - Footer: box pink com escudo navy + `important`.
- **Adicionar** `renderPNG(html, width=1080, height=~1600)` que faz `POST` para `${VITE_PUBLIC_ORIGIN}/api/render-template` (o endpoint Vercel já existe) e recebe PNG.
- **Product image**: novo campo `resins.product_image_url` (ou reusar `resins.image_url` se já existir — verificar no schema). Passar para o renderer. Fallback: silhueta neutra do frasco em SVG inline.
- **Height dinâmica**: computar altura ~= `540 + 320*num_sections + 220` para caber tudo sem cortar (ou usar `waitForSelector` + `page.evaluate(document.body.scrollHeight)` no `render-template.ts`).
- Fire-and-forget async (`EdgeRuntime.waitUntil`) — arquitetura atual mantida, mas cada idioma agora leva **~2–4 s** (Puppeteer) em vez de 40–70 s (GPT-image-2). Total dos 3 idiomas < 15 s.

### 2. `api/render-template.ts`

Pequenos ajustes para suportar altura dinâmica:
- Aceitar `height: 'auto'` no body → após `setContent`, ler `document.body.scrollHeight` e re-setar viewport + `clip`.
- Aumentar timeout de screenshot para 30 s (o Chromium cold start no Vercel demora ~5 s).

### 3. Migração (só se necessário)

Se `resins` ainda não tiver coluna para imagem do produto, adicionar `product_image_url text` (nullable). O `AdminModal` já tem upload de imagens do produto — mapear qual campo existente usar antes de criar coluna nova.

### 4. `src/components/AdminModal.tsx`

Sem mudanças de lógica — polling de `info_card_status` já cobre. Ajustar só a label do badge de "Gerando (~60–120s)…" para "Gerando (~15s)…".

## Fora de escopo

- Editor visual do card.
- Suportar mais que 3 idiomas.
- Trocar Poe / plano JSON (o LLM continua igual).

## Validação

1. Clicar "Gerar Card Informativo" na resina Smart Print Bio Vitality.
2. Em ~15 s os 3 PNGs aparecem no modal.
3. Abrir o PNG PT: verificar que **todo** o texto que você colou (Pré, Pós-lavagem NanoClean, Secagem ar, Pós-cura Elegoo/Anycubic/ShapeCure, Tratamento térmico A/B/C/D, Polimento, SmartMake 5 etapas, Condicionamento, Protocolo clínico, Cimentação) está renderizado, com bullets e ⚠️.
4. Logo Smart Dent no topo é a imagem real do storage (não desenho gerado).
5. Foto do frasco à direita é a real do produto (não bisnaga preta genérica).
6. Sem alucinação: nenhum "NanoClea" cortado, nenhum "80 nos equipos".
