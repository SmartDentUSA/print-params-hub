# Correção de formato em meta_form_mappings (somente SQL)

## Estado atual verificado agora
21 linhas, todas `active = true`, todas com `product_name` e `origin_system_b` preenchidos. **Os dois form_ids que estavam com `workflow_stage_target` NULL já foram corrigidos** — 1656129874991505 (SCAN BANCADA MEDIT) e 520986211045312 (SMARTLAB) já estão em `1_captura_digital__scanner_bancada`.

Restam **2 linhas** com defeito (underscore simples):

| form_id | form_name_meta | workflow_stage_target atual | problema |
|---|---|---|---|
| 1671244647446516 | # - FACE - BLZ INO110 PLUS - SÓ SCANNER | `1_captura_digital_scanner_intraoral` | underscore simples |
| 4309081142703799 | # - Impresoras - Smart Dent | `3_impressao_3d_impressora_odontologica` | underscore simples |

Os outros 19 valores já casam com o regex canônico.

## Divergências a apontar
1. Você falou em **5 linhas com defeito**; hoje restam **2**. As 2 linhas NULL já foram resolvidas em passo anterior, então o terceiro UPDATE (o de `form_id IN (...) AND workflow_stage_target IS NULL`) vai afetar 0 linhas — mantenho no script por idempotência.
2. Não existe constraint `meta_form_mappings_stage_formato_chk` na tabela hoje (só PK, UNIQUE em `form_id` e FK de `product_catalog_id`). O `DROP ... IF EXISTS` é inócuo.
3. Observação sem ação: 3 linhas têm `product_catalog_id` nulo (INSUMOS, RESINAS geral, Impresoras). Fora do escopo desta etapa — não vou mexer.

## SQL proposto (aplicar só após "Pode implementar")

```sql
UPDATE meta_form_mappings
   SET workflow_stage_target = '3_impressao_3d__impressora_odontologica'
 WHERE workflow_stage_target = '3_impressao_3d_impressora_odontologica';

UPDATE meta_form_mappings
   SET workflow_stage_target = '1_captura_digital__scanner_intraoral'
 WHERE workflow_stage_target = '1_captura_digital_scanner_intraoral';

UPDATE meta_form_mappings
   SET workflow_stage_target = '1_captura_digital__scanner_bancada'
 WHERE form_id IN ('1656129874991505','520986211045312')
   AND workflow_stage_target IS NULL;   -- 0 linhas hoje (já corrigidas)

ALTER TABLE meta_form_mappings
  DROP CONSTRAINT IF EXISTS meta_form_mappings_stage_formato_chk;

ALTER TABLE meta_form_mappings
  ADD CONSTRAINT meta_form_mappings_stage_formato_chk
  CHECK (workflow_stage_target IS NULL
         OR workflow_stage_target ~ '^[1-7]_[a-z0-9_]+__[a-z0-9_]+$');
```

Os três UPDATEs entram pela ferramenta de dados; os dois ALTERs entram como migration de schema.

## Escopo respeitado
- Nenhum arquivo de código alterado.
- `product_name`, `product_catalog_id`, `origin_system_b`, `active` intocados.
- Nenhum outro valor "normalizado".
- `lead_activity_log`, `lia_attendances` e Sistema A não são tocados.

## Aceite
```sql
SELECT count(*) total,
       count(*) FILTER (WHERE workflow_stage_target IS NULL) nulos,
       count(*) FILTER (WHERE workflow_stage_target ~ '^[1-7]_[a-z0-9_]+__[a-z0-9_]+$') ok
  FROM meta_form_mappings;
```
Esperado: `total = 21`, `nulos = 0`, `ok = 21`.
