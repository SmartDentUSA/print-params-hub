## Diagnóstico

A página `/admin` está demorando >5s e mostrando tela branca porque `src/pages/AdminViewSecure.tsx` importa **todos** os componentes do painel de forma estática no topo do arquivo — antes mesmo de saber se o usuário está logado.

Isso obriga o Vite a baixar e parsear, no primeiro load, ~17.500 linhas de código de componentes pesadíssimos (incluindo dependências indiretas: charts, editores, dnd-kit, etc.):

| Componente | Linhas |
|---|---|
| SmartOpsCampaigns | 2.289 |
| SmartOpsCourses | 1.440 |
| SmartOpsFormBuilder | 1.167 |
| SmartOpsAudienceBuilder | 1.081 |
| SmartOpsLeadsList | 820 |
| SmartOpsCSRules | 784 |
| SmartOpsROICardsManager | 685 |
| SmartOpsFormEditor | 634 |
| SmartOpsSdrCaptacaoEditor | 623 |
| SmartOpsBowtie | 594 |
| + ~20 outros componentes Admin/SmartOps | ~7.500 |

O usuário só visualiza **uma seção por vez** (controlada por `activeSection`), então 95% desse código é desperdiçado no primeiro paint.

## O que vai mudar

Apenas `src/pages/AdminViewSecure.tsx` — sem alterar lógica de negócio, sem mudar nenhuma seção.

### Antes
```tsx
import { SmartOpsCampaigns } from "@/components/SmartOpsCampaigns";
import { SmartOpsCourses } from "@/components/SmartOpsCourses";
// ...+30 imports
```

### Depois
```tsx
import { lazy, Suspense } from "react";
const SmartOpsCampaigns = lazy(() => import("@/components/SmartOpsCampaigns").then(m => ({ default: m.SmartOpsCampaigns })));
const SmartOpsCourses    = lazy(() => import("@/components/SmartOpsCourses").then(m => ({ default: m.SmartOpsCourses })));
// ...etc para todos os Smart Ops e Admin* pesados
```

E envolver o `renderContent()` em um `<Suspense>` com um spinner leve:
```tsx
<Suspense fallback={<div className="flex items-center justify-center py-20">
  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
</div>}>
  {renderContent()}
</Suspense>
```

### Mantém estático (são leves e/ou parte do shell)
- `AdminSidebar`, `AuthPage`, `ConnectionError`
- `Card`, `Button`, `Badge`, ícones lucide, `SidebarProvider/Trigger`
- `useToast`, supabase client

### Tornam-se `lazy(...)`
Todos os `Admin*` e `SmartOps*` referenciados no `switch(activeSection)`:
- AdminModels, AdminCatalog, AdminDocumentsList, AdminKnowledge, AdminKnowledgeHub, AdminAuthors, AdminParameterPages, AdminArticleReformatter, AdminArticleEnricher, AdminVideoProductLinks, AdminPandaVideoSync, AdminPandaVideoTest, AdminVideoAnalyticsDashboard, AdminStats, AdminDraLIAStats, AdminUsers, AdminSettings, ApostilaExport
- SmartOpsBowtie, SmartOpsLeadsList, SmartOpsTeam, SmartOpsCSRules, SmartOpsLogs, SmartOpsReports, SmartOpsContentProduction, SmartOpsSystemHealth, SmartOpsWhatsAppInbox, SmartOpsFormBuilder, SmartOpsCourses, SmartOpsAIUsageDashboard, SmartOpsAIRouting, SmartOpsIntelligenceDashboard, SmartOpsSmartFlowAnalytics, SmartOpsCopilot, SmartOpsRayshape, SmartOpsWorkflowMapper, SmartOpsCampaigns, SmartOpsDistributors

## Impacto esperado

- Tela branca do `/admin` cai de >5s para <1s (apenas auth + shell + sidebar).
- Cada seção carrega seu próprio chunk sob demanda (~100–500ms na 1ª vez, cacheado depois).
- Zero mudança visual, zero mudança de comportamento.

## Fora do escopo

- Otimização das queries lentas (`lia_attendances` por `platform_lead_id` com 4M ms acumulados) — é um problema real mas separado; posso atacar em seguida se quiser.
- Refatorar componentes individuais.
- Mexer em rotas públicas.
