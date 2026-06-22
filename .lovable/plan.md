## Fix: Sentinela aceita instância `Danilo-Henrique`

### Mudança única
Normalizar comparação de `instanceName` em 2 edge functions para aceitar variações (`Danilo-Henrique`, `Danilo Henrique`, case-insensitive):

1. `supabase/functions/sentinela-webhook-receiver/index.ts`
2. `supabase/functions/sentinela-daily-report/index.ts`

Substituir comparação literal `=== "Danilo Henrique"` por:
```ts
const normalize = (s: string) => (s ?? "").toLowerCase().replace(/[\s_-]/g, "");
if (normalize(instanceName) !== normalize("Danilo Henrique")) return skipped;
```

### O que NÃO muda
- Credenciais EvolutionGo (5519992612348 continua intacto)
- `team_members`, `lia-assign`, schema, RLS, UI
- Webhooks existentes da instância (usuário adiciona o endpoint Sentinela como destino adicional, apenas `MESSAGES_UPSERT`)
- Lógica do analyzer e do daily-report

### Validação
1. Deploy das 2 functions
2. `curl` POST em `/sentinela-webhook-receiver` com `instance: "Danilo-Henrique"` e remoteJid `@g.us` → esperar 200 e linha em `sentinela_group_messages`
3. Checar `system_health_logs` sem erros
4. Após usuário registrar endpoint no painel Evolution, confirmar crescimento de `sentinela_group_messages`
