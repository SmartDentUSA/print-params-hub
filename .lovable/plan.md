

# Auditoria: Paulo Salles — PipeRun CSV vs SmartOps

## Dados do PipeRun (CSV exportado)

Extraí **19 deals únicos** (por hash de oportunidade) do CSV. Todos com status **Ganha**:

| # | Data | Valor P&S | Produto(s) | Vendedor | Pipeline |
|---|------|-----------|-----------|----------|----------|
| 1 | 21/01/2022 | R$ 690 | Resina Salmão 1kg | Evandro | Ganhos Aleatórios |
| 2 | 03/02/2022 | R$ 270 | Reposição Teflon Anycubic x3 | Evandro | Ganhos Aleatórios |
| 3 | 15/02/2022 | R$ 1.070 | Painel LCD Anycubic Mono 6.08" | Evandro | Ganhos Aleatórios |
| 4 | 27/07/2022 | R$ 827 | Resina Salmão 1kg + frete R$62 | Evandro | Ganhos Aleatórios |
| 5 | 29/07/2022 | R$ 902 | Bite Splint Clear 500g + frete R$62 | Evandro | Ganhos Aleatórios |
| 6 | 11/10/2022 | R$ 902 | Bite Splint Clear 500g + frete R$62 | Evandro | Ganhos Aleatórios |
| 7 | 05/12/2022 | R$ 892 | Bite Splint Clear 500g + frete R$62 | Evandro | Ganhos Aleatórios |
| 8 | 15/03/2023 | R$ 892 | Bite Splint Clear 500g + frete R$62 | Evandro | Ganhos Aleatórios |
| 9 | 03/04/2023 | R$ 827 | Resina Salmão 1kg + frete R$62 | Evandro | Ganhos Aleatórios |
| 10 | 27/06/2023 | R$ 902 | Bite Splint Clear 500g + frete R$62 | Evandro | Ganhos Aleatórios |
| 11 | 03/10/2023 | R$ 902 | Bite Splint Clear 500g + frete R$62 | Evandro | Ganhos Aleatórios |
| 12 | 06/11/2023 | R$ 827 | Resina Salmão 1kg + frete R$62 | Evandro | Ganhos Aleatórios |
| 13 | 19/08/2024 | R$ 1.628 | Salmão 1kg + Bite Splint 500g + frete R$29 | Patricia | CS Onboarding |
| 14 | **27/11/2024** | **R$ 778** | Bite Splint 500g + frete R$29 | Patricia | **CS Onboarding** |
| 15 | 24/01/2025 | R$ 1.313 | Salmão 1kg + Bite Flex 500g | Evandro | CS Onboarding |
| 16 | **02/04/2025** | **R$ 904** | Bite Flex 500g + frete R$29 | Patricia | **CS Onboarding** |
| 17 | **04/07/2025** | **R$ 1.873** | Bite Flex 500g + Salmão 1kg + frete R$69 | Patricia | **CS Onboarding** |
| 18 | **15/12/2025** | **R$ 1.873** | Bite Flex 500g + Salmão 1kg + frete R$69 | Patricia | **CS Onboarding** |
| 19 | 17/03/2026 | R$ 1.026,40 | Bite Flex 500g + frete R$63,90 | Lucas | CS Onboarding |

**Total PipeRun: R$ 19.298,40** (19 deals ganhos)

## O que o SmartOps tem atualmente

O JSONB `piperun_deals_history` tem **15 deals**. Faltam 4 (em negrito acima):

| Deal ausente | Valor | Vendedor |
|---|---|---|
| 27/11/2024 | R$ 778 | Patricia |
| 02/04/2025 | R$ 904 | Patricia |
| 04/07/2025 | R$ 1.873 | Patricia |
| 15/12/2025 | R$ 1.873 | Patricia |

**Valor faltando: R$ 5.428** (13.870 + 5.428 = 19.298)

Todos os 4 deals faltantes são do pipeline **CS Onboarding** e de **Patricia Gastaldi**. O `SYNC_PIPELINES` já inclui CS Onboarding, então o problema é que esses deals foram criados em um período em que o sync não rodou ou o identity cascade não os vinculou (possivelmente porque foram criados com título "Paulo Salles" sem email).

## Dados adicionais do PipeRun que NÃO estamos capturando no card

O CSV traz campos ricos que o card não exibe:

1. **Dados de proposta detalhados**: forma de pagamento (Boleto), parcelas, entrada, desconto
2. **Frete**: tipo (FOB/CIF), valor, transportadora (CORREIOS SEDEX)
3. **Dados pessoais completos**: CPF (947.079.877-53), endereço completo (mudou de endereço ao longo do tempo)
4. **Especialidade**: PROTESISTA
5. **Área**: CLÍNICA OU CONSULTÓRIO
6. **Vendedores com valor**: Evandro R$ 11.382 | Patricia R$ 7.056 | Lucas R$ 1.026

## Plano de Correção

### 1. Backfill imediato dos 4 deals faltantes via SQL

Atualizar o JSONB `piperun_deals_history` do Paulo Salles para adicionar os 4 deals ausentes e recalcular `ltv_total` e `total_deals`.

### 2. Criar edge function `import-proposals-csv` para importar CSVs do PipeRun

Reaproveitar o CSV de propostas do PipeRun para backfill completo em batch:
- Parsear o CSV (separador `;`)
- Agrupar linhas por hash de oportunidade (dedup de itens multi-produto)
- Para cada deal: resolver lead por pessoa_piperun_id ou email
- Upsert no `piperun_deals_history` JSONB com dados completos (itens da proposta, frete, pagamento, vendedor)
- Recalcular `ltv_total` e `total_deals`

### 3. Enriquecer snapshot de deal com dados de proposta

Expandir a interface `DealSnapshot` no sync para incluir:
- `proposals`: array com `{ id, items: [{nome, qty, unit_value, total}], freight_type, freight_value, payment_method, installments }`
- `owner_name`: já existe mas falta em deals mais antigos

Isso alimenta automaticamente a seção "Produtos Mais Vendidos" e "Vendedor Top" que já estão no card.

### 4. Fix no sync periódico: garantir que deals do CS Onboarding vinculem corretamente

O problema de identity cascade é que esses 4 deals podem ter sido buscados mas não vinculados ao lead Paulo Salles porque:
- O `piperun_id` do lead aponta para um deal antigo (R$690)
- A busca por email pode ter falhado se o deal não tinha `person.emails` populado

**Fix**: No `smart-ops-sync-piperun`, após o identity cascade falhar, tentar match por `pessoa_piperun_id` (12929031) que é estável.

