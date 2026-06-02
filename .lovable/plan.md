## Objetivo

1. Ao clicar em **Voltar** no visualizador de fluxo, retornar para **Admin → aba Campanhas → sub-aba Grupos WA**, com o estado preservado (em vez de cair na aba Bowtie padrão).
2. No **visualizador de fluxo**, adicionar um botão **Atualizar** e mostrar **apenas as mensagens que existem no editor de fluxo atual** (`flow_json` da campanha), escondendo linhas legadas da fila vindas de versões anteriores do fluxo.

## Mudanças

### 1. Preservar aba via URL (`?tab=...&sub=...`)

**`src/components/SmartOpsTab.tsx`**
- Trocar `<Tabs defaultValue="bowtie">` por um `Tabs` controlado lendo/escrevendo `searchParams.get("tab")` (`useSearchParams` do `react-router-dom`).
- `onValueChange` faz `setSearchParams({ tab }, { replace: true })`, mantendo `sub` se presente.
- Default continua `"bowtie"` quando não há param.

**`src/components/SmartOpsCampaigns.tsx`**
- Tornar o `Tabs` interno também controlado pelo searchParam `sub` (default = `"biblioteca"`).
- Ao trocar de sub-aba, atualizar `sub` na URL preservando `tab=campanhas`.

### 2. Visualizador: voltar para o lugar certo + botão Atualizar

**`src/pages/WaFlowVisualizerPage.tsx`**
- Trocar `navigate(-1)` por `navigate("/admin?tab=campanhas&sub=grupos-wa")`.
- Adicionar botão **Atualizar** (ícone `RefreshCw`) ao lado do "Voltar", que dispara um `refreshKey` passado ao `WaGroupFlowVisualizer` via prop (`key={refreshKey}` força refetch) ou expondo um `ref`/callback. Vou usar a abordagem simples de `key`.

### 3. Filtrar somente nós do fluxo atual

**`src/components/smartops/wa-groups/WaGroupFlowVisualizer.tsx`**
- Ao carregar a campanha, ler `campaign.flow_json` (array de nós).
- Construir um set de `node_index` válidos: `validIdx = new Set(flow_json.map((_, i) => i))`.
- Filtrar `queue` para manter apenas `row.node_index ∈ validIdx`.
- Opcional defensivo: também checar que `row.node_type` casa com `flow_json[row.node_index].type` (se não bater → também esconder, é resíduo de versão antiga).
- Botão Atualizar local também (header do card) chamando `fetchAll()` manualmente, em vez de só depender do `key` da página — assim o usuário tem refresh instantâneo sem perder scroll.

## Detalhes técnicos

- `flow_json` já existe em `wa_campaigns` e é lido pelo builder; é a fonte de verdade do "fluxo em ação".
- Nenhuma mudança no backend / `wa-dispatcher` / `wa-message-queue` — somente filtro de apresentação.
- Realtime continua igual; o filtro é aplicado depois de cada `fetchAll`.
- Os links que abrem o visualizador (em `SmartOpsWaGroupCampaigns.tsx` linhas 502 e 688) continuam iguais — quando a página `/admin` recarrega via Voltar, a URL `?tab=campanhas&sub=grupos-wa` restaura a posição.

## Fora de escopo

- Não mexer em `wa-dispatcher`, builder, ou schema.
- Não alterar comportamento de envio nem do modo incremental.
