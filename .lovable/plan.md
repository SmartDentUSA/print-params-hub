
## Objetivo
Editor de eventos com IA + capa por idioma na base de conhecimento, **respeitando os formatos de imagem oficiais por canal**.

## Formatos oficiais (aplicados em TODA geração/upload de imagem)

| Uso                                         | Proporção | Tamanho (px)  | Limite |
|---------------------------------------------|-----------|---------------|--------|
| Instagram / Facebook — Feed & Stories       | 4:5       | 1080 × 1350   | 8 MB   |
| Reddit                                      | 1:1       | 1080 × 1080   | 8 MB   |
| LinkedIn — Carrossel PDF (por página)       | 4:5       | 1080 × 1350   | —      |
| Capa Hero — Base de Conhecimento / Evento   | 16:9      | 1200 × 675    | 5 MB   |

Esses presets viram um único dicionário compartilhado em `src/lib/social/imagePresets.ts` e são usados em:
- Editor de eventos (capa hero 16:9 por idioma)
- `StepMedia` do Social Publisher (presets por canal selecionado)
- Edge function `social-generate-image` (já existe — passar `aspect` + dimensão correta)
- Edge function nova `event-generate-image` (16:9, 1200×675)

## Comportamento confirmado (idiomas)
- 3 imagens **separadas** (PT/EN/ES) geradas pela IA, persistidas em colunas distintas.
- `KbTabEventos.tsx` lê `useLanguage()` e troca a capa para o idioma escolhido; fallback PT → `cover_image_url` legado.

## Schema (`smartops_events`)
Adicionar:
- `about_event_pt/en/es text`
- `cover_image_pt/en/es text` (16:9, 1200×675)
- `reference_image_url text`, `event_logo_url text`
- `ai_image_prompt_pt/en/es text`

## Editor (`SmartOpsEvents.tsx`)
```
Nome • País • Site [🔎 Buscar info na web]
Sobre o evento — Tabs PT/EN/ES (textarea + [✨ Gerar IA])
Data início • Data fim • Local • Stand • Ordem • Ativo

— Mídia de referência (alimenta a IA) —
[Upload imagem referência] [Upload logo do evento]

— Capa do evento por idioma — (preset 16:9 / 1200×675 / ≤5MB)
Tabs: PT | EN | ES
  • Preview 16:9
  • Upload manual com validação do preset
  • Crop 16:9 (react-easy-crop)
  • Painel IA: prompt editável + [Gerar com Poe Nano-Banana]
Notas internas
```

## Edge functions novas
1. **`event-web-research`** — Firecrawl scrape do site → pré-preenche campos + sugere `og:image` como referência.
2. **`event-generate-about`** — Lovable AI (`google/gemini-2.5-flash`), 300–500 palavras no idioma alvo, sem preços (Core rule). Persiste em `about_event_{lang}`.
3. **`event-generate-image`** — `callPoe({ model: 'Nano-Banana' })` com referência + logo, **força 16:9 / 1200×675**, salva em `wa-media/events-ai/{event_id}/{lang}-{ts}.png`, grava `cover_image_{lang}`.

## StepMedia (Social Publisher) — alinhamento aos novos presets
- Em `AIImagePanel`, substituir o seletor genérico (Square/Vertical/Horizontal) por **opções dirigidas ao canal selecionado**:
  - Instagram/Facebook Feed & Stories → 4:5 (1080×1350)
  - Reddit → 1:1 (1080×1080)
  - LinkedIn Carrossel → 4:5 (1080×1350) por página
- Uploads manuais validam contra o preset do canal (avisar "imagem fora do recomendado").
- `social-generate-image` recebe `aspect` + `width`/`height` exatos do preset.

## Frontend público (`KbTabEventos.tsx`)
- Adicionar `cover_image_pt/en/es` ao `select`.
- Helper `pickCover(e, language)` → `cover_image_{lang}` ⟶ `cover_image_pt` ⟶ `cover_image_url`.
- Troca de idioma no header re-renderiza o card e troca a capa.

## Componentes novos
- `src/lib/social/imagePresets.ts` — dicionário único de presets.
- `src/components/smartops/events/EventReferenceUploads.tsx`
- `src/components/smartops/events/EventAboutByLanguage.tsx`
- `src/components/smartops/events/EventCoverByLanguage.tsx`
- `src/components/smartops/events/EventAIImagePanel.tsx`
- `src/components/smartops/events/EventWebResearchButton.tsx`

## Fora de escopo
- Layout do listing admin.
- Geração de PDF do carrossel LinkedIn (só preset visual por página por enquanto).
- Fluxo Canva existente (`canva_image_*`) permanece intocado.

## Perguntas finais
1. **Texto literal na imagem**: a capa gerada deve conter o nome do evento renderizado no idioma (ex: "INTERNATIONAL DENTAL SHOW 2026") ou apenas visual + título em overlay no card?
2. **Sobre o evento**: ao salvar, **publica automaticamente** um artigo em `knowledge_contents` (Ciência & Tecnologia) ou fica armazenado no evento até você publicar manualmente?
3. **Validação de upload**: bloqueio rígido fora do preset, ou só aviso amarelo e segue?
