## Resultado da verificação

| # | Ponto | Status atual | Ação |
|---|-------|--------------|------|
| 1 | Parâmetro da URL | **Bate** — `navigate(...?campaign=${id})` em `SmartOpsWaGroupCampaigns.tsx:245` e `params.get("campaign")` em `WaFlowVisualizerPage.tsx:9`. Não há bug. | Padronizar para `campaign_id` nos dois (preferência do spec, mais legível). |
| 2 | Countdown 30s | **Confirmado** — `WaGroupFlowVisualizer.tsx:77` usa `30_000`. | Trocar para `1_000`. |
| 3 | Sheet vs Dialog | **Confirmado** — Builder usa `<Sheet sm:max-w-2xl>` single-column. Sem painel esquerdo. | Trocar para `<Dialog max-w-6xl>` com sidebar `w-64` (paleta de nós + config global) + canvas (lista de nós). |

## Mudanças

### Ajuste 1 — Padronizar param para `campaign_id`

- `SmartOpsWaGroupCampaigns.tsx:245` → `navigate(\`/smartops/wa-flow-visualizer?campaign_id=${row.campaign_id}\`)`
- `WaFlowVisualizerPage.tsx:9` → `params.get("campaign_id")`
- `WaFlowVisualizerPage.tsx:19` → texto fallback `?campaign_id=`

### Ajuste 2 — Countdown a cada 1s

- `WaGroupFlowVisualizer.tsx:77` → `setInterval(..., 1_000)`
- Refinar helper `countdown()` para mostrar `HH:MM:SS` quando faltar menos de 1h (hoje só mostra `em Nh Nm`, então o tick de 1s seria invisível). Formato:
  - `> 1d`  → `em 2d 3h`
  - `> 1h`  → `em 3h 12m`
  - `< 1h`  → `em 12:34` (mm:ss)
  - `≤ 0`   → `agora`

### Ajuste 3 — Builder em Dialog 2-painéis

Reescrever `WaGroupFlowBuilder.tsx` mantendo toda lógica (state, validation, save, selector de conteúdo, IDs `ai_source_*`/`media_url`/`weekdays_only`), trocando só o container:

```text
<Dialog open className="max-w-6xl h-[85vh] p-0">
  ┌──────────────────────────────────────────────┐
  │ Header: Nome | Limite diário | Delay | X    │
  ├──────────────┬───────────────────────────────┤
  │ Sidebar w-64 │ Canvas (overflow-y-auto)      │
  │              │                               │
  │ + Mensagem   │ [Nó #1 msg] ...               │
  │ + Aguardar   │ [Nó #2 wait] ...              │
  │ + IA         │ [Nó #3 ai] ...                │
  │ + Imagem     │                               │
  │ + Vídeo      │                               │
  │ + Link       │                               │
  │              │                               │
  │ ─── Config ─ │                               │
  │ daily_limit  │                               │
  │ delay_secs   │                               │
  ├──────────────┴───────────────────────────────┤
  │ Validation errors (se houver)                │
  │ Cancelar | Salvar rascunho | Salvar e ativar │
  └──────────────────────────────────────────────┘
```

- Sidebar esquerda: 6 botões de adicionar nó (paleta) + bloco config (`daily_limit`, `delay_seconds`, nome).
- Canvas direita: lista de cards de nó (mesmo conteúdo de hoje — campos por tipo, reorder, remover).
- Footer fixo com validação e ações.
- `<Sheet>` removido do import; `<Dialog>` + `<DialogContent>` adicionados.

## Verificação após implementação

1. `rg "campaign_id" src/pages/WaFlowVisualizerPage.tsx src/components/smartops/wa-groups/SmartOpsWaGroupCampaigns.tsx` → confirma o mesmo nome nas duas pontas.
2. TS compila sem erros.
3. Abrir `/admin` → aba "Grupos WA" → "Sincronizar grupos" → cards aparecem.
4. "Criar régua" → modal abre largo (6xl), 2 painéis visíveis lado a lado.
5. Montar fluxo msg+wait+ai → "Salvar e ativar" → toast com `first_send`.
6. "Ver fluxo" abre `/smartops/wa-flow-visualizer?campaign_id=...` → timeline renderiza, countdown atualiza a cada segundo.
