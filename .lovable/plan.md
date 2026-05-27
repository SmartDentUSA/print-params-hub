## Objetivo

Renderizar os **dois artefatos reais** que o vendedor recebe quando o lead `criatianobrazodonto@gmail.com` é atribuído — **sem postar nada** no PipeRun nem no WhatsApp:

1. **Nota HTML no card do PipeRun** — `buildDealNoteHTML` (`smart-ops-lia-assign/index.ts:1140`)
2. **Briefing texto no WhatsApp** do vendedor — `buildSellerNotification` (`smart-ops-lia-assign/index.ts:1014`)

Ambos rodam o mesmo pipeline: `enrichLeadFromIdentity` → `fetchDealsContext` → DeepSeek (HISTÓRICO + OPORTUNIDADE) → fallback cognitivo determinístico.

## Implementação (one-off, descartável)

### Edge function `smart-ops-preview-seller-note`

- `verify_jwt = false`. GET/POST com `?email=...` ou `?lead_id=...`.
- Carrega `lia_attendances.*` (canonical, `merged_into IS NULL`).
- Importa e invoca **diretamente** `buildDealNoteHTML` e `buildSellerNotification` de `smart-ops-lia-assign/index.ts` — para garantir paridade 100% com produção, esses dois builders serão **extraídos para `_shared/seller-briefing.ts`** (sem mudança de lógica, apenas refator: mover funções e suas dependências locais como `buildOriginLines`, `buildDeterministicCognitiveFallback`, `generateHistoricoOportunidade`, `buildHistoricoFallback`). `smart-ops-lia-assign` passa a re-exportar/importar.
- **Não chama** `addDealNote` nem Evolution. Retorna JSON com:
  ```json
  {
    "ok": true,
    "lead": { "id", "email", "nome", "piperun_id" },
    "piperun_note_html": "...",
    "whatsapp_briefing_text": "...",
    "warning": "PREVIEW ONLY — nothing was posted."
  }
  ```

### Refator mínimo (sem mudança de comportamento)

- Novo arquivo: `supabase/functions/_shared/seller-briefing.ts` contendo:
  - `buildDealNoteHTML(lead, supabase, formResponses?)`
  - `buildSellerNotification(lead, supabase)`
  - Helpers privados: `buildOriginLines`, `buildDeterministicCognitiveFallback`, `generateHistoricoOportunidade`, `buildHistoricoFallback`, `formatDate`, `formatDealsBlockLocal`.
- `smart-ops-lia-assign/index.ts`: substituir as definições locais por imports do `_shared/seller-briefing.ts`. Comportamento idêntico, mesmas assinaturas.
- Risco: baixo (mesma lógica, mesmas chamadas DeepSeek). Validação: 1 chamada de preview imediatamente após deploy.

### Execução do preview

1. Deploy de `_shared/seller-briefing.ts` + `smart-ops-lia-assign` (refatorado) + `smart-ops-preview-seller-note` (nova).
2. `curl GET /smart-ops-preview-seller-note?email=criatianobrazodonto@gmail.com`.
3. Apresentar ao usuário os dois artefatos lado a lado.

## O que NÃO faz

- Não posta nota no deal real.
- Não envia WhatsApp para o vendedor.
- Não altera `last_seller_note_hash`/`_at`.
- Não muda nada em `ingest-lead`, `deal-form-note`, hierarchy, RR.
- Não inclui a troca de `[Dra. L.I.A.]` → `[🤖 SmartOps]` (assunto separado, ainda aguardando aprovação).

## Arquivos

- `supabase/functions/_shared/seller-briefing.ts` (novo, refator)
- `supabase/functions/smart-ops-lia-assign/index.ts` (remove definições locais, importa do shared)
- `supabase/functions/smart-ops-preview-seller-note/index.ts` (novo, descartável)
- `supabase/config.toml` (registrar nova function com `verify_jwt = false`)

## Confirmação

Posso aplicar? (Se preferir **sem refator**, faço uma versão alternativa: duplico a lógica dentro da preview function — fica mais rápido mas com risco de divergir do produção no futuro.)
