# Correção de formato em meta_form_mappings (somente SQL)

## O que encontrei (verificado no banco)
Tabela tem exatamente 21 linhas, todas `active = true`. Defeitos de formato:

| form_id | form_name_meta | workflow_stage_target atual | problema |
|---|---|---|---|
| 1671244647446516 | # - FACE - BLZ INO110 PLUS - SÓ SCANNER | `1_captura_digital_scanner_intraoral` | underscore simples |
| 4309081142703799 | # - Impresoras - Smart Dent | `3_impressao_3d_impressora_odontologica` | underscore simples |
| 1656129874991505 | # - FACE - SCAN BANCADA MEDIT | NULL | sem etapa |
| 520986211045312 | # - FACE - SMARTLAB | NULL | sem etapa |

Não existe hoje nenhuma constraint `meta_form_mappings_stage_formato_chk` (a tabela só tem PK, UNIQUE em `form_id` e a FK de `product_catalog_id`). O `DROP CONSTRAINT IF EXISTS` é inócuo, mantido por segurança.

## Divergências a apontar
1. Você mencionou **5 linhas com defeito**; o banco mostra **4** (2 com underscore simples + 2 NULL). Os outros 17 valores já casam com o regex canônico.
2. `520986211045312` é o form **"# - FACE - SMARTLAB"**, não um nome de scanner de bancada. Vou aplicar `1_captura_digital__scanner_bancada` como você pediu, mas confirme se é isso mesmo.

## SQL proposto (a aplicar só após "Pode implementar")

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
   AND workflow_stage_target IS NULL;

ALTER TABLE meta_form_mappings
  DROP CONSTRAINT IF EXISTS meta_form_mappings_stage_formato_chk;

ALTER TABLE meta_form_mappings
  ADD CONSTRAINT meta_form_mappings_stage_formato_chk
  CHECK (workflow_stage_target IS NULL
         OR workflow_stage_target ~ '^[1-7]_[a-z0-9_]+__[a-z0-9_]+$');
```

Os três UPDATEs entram pela ferramenta de dados; os dois ALTERs entram como migration de schema (é DDL na própria `meta_form_mappings`, tabela permitida no escopo).

## Escopo respeitado
- Nenhum arquivo de código alterado.
- `product_name`, `product_catalog_id`, `origin_system_b`, `active` intocados.
- Nenhum outro valor "normalizado".
- `lead_activity_log`, `lia_attendances` e Sistema A não são tocados.

## Aceite
Após aplicar, rodo:
```sql
SELECT count(*) total,
       count(*) FILTER (WHERE workflow_stage_target IS NULL) nulos,
       count(*) FILTER (WHERE workflow_stage_target ~ '^[1-7]_[a-z0-9_]+__[a-z0-9_]+$') ok
  FROM meta_form_mappings;
```
Esperado: `total = 21`, `nulos = 0`, `ok = 21`.
