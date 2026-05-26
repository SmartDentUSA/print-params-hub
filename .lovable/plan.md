## Plano: Recuperar 17 leads ausentes do Piperun

### 1. Adicionar 3 formulários Meta faltantes ao poller
Atualizar a configuração do `meta-lead-ads-pull` (catálogo dinâmico em `meta_form_catalog` ou config estática) para incluir:
- `# - GlazeON- Smart Dent`
- `# - FACE - BLZ INO110 PLUS + NOTEBOOK`
- `# - PósCura- Smart Dent`

Validar com SELECT em `meta_form_catalog` quais formulários estão ativos hoje e inserir/ativar os 3 ausentes (via migration se a tabela exigir UPDATE/INSERT estrutural, ou via INSERT direto se a tabela aceitar inserts).

### 2. Investigar falha do `smart-ops-meta-lead-recovery`
Consultar logs do edge function (últimas 48h) para os 5 leads dos forms ativos (`Impresoras`, `BLZ- Smart Dent`, etc.):
- Verificar erros em `function_edge_logs` com `function_id = smart-ops-meta-lead-recovery`
- Checar `meta_lead_ingestion_log` para tentativas falhadas (status != 'success')
- Identificar se é rate limit, token expirado, ou janela de busca curta demais
- Aplicar fix mínimo (ex.: aumentar janela de lookback, retry com backoff)

### 3. Backfill manual dos 17 leads via CSV
Executar `smart-ops-meta-csv-backfill` com o CSV fornecido pelo usuário:
- Forçar `commercial_override=true` para passar pelo Commercial Intent Guard
- Respeitar Person Origin Frozen (não sobrescrever origin de leads existentes)
- Respeitar dedupe por `proposal_id` e debounce nome+source 60s
- Anomalias documentadas: pular `test@meta.com`; tratar `centrodonto@terra.com.br` corrigindo o domínio (typo Gmail) antes do envio

### Pós-execução: verificação
- Query em `lia_attendances` + `deals` filtrando os 17 emails/phones do CSV
- Confirmar `piperun_id` populado e Deal criado com `origem_primeiro_contato` correto
- Reportar quais foram criados, quais falharam e o motivo

### Ordem de execução
1. Fix imediato (forms ausentes) → previne novos vazamentos
2. Backfill CSV → recupera os 17 históricos
3. Debug do recovery cron → fix estrutural para não depender de CSV manual

### Riscos
- Backfill pode criar duplicatas se identidade colidir com lead canônico já mergeado → mitigado pelo Lead Merge System
- Forms novos no poller podem gerar pico de ingestion → monitorar `meta_lead_ingestion_log` nas próximas 2h
