## Problema identificado

Ao clonar os 52 formulários a partir do template `# - Formulário Padrão` (`63ecb106-c297-46de-b8d3-77f94a9c0e5f`), os novos campos receberam **novos UUIDs**, mas a coluna `conditions.show_if.rules[].field_id` **não foi remapeada** — continua apontando para os UUIDs dos campos do template original.

Resultado no `SmartOpsFormFlowPreview`:
- O visualizador procura o `field_id` referenciado e não encontra no formulário atual.
- As condicionais ficam **órfãs** → cada campo vira "coluna principal", sem setas verdes ligando pergunta → resposta → próxima pergunta.
- Os campos mapeados (badge laranja 🗺️) aparecem soltos, sem a lógica de quando devem aparecer.
- A "rota" (ordem condicional) é exibida como se tudo fosse linear.

Exemplo concreto (form `# - FORMS - Ativação exocad DentalCad I.A.`):
- Campo `Qual sua especialidade?` tem `show_if.rules[0].field_id = d28da69a-...` → esse UUID pertence ao campo `Qual sua área de atuação` do **template**, não deste form.
- O campo equivalente neste form clonado é `9cb2012a-8048-4b38-ac93-99158ef29928`.

Além disso, algumas linhas têm chaves legadas no topo de `conditions` (`field`, `operator`, `value`) misturadas com `show_if` — lixo de migração antiga.

## Plano de correção (1 migration SQL, somente dados)

Migration única que percorre todos os formulários clonados e:

1. **Constrói o mapeamento template → clone por `order_index`**
   - Template = `63ecb106-c297-46de-b8d3-77f94a9c0e5f`.
   - Para cada form com `name LIKE '# - FORMS - %'`, monta `(template_field_id → cloned_field_id)` usando `order_index` como chave (todos têm os mesmos 17 campos na mesma ordem — já validado).

2. **Reescreve `conditions` campo a campo** com `jsonb_set`:
   - Para cada rule em `conditions->'show_if'->'rules'`, troca `field_id` pelo equivalente no clone via o mapa.
   - Se a rule não bater no mapa (caso raro), mantém intacta para não destruir dado.

3. **Limpa chaves legadas de topo** (`field`, `operator`, `value`) em `conditions`, mantendo apenas `show_if`.

4. **NÃO altera o template** (`# - Formulário Padrão`) — ele já está consistente.

5. **NÃO altera nenhum código frontend** — o `SmartOpsFormFlowPreview`, `SmartOpsFormEditor`, `formConditions.ts` já funcionam corretamente; o problema é exclusivamente de dados.

### Implementação técnica

```sql
-- Pseudocódigo da migration
DO $$
DECLARE
  v_form record;
  v_map jsonb;
BEGIN
  FOR v_form IN
    SELECT id FROM smartops_forms
    WHERE name LIKE '# - FORMS - %'
  LOOP
    -- monta { "<template_field_id>": "<clone_field_id>", ... }
    SELECT jsonb_object_agg(tpl.id::text, clone.id::text) INTO v_map
    FROM smartops_form_fields tpl
    JOIN smartops_form_fields clone
      ON clone.form_id = v_form.id
     AND clone.order_index = tpl.order_index
    WHERE tpl.form_id = '63ecb106-c297-46de-b8d3-77f94a9c0e5f';

    -- aplica o remap + remove chaves legadas
    UPDATE smartops_form_fields f
    SET conditions = jsonb_build_object(
      'show_if', jsonb_set(
        f.conditions->'show_if',
        '{rules}',
        (
          SELECT jsonb_agg(
            CASE
              WHEN v_map ? (rule->>'field_id')
                THEN jsonb_set(rule, '{field_id}', to_jsonb(v_map->>(rule->>'field_id')))
              ELSE rule
            END
          )
          FROM jsonb_array_elements(f.conditions->'show_if'->'rules') AS rule
        )
      )
    )
    WHERE f.form_id = v_form.id
      AND f.conditions ? 'show_if'
      AND jsonb_typeof(f.conditions->'show_if'->'rules') = 'array';
  END LOOP;
END $$;
```

### Verificação pós-migration

```sql
-- deve retornar 0 linhas (nenhum field_id órfão)
SELECT f.name, ff.label, rule->>'field_id' AS orphan_field_id
FROM smartops_forms f
JOIN smartops_form_fields ff ON ff.form_id = f.id
CROSS JOIN LATERAL jsonb_array_elements(ff.conditions->'show_if'->'rules') AS rule
WHERE f.name LIKE '# - FORMS - %'
  AND NOT EXISTS (
    SELECT 1 FROM smartops_form_fields x
    WHERE x.form_id = f.id AND x.id::text = rule->>'field_id'
  );
```

## Arquivos

- **Nova migration**: `supabase/migrations/<timestamp>_fix_cloned_form_conditional_field_ids.sql`
- Nenhum arquivo frontend é tocado.
