

## Problema

A Edge Function `smart-ops-meta-lead-webhook` existe no código mas **não está deployada** no Supabase. Quando o Meta tenta acessar a URL, recebe 404.

## Causa

A função precisa ser re-deployada. Isso acontece automaticamente quando há um commit que altera o arquivo, mas como o arquivo já existia sem alterações recentes, o deploy pode não ter sido disparado.

## Solução

1. **Forçar o deploy** da Edge Function fazendo uma alteração mínima no arquivo (ex: adicionar um comentário com timestamp) para que o Lovable dispare o deploy automático.

2. **Verificar o deploy** chamando o endpoint GET com os parâmetros de verificação do webhook.

3. **Confirmar que o Meta consegue alcançar** testando com um POST simulando um lead real.

## Alteração

**Arquivo:** `supabase/functions/smart-ops-meta-lead-webhook/index.ts`
- Adicionar comentário `// deployed 2026-03-31` no topo para forçar redeploy

Depois do deploy, testarei:
- GET de verificação (hub.mode=subscribe)
- POST com payload de lead simulado

