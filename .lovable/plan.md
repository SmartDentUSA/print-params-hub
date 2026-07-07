## Reverter filtro BR-only no disparo de SMS

Confiar em `telefone_normalized` como fonte da verdade. Removo o guard client-side que adicionei na última mudança.

### Alterações em `src/components/SmartOpsCampaigns.tsx`

1. **`resolveSmsAudience`**
   - Remover `.like('telefone_normalized', '55%')` do `applySmsFilters`.
   - Remover a função `isValidBrPhone` e o filtro por regex no loop de paginação de `lead_ids`.
   - Voltar `select('id')` (sem `telefone_normalized`) na paginação.
   - Voltar `.limit(5)` na `sampleQuery` e remover o `.filter(isValidBrPhone).slice(0,5)` da montagem da amostra.

2. **Contador de leads SMS válidos (useEffect do step 2)**
   - Remover `.like('telefone_normalized', '55%')` do `buildBase`.

### Fora de escopo

- `handleSendSms` continua como está: cria `campaign_sessions` com `lead_ids` + `results.sms_message` e invoca `smart-ops-sms-disparopro` com `async: true`. Esse fluxo é o fix da mensagem anterior e não faz parte da reversão.
- Nada muda na tabela `lia_attendances`, no pipeline de ingestão nem na edge function `smart-ops-sms-disparopro`.
