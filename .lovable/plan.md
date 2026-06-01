## Componente CampaignLinkPicker

Criar `src/components/smartops/CampaignLinkPicker.tsx`, reutilizável nos 3 canais (SMS, WhatsApp, Grupos WA), consumindo a edge function `disparopro-sync-links`.

### 1. Novo componente

**Arquivo**: `src/components/smartops/CampaignLinkPicker.tsx`

**Props**:
```ts
interface Props {
  channel: 'sms' | 'whatsapp' | 'whatsapp_groups';
  onInsert: (text: string) => void;
}
```

**UI**:
- Botão trigger `[🔗 Links]` (`variant="outline" size="sm"`).
- Abre um `Popover` (~420px) listando links do canal.
- Topo do painel: `[🔄 Sincronizar DisparoPro]` + `[+ Novo Link]`.
- Lista agrupada em 2 seções com badge:
  - **DisparoPro** (badge azul, `variant="default"`) — `source = 'disparopro'`.
  - **Manual** (badge cinza, `variant="secondary"`) — `source = 'manual'`.
- Cada linha: `nome` (font-medium) · `url_curta ?? url` truncada (`text-xs text-muted-foreground`) · ações `[↩]` `[✏]` `[🗑]`. Editar/excluir só habilitados para `source = 'manual'`.
- Loading skeleton e estado vazio.

**Comportamento**:
- Ao abrir: `GET /functions/v1/disparopro-sync-links?channel={channel}` via `fetch` (ver nota técnica).
- `[↩]` → `onInsert(link.url_curta ?? link.url)` e fecha o popover.
- `[🔄]` → `POST { action: 'sync' }` via `supabase.functions.invoke`, refaz o GET.
- `[+ Novo Link]` / `[✏]` → `Dialog` com:
  - Nome* (Input), URL* (Input), URL curta (Input opcional).
  - Disponível em: 3 `Checkbox` (SMS / WhatsApp / Grupos WA) — pré-marca o canal atual.
  - `[Cancelar]` `[Salvar]` → `POST { action: 'save', link: { id?, nome, url, url_curta, channels } }`.
- `[🗑]` → confirm + `POST { action: 'delete', id }`. Refresh.

### Nota técnica — GET com querystring

`supabase.functions.invoke` não aceita querystring no path de forma confiável. Para o GET, usar `fetch` direto:

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const res = await fetch(
  `${SUPABASE_URL}/functions/v1/disparopro-sync-links?channel=${channel}`,
  { headers: { Authorization: `Bearer ${SUPABASE_ANON}` } }
);
const data = await res.json();
```

Para POST (`sync` / `save` / `delete`), continuar com:
```ts
const { data } = await supabase.functions.invoke('disparopro-sync-links', {
  body: { action: 'sync' }, // ou 'save' / 'delete'
});
```

### Tipos locais
```ts
type Link = {
  id: string;
  nome: string;
  url: string;
  url_curta: string | null;
  source: 'disparopro' | 'manual';
  channels: ('sms'|'whatsapp'|'whatsapp_groups')[];
};
```

### 2. Integrações

**A) `src/components/SmartOpsCampaigns.tsx` — Step 3, SMS** (perto do `Textarea` de `smsMessage`, ~linha 1099):
```tsx
<CampaignLinkPicker channel="sms" onInsert={(t) => setSmsMessage((p) => (p ? p + " " : "") + t)} />
```

**B) `src/components/SmartOpsCampaigns.tsx` — Step 3, WhatsApp** (bloco do canal `evolution`):
```tsx
<CampaignLinkPicker channel="whatsapp" onInsert={(t) => setWaMessage((p) => (p ? p + " " : "") + t)} />
```
Confirmar nome real do state (`waMessage`/`evolutionMessage`) ao editar.

**C) `src/components/smartops/wa-groups/WaGroupBlastModal.tsx`** (ao lado do `Textarea` de `text`, linha 160):
```tsx
<CampaignLinkPicker channel="whatsapp_groups" onInsert={(t) => setText((p) => (p ? p + " " : "") + t)} />
```

### Fora de escopo
- Não alterar lógica de envio (`handleSendSms`, `handleCreate`, blast).
- Não criar migrations.
- Não tocar em outros arquivos além dos 3 listados.
- Sem novas dependências — usar `Popover`, `Dialog`, `Checkbox`, `Input`, `Button`, `Badge` já existentes.