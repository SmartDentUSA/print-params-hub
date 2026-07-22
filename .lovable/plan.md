## Diagnóstico

A campanha SMS "RMS" (312 leads) falhou 100% com **HTTP 404** do provedor DisparoPro em todos os leads. O corpo da resposta é uma página HTML "Apigility 404" — ou seja, a URL do endpoint não existe mais no provedor.

Endpoint atualmente usado em `supabase/functions/smart-ops-sms-disparopro/index.ts`:
```
POST https://api.disparopro.com.br/mt-sms/v3/sms
```

Nenhum lead teve problema de telefone, mensagem ou codificação — o erro é 100% do endpoint do provedor.

## Causa raiz

URL do endpoint DisparoPro está desatualizada/incorreta (v3 provavelmente foi descontinuada ou o path mudou). O DisparoPro passou a expor a API sob outro caminho (tipicamente `/api/v1/...` ou `/mt/v1/...` conforme documentação atual).

## Plano de correção

1. **Confirmar endpoint correto** consultando `https://disparopro.com.br/api` (docs atuais) e/ou o painel do cliente. Candidatos prováveis:
   - `https://api.disparopro.com.br/mt/v1/send`
   - `https://api.disparopro.com.br/api/v1/sms`
   - v3 com sufixo diferente (ex.: `/mt-sms/v3/send`)

2. **Atualizar `smart-ops-sms-disparopro/index.ts`**:
   - Trocar `DISPARO_PRO_URL` para o endpoint válido.
   - Ajustar formato do payload/headers se a nova versão exigir (ex.: `Bearer` em vez de `Basic`, JSON schema diferente).
   - Ajustar `parseProviderItems` / `isProviderAccepted` para o novo formato de resposta se necessário.

3. **Endurecer tratamento de erro** para não repetir o cenário atual em silêncio:
   - Se `httpStatus === 404` ou resposta não-JSON (HTML), marcar a campanha como `failed` imediatamente após o primeiro lote e abortar (evita marcar 312 leads como falha por erro de configuração).
   - Gravar em `system_health_logs` um alerta `sms_provider_endpoint_invalid`.

4. **Reprocessar a campanha "RMS"**:
   - Resetar `campaign_sessions.status='pending'`, `sent_count=0`, `failed_count=0` para o id `921e502b-ecc6-4250-a56f-aaf89810bd97`.
   - Limpar registros em `campaign_send_log` desta campanha.
   - Re-invocar `smart-ops-sms-disparopro` com `async=true` e `batch_size=100`.

5. **Validação**: monitorar primeiro lote (100) e confirmar `protocolo` retornado pelo provedor antes de liberar restantes.

## Perguntas antes de executar

- Você tem a **URL/versão atual** da API do DisparoPro (do painel deles ou do e-mail de suporte)? Se sim, me passe que já aplico. Caso não, sigo com a hipótese `/mt/v1/send` e valido em runtime.
- Confirmar credenciais atuais (`DISPARO_PRO_TOKEN`) ainda são válidas — se o provedor migrou versão, pode exigir novo token.