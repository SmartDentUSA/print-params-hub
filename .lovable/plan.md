# Página de Formulários — Cards com Indicadores

## Objetivo

Substituir a tabela atual de formulários por **cards agrupados por finalidade** (NPS, SDR, ROI, CS, Captação, Evento), exibindo 3 indicadores principais por card + sparkline de tendência (estilo das imagens enviadas).

## É possível? Sim

Todos os dados necessários já existem no banco:

| Indicador | Fonte | Como calcular |
|---|---|---|
| **Visitantes** (clicks) | `lead_page_views` | `count(*) where page_path = '/f/{slug}'` (total) + `count(distinct session_id)` (únicos) |
| **Leads gerados** (preencheram) | `lead_form_submissions` | `count(*) where form_id = {id}` |
| **Taxa de preenchimento** | derivado | `leads / visitantes únicos` |
| **Oportunidades ganhas** | `lia_attendances.deals` (JSONB) | leads vindos do form → deals com `status_name='Ganha'` |
| **Taxa de conversão** | derivado | `ganhas / leads` |
| **Tendência 30d** (sparkline) | `lead_page_views.viewed_at` agrupado por dia | array dos últimos 30 dias |

## Layout proposto

```text
┌─ NPS ─────────────────────────────────────────────────┐
│  [card form A]    [card form B]    [card form C]      │
└───────────────────────────────────────────────────────┘
┌─ SDR ─────────────────────────────────────────────────┐
│  [card form D]    [card form E]                       │
└───────────────────────────────────────────────────────┘
... (ROI, CS, Captação, Evento)
```

Cada **card** exibe:

```text
┌──────────────────────────────────────┐
│ 📋 Nome do Formulário      [Ativo] │
│ slug · finalidade                    │
│ ──────────────────────────────────── │
│ Visitantes   Leads      Conversão    │
│   844         240        28.4%       │
│   ▁▃▅▂▆▃▅    +63% 30d   3 ganhas    │
│ ──────────────────────────────────── │
│ [Editar] [Link] [Embed] [Duplicar]  │
└──────────────────────────────────────┘
```

- Header: nome, slug, badge de finalidade, switch ativo/inativo
- 3 KPIs grandes: Visitantes / Leads / Conversão (com % delta vs período anterior)
- Sparkline 30d sob "Visitantes" (estilo da imagem 1)
- Ações no rodapé (mesmas da tabela atual)
- Vazio: card permanece, mas KPIs mostram "—"

## Filtro de período

Header da página com botões: **24h · 7d · 30d · 90d · Tudo** (default: 30d). Reaplica todas as queries.

## Implementação técnica

1. **RPC nova** `fn_form_metrics(p_period_days int)` → retorna 1 linha por form:
   - `form_id, visitors, unique_visitors, leads, deals_won, daily_series jsonb`
   - Faz JOIN: `smartops_forms` × `lead_page_views` (por `/f/{slug}`) × `lead_form_submissions` (por `form_id`) × `lia_attendances` (lead_id → deals JSONB com `status_name='Ganha'`).
   - Calcula tudo server-side em 1 query para evitar N+1.

2. **Componente `FormMetricsCard`** (novo) em `src/components/smartops/FormMetricsCard.tsx`:
   - Recebe `form` + `metrics`.
   - Sparkline com `recharts` (já no projeto) ou SVG inline minimalista.
   - Reutiliza as ações da tabela atual (editar meta, editar campos, duplicar, copiar link/embed, excluir).

3. **`SmartOpsFormBuilder.tsx`**:
   - Substituir bloco da tabela (linhas 922-983) por:
     - Filtro de período no topo da listagem
     - `Object.entries(PURPOSE_CONFIG).map(...)` agrupando forms por `form_purpose`
     - Para cada grupo: título da seção + grid responsivo `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` de `FormMetricsCard`
   - Carregar `formMetrics` via RPC em paralelo com `loadForms()`.

## Validação

- Form "Formulário exocad I.A." (16 submissions, 130 page views) deve mostrar: Visitantes 130, Leads 16, taxa preenchimento ~12%.
- Forms sem visitas mostram "0" + sparkline plana, sem quebrar.
- Mudança de período (7d/30d/90d) recalcula KPIs e sparkline.
- Agrupamento esconde seções vazias (ex: hoje só SDR-Captação e Captação têm forms; NPS/ROI/CS/Evento ficam ocultos ou exibem "Nenhum formulário desta categoria").

## Pergunta antes de seguir

1. **Seções vazias**: ocultar grupos sem forms, ou mostrar um placeholder "Nenhum formulário NPS ainda · [+ Criar]"?
2. **Conversão**: usar `deals_won` (deals com status `Ganha`) ou `deals_open` (qualquer deal criado, mesmo em aberto)? A imagem sugere "Conversion Rate" + "Completion Rate" separados — quer os dois?
3. **Sparkline**: visitantes (como na imagem 1) ou submissions (como na imagem 2)?
