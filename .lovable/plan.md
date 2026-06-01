## Escopo

Só o fluxo **SMS** dentro de `src/components/SmartOpsCampaigns.tsx`. WhatsApp/Evolution continua exatamente como está (escrevendo em `campaign_sessions`). Backend já está pronto — nenhuma migration, nenhuma edge function nova.

## O que existe hoje (SMS)

- `handleSendSms` (linhas 867-913) grava em **`campaign_sessions`** e chama **`smart-ops-sms-disparopro`**.
- Não há botão de Preview de Audiência — o usuário só vê o `smsLeadValidCount` calculado client-side por query direta em `lia_attendances`.
- `CampaignHistory` (linhas 1776-2007) lê só de `campaign_sessions`.

## O que muda

### 1. `CreateCampaign` — fluxo SMS

Adicionar 3 estados novos:

```ts
const [smsCampaignId, setSmsCampaignId] = useState<string | null>(null);
const [audiencePreview, setAudiencePreview] = useState<{
  total: number; com_telefone: number; sample: any[]; lead_ids: string[];
} | null>(null);
const [previewing, setPreviewing] = useState(false);
```

Nova helper `ensureSmsCampaign()`:
- Se já existe `smsCampaignId`, faz `UPDATE campaigns` com `mensagem_template`, `lead_filter`, `nome`.
- Senão, `INSERT INTO campaigns` com:
  - `canal: 'sms'`
  - `nome: campaignName.trim()`
  - `descricao: campaignDesc.trim() || null`
  - `mensagem_template: smsMessage`
  - `lead_filter: buildFiltersObject()`
  - `status: 'draft'`
  - retorna o `id` e guarda em `smsCampaignId`.

Reescrever `handleSendSms`:
1. `id = await ensureSmsCampaign()`
2. `supabase.functions.invoke('campaign-execute-sms', { body: { campaign_id: id } })`
3. Mostra toast com `{sent, failed, total_leads, status}`.

Novo `handlePreviewAudience`:
1. `id = await ensureSmsCampaign()`
2. `supabase.functions.invoke('campaign-build-audience', { body: { ...buildFiltersObject(), campaign_id: id } })`
3. `setAudiencePreview(data.audience + sample + lead_ids)`.

### 2. UI — Step 3 do wizard (SMS apenas)

Entre "Salvar como rascunho" e "Disparar SMS agora", inserir:

- Botão **"👁 Preview de Audiência"** que dispara `handlePreviewAudience`.
- Painel resumo quando `audiencePreview` está populado:
  - `total` leads / `com_telefone` válidos
  - Lista das primeiras 5 amostras (`sample[].nome` + `telefone`)

O botão "Disparar SMS agora" continua existindo mas agora chama o novo fluxo. Botão "Salvar como rascunho" salva em `campaigns` (não mais em `campaign_sessions`) quando canal=sms.

### 3. `CampaignHistory` — union das duas tabelas

- Buscar em paralelo `campaigns` (novo) e `campaign_sessions` (legado WA/Evolution).
- Normalizar campos pra uma interface comum:
  - `nome` ← `campaigns.nome` ou `campaign_sessions.name`
  - `canal` ← `canal` ou `channel`
  - `lead_count` ← `total_leads` ou `lead_count`
  - `sent_count` ← `total_sent` ou `sent_count`
  - `failed_count` ← `total_failed` ou `failed_count`
  - `delivered_count` ← `total_delivered` (só novo)
  - `lead_filter` ← `lead_filter` ou `lead_filters`
  - `_source` ← `'campaigns'` ou `'campaign_sessions'`
- Ordenar por `created_at desc`, limit 100 cada.
- Tabela ganha coluna **"Entregues"** (mostra `—` pro legado).

### 4. Mapeamento de status (topo do arquivo)

Adicionar em `statusColors` e `statusLabels`:

```ts
completed_with_errors: { color: laranja, label: "Concluída c/ falhas" }
failed: { color: vermelho, label: "Falha total" }
```

### 5. Log por lead (`campaign_send_log`)

Já existe a leitura em `openDetail` (linha 1799-1805) — só precisa estender o badge na linha 1986 pra reconhecer os 3 status do novo backend:

- `aguardando` → ícone amarelo "Aguardando DLR"
- `delivered` → ícone verde "Entregue"
- `failed` → ícone vermelho "Falhou"
- mantém `sent` / `pending` como fallback do legado.

## Fora de escopo

- Não mexer no fluxo WhatsApp/Evolution (`handleCreate` para sendChannel !== 'sms').
- Não remover `campaign_sessions` nem a edge function `smart-ops-sms-disparopro` — ficam disponíveis pra rollback.
- Não criar migration nem edge function.
- Não tocar em `SmartOpsAudienceBuilder.tsx` nem `SmartOpsWaGroupCampaigns.tsx`.

## Validação após apply

1. Criar campanha SMS de teste com 1-2 filtros.
2. Clicar "Preview de Audiência" → ver `total / com_telefone / sample` no painel.
3. Conferir no Supabase que `campaigns` tem 1 linha com `canal='sms'`, `status='draft'`, `lead_filter` populado.
4. Clicar "Disparar SMS agora" → toast com `sent/failed/total_leads`, e `campaigns.status` muda pra `running` → `completed*`/`failed`.
5. Abrir aba Histórico → campanha aparece junto com as antigas (legado de `campaign_sessions`), com coluna Entregues preenchida.
6. Abrir detalhe → log por lead mostra status `aguardando`/`delivered`/`failed`.

## Risco

🟢 **Baixo.** Mudanças isoladas no caminho SMS. WA/Evolution segue intacto. Rollback = reverter a edição do arquivo (1 arquivo, ~3 blocos).