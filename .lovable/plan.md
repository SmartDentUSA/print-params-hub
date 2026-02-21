

# Exportar conversas historicas (sem nova funcionalidade)

Alteracao minima: na edge function, trocar a janela de 24h para aceitar `days_back` opcional no body (default continua 1 dia para o cron). Assim basta invocar uma vez com `days_back: 30` pelo botao do Admin.

## Alteracoes

### 1. `supabase/functions/archive-daily-chats/index.ts`

- Linha 20: ler body opcional e calcular janela dinamica
- Substituir `const yesterday = new Date(today.getTime() - 24*60*60*1000)` por:

```text
const body = await req.json().catch(() => ({}));
const daysBack = Math.min(Math.max(body.days_back || 1, 1), 30);
const since = new Date(today.getTime() - daysBack * 24 * 60 * 60 * 1000);
```

- Usar `since` em vez de `yesterday` na query (linha 29) e nos logs

### 2. `src/components/AdminApostilaImporter.tsx`

- Adicionar state `archiveDaysBack` (default 7)
- Adicionar input numerico "Dias" ao lado do botao
- Passar `{ body: { days_back: archiveDaysBack } }` no invoke

### Resultado

O cron continua funcionando com 1 dia (envia `{}`). Voce clica "Exportar Agora" com 7 dias e as 64 conversas serao arquivadas imediatamente.

