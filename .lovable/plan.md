## Objetivo

Excluir fisicamente o cartão pai deprecated `ATOS Block - caixa com 5 unidades` (ID `63d0a419-d860-4939-9e09-1e30f9620597`, slug `/atos-block-caixa-com-5-unidades`, categoria 7. Fresagem / 7.2 Insumos), mantendo apenas as 11 tonalidades já consolidadas.

## Verificações antes de apagar

1. Confirmar que as 11 sucessoras estão OK em `system_a_catalog` — cada uma com `image_url`, `description`, categoria `7. Fresagem / 7.2 Insumos`, `active=true`, `visible_in_ui=true`, e 5 documentos ativos em `catalog_documents`. Se qualquer sucessora estiver incompleta, aborto e reporto antes de deletar.
2. Confirmar que o pai continua com `active=false` (soft-deleted na etapa anterior) e que `extra_data.deprecated.successors` lista os 11 IDs. É a última chance de reverter — depois do DELETE não tem volta.
3. Checar dependências antes do DELETE para não quebrar FK:
   - `deal_items` referenciando o pai (esperado: 0, já verificado antes).
   - Qualquer outra tabela com FK para `system_a_catalog.id` (ex.: `catalog_product_variations`, `catalog_documents`, conteúdos que linkam produto). Vou listar via `information_schema` e decidir por linha:
     - `catalog_documents` do pai: DELETE (as 55 cópias nas sucessoras já existem).
     - `catalog_product_variations` do pai (11 linhas): DELETE (as sucessoras têm variações próprias).
     - Se aparecer FK inesperada com dados relevantes, paro e reporto antes de forçar.

## Execução (via `supabase--insert`, apenas DML)

```sql
-- 1. Apagar documentos do pai
DELETE FROM catalog_documents WHERE product_id = '63d0a419-d860-4939-9e09-1e30f9620597';

-- 2. Apagar variações do pai
DELETE FROM catalog_product_variations WHERE product_id = '63d0a419-d860-4939-9e09-1e30f9620597';

-- 3. Apagar o registro pai
DELETE FROM system_a_catalog WHERE id = '63d0a419-d860-4939-9e09-1e30f9620597';
```

## Redirect do slug antigo

O slug `/atos-block-caixa-com-5-unidades` deixará de resolver. Duas opções — me diga qual:
- **(a)** Não fazer nada — 404 na URL antiga (aceitável se não há tráfego externo).
- **(b)** Criar redirect 301 para uma das 11 tonalidades (ex.: `/atos-block-ht-a1`) ou para a listagem de categoria Fresagem/Insumos. Isso exigiria uma linha em `external_links` ou lógica no roteador — posso implementar se quiser.

## Validação pós-delete

- `SELECT count(*) FROM system_a_catalog WHERE slug = 'atos-block-caixa-com-5-unidades'` → esperado 0.
- Recontar produtos ATOS Block ativos em 7.2 Insumos → esperado 11.
- Abrir `/base-conhecimento?tab=catalogo` chip Fresagem e conferir que os 11 cartões aparecem e o pai sumiu.

## O que NÃO muda

- Nenhuma das 11 tonalidades.
- Storage dos PDFs (as URLs são compartilhadas com as cópias já criadas nas sucessoras — nada é removido do bucket).
- Nenhuma tabela de vendas, PipeRun, Omie ou pipelines.

## Confirmações antes de executar

1. OK apagar fisicamente (irreversível)?
2. Redirect do slug: (a) 404, (b) redirecionar — se (b), destino?
