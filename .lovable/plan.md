

## Registrar Secrets do Meta no Supabase

Precisamos cadastrar 2 secrets no Supabase:

| Secret | Valor |
|--------|-------|
| `META_WEBHOOK_VERIFY_TOKEN` | `blz_meta_2026_secure` |
| `META_LEAD_ADS_TOKEN` | O Page Access Token (usaremos o primeiro fornecido) |

### Ações

1. **Adicionar `META_WEBHOOK_VERIFY_TOKEN`** com valor `blz_meta_2026_secure`
2. **Adicionar `META_LEAD_ADS_TOKEN`** com o token de acesso à página
3. **Nenhuma alteração de código** -- as 3 funções já usam `META_LEAD_ADS_TOKEN` e `META_WEBHOOK_VERIFY_TOKEN`

### Nota sobre o App Secret

O App Secret (`5c4e4cb70a8d7414a4bf330676bb3b2b`) pode ser usado futuramente para validar assinaturas de webhook (segurança extra). Não é necessário agora, mas pode ser cadastrado como `META_APP_SECRET` para uso futuro.

