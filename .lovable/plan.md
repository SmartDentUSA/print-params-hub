

## Endpoint para Receber Leads do SellFlux via Webhook

### Situação Atual

O sistema já tem o `smart-ops-ingest-lead` que recebe leads de formulários e outras fontes. Porém, ele espera campos como `email`, `full_name`, `phone` etc. Os webhooks do SellFlux enviam payloads com estrutura própria que precisa ser mapeada.

Atualmente o fluxo é **unidirecional**: nosso sistema **envia** dados para o SellFlux (via V1 GET e V2 POST). Não existe endpoint dedicado para **receber** dados do SellFlux.

### Solução

Criar uma nova Edge Function `smart-ops-sellflux-webhook` dedicada a receber webhooks do SellFlux, que:

1. **Recebe o payload** do SellFlux (POST com JSON)
2. **Mapeia os campos** do SellFlux para o formato do nosso sistema (nome, email, telefone, tags, etc.)
3. **Redireciona** para o `smart-ops-ingest-lead` existente (reutilizando toda a lógica de dedup, merge, PipeRun sync, Astron lookup, etc.)
4. **Retorna 200** rapidamente para o SellFlux não dar timeout

### Endpoint

```
POST https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-sellflux-webhook
```

Este é o URL que você vai configurar no SellFlux como destino do webhook.

### Implementação

**Arquivo**: `supabase/functions/smart-ops-sellflux-webhook/index.ts`

- Aceita POST sem JWT (webhook externo)
- Extrai campos do payload SellFlux: `email`, `nome`/`name`, `phone`/`telefone`, `tags`, campos customizados
- Mapeia tags do SellFlux para tags padronizadas usando `migrateLegacyTags()` já existente
- Extrai campos de qualificação embutidos nas tags (área de atuação, impressora, scanner)
- Chama internamente `smart-ops-ingest-lead` com o payload normalizado
- Loga o evento em `system_health_logs` para rastreabilidade

**Config**: Adicionar `[functions.smart-ops-sellflux-webhook] verify_jwt = false` ao `config.toml`

### Campos Mapeados (SellFlux → Nosso Sistema)

| SellFlux | `lia_attendances` |
|----------|------------------|
| `email` | `email` |
| `name` / `nome` | `nome` |
| `phone` / `telefone` | `telefone_raw` |
| `tags` (array) | processados via `migrateLegacyTags()` → `tags_crm` |
| campos extraídos das tags | `area_atuacao`, `tem_impressora`, `tem_scanner` |
| `city` / `cidade` | `cidade` |
| `state` / `uf` | `uf` |

O `source` será setado como `"sellflux_webhook"` para identificar a origem.

