## Diagnóstico

Baixei o CSV (`oportunidades-26-05-2026.csv`, 115 MB, encoding Latin-1, 129 colunas, 71.120 linhas).

Gap encontrado vs. nossa base:

| Métrica | PipeRun export | Banco hoje | Faltando |
|---|---:|---:|---:|
| Deals totais | 71.120 | 32.700 | **38.420** |
| Won/Ganha | 16.639 | 4.150 | **12.489** |
| Perdida | 896 | 117 | 779 |
| Aberta | 53.039 | 28.433 | 24.606 |

A maior parte do gap está no funil **"Funil Estagnados"** (53.659 deals, etapa "Etapa 00 - Novos") — leads antigos que o webhook nunca trouxe.

## Plano

### 1. Subir o CSV para Storage privado
- Bucket `piperun-imports` (privado), upload do arquivo via SQL `storage.objects` ou via dashboard.
- Manter rastreabilidade (data, hash, contagem).

### 2. Criar tabela de staging `piperun_deals_import`
- Espelha as 129 colunas do CSV como `text` + colunas de controle (`import_batch_id`, `imported_at`, `processed`, `error`).
- Carregar via Edge Function `piperun-import-csv` que faz streaming (CSV é grande, processar em chunks de 1.000 linhas).

### 3. Edge Function `piperun-deals-bulk-upsert`
Para cada linha do staging, aplicar a mesma lógica do webhook `smart-ops-piperun-webhook` (reuso de `_shared/piperun-deal-hydrate.ts` e `findLeadByCascade`):

**a. Resolver lead canônico** (cascata já existente):
`piperun_id` → `email` → `phone` → `cnpj` → cria novo lead se não achar e tiver email/telefone.

**b. Upsert em `deals`** por `piperun_deal_id`:
- Campos diretos: status (mapeando Aberta→aberta, Ganha→ganha, Perdida→perdida, Cancelada→cancelada), funil, etapa, owner, origem, valor P&S, MRR, datas, motivo de perda, temperatura, probabilidade, freight, payment.
- Campos JSONB: `proposals` (parse de "Itens da proposta"), `piperun_custom_fields` (todas colunas 105-128 — especialidade, scanner, impressora, área de atuação etc.).
- **Regra anti-perda já memorizada**: nunca sobrescrever JSONB com vazio; merge incremental.
- Timestamps: usar `Data de cadastro` (col 10) como `piperun_created_at`, `Data de fechamento` (col 11) como `closed_at` — nunca `now()`.

**c. Enriquecer `lia_attendances`** (apenas canônicos, `merged_into IS NULL`):
- Empresa: CNPJ, razão social, cidade/UF, segmento, porte, situação cadastral.
- Pessoa: CPF, cargo, endereço, instagram, especialidade, equipamentos (scanner/impressora).
- Estratégia ALWAYS_UPDATE para equipamentos (memória `lead-form-enrichment-v3`); demais campos só preenchem se nulos.

**d. Auditoria**: gravar em `piperun_webhook_events` (outcome=`bulk_import`) para manter trilha.

### 4. UI mínima em `/admin`
Card "Importação PipeRun" com:
- Botão **Selecionar CSV** (multipart upload, valida cabeçalho).
- Tabela de batches: data, linhas, processadas, criadas, atualizadas, erros, link p/ baixar relatório.
- Botão **Reprocessar batch** (idempotente).

### 5. Execução do batch atual
- Rodar o upload do CSV já baixado.
- Processar em background (cron `process-piperun-import-queue` a cada 1 min, lote de 500).
- Estimativa: ~71k linhas / 500 por minuto ≈ 2-3 horas até completar.
- Relatório final: criados vs. atualizados vs. leads novos vs. erros.

### 6. Salvaguardas
- **Idempotente**: upsert por `piperun_deal_id`, batch reprocessável.
- **Não duplica leads**: cascata de identidade respeitada; deals órfãos (sem identificador) ficam com `lead_id NULL` e flag `needs_review`.
- **Custom fields preservados**: regra no-overwrite-with-empty já implementada no webhook.
- **Auditoria completa** em `piperun_webhook_events`.

## Confirmação necessária

1. Pode criar o bucket `piperun-imports` e a tabela `piperun_deals_import`?
2. Pode rodar o import deste CSV imediatamente após a UI ficar pronta, ou prefere validar primeiro com um subset (ex.: só "Funil Estagnados")?
3. Para deals "Aberta" no funil "Funil Estagnados" (53k), devo marcar `real_status` como reativação ou manter neutro?
