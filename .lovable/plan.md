## WA Group Scheduler — Frontend (aprovado para implementar)

Construir a régua de mensagens para grupos WhatsApp como nova aba dentro de `SmartOpsCampaigns`, consumindo as tabelas/views/edge functions já existentes (`wa_groups`, `wa_campaigns`, `wa_message_queue`, `v_wa_group_summary`, `wa-sync-groups`, `wa-campaign-builder`). Sem mexer no wizard atual.

### Arquivos a criar

```text
src/components/smart-ops/wa-groups/
  types.ts
  SmartOpsWaGroupCampaigns.tsx
  WaGroupFlowBuilder.tsx
  WaContentNodeSelector.tsx
  WaGroupFlowVisualizer.tsx
src/pages/WaFlowVisualizerPage.tsx
```

### Integração

- `src/components/SmartOpsCampaigns.tsx`: adicionar `<TabsTrigger value="grupos-wa">Grupos WA</TabsTrigger>` + `<TabsContent value="grupos-wa">` renderizando `<SmartOpsWaGroupCampaigns />`. Nenhuma outra linha alterada.
- `src/App.tsx`: nova rota `/smartops/wa-flow-visualizer` → `WaFlowVisualizerPage` (lê `campaign_id` via `useSearchParams`).

### Tipagens (`types.ts`) — nomes alinhados ao contrato do edge `wa-campaign-builder`

```ts
export type FlowNodeType = "msg" | "wait" | "ai" | "image" | "video" | "link";

export interface FlowNodeBase { id: string; type: FlowNodeType; }

export interface MsgNode extends FlowNodeBase {
  type: "msg";
  text: string;
  mention_all?: boolean; // UI exibe; envio Evolution ignora por enquanto
}

export interface WaitNode extends FlowNodeBase {
  type: "wait";
  days: number;
  time: string;            // "HH:MM"
  weekdays_only?: boolean;
}

export interface AiNode extends FlowNodeBase {
  type: "ai";
  ai_source_type: "article" | "product" | "video";
  ai_source_id: string;
  ai_source_title: string;
  ai_prompt_override?: string;
}

export interface MediaNode extends FlowNodeBase {
  type: "image" | "video";
  media_url: string;
  caption?: string;
}

export interface LinkNode extends FlowNodeBase {
  type: "link";
  title: string;
  description?: string;
  url: string;
}

export type FlowNode = MsgNode | WaitNode | AiNode | MediaNode | LinkNode;
```

Todos os pontos do `WaGroupFlowBuilder` que criam/leem/validam nós usam exatamente estes nomes (`weekdays_only`, `ai_source_*`, `ai_prompt_override`, `media_url`). O `WaContentNodeSelector` retorna `(type, id, title)` que o Builder grava como `ai_source_type` / `ai_source_id` / `ai_source_title`.

### Componente 1 — SmartOpsWaGroupCampaigns

- Query inicial em `v_wa_group_summary` ordenado por `group_name`.
- Realtime: canal `wa-groups-overview` com `postgres_changes` em `wa_message_queue` e `wa_campaigns` → recarrega lista.
- Header: título + subtítulo (instância Comercial + contagem) + botões `Sincronizar` (invoca `wa-sync-groups`, toast com `synced`) e `Nova campanha` (abre Builder sem grupo).
- Grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3`. Card com `border-l-4` por status:
  - sem campanha → `border-border`, CTA "Criar régua"
  - active → emerald; paused → amber; finished/error → tokens equivalentes
- Card com campanha: avatar de iniciais, Badge status, métricas (sent/pending/failed direto da view), `Progress` (`current_node_index/total_nodes`), próxima data em PT-BR, botões `Ver fluxo` / `Pausar|Retomar` / engrenagem (editar).
- `Ver fluxo`: `window.open(/smartops/wa-flow-visualizer?campaign_id=...)`; se bloqueado, abre Dialog in-page com `WaGroupFlowVisualizer`.
- Pausar/Retomar: `update wa_campaigns.status` entre `active|paused`.

### Componente 2 — WaGroupFlowBuilder

- Dialog full-screen (`max-w-6xl`, `90vh`). Props: `group | null`, `onSaved`, `onCancel`.
- Carrega `wa_groups` (todos). Itens com `is_admin=false` aparecem desabilitados no select.
- Se `group.campaign_id`: hidrata estado a partir de `flow_json`, nome, delay, daily_limit.
- Painel esquerdo `w-64 border-r bg-muted/20 p-4`:
  - Bloco Configuração: Select grupo, Input nome, Input delay (min 10, helper "anti-ban"), Input daily_limit (1–50).
  - Resumo: total de nós, nós de conteúdo (não-wait), duração estimada (soma de waits em dias).
  - Adicionar nó: 6 botões (Mensagem / IA / Aguardar / Imagem / Vídeo / Link) com tokens (violet, primary, amber, emerald, pink, cyan).
- Painel direito: toolbar (Cancelar / Salvar rascunho / Salvar e ativar) + canvas com grid de pontos via `hsl(var(--border))`.
- Coluna `max-w-lg mx-auto`: nó início (grupo) → conectores `h-8 w-px bg-border` → `FlowNodeCard` por nó → nó final (contagem).
- `FlowNodeCard` (`w-72`): header (Grip, ícone, label, preview 50 chars, ↑↓ 🗑 chevron). Body por tipo:
  - `msg`: Textarea + checkbox `mention_all` (UI-only por enquanto)
  - `wait`: grid 2 col — dias + horário HH:MM + checkbox `weekdays_only`
  - `ai`: botão "Selecionar conteúdo" (abre `WaContentNodeSelector`) ou card do item escolhido + "Trocar"; Textarea opcional (`ai_prompt_override`)
  - `image` / `video`: Input `media_url` + Textarea `caption`
  - `link`: Input `title` + Textarea `description` + Input `url`
- Ordenação por swap. Validação:
  - rascunho: grupo + nome + ≥1 nó não-wait
  - ativar: rascunho + obrigatórios por tipo (`text` / `media_url` / `ai_source_id` / `url`)
- Salvar rascunho: `upsert wa_campaigns {status:'draft'}` + `update wa_groups.active_campaign_id`. Toast.
- Salvar e ativar: mesmo upsert + `fetch POST ${VITE_SUPABASE_URL}/functions/v1/wa-campaign-builder { campaign_id }` com `Authorization: Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}` + `apikey`. Toast com `first_send`. `Loader2 animate-spin` enquanto chama.

### Componente 3 — WaContentNodeSelector

- Dialog `max-w-2xl max-h-[85vh] p-0 flex-col`. Props: `open`, `onClose`, `onSelect(type, id, title)`.
- Estado: `query`, `tab` (`article|product|video`), `selected`. Debounce 300ms.
- Queries por aba:
  - `knowledge_articles`: `is_published=true`, `ilike('title', %q%)`, `order updated_at desc`, `limit 50`
  - `system_a_catalog`: `active=true`, `ilike('name', %q%)`
  - `videos`: `status='active'`, `ilike('title', %q%)`
- `ScrollArea max-h-72`. Item: título + Badge categoria + "Atualizado dd/MM/aa" + preview `line-clamp-2`. Selecionado → `bg-primary/10 border-primary/30` + `CheckCircle2`.
- Footer: nome selecionado + Cancelar + "Usar este conteúdo" (disabled sem seleção). Reset ao abrir.

### Componente 4 — WaGroupFlowVisualizer

- Props: `campaignId`. Sem Dialog wrapper.
- Busca `wa_campaigns` + join `wa_groups` + `wa_message_queue` (order `node_index`).
- Realtime: canal `vis-${campaignId}` filtrando `campaign_id=eq.${id}` em ambas tabelas → recarrega.
- Header: nome + Badge status + ícone Users + nome do grupo + N membros.
- Countdown (se `active` e `next_send_at` futuro): label + `Progress` animada + `HH:MM:SS` via `setInterval(1000)` + data PT-BR.
- Métricas 3-col (sent/pending/total).
- Timeline vertical: para cada nó do `flow_json` match com queue items por `node_index`. Círculo de status (sent=emerald check, sending=primary spinner, failed=destructive alert, pending=muted). Linha conectora colorida. Badge "ATUAL" no `current_node_index`. Mostra "Enviado dd/MM HH:mm" / "Agendado dd/MM HH:mm" / "Aguardar N dias — HH:MM".

### Página standalone

`WaFlowVisualizerPage`: lê `campaign_id`, header simples + `<WaGroupFlowVisualizer campaignId={id} />` dentro de `max-w-3xl mx-auto p-6`. Erro amigável se sem id.

### Regras

- Zero cor hardcoded: tokens semânticos. Apenas "status dot" usa utilitários (`emerald-500/amber-500/...`).
- Todo `fetch`/Supabase com try/catch + `toast` de erro.
- Estados de loading com `Loader2 animate-spin`.
- Nada de WaLeads. Nenhuma alteração nas abas atuais de `SmartOpsCampaigns`.

### Verificação pós-build

- Compilação TS limpa.
- Abrir aba "Grupos WA" → cards renderizam (loading → lista).
- "Nova campanha" → Builder abre; select de grupo lista todos, não-admin desabilitado.
- Nó IA → modal abre, busca funciona, seleção grava `ai_source_*` no nó.
- Salvar e ativar → chama `wa-campaign-builder` e mostra toast com `first_send`.
- Pausar/Retomar → status muda na view sem recarregar.
- `/smartops/wa-flow-visualizer?campaign_id=...` carrega com countdown ativo.
