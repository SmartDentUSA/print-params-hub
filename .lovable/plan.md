

## Central de Campanhas — Plano de Implementacao

### Resumo

Nova aba "Campanhas" no Smart Ops com 3 sub-abas: Biblioteca de Conteudo, Criar Campanha e Historico. Requer 3 tabelas novas + 1 componente principal + registro na sidebar/renderizacao.

### 1. Migration SQL (3 tabelas)

Criar `system_a_content_library`, `campaign_sessions`, `campaign_send_log` conforme schema fornecido. RLS: leitura para authenticated, escrita para authenticated. Indexes em `channel`, `content_type`, `product_name` na library e `status`, `created_at` em sessions.

### 2. Componente principal

**Arquivo**: `src/components/SmartOpsCampaigns.tsx`

Componente com `Tabs` interno (3 sub-abas):

**Sub-aba 1 — Biblioteca de Conteudo**
- Header: titulo, badge count, botao "Sincronizar Agora" (invoke `sync-content-from-a`), ultimo sync
- Filtros: canal (Select), tipo (Select), produto (Input ILIKE)
- Grid de cards com badges, preview, thumbnail, quality_score, botao "Usar em Campanha"
- Estado vazio quando count=0

**Sub-aba 2 — Criar Campanha (Wizard 3 steps)**
- Step 1: selecionar conteudo (busca ou pre-selecionado), nome, descricao, canal
- Step 2: segmentar leads via filtros em `lia_attendances` (anchor_product, temperatura, stage, status). Count em tempo real
- Step 3: revisar e INSERT em `campaign_sessions` com status=draft

**Sub-aba 3 — Historico**
- Tabela de `campaign_sessions` ORDER BY created_at DESC
- Badges de status coloridos
- Row expandivel ou Sheet lateral com detalhes + logs de `campaign_send_log`

### 3. Registro no Admin

| Arquivo | Mudanca |
|---------|---------|
| `src/components/AdminSidebar.tsx` | Adicionar `{ id: "so-campanhas", title: "Campanhas", icon: Megaphone }` no grupo Smart Ops |
| `src/pages/AdminViewSecure.tsx` | Importar `SmartOpsCampaigns`, adicionar case `so-campanhas` no switch |
| `src/components/SmartOpsTab.tsx` | Adicionar TabsTrigger "Campanhas" + TabsContent (para compatibilidade) |

### 4. Arquivos criados/editados

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/xxx_create_campaign_tables.sql` | 3 tabelas + RLS + indexes |
| `src/components/SmartOpsCampaigns.tsx` | Componente principal (~500 linhas) |
| `src/components/AdminSidebar.tsx` | +1 item sidebar (import Megaphone, +1 linha) |
| `src/pages/AdminViewSecure.tsx` | +1 import, +1 case |
| `src/components/SmartOpsTab.tsx` | +1 trigger, +1 content |

### Padrao tecnico

- Queries via `supabase` client importado de `@/integrations/supabase/client`
- Toast via `sonner`
- UI: shadcn Card, Badge, Select, Button, Sheet, Tabs, Input
- Todas as queries em `lia_attendances` com `WHERE merged_into IS NULL`
- Nenhuma tabela existente sera modificada

