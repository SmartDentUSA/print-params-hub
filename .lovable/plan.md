

## Remover valores/precos dos prompts de geracao de conteudo

### Problema

Os prompts de geracao de conteudo por IA incluem precos dos produtos (R$ XX,XX), o que expoe informacoes comerciais sensiveis nos artigos publicos e pode ficar desatualizado rapidamente.

### Arquivos afetados

**1. `supabase/functions/ai-orchestrate-content/index.ts`**

- **Linha 283-285**: Remover bloco `💰 DADOS COMERCIAIS` que injeta `Preço: R$ ${item.price}` no contexto enviado a IA
- **Linha 301**: Remover instrucao "Mencionar preços e links de compra quando disponíveis"
- **Linha 314**: Remover proibicao "Mencionar preços de produtos não listados acima" (ja nao fara sentido)
- **Linhas 193-196**: Remover `price` do SELECT da tabela `resins`
- **Linhas 224-226**: Remover `price` do SELECT da tabela `system_a_catalog`

**2. `supabase/functions/ai-enrich-pdf-content/index.ts`**

- **Linha 166**: Remover `price` do SELECT de `system_a_catalog`
- **Linha 275**: Remover referencia a "preço" na descricao de secao de produtos

**3. `supabase/functions/auto-inject-product-cards/index.ts`**

- **Linhas 267-269**: Remover geracao de `priceHtml` no card injetado
- **Linha 304**: Remover `${priceHtml}` do template HTML do card
- **Linha 115**: Remover `price, currency` do SELECT
- **Linhas 143-144, 180-181**: Remover `price` e `currency` do mapeamento

**4. `supabase/functions/export-apostila-docx/index.ts`**

- **Linhas 453-455**: Remover bloco que adiciona "Preço: R$ X,XX" na apostila exportada

### O que NAO sera alterado

- `supabase/functions/import-system-a-json/index.ts` e `import-loja-integrada/index.ts` — sao importadores, o preco continua sendo salvo no banco para uso interno/admin
- `supabase/functions/seo-proxy/index.ts` — Schema.org Product com price e valido para SEO estruturado (Google Shopping), manter
- `og-visual-dictionary.ts` — ja proibe precos em imagens, esta correto
- `system-prompt.ts` — nao menciona precos diretamente
- Admin UI (formularios) — preco continua editavel no painel, so nao sera usado nos prompts de IA

### Resultado

Os artigos gerados pela IA nao incluirao mais valores monetarios. Os precos continuam no banco de dados e no painel admin, mas nao serao injetados nos prompts nem exibidos nos cards automaticos de produtos dentro dos artigos.

