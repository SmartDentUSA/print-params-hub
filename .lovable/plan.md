# Canal SMS (DisparoPro) + ROI tracking em `SmartOpsCampaigns.tsx`

Implementação **somente UI** no arquivo `src/components/SmartOpsCampaigns.tsx`. Backend (`smart-ops-sms-balance`, `smart-ops-sms-disparopro`, RPC `fn_sms_campaign_attribution`) e colunas (`provider_status`, `provider_detail_code`, `provider_detail_message`, `sms_opt_out`) já estarão prontos.

## Alvo único
- `src/components/SmartOpsCampaigns.tsx` (1037 linhas, 3 seções: `CreateCampaign`, `CampaignHistory`, wrapper de tabs).

## Mudanças

### 1. Tipos
- `SendLog`: adicionar `provider_status?: string | null`, `provider_detail_code?: string | null`, `provider_detail_message?: string | null`.
- `CampaignSession.results`: tipar como `{ sms_message?; sms_codificacao?; sms_pdus?; sms_custo_por_pdu?; sent?; failed? } | Record<string, unknown>`.
- Novo tipo `SmsAttribution` exatamente como na spec.

### 2. Imports adicionais
`Skeleton` (`@/components/ui/skeleton`), `Input` se ainda não estiver importado, `useMemo`/`useRef` do React, `toast` de `sonner` (componente já usa toast — confirmar).

### 3. `CreateCampaign` — estado novo
Adicionar conforme spec: `smsMessage`, `smsCodificacao`, `smsCustoPdu`, `smsBalance`, `smsBalanceLoading`, `smsLeadValidCount`, `sending`, `smsTextareaRef`, `smsStats` (memo).

### 4. Seletor de canal
Acrescentar `<SelectItem value="sms">📱 SMS (DisparoPro)</SelectItem>` no `<Select>` de canal de envio do step 1.

### 5. Etapa 1 — bloco SMS condicional
Renderizar quando `sendChannel === "sms"` o JSX da spec: badge de saldo (`useEffect` chama `smart-ops-sms-balance` ao trocar canal), Textarea + contador (chars / PDU / custo estimado), variáveis clicáveis (`{{nome}}`, `{{primeiro_nome}}`, `{{empresa}}`) com inserção na posição do cursor via ref, Select de codificação (`0` / `8`), Input numérico de custo/PDU (default `0.08`), preview com substituições de exemplo.

Validação para avançar: se `sendChannel === "sms"`, exigir `smsMessage.trim().length > 0`.

### 6. Etapa 2 — contagem válida
`useEffect` ao entrar no step 2 com `sendChannel === "sms"`: query `lia_attendances` com `merged_into IS NULL`, `telefone_normalized` not null, `sms_opt_out != true`, aplicando os mesmos filtros já existentes da segmentação. Fallback `try/catch` sem `sms_opt_out` se a coluna ainda não existir. Renderiza linha extra `📱 X leads com telefone válido / Y total`.

### 7. Etapa 3 — Revisar (quando SMS)
Substituir resumo padrão por card SMS (Canal, Codificação, PDUs, Leads válidos, Custo total + breakdown) + preview da mensagem.

Botões:
- `Salvar como rascunho` → `handleCreate()` existente.
- `📱 Disparar SMS agora (N leads)` → novo `handleSendSms`: insere em `campaign_sessions` com `channel: "sms"`, `status: "running"`, `results: { sms_message, sms_codificacao, sms_pdus, sms_custo_por_pdu }`; chama `supabase.functions.invoke("smart-ops-sms-disparopro", { body: { campaign_id, sms_message, sms_codificacao } })`; `toast.loading` → `toast.success/error` com contagem `sent/failed`; `onCreated?.()` no sucesso.

### 8. `CampaignHistory` — detalhe SMS
- Estado novo: `smsAttribution`.
- `useEffect` quando `selectedCampaign?.channel === "sms"`: `supabase.rpc("fn_sms_campaign_attribution", { p_campaign_id })`.
- `select` de logs passa a incluir `provider_status, provider_detail_code, provider_detail_message`.
- Acima da tabela: grid 4 cards (Enviados/Entregues + taxa, Custo total + unitário, Leads gerados + CPL, Receita atribuída + ROI + nº de vendas).
- Linha de UTM: `?utm_medium=sms&utm_campaign={parceiro_id}` com botão Copiar (clipboard).
- Tabela: colunas extras `Status Operadora` (Badge colorido por estado: DELIVERED verde, ACCEPTED amarelo, BLACKLIST roxo, demais vermelho) e `Detalhe` (`{code} — {message}`). Renderizam só quando o canal é SMS.

## Comportamento preservado
- Canais existentes (whatsapp, evolution, sellflux, registro) seguem inalterados.
- Botão "Criar Campanha" original mantido para canais não-SMS.
- Padrão visual (Card, Badge, Select, Textarea, Skeleton) reaproveitado — sem novas libs.

## Riscos / fallbacks
- `sms_opt_out` pode não existir no momento do build da UI: usar fallback no catch (já especificado).
- `fn_sms_campaign_attribution` pode retornar null antes do disparo: card só renderiza se `smsAttribution` truthy.
- Se `smart-ops-sms-balance` falhar, badge mostra "Indisponível" (não bloqueia o disparo).

## Arquivos afetados
- `src/components/SmartOpsCampaigns.tsx` — única edição.