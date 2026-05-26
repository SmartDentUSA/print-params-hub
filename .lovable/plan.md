## Diagnóstico

Comparei o CSV exportado do PipeRun (110 oportunidades, filtradas por `Status=Ganha` + `Tags contém RAYSHAPE`) contra `fn_rayshape_owners()` do sistema.

- **CRM (CSV)**: 59 deals Ganha com tag RAYSHAPE
- **Sistema (Rayshape Donos Edge Mini)**: 88 donos (inclui histórico anterior ao recorte do CSV)
- **Faltando no sistema**: **7 deals**

## Os 7 deals ausentes

| Deal ID | Lead | Fechamento | Vendedor | Valor | Status no CDP |
|---|---|---|---|---|---|
| 47317858 | Fabiano Rocha Pereira e Cia LTDA | 24/10/2025 | Patricia Gastaldi | R$ 27.000 | lead existe, sem etapa |
| 51852538 | GABRIELA CE | 11/09/2025 | Daniele Oliveira | R$ 26.000 | **lead não existe** |
| 51909112 | M Veraldi Odontologia Especializada Ltda | 15/09/2025 | Paulo Sérgio | R$ 79.500 | lead existe, sem etapa |
| 52559870 | Sergio Antonio Cardoso | 30/09/2025 | Patricia Gastaldi | R$ 28.617 | **lead não existe** |
| 56643646 | Ivan Contreras | 03/03/2026 | Lucas Silva | R$ 28.000 | lead existe, sem etapa |
| 58513700 | Clinica kignel associados Ltda | 08/04/2026 | Gabriella Ferreira | R$ 30.000 | lead existe (cs_em_espera) |
| 59311370 | COELHO E VILAROUCA LTDA | 27/04/2026 | Lucas Silva | R$ 18.690 | lead existe, sem etapa |

## Causa raiz provável

- **2 leads ausentes do CDP** (51852538, 52559870): sync do PipeRun não trouxe esses deals para `lia_attendances`. Provavelmente foram criados manualmente no PipeRun em pipeline não monitorado pelo orquestrador, ou ficaram fora da janela `updated_since` do reconciler.
- **5 leads existem mas não aparecem em `fn_rayshape_owners`**: a função filtra por SKU/produto da Rayshape (Edge Mini) dentro do `deals.items_jsonb`. Esses deals estão no CDP mas o item não foi normalizado como Rayshape — provavelmente o nome do produto na proposta do PipeRun não bate com o matcher SKU.

## Plano de correção

1. **Backfill dos 2 leads ausentes** (51852538, 52559870):
   - Invocar `smart-ops-piperun-funnel-reconciler?hours=168` (7 dias não cobre — usar `smart-ops-sync-piperun?orchestrate=true&pipeline_id=18784&deal_ids=51852538,52559870` para forçar pull pontual).
   - Alternativa: adicionar suporte ao parâmetro `deal_ids` no `smart-ops-sync-piperun` se ainda não existir.

2. **Investigar os 5 leads sem match Rayshape**:
   - Inspecionar `deals.items_jsonb` desses 5 `piperun_id` para ver o `product_name`/`sku` exato.
   - Ajustar o matcher em `fn_rayshape_owners` (ou no normalizador de itens) para reconhecer as variações de nome ("Rayshape Edge Mini", "EDGE MINI", "Edge-Mini", etc.).

3. **Verificação pós-fix**:
   - Rodar `fn_rayshape_owners()` e confirmar que os 7 IDs apareceram.
   - Conferir no painel SmartOps → Rayshape se contagem total bate com CRM (59 no recorte + histórico).

## Não muda

- Lógica do funil 18784 recém-atualizada.
- Outras views/RPCs do SmartOps.
