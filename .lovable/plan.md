## Problema

Edge function `generate-resin-info-card` está estourando o limite de 150s do Supabase.

Causa: as 3 chamadas ao `openai/gpt-image-2` (PT/EN/ES) rodam em sequência, e cada geração de PNG 1024x1536 em `quality: high` leva 40–70s. Total >150s → `Request idle timeout`.

## Correção

Transformar a função em **assíncrona (fire-and-forget)**: responde imediatamente ao clique e processa em background usando `EdgeRuntime.waitUntil`, com status persistido em `resins` para o UI acompanhar.

### 1. `supabase/functions/generate-resin-info-card/index.ts`

- Ao receber `POST`:
  1. Validar payload + carregar resina.
  2. `UPDATE resins SET info_card_status='processing', info_card_error=NULL, info_card_started_at=now() WHERE id=?`.
  3. Disparar processamento em background com `EdgeRuntime.waitUntil(runJob(...))`.
  4. Retornar `202 { ok: true, status: 'processing' }` imediatamente (bem abaixo de 150s).
- `runJob()`:
  1. Gera plano JSON (Poe) — 1 chamada.
  2. **Paraleliza** as 3 chamadas GPT-image-2 com `Promise.allSettled` (corta ~⅔ do tempo mesmo se não fosse background).
  3. Upload dos PNGs no bucket + `UPDATE resins SET info_card_url_pt/en/es, info_card_generated_at, info_card_status='ready'`.
  4. Em erro: `UPDATE resins SET info_card_status='error', info_card_error=<msg>`.
  5. `logAIUsage` mantido.

### 2. Migração

Adicionar em `public.resins`:
- `info_card_status text` (`idle` | `processing` | `ready` | `error`, default `idle`)
- `info_card_error text`
- `info_card_started_at timestamptz`

Sem novas GRANTs (tabela já existe e é acessada pelo service_role/edge).

### 3. `src/components/AdminModal.tsx`

- Após clicar "Gerar Card Informativo": mostrar badge "Gerando… (~2 min)" enquanto `info_card_status='processing'`.
- Polling leve a cada 5s (ou realtime na row) até status virar `ready` (mostra imagens) ou `error` (mostra mensagem + botão "Tentar novamente").

## Fora de escopo

- Trocar modelo de imagem.
- Reduzir para 1 idioma só.
- Editor visual do card.

## Validação

1. Clicar "Gerar Card Informativo" → resposta HTTP em <2s, badge "Gerando…" aparece.
2. Logs edge: 1× Poe + 3× `openai/gpt-image-2` em paralelo, função encerra sem timeout.
3. Após ~60–90s, `info_card_status='ready'`, PNGs aparecem no modal e na aba Catálogo.
4. Se GPT-image-2 falhar em algum idioma, status vira `error` com mensagem legível — sem travar o UI.
