## Objetivo

Substituir o gerador atual (edge function → Puppeteer quebrado) por um **preview + export no navegador** dentro do `AdminModal`, seguindo a identidade visual Smart Dent (Host Grotesk, paleta, layers), com conteúdo montado no modo **híbrido**: parser determinístico do markdown em PT + LLM só para traduzir EN/ES.

Coexiste com os botões manuais de upload PT/EN/ES já implementados. O botão de exportar substitui a UI antiga de "Gerar Card Informativo".

## Arquitetura

```
AdminModal
  └── <InfographicCard> (React, offscreen visible ao clicar "Preview")
        ├── camada 0: fundo/paleta Smart Dent (CSS puro, sem Nano Banana neste MVP)
        ├── camada 1: painéis das seções (pré / pós / pós-cura / alertas)
        ├── camada 2: <ProductHero> (img real do produto)
        ├── camada 3: logo oficial (SD_LOGO_URL)
        └── camada 4: rodapé "Importante"
  └── botão "Exportar PT/EN/ES"
        1. planContent(lang) → seções estruturadas
        2. carrega Host Grotesk + valida document.fonts.ready
        3. renderiza <InfographicCard lang plan /> offscreen
        4. aguarda waitForImage() em logo + produto
        5. html-to-image → PNG (pixelRatio 2)
        6. upload no bucket `model-images` (mesma pasta usada pelo upload manual)
        7. update resins.info_card_url_{lang} + info_card_status=ready
```

### Pacote

Adicionar `html-to-image` (peer-free, funciona com fontes web).

## Conteúdo (modo híbrido)

1. **Parser PT determinístico** — nova função `parseInstructionsMd(md)` que lê `resins.processing_instructions` e produz `Plan`:
   - `##` → seção com cor semântica (pré = azul-derivado, pós = verde clínico dessaturado, pós-cura = roxo dessaturado)
   - `###` → sub-seção numerada (1.1, 1.2…)
   - `>` → callout laranja `#DE6E37` @ 8% opacidade (regra do spec)
   - `•` (2 espaços = sub-bullet)
   - Extrai números técnicos (`60°C`, `3 min`) e envolve em `<span class="numeric-value">`.

2. **Tradução EN/ES via LLM** — nova edge function `translate-resin-card` recebe `Plan` PT + idioma alvo → devolve `Plan` traduzido. Chama Poe (Claude Sonnet 4.6), retorna JSON estruturado (mesmo schema do plan). Cache em `resins.info_card_plan_en/es` (novas colunas) para evitar retradução em cliques repetidos.

3. **Estados**: se PT tem markdown mas EN/ES ainda não traduziram → botão "Exportar EN/ES" mostra "Traduzindo…" antes do render.

## Componente `<InfographicCard>` (nova pasta `src/components/resin-card/`)

Arquivos:
- `SmartDentTheme.tsx` — CSS-in-JS/CSS module com tokens do spec (`--sd-navy`, `--sd-orange`, etc.), Host Grotesk `@import`, `.infographic-root`, `.brand-logo`, `.product-hero`, `.numeric-value`.
- `InfographicCard.tsx` — layout completo (header com logo esquerda + ProductHero direita, N seções coloridas, footer "Importante"). Recebe `plan: Plan`, `lang`, `resin: Resin`.
- `ProductHero.tsx` — conforme spec (blur pedestal, drop-shadow, sem filtro).
- `useAssetsReady.ts` — hook que aguarda `document.fonts.ready` + `waitForImage(logo)` + `waitForImage(product)` + retorna `AssetValidation`.
- `exportInfographic.ts` — orquestra `assetsReady → html-to-image → upload → update resins`. Retorna `{ url, validation }`.

## `resolveProductImage`

Utilitário compartilhado em `src/utils/resolveProductImage.ts`. Prioridade:
1. `resin.image_background_removed_url` (nova coluna, opcional)
2. primeiro válido em `resin.image_urls` (nova coluna JSONB, opcional)
3. `resin.image_url` (já existe)
4. → erro `MISSING_OFFICIAL_PRODUCT_IMAGE`, bloqueia exportação oficial, permite preview com placeholder cinza.

## Migration

```sql
ALTER TABLE public.resins
  ADD COLUMN IF NOT EXISTS image_background_removed_url text,
  ADD COLUMN IF NOT EXISTS image_urls jsonb,
  ADD COLUMN IF NOT EXISTS info_card_plan_pt jsonb,
  ADD COLUMN IF NOT EXISTS info_card_plan_en jsonb,
  ADD COLUMN IF NOT EXISTS info_card_plan_es jsonb;
```

(RLS/grants já existentes na tabela cobrem — sem novas policies.)

## Mudanças no `AdminModal`

Bloco atual do card (linhas ~1359-1499):
- Remove botão "Gerar Card Informativo" (chamada da edge function `generate-resin-info-card`).
- Adiciona:
  - `[Pré-visualizar Card]` → abre painel expansível com `<InfographicCard>` renderizado (PT default, seletor de idioma).
  - `[Exportar PT] [Exportar EN] [Exportar ES]` — cada botão executa o pipeline completo e grava em `info_card_url_{lang}`.
  - Painel de validação: check-list com `logoLoaded / productImageLoaded / fontLoaded` (verde/vermelho).
  - Se `MISSING_OFFICIAL_PRODUCT_IMAGE`: mostra erro e link "Cadastrar imagem do produto" (abre a aba de imagem).
- **Mantém** os botões manuais de upload/excluir PT/EN/ES entregues antes (fallback e override).

## Edge function

- **Deletar** `generate-resin-info-card` (motor Puppeteer quebrado, não faz mais sentido).
- **Criar** `translate-resin-card` (POST `{ plan, targetLang, resinId }` → `{ plan }`; usa Poe; persiste `info_card_plan_{lang}` no DB; retorna do cache se já existir).

## Fora de escopo

- Nano Banana (fundo IA). O MVP usa fundo CSS puro `#EDF0F7` + grafismos vetoriais leves. Etapa 2, depois de validar a arte estática.
- Editor visual das seções.
- Rodada de logo com background-removed alternativa.
- Batch (3 idiomas em 1 clique) — pode vir depois, o custo agora é 1 clique por idioma.

## Validação

1. Salvar resina com `processing_instructions` em PT (markdown ## / ### / > / •).
2. Abrir aba "Card Informativo" → clicar "Pré-visualizar" → conferir:
   - Host Grotesk carregada (não Arial),
   - logo SD no canto superior esquerdo, sem deformação,
   - imagem real do frasco à direita (drop-shadow, blur pedestal),
   - seções com cores semânticas discretas,
   - callouts laranja em opacidade correta,
   - números técnicos sem quebra.
3. Clicar "Exportar PT" → em <5s o PNG surge no card PT e persiste no DB.
4. Clicar "Exportar EN" → mostra "Traduzindo…" na 1ª vez, gera PNG EN com labels traduzidas, todo texto do plano PT presente traduzido.
5. Clicar "Exportar ES" → idem.
6. Deletar `resins.image_url` de uma resina → tentar exportar → erro `MISSING_OFFICIAL_PRODUCT_IMAGE`, botão bloqueado, preview mostra placeholder.
7. Forçar falha de Host Grotesk (DevTools bloqueando fonts.googleapis.com) → botão exportar bloqueia + warning "Fonte não carregada; usando Arial" só após 2 tentativas.

## Ordem de implementação

1. Migration (colunas novas).
2. Utilitário `resolveProductImage` + tokens Smart Dent (`SmartDentTheme.tsx`).
3. `parseInstructionsMd` + tipos `Plan` compartilhados.
4. `<InfographicCard>` + `<ProductHero>` + preview offscreen.
5. Edge function `translate-resin-card` + cache no DB.
6. `exportInfographic` (html-to-image + upload + update).
7. Rewire do bloco no `AdminModal` (preview, botões, validação).
8. Deletar `generate-resin-info-card`.