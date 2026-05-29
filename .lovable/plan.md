# Diagnóstico — Receita Maio/2026 divergente

Verifiquei as 3 fontes diretamente no banco:

| Fonte | Deals ganhos | Receita |
|---|---|---|
| **PipeRun (UI oficial)** | — | **R$ 2.502.791,58** |
| **Tabela `deals`** (usada pelo Relatório do Sistema → `vw_vendas_ganhas` → `fn_total_vendas_mes`) | 347 | **R$ 2.252.998** (= R$ 2.223k que aparece na tela) |
| **JSONB `piperun_deals_history`** em `lia_attendances` (fonte do Cérebro/Copilot) — distinct deal_id | 432 | **R$ 2.604.537** |

## Causa raiz

A tabela `deals` está **defasada**. Encontrei **38 deals ganhos em Maio** que existem no PipeRun e no JSONB (ex: deal 60236286 / Adriano / R$ 69.990 fechado 29-05) mas **nunca foram persistidos na tabela `deals`**. Isso soma ~R$ 138k. Outros ~R$ 110k vêm de valores stale (proposta atualizada no PipeRun mas snapshot antigo na tabela).

O fluxo atual:
- `smart-ops-piperun-webhook` e `piperun-full-sync` atualizam o JSONB em `lia_attendances` (canônico, em tempo real).
- A tabela `deals` é atualizada por um caminho separado que está perdendo eventos.
- `vw_vendas_ganhas` lê da tabela `deals` → Relatório fica desatualizado.
- O Cérebro já foi migrado para ler do JSONB (last refactor), por isso ele bate com PipeRun, e o Relatório do Sistema continua divergente.

## Plano de correção

**1. Recriar `vw_vendas_ganhas` lendo direto do JSONB canônico**

Nova view materializada como SELECT sobre `lia_attendances` + `jsonb_array_elements(piperun_deals_history)`:
- `WHERE merged_into IS NULL`
- `AND snap->>'status' = 'ganha'`
- `AND snap->>'closed_at' IS NOT NULL`
- `DISTINCT ON (deal_id)` pegando o snapshot mais recente (evita duplicação quando o mesmo deal aparece em leads diferentes)
- Expõe as mesmas colunas: `vendedor` (owner_name), `pipeline`, `etapa` (stage_name), `produto`, `valor` (value), `fechado_em` (closed_at), `mes_fechamento`, etc.

**2. Manter as funções de relatório sem alterar assinatura**
- `fn_total_vendas_mes`, `fn_resumo_vendas_mes` continuam idênticas — só mudam de fonte porque a view foi recriada.
- Já foram alinhadas ao novo padrão na migration anterior do Cérebro.

**3. Validação pós-migration**

Rodar `SELECT * FROM fn_total_vendas_mes(2026,5)` e confirmar que a `receita_total` cai dentro de ±1% de R$ 2.502.791,58 (PipeRun). Recalcular ranking por vendedor e comparar com o `brain_sales_ranking` — devem ser idênticos.

**4. (Opcional, fora deste escopo)** Diagnosticar por que `piperun-full-sync` deixou de gravar na tabela `deals`. Como agora ninguém crítico depende dela, pode virar tabela de auditoria/legado.

## Detalhes técnicos

- Arquivo único: nova migration recriando `public.vw_vendas_ganhas` (DROP + CREATE).
- Filtro de pipelines NÃO se aplica aqui (o Relatório deve mostrar todas as vendas ganhas, igual o PipeRun). O filtro de pipelines não-comerciais (`Funil Atos`, `E-book`, etc.) continua só nas funções específicas do Cérebro/check_copilot_brain_drift.
- Parse de `closed_at`: alguns snapshots têm formato `"2023-02-14"` solto; usar `(snap->>'closed_at')::timestamptz` com guard `regexp_match` ou simplesmente filtrar `substring(...,1,4) ~ '^[0-9]{4}$'`.
- Coerção de `value` para `numeric` com `NULLIF` para evitar erro em strings vazias.

Posso aplicar?
