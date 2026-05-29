## Diagnóstico confirmado

Listei `fetchInstances` no Evolution (`http://82.25.75.61:8080`, apikey `SmartDent_LIA_2026`):

| Team member | Telefone | Instância Evolution | Status |
|---|---|---|---|
| Danilo Henrique | — | `Danilo Henrique` | **open** ✅ (402 grupos) |
| Dra. Lia | 5516981158403 | `Dra. Lia` | **close** ⚠️ (16 grupos — precisa reconectar QR) |
| Ana Paula (CS) | 5516993094142 | `cs_principal` | **open** ✅ (0 grupos hoje) |

Outras instâncias no servidor (`gabriella`, `Marcela Brito`, `Thiago Godoy`, `adriano`, `lucas`, `janaina`, `evandro`, `patricia`, `paulo_sergio`, `danilo_foschini`, `Thiago Nicolleti`, `Adriano Oliveira`, `marcela`, `d`) estão `connecting` — não vão enviar até finalizar pareamento.

**Causa raiz do 401**: a instância `Danilo Henrique` tem espaço no nome. O `sendText`/`sendMedia` em `_shared/evolution.ts` montam a URL **sem** `encodeURIComponent`, então o servidor não casa a rota e responde 401. A `smart-ops-lia-notify-seller` (v23, em produção) já usa o encoding e funciona.

## Mudanças

### 1. `supabase/functions/_shared/evolution.ts`
- `sendText`: trocar `${instanceName}` por `${enc(instanceName)}` na URL e adicionar `signal: AbortSignal.timeout(15_000)`.
- `sendMedia`: idem.
- `EVO_KEY`: trocar o fallback hardcoded para `'SmartDent_LIA_2026'` (apikey global real do servidor, confirmada via `fetchInstances`). Se o secret `EVOLUTION_API_KEY` estiver setado, ele continua tendo prioridade.

### 2. `supabase/functions/wa-dispatcher/index.ts`
- Acrescentar 1 log antes de cada envio com `{ queue_id, group_jid, instance, node_type }` para auditoria.
- Sem mudança de lógica — ele já passa `instance` para `sendText`/`sendMedia`.

### 3. Mapeamento instância × grupos (operação, não código)
Hoje `wa_groups` tem só `Danilo Henrique` (402, open) e `Dra. Lia` (16, close):
- **Dra. Lia**: reconectar pelo painel Evolution (escanear QR) para destravar os 16 grupos dela.
- **Ana Paula / cs_principal**: quando ela for usada para grupos, mapear `wa_groups.instance_name = 'cs_principal'` (nome real da instância, não o display name). UI continua mostrando "Ana Paula CS".

### 4. Validação pós-deploy
- Disparo manual de `wa-dispatcher` para drenar fila da "Automação teste" (instância `Danilo Henrique`, `open`).
- Conferir `wa_message_queue.status = 'sent'`, `wa_send_log.success = true`, `http_status = 200`.

## Detalhes técnicos

Patch resumido em `_shared/evolution.ts`:

```ts
export const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY') ?? 'SmartDent_LIA_2026'

// sendText
fetch(`${EVO_BASE}/message/sendText/${enc(instanceName)}`, {
  method: 'POST', headers: hWith(apikey),
  body: JSON.stringify({ number: groupJid, text }),
  signal: AbortSignal.timeout(15_000),
})

// sendMedia: mesma mudança (enc + timeout)
```

`number` aceita JID `@g.us` (grupo) ou `@s.whatsapp.net` (1:1) — Evolution trata igual.

## Arquivos

- `supabase/functions/_shared/evolution.ts` (editar)
- `supabase/functions/wa-dispatcher/index.ts` (log adicional)

Nenhuma migration. Nenhuma mudança de UI.