
## Descoberta

O CSV enviado (137 propostas, exportação parcial do PipeRun) não traz nome de item, então é insuficiente para auditar donos da Edge Mini. Cruzando com o banco (fonte real usada pelo dashboard), encontrei um bug de classificação:

O filtro atual da `fn_rayshape_owners()` é `(item->>'nome') ILIKE '%Edge Mini%'`, e nas propostas ganhas existem 4 SKUs distintos que casam com esse padrão:

| SKU                                    | Ocorrências | É a impressora? |
| -------------------------------------- | ----------- | --------------- |
| `RayShape - Edge Mini`                 | 125         | **Sim** |
| `BANDEJA PEQUENA - RAYSHAPE EDGE MINI` | 5           | Não (acessório) |
| `BANDEJA GRANDE - RAYSHAPE EDGE MINI`  | 3           | Não (acessório) |
| `LCD RAYSHAPE - EDGE MINI`             | 1           | Não (peça de reposição) |

Consequência: **3 leads na lista atual de donos nunca compraram a impressora**, só um acessório. Contaminam KPI de total, ticket médio de recompra e categoria.

## Correção

Migração única em `fn_rayshape_owners()` — restringir o `ILIKE` da impressora ao nome exato do SKU. Um item é a impressora se:

- `(item->>'nome') ILIKE 'RayShape - Edge Mini'` (nome canônico), **ou**
- `(item->>'nome') ILIKE 'Impressora 3D Rayshape Edge Mini%'` (variante já observada em `deals.proposals`)

E não casa com `BANDEJA`, `LCD` nem outras peças de reposição.

Aplicar essa condição em 3 lugares dentro da função:
1. Cálculo de `printer_price` no CTE `deal_edge` (SUM condicional).
2. Predicado `EXISTS (item Edge Mini)` na detecção de combo (dentro do `BOOL_OR` do CTE `deal_edge`).
3. `HAVING` do `deal_edge` — só entra no CTE se a proposta tem a impressora de verdade, não só acessório.

Fora desses três pontos, nada muda: manual owners, categorias, KPIs de recompra, sanitizador de e-mail placeholder, thresholds, filtro `status='ganha'` e `is_deleted=false` permanecem idênticos.

## Detalhes técnicos

Predicado reutilizado:
```sql
(
  (item->>'nome') ILIKE 'RayShape - Edge Mini'
  OR (item->>'nome') ILIKE 'Impressora 3D Rayshape Edge Mini%'
)
```

Após aplicar, valido:
- Total de donos deve cair de 123 para ~120.
- Rodar `SELECT count(*) filter (where row->>'sale_kind'='combo'), count(*) FROM jsonb_array_elements(fn_rayshape_owners()) row;` e conferir que continua sensato (esperado ~59 combo, ~61 separado).
- Conferir que os 3 leads falsos positivos identificados saíram da lista.

## Fora do escopo

- Não mudar a regra de combo (INO 200 / KIT CHAIRSIDE / scanners) — já validada com Vettori e Veraldi.
- Não mexer no CSV enviado — ele é só recorte parcial, sem coluna de nome de item; não vou usar como fonte.
- Não alterar `rayshape_manual_owners`.
