## Diagnóstico

`curl http://82.25.75.61:8080/instance/fetchInstances` confirma:
- **`name: "Dra. Lia"`** ← este é o instance name que vai na URL
- `profileName: "Comercial"` ← só metadado de exibição
- `connectionStatus: "open"` ← instância está conectada (reconectou após o QR)

O 404 anterior (`The "Comercial" instance does not exist`) aconteceu porque o secret `EVOLUTION_INSTANCE_NAME` provavelmente está como `Comercial`, sobrescrevendo o default `'Dra. Lia'` em `_shared/evolution.ts`.

## Ações

1. **`secrets--update_secret`** → `EVOLUTION_INSTANCE_NAME = "Dra. Lia"` (com espaço e ponto, exatamente como retorna `fetchInstances`).
2. Confirmar que `supabase/functions/_shared/evolution.ts` mantém `EVO_INST` default `'Dra. Lia'` e `encodeURIComponent(EVO_INST)` em todas as URLs (já está).
3. **`supabase--deploy_edge_functions`** para `wa-sync-groups`, `wa-verify-lead`, `wa-dispatcher`, `wa-campaign-builder` (todos consomem `_shared/evolution.ts`).
4. **Validar** com `supabase--curl_edge_functions` → `POST /wa-sync-groups` deve retornar `{ ok: true, synced: N, groups: [...] }` com N > 0 (a instância está `open`).
5. Abrir `/admin → Smart Ops → Campanhas → Grupos WA → Sincronizar grupos` e confirmar que os cards renderizam.

## Observação

Nenhuma mudança de UI ou schema. Só secret + redeploy.
