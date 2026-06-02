## Objetivo

Adicionar três tipos de nó interativos — **button**, **list**, **carousel** — ao Builder de campanhas WhatsApp. **Apenas frontend** — backend já está em produção.

## Backend já deployado (NÃO TOCAR)

| Função | Versão | Status |
|---|---|---|
| `wa-dispatcher` | v58 | 3 cases novos + mapeamento `body→title`/`body→description` |
| `wa-campaign-builder` | v54 | `buildContent` suporta `body`, `sections`, `cards` |
| `_shared/evolution.ts` | v4.0 | `sendButtonEvoGo` / `sendListEvoGo` / `sendCarouselEvoGo` com endpoints `/send/button`, `/send/list`, `/send/carousel` (Evolution Go porta 8081) |

**Não regenerar nenhum desses arquivos.** Não deploiar `wa-dispatcher`.

## Escopo (apenas 3 arquivos frontend)

### 1) `src/components/smartops/wa-groups/types.ts`
Estender união discriminada (padrão `{ id, type, ...fields }`, sem envelope `data`):

```ts
type FlowNodeType = "msg"|"wait"|"ai"|"image"|"video"|"audio"
                  |"document"|"link"|"button"|"list"|"carousel";

interface ButtonItem {
  type: "reply"|"cta_url"|"cta_copy"|"cta_call"|"pix";
  id: string; title: string;
  url?: string; copyCode?: string;
  phoneNumber?: string; pixKey?: string; pixAmount?: number;
}
interface ButtonNode  { id; type:"button"; body: string; footer?: string; buttons: ButtonItem[] }

interface ListRow     { id: string; title: string; description?: string }
interface ListSection { title: string; rows: ListRow[] }
interface ListNode    { id; type:"list"; title?: string; body: string; footer?: string;
                        buttonText: string; sections: ListSection[] }

interface CarouselCard{ body: string; image?: string;
                        buttons: Array<{ type: string; id: string; title: string; url?: string }> }
interface CarouselNode{ id; type:"carousel"; cards: CarouselCard[] }
```

Adicionar ao `FlowNode` union.

### 2) `src/components/smartops/wa-groups/WaGroupFlowBuilder.tsx`
- 3 entradas em `nodeMeta` (ícones `Hand` / `List` / `LayoutList`, cor accent + badge "Novo").
- Defaults em `newNode()` para `button`/`list`/`carousel`.
- Componentes inline `ConfigButton`, `ConfigList`, `ConfigCarousel` (adaptados do `WaFlowVisualizer.tsx` enviado para o shape discriminado — sem `node.data.*`, direto em `node.field`).
- `validation` estendido:
  - **button**: body ≥1 char; máx 3 reply OU 1 CTA/PIX isolado (não misturar).
  - **list**: ≥1 seção × ≥1 row; máx 10 × 10; `buttonText` ≤ 20 chars.
  - **carousel**: 1–10 cards; cada card com body; ≤3 botões por card.

### 3) `src/components/smartops/wa-groups/WaGroupFlowVisualizer.tsx`
- Adicionar `Hand` / `List` / `LayoutList` ao `typeIcon` map (cosmético).

## Fora de escopo
- Não tocar em `_shared/evolution.ts`, `wa-dispatcher`, `wa-campaign-builder`.
- Não substituir `WaGroupFlowVisualizer.tsx` pelo arquivo enviado (só ícones).
- Não mexer em `WaContentNodeSelector`, `WaMediaUploader`, `wa-ai-preview`.
- Sem migração de DB.

## Entregáveis
1. `types.ts` com 3 novas interfaces na union
2. `WaGroupFlowBuilder.tsx` com 3 editores + validação
3. `WaGroupFlowVisualizer.tsx` com 3 ícones novos
