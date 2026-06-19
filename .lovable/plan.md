## Resposta direta

Você tem razão — Poe tem modelos MUITO melhores que Nano-Banana pra esse tipo de peça. O Nano-Banana (Gemini Flash Image) é bom pra fotos e edição, **péssimo pra tipografia e layouts editoriais com texto**. É exatamente por isso que sai colagem com letra torta.

## Cardápio Poe relevante pro nosso caso (capa de evento com tipografia + logo + bandeira + rodapé)

| Modelo Poe | Força | Fraqueza | Nota pra capa de evento |
|---|---|---|---|
| **Ideogram-v3** | **Rei absoluto em texto dentro de imagem.** Foi desenhado pra pôster/branding/tipografia legível. Renderiza headlines, captions, logos com kerning real. | Menos fotorrealista que FLUX | ⭐⭐⭐⭐⭐ |
| **GPT-Image-1** | Excelente em texto + composição editorial + segue layout literal. Aceita imagem de referência (edit mode). | Mais caro, mais lento | ⭐⭐⭐⭐⭐ |
| **Recraft-v3** | Especialista em design gráfico/pôster, vetor-like, tipografia crisp. Tem modo "any-text". | Estética mais "design system", menos cinematográfica | ⭐⭐⭐⭐ |
| **FLUX-pro-1.1-ultra** | Fotorrealismo top, atmosfera cinematográfica linda. | Texto ainda erra (não compete com Ideogram/GPT). | ⭐⭐⭐ (só pra background) |
| **Imagen-4** / **Imagen-4-Ultra** | Boa qualidade geral, melhor que Nano-Banana em texto. | Inferior a Ideogram pra pôster com texto. | ⭐⭐⭐ |
| **Seedream-4** | Composição de design forte, bom em pôster asiático/editorial. | Texto em português às vezes erra acento. | ⭐⭐⭐ |
| **Nano-Banana** (atual) | Foto/edição leve | **Texto fica torto, vira colagem, ignora layout.** | ⭐ (não usar) |

## Minha recomendação: **Ideogram-v3**

Pra essa ferramenta específica (capa de evento Smart Dent com "PRESENÇA CONFIRMADA", nome do evento gigante, bandeira, logo, rodapé com cidade/datas/stand), **Ideogram-v3 é o match perfeito**:

- Foi treinado especificamente pra **posters, álbuns, branding, capas** — exatamente o caso de uso
- **Renderiza texto em português corretamente** (com acento, caps, kerning amplo)
- **Respeita hierarquia tipográfica** (eyebrow pequeno, título display, rodapé fino) sem virar mockup de UI
- **Não inventa retângulos cinza** nem "STAND: " vazio
- Disponível no Poe via `Ideogram-v3` (também tem `Ideogram-v3-Quality` pra máxima fidelidade)

GPT-Image-1 seria o segundo lugar, mas tem 2 desvantagens no nosso caso: não está em todos os planos Poe e é ~5x mais lento.

## O que muda na função

Único ponto de mudança em `supabase/functions/event-generate-image/index.ts`:

```ts
// ANTES
const poeRes = await callPoe({
  model: "Nano-Banana",
  messages: [{ role: "user", content }],
});

// DEPOIS
const poeRes = await callPoe({
  model: "Ideogram-v3-Quality",  // ou "Ideogram-v3" pra mais rápido/barato
  messages: [{ role: "user", content }],
});
```

**Mais nada muda** — `callPoe` já existe, o prompt cinematográfico atual funciona, o upload no Storage permanece igual, o frontend não precisa mexer.

## Ajuste fino no prompt (opcional mas recomendado)

Ideogram entende melhor instruções **declaradas em inglês** pra texto, mesmo que o texto final seja em PT. Posso adaptar o `layoutBlock` pra usar diretivas como:
- `Render the exact text: "PRESENÇA CONFIRMADA" in white condensed sans-serif caps, small, wide tracking`
- `Render the exact event title: "${eventName}" in massive white display caps, black weight`
- `Render the exact footer line: "${cityLine} · ${dateRange} · STAND ${stand}"`

Isso garante que ele **escreve exatamente esses textos** sem inventar nada.

## Confirmações

1. Topa trocar pra **`Ideogram-v3-Quality`** (melhor pra texto/pôster)?
2. Quer que eu já adapte o prompt com as diretivas estilo Ideogram (declarar texto exato em inglês) pra extrair o máximo do modelo?