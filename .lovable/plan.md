## Objetivo

Na geração de post, oferecer 3 caminhos lado-a-lado:
1. **Usar uma copy pronta** vinda do endpoint `knowledge-export-full` do Sistema A (mensagens CS/aftersales, Google Ads, SEO description) — usuário escolhe e ela cai direto na legenda.
2. **Gerar com IA** — agora com cara de Instagram (emojis, bullets, unicode estilizado, hashtags em bloco) e enriquecida com os mesmos dados do endpoint.
3. **Escrever do zero** — caminho atual (textarea já existente).

## Fonte de dados (mesma para os 3 caminhos)

`POST https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-export-full` retorna por produto:
- `messages.cs[]` e `messages.aftersales[]` → cada item `{ message_content, message_order, is_active }` (copy de WhatsApp/CS pronta — inclui mensagens tipo "Comente X").
- `google_ads` → headlines/descriptions de campanha.
- `seo.seo_description`.
- Enriquecimento: `description`, `applications`, `benefits[]`, `features[]`, `keywords[]`, `target_audience`, `tags[]`, `faq[]` (top 3), `videos.youtube[].title/description` (até 3), `ctas.product_url`.

Match por `slug` exato → fallback `name ILIKE`. Cache em memória 10 min, soft-fail.

## Backend

### Novo edge function `social-knowledge-fetch`
- Input: `{ product_slug?, product_name? }`.
- Chama `knowledge-export-full`, encontra o produto, devolve payload já normalizado:
  ```ts
  { product: { name, slug, category, url },
    ready_copies: [
      { id, source: 'cs'|'aftersales'|'google_ads'|'seo', label, text }
    ],
    enrichment: { description, benefits, features, faq_top, videos_top, keywords, target_audience }
  }
  ```
- Soft-fail (200 com `ready_copies: []` se 404/timeout).

### `social-caption-generator/index.ts`
- Recebe opcional `external_enrichment` (já buscado pelo front, evita duplicar chamada). Se ausente, faz fetch interno.
- Adiciona no prompt um bloco `EXPORT SISTEMA A (knowledge-export-full)` com benefícios, features, FAQ-top, vídeos relacionados, keywords, público.
- Reescreve `buildPrompt` para platform `instagram|facebook` em modo Instagram-rich:
  - 1ª linha = gancho com 1 emoji forte
  - 3–6 bullets `▸`/`✔️` com 1 emoji cada
  - Frase de transformação/prova
  - CTA destacado (ex.: `👉 Saiba mais no link da bio`)
  - Separador `━━━━━━━━━━━━━━━`
  - Bloco hashtags separado por linha em branco
  - Permitir 1–2 palavras em unicode estilizado (𝗻𝗲𝗴𝗿𝗶𝘁𝗼 / 𝘪𝘵á𝘭𝘪𝘤𝘰) — sem markdown, que Instagram renderiza literal
  - 6–12 emojis contextuais (não decorativos)
- Mantém regras de proibição de preço e promessas regulatórias.
- `_meta` ganha `export_hits` e `export_matched_slug`.

## Frontend (`StepContent.tsx`)

Após o `SearchableProductSelect`, quando um produto é selecionado:

1. **Auto-fetch** via novo hook `useProductKnowledgeCopies(product_slug, product_name)` que chama `social-knowledge-fetch`.
2. **Nova seção "Copies prontas do Sistema A"** dentro do card "Gerar com IA":
   - Lista compacta de chips/cards horizontais (até 8), cada um com:
     - Badge da origem (`CS`, `Pós-venda`, `Google Ads`, `SEO`)
     - Preview de 2 linhas do texto
     - Botão **"Usar esta copy"** → preenche `caption` (mantendo `hashtags` e `first_comment` vazios para o usuário ajustar).
   - Mensagem vazia se 0 copies: "Sem copies prontas para este produto. Gere com IA ou escreva abaixo."
3. **Botão "Gerar com IA"** continua igual, mas passa `external_enrichment` no body (evita 2ª chamada externa).
4. **Toast** ao usar copy pronta: "Copy do Sistema A aplicada — ajuste e publique".

## Out of scope
- Editar a copy do Sistema A no painel (read-only aqui).
- Salvar de volta a copy escolhida no Sistema A.
- Mudanças nos ícones de canal, schema do banco, ou no publisher.
- Autenticação no endpoint (assume público; warning + skip se 401).

## Validação
1. Deploy `social-knowledge-fetch` e `social-caption-generator`.
2. `curl` em `social-knowledge-fetch` com slug `nanoclean-pod-limpeza-resina-3d-odontologica-sem-alcool` → deve trazer vídeo no enrichment.
3. `curl` em `social-caption-generator` com platform `instagram` → caption volta com bullets `▸`, emojis e bloco final de hashtags; `_meta.export_hits >= 1`.
4. UI: selecionar produto → ver chips de copies prontas; clicar "Usar esta copy" preenche a legenda; clicar "Gerar com IA" gera versão estilo Instagram.
