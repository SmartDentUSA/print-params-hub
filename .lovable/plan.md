## Objetivo

Substituir/complementar o badge "Revenda Oficial exocad" (canto do card do hero) por um **player de áudio explicativo** do produto, com upload de arquivo `.mp3` no builder da LP.

## Design da identificação visual

Um botão-pill compacto, no mesmo lugar do badge atual (canto inferior-esquerdo do card do hero), com:

- Ícone de **auto-falante animado** (pulsando suavemente enquanto não está tocando) para sinalizar "tem áudio aqui".
- Label curta: **"Ouvir explicação"** (2s → muda para tempo decorrido / total quando toca).
- Ao clicar: expande em um mini-player horizontal (play/pause + barra de progresso + tempo), mantendo o mesmo pill.
- Badge "Revenda Oficial exocad" se mantém, mas movido para o topo do card (junto ao "RMS · Regional Monthly Subscription"), preservando a credencial.

Racional: o usuário reconhece imediatamente que há conteúdo em áudio (ícone + microcopy + pulso), diferente de um simples badge estático, e o toque de "play" é o affordance universal.

## Mudanças

### 1. Tipo `LPContent` — `src/components/lp/PremiumLandingTemplate.tsx`

Adicionar campo opcional em `hero`:
```ts
audio?: { url: string; label?: string };
```

### 2. Player no card do hero — `PremiumLandingTemplate.tsx` (linhas 449-454)

- Mover o badge "Official Reseller" para o topo (linha ~440, ao lado de "Smart Dent").
- No lugar dele (bottom-left), renderizar `<HeroAudioPlayer url={c.hero.audio.url} label={c.hero.audio.label} />` quando `hero.audio?.url` existir.
- Componente novo `HeroAudioPlayer`: pill branco com ícone `Volume2` (pulsando via CSS `animate-pulse` até primeiro play), botão play/pause, barra de progresso fina laranja, tempo `0:12 / 1:45`. Usa `<audio>` nativo controlado por `useRef` + `useState`.

### 3. Upload de MP3 no builder — `LandingPageBuilderModal.tsx`

- Criar `src/components/smartops/HeroAudioUpload.tsx` (baseado em `CoverImageUpload.tsx`):
  - Bucket: `knowledge-images` (já público), prefixo `lp-audio/`.
  - Aceita `audio/mpeg` (`.mp3`), limite 15 MB.
  - Preview: `<audio controls>` com a URL enviada.
  - Botão "Remover" limpa o campo.
- Na aba "Editar" do modal (junto ao `CoverImageUpload` do hero, ~linha 520), adicionar:
  - `HeroAudioUpload` ligado a `content.hero.audio.url`.
  - `TextField` "Rótulo do player" (default: "Ouvir explicação").

### 4. Persistência

Nenhuma migration necessária: `content` já é `jsonb`. O campo `hero.audio` é serializado junto.

### 5. Regeneração com IA

`enforceCanonicalContent` em `landing-page-generator/index.ts` **preserva** `content.hero.audio` do LP existente ao regenerar (mesmo padrão do `hero_image_url`). Adicionar mesclagem explícita.

## Detalhes técnicos

- Storage bucket `knowledge-images` já é público (usado por capas). Sem novas policies.
- Player usa apenas HTML5 `<audio>` — sem libs externas.
- Acessibilidade: `aria-label="Reproduzir explicação do produto"` no botão play.
- Mobile: pill vira full-width abaixo do card em `< sm`.

## Validação

1. Build TypeScript sem erros (`bunx tsgo --noEmit`).
2. No admin: abrir LP exocad → aba Editar → upload `.mp3` → salvar.
3. Abrir `/lp/{slug}` público → ver pill "Ouvir explicação" pulsando → clicar → tocar áudio.
4. "Regenerar com IA" mantém o áudio.

## Fora de escopo

- Waveform visual (barras animadas) — mantido simples com barra de progresso linear.
- Transcrição automática do MP3.
- Múltiplos áudios por seção.
