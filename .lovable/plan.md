## Auditoria Social Publisher — Plano de correções

Escopo dividido em 5 frentes. Tudo frontend + 1 edge function nova (sync unificada). Sem mudanças de schema.

### 1. `/social/banco` — Banco de Posts (`SocialPostsBank.tsx` + `SocialPostCard.tsx`)

- **Card**: aspect-ratio dinâmico por formato (1:1 feed/image/carousel, 9:16 reel/story, 16:9 video). Placeholder com ícone SVG colorido da rede quando `thumbnail_url` é null. Badge canal (top-left, cor da rede) + badge formato (top-right). Caption clamp-2 com "ver mais". Métricas ♡ 💬 👁. Data relativa. Hover: botões "Copiar link" e "Usar em campanha".
- **Indicador carrossel**: ícone de stack quando `format='carousel'` ou múltiplas mídias.
- **Filtros funcionais** (já existem mas reforçar): toggles canal multi-select com cor ativa, dropdown formato (Feed/Reel/Story/Video/Carrossel), input busca caption (ILIKE), period quick-select (7d/30d/3m/tudo) substituindo dois date pickers, ordenar mantém. Cada change re-dispara query.
- **Botão Sincronizar**: já existe via `useZernioSync`. Garantir spinner + toast sucesso/erro e invalidate da query `social-posts-bank`.
- **Estado vazio**: ilustração SVG inline + CTA "Sincronizar agora".
- **Skeleton**: grid 3 col com shimmer enquanto `isLoading`.

### 2. `/social/calendario` — Calendário (`SocialCalendar.tsx` + `CalendarDayCell.tsx` + `useCalendarPosts.ts`)

- **Fonte unificada**: `useCalendarPosts` passa a fazer 2 queries paralelas:
  - `social_scheduled_posts` no range (já faz).
  - `social_posts` por `published_at` no range (novo) — marcados como `source='published_history'`.
  Mescla por dia em `postsByDay`.
- **Chip do dia**: ícone da rede colorido + caption 1 linha (~30 chars) + bolinha de status colorida (verde/azul/amber-pulse/vermelho/cinza). Múltiplos canais = ícones empilhados (max 3 + "+N").
- **Navegação**: já chama setCursor → query refaz por nova range. Validar "Hoje" reseta.
- **Modos Mês/Semana/Lista**: tabs no header. Semana: 7 col × horários 08–22h posicionados por hora de `scheduled_at`/`published_at`. Lista: tabela compacta.
- **Drag & drop**: já existe para reagendar (`useReschedulePost`). Apenas posts `source='scheduled'` arrastáveis; histórico publicado é read-only. Visual: card opaco ao arrastar, destino destacado.
- **Click no chip** → modal preview com botões Editar/Duplicar/Cancelar/Retry. **Click em dia vazio** → `navigate('/social/novo?date=YYYY-MM-DD')` e o editor pré-preenche `scheduled_at`.
- **Filtros**: canal multi-toggle + status multi-toggle aplicam no `useMemo` existente.

### 3. `/social/novo` — Editor (`StepPreview.tsx` + `StepChannels.tsx` + `StepContent.tsx` + `StepMedia.tsx`)

- **Preview lateral**: tabs por canal ATIVO (avatar circular colorido). Cada tab renderiza mockup específico com aspect-ratio correto (1:1 IG feed, 9:16 reel/story/TT, 16:9 YT, 2:3 PT, 1.91:1 FB, texto-only Reddit). Caption respeita limite do canal mais restritivo (mostra contador). Indicador ⚠ na tab quando campos obrigatórios faltam.
- **Seleção canal**: botão circular 44px, opacidade 0.3 inativo / 1.0 ativo, animação scale pop ao ativar. Pills de formato suaves abaixo do ícone.
- **Campos condicionais**: garantir render confiável dos blocos YouTube/Pinterest/Reddit/TikTok com `border-l-4` na cor da rede. Cada bloco controlado por `formats[platform]` selecionado (não apenas canal ativo).
- **Upload mídia**: barra de progresso real do `useMediaUpload` (já tem signal de progresso). Thumbnail no grid, duração para vídeo (extraída do `<video>` metadata), botão × remover, máx 10.
- **Hashtags**: chips removíveis, contador "X/30", toggle "Mover para 1º comentário".

### 4. `/social` — Dashboard (`SocialDashboard.tsx` + `useSocialMetrics.ts` + `useUpcomingPosts.ts`)

- **Métricas**: ajustar `useSocialMetrics` para:
  - Publicados mês: `social_posts` `published_at >= startOfMonth`.
  - Agendados: `social_scheduled_posts` `status='scheduled'`.
  - Hoje: `social_posts` `published_at::date = today` (novo card substitui ou complementa).
  - Falhas: `status='failed'`.
- **Próximos posts**: já filtra agendados — manter.
- **Posts recentes**: nova seção (3 últimos de `social_posts` por `published_at desc`) com likes/reach.
- **Gráfico semanal**: linha recharts simples — posts/dia × canal nos últimos 7d. Opcional, incluso.

### 5. `/social/analytics`

Já tem implementação. Ajustes incrementais:
- Tabs por canal (Todos/IG/TT/YT/FB/PT/RD) que filtram a tabela.
- Garantir ordenação clicável por coluna (Curtidas/Alcance/Comentários/Data).
- Estado vazio com CTA Sincronizar.

### Detalhes técnicos

- **Design tokens**: criar mapa `SOCIAL_BRAND_COLORS` em `src/lib/socialChannels.ts` com HEX exatos (#E1306C, #1877F2, #000, #FF0000, #E60023, #FF4500) usados via `style={{color}}` apenas em ícones de marca (exceção semântica documentada). Status colors via tokens HSL no `index.css` (`--social-published`, etc.).
- **Edge function**: NÃO criar `social-posts-sync` agora — o sync já roda via `zernio-metrics-sync` + `zernio-webhook`. Apontar `useZernioSync` para esses. (Sem mudança de backend nesta entrega.)
- **Sem migrações** — todos os campos já existem.

### Arquivos a editar/criar

```
src/lib/socialChannels.ts                          (add brand colors + status tokens)
src/index.css                                      (add --social-* HSL tokens)
src/components/social/SocialPostCard.tsx           (rewrite)
src/components/social/SocialPostsBank.tsx          (filters + empty + skeleton)
src/components/social/SocialPostEmpty.tsx          (NEW — illustration)
src/components/social/SocialDashboard.tsx          (métricas + recentes + gráfico)
src/hooks/social/useSocialMetrics.ts               (queries reais)
src/hooks/social/useCalendarPosts.ts               (merge published history)
src/components/social/calendar/SocialCalendar.tsx  (modos + filtros + modal)
src/components/social/calendar/CalendarDayCell.tsx (chip novo)
src/components/social/calendar/PostPreviewDialog.tsx (NEW)
src/components/social/editor/steps/StepPreview.tsx (mockups por canal)
src/components/social/editor/steps/StepChannels.tsx (visual)
src/components/social/editor/steps/StepContent.tsx (hashtags chips + contador)
src/components/social/editor/steps/StepMedia.tsx   (progresso + duração)
src/components/social/SocialAnalytics.tsx          (tabs canal + sort headers)
```

Sem mudanças em rotas, schema ou edge functions.