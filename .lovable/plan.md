Webhook Zernio validado (200 OK). Nada a implementar — próximos passos são apenas operacionais na Zernio.

## Status
- Assinatura HMAC (`X-Late-Signature`) validando corretamente
- `webhook.test` retornou `{ success: true, ignored: true }` (esperado: eventos de teste são ignorados pelo ingest)

## Próximos passos (na Zernio, sem código)
1. Ativar o webhook para os eventos reais de lead (`lead.created` ou equivalente)
2. Disparar um lead de teste real via um dos formulários Meta mapeados em `FORM_ID_TO_PRODUCT`
3. Validar no Supabase:
   - Registro em `zernio_leadgen_dedup`
   - Lead ingerido em `lia_attendances` com `area_atuacao`, `especialidade`, `scanner_marca`, `impressora_marca` e `produto_interesse` normalizados
   - Deal criado no funil Vendas do PipeRun

Se algum campo não normalizar ou o lead não entrar, me avise com o `Event ID` da Zernio para eu rastrear nos logs.
