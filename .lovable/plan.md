## Fase 1A — Social Publisher: Dashboard + Banco de Posts

Escopo cirúrgico para entregar valor visual rápido. Editor (1B) e Calendário (1C) ficam em fases seguintes.

---

### Entregáveis

1. **Nova área `/social` no SmartOps** (sidebar lateral própria, padrão visual escuro)
2. **`/social` — Dashboard** com métricas e próximos posts
3. **`/social/banco` — Banco de posts** sincronizados da Zernio
4. Placeholders navegáveis para `/social/novo`, `/social/calendario`, `/social/analytics` (com "Em breve") para a sidebar já estar completa

---

### Arquivos a criar

```
src/components/social/
  SocialLayout.tsx           # Sidebar + outlet (padrão SmartOps escuro)
  SocialSidebar.tsx          # Nav: Dashboard · Criar · Calendário · Banco · Analytics
  SocialDashboard.tsx        # Métricas + lista "próximos 7 dias"
  SocialPostsBank.tsx        # Grid filtrável de social_posts
  SocialPostCard.tsx         # Card individual do banco (thumb + métricas + ações)
  MetricCard.tsx             # Card de KPI (publicados, agendados, falhos, último sync)
  ComingSoon.tsx             # Placeholder reutilizável

src/hooks/social/
  useSocialMetrics.ts        # Conta posts por status do mês corrente
  useUpcomingPosts.ts        # social_scheduled_posts próximos 7 dias
  useSocialPostsBank.ts      # POST social-posts-search com filters
  useZernioSync.ts           # POST social-posts-sync + toast
```

### Arquivos a editar

- `src/App.tsx` — adicionar rotas filhas sob `/social/*` (fora do site público, sem Footer/DraLIA — adicionar a `/social` ao guard de `FooterGlobal`/`DraLIAGlobal`)
- `src/components/AdminSidebar.tsx` ou `SmartOpsTab.tsx` — adicionar atalho "📱 Social" que navega para `/social` (área externa ao admin, mas acessível pela mesma sessão)

---

### Detalhes de implementação

**Roteamento**: `/social/*` é uma área autenticada separada do admin (não dentro de `/admin`). Usa `SocialLayout` como wrapper com `<Outlet/>`. Acesso protegido pelo mesmo auth do admin (reusa `AdminViewSecure` pattern — verificar sessão Supabase + role).

**Sidebar `/social`** (componentizada, escura igual SmartOps):
- 📊 Dashboard → `/social`
- ✏️ Criar Post → `/social/novo` (placeholder Fase 1B)
- 📅 Calendário → `/social/calendario` (placeholder Fase 1C)
- 🗃️ Banco de Posts → `/social/banco`
- 📈 Analytics → `/social/analytics` (placeholder)
- Botão "← Admin" no rodapé

**Dashboard** (`/social`):
- Header: título "Social Publisher" + botão "🔄 Sincronizar" (chama `social-posts-sync`, toast "X posts sincronizados") + botão "+ Criar Post" (navega `/social/novo`)
- 4 cards de métricas em grid (lg:grid-cols-4):
  - Publicados este mês — `count` em `social_scheduled_posts` onde `status='published'` e `published_at >= startOfMonth`
  - Agendados (7 dias) — `status='scheduled'` e `scheduled_at` entre now e now+7d
  - Falhos — `status='failed'` (com botão "Ver" que filtra a tabela)
  - Último sincronizado — `max(synced_at)` em `social_posts` ou `created_at` se não houver
- Tabela "Próximos posts" (próximos 7 dias):
  - Coluna: thumbnail (1º media_item), badge canal, caption truncada, data/hora SP, badge status
  - Click na linha → modal de preview (modal completo fica na Fase 1C; nesta fase só exibe os campos)

**Banco de Posts** (`/social/banco`):
- Header: "Banco de Posts" + contador "X posts" + botão "🔄 Sincronizar"
- Filtros em linha:
  - Canal (multi-select: IG/FB/TT/YT/PT/RD)
  - Formato (select dependente do canal)
  - Produto (input texto livre)
  - Período (date range)
  - Ordenar por (data desc/asc, likes desc, reach desc)
- Grid responsivo `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Cada card (`SocialPostCard`):
  - Wrapper com `aspect-square` (feed) ou `aspect-[9/16]` (reels/stories) — derivado de `format`
  - `<img>` lazy-loaded com fallback
  - Badge canal canto sup. esq. (cores: IG=#E1306C, FB=#1877F2, TT=#000, YT=#FF0000, PT=#E60023, RD=#FF4500 — tokens em tailwind.config.ts)
  - Badge formato canto sup. dir.
  - Footer: caption (2 linhas, line-clamp), métricas com ícones lucide (Heart, MessageCircle, Eye), data
  - 2 botões: "🔗 Copiar link" (copia `short_link || post_url` para clipboard, toast) e "📤 Usar em campanha WA" (placeholder Fase 3 — toast "Disponível em breve")

**Design tokens** a adicionar em `tailwind.config.ts`:
```ts
colors: {
  social: {
    instagram: '#E1306C',
    facebook:  '#1877F2',
    tiktok:    '#000000',
    youtube:   '#FF0000',
    pinterest: '#E60023',
    reddit:    '#FF4500',
  }
}
```

**Secret check**: antes de chamar `social-posts-sync` pela primeira vez, o handler de erro deve mostrar toast claro se vier `ZERNIO_API_KEY missing` ("Configure ZERNIO_API_KEY em Settings → Edge Functions → Secrets").

---

### Fora de escopo desta fase

- Editor de posts (1B)
- Calendário com drag&drop (1C)
- Modal "Usar em campanha WA" (Fase 3)
- Página de Analytics
- Edição de posts agendados (apenas leitura)

---

### Após Fase 1A

Confirmo com você antes de seguir para **1B (Editor /social/novo)** — vai requerer upload pro bucket `wa-media`, schemas Zod por canal, validações condicionais YT/PT/RD/TT, preview lateral. É a fase mais densa do PROMPT 1.