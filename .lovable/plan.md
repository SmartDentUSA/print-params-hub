

## Atualizar Mapeamento de Variáveis SellFlux

O usuario compartilhou as chaves personalizadas disponiveis no SellFlux. Precisamos garantir que nosso sistema mapeia todas elas corretamente, tanto no envio (Push) quanto na recepcao (Receiver/Pull).

### Variaveis SellFlux vs Sistema Atual

| Variavel SellFlux | Mapeado? | Campo `lia_attendances` |
|---|---|---|
| `primeiro_nome` | Parcial | extraido de `nome` |
| `telefone` | Sim | `telefone_raw` |
| `email` | Sim | `email` |
| `proprietario` | Sim | `proprietario_lead_crm` |
| `area_atuacao` | Sim | `area_atuacao` |
| `especialidade` | Sim | `especialidade` |
| `produto_interesse` | Sim | `produto_interesse` |
| `scanner` | Sim | `tem_scanner` |
| `impressora` | Sim | `impressora_modelo` |
| `bought-resin` | Parcial | tag `EC_PROD_RESINA` |
| `atual-id-pipe` | Novo | `piperun_id` (ja existe) |
| `platform_pass` | Novo | campo Astron |
| `platform_mail` | Novo | campo Astron |
| `train_date` | Novo | data treinamento |
| `scheduled_by` | Novo | agendado por |
| `group_train` | Novo | grupo treinamento |
| `train-dur` / `train-time` | Novo | duracao/horario treino |
| `debtor-message` | Novo | msg inadimplencia |
| `invoice-track` / `invoice-data` | Novo | rastreio/dados NF |
| `vacancy` | Novo | vagas |
| `tracking.*` | Novo | rastreamento Loja Integrada |
| `transaction.*` | Novo | pagamento Loja Integrada |
| `pix` / `boleto` | Novo | codigos pagamento |

### Plano

**1. Atualizar `buildSellFluxCampaignPayload` em `sellflux-field-map.ts`**

Adicionar os campos que ja existem no `lia_attendances` mas nao estao sendo enviados ao SellFlux:
- `atual-id-pipe` ← `piperun_id`
- `bought-resin` ← derivado de `tags_crm` contendo `EC_PROD_RESINA`
- `platform_mail` ← `astron_email` (se existir)
- `platform_pass` ← campo Astron (se existir)

**2. Atualizar `smart-ops-sellflux-webhook` (Receiver)**

Adicionar mapeamento dos novos campos customizados recebidos do SellFlux:
- `atual-id-pipe` → `piperun_id`
- `platform_mail` → campo de referencia Astron
- `proprietario` → `proprietario_lead_crm`
- `train_date`, `scheduled_by` → armazenar em JSONB `sellflux_custom_fields`
- `invoice-track`, `invoice-data` → dados de NF
- Campos de rastreamento (`tracking.*`) e transacao (`transaction.*`) da Loja Integrada

**3. Atualizar `WaLeadsVariableBar`**

Adicionar as novas variaveis ao componente para que os operadores possam inseri-las nas mensagens:
- `piperun_id`, `impressora_modelo`, `tem_scanner`, `bought-resin`
- Campos de treinamento: `train_date`, `scheduled_by`, `group_train`

**4. Atualizar `fetchLeadFromSellFlux` (Pull)**

Extrair os campos customizados retornados pela API GET do SellFlux e mapear para `lia_attendances`.

### Arquivos a Modificar

- `supabase/functions/_shared/sellflux-field-map.ts` — adicionar campos no payload de envio
- `supabase/functions/smart-ops-sellflux-webhook/index.ts` — mapear novos campos recebidos
- `supabase/functions/smart-ops-sellflux-sync/index.ts` — extrair campos customizados no pull
- `src/components/smartops/WaLeadsVariableBar.tsx` — adicionar variaveis novas

