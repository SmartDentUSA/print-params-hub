## Objetivo

1. Classificar cada dono de Edge Mini como **Separado** ou **Combo** com base no item da proposta ganha (regra: "item único com múltiplos produtos no nome").
2. Adicionar dois KPIs ao dashboard "Impressora 3D Rayshape Edge Mini — Donos": `Equipamentos vendidos separadamente` e `Equipamentos combo`, além de chips de filtro para as duas categorias.
3. Manter o filtro atual da RPC: só deals `status='ganha'` e `is_deleted=false`. Deals excluídos/empty-proposals continuam fora — usuário adiciona via "Adicionar manualmente" se quiser.

## Passo 1 — Migration: `fn_rayshape_owners` retorna `sale_kind`

Reescrever a RPC (mesma lógica atual + campo novo `sale_kind: 'separado' | 'combo'`).

Detecção do combo é feita no `deal_edge` a partir do texto do item que contém `Edge Mini`. Regra:

```
combo := (item->>'nome' ILIKE '%edge mini%')
      AND (item->>'nome' ~* '(cure|mercury|wash|nano|resina|notebook|ino[[:space:]]|blz[[:space:]]|ryzen|glaze|splint|bite|smartmake|elegoo|kit|vitality|unikk|pod\b)')
```

Ou seja: se o mesmo item que traz "Edge Mini" também menciona qualquer outro produto conhecido → é combo. Caso contrário → separado.

A RPC agrega por lead: se **qualquer** deal Edge Mini do lead for combo → o dono é classificado `combo` (a maioria dos casos misturados no CSV são combos). Isto fica explícito em CASE dentro do SELECT final:

```sql
'sale_kind', CASE
  WHEN BOOL_OR(de.is_combo) OVER (PARTITION BY p.lead_id) THEN 'combo'
  ELSE 'separado'
END
```

Alterações no CTE `deal_edge`:
- Adiciona coluna `is_combo boolean` calculada pelo regex acima aplicada ao item que trouxe Edge Mini.
- Mantém filtros `status='ganha'` e `is_deleted=false` (não muda o universo de deals).

Nada mais muda no shape retornado — apenas adiciona `sale_kind` em cada linha.

## Passo 2 — Frontend: `src/components/SmartOpsRayshape.tsx`

1. Estender interface `Owner`:
   ```ts
   sale_kind?: 'separado' | 'combo';
   ```

2. No `useMemo(kpis)`, adicionar dois contadores:
   ```ts
   const separados = owners.filter(o => o.sale_kind === 'separado').length;
   const combos    = owners.filter(o => o.sale_kind === 'combo').length;
   ```

3. Grid de KPIs vai de 4 para 6 cards (md:grid-cols-3 lg:grid-cols-6):
   - Donos totais
   - Vendidos separadamente (novo, azul)
   - Combo (novo, roxo)
   - Recompraram
   - Críticos (180d+)
   - Ticket médio recompra

4. Adicionar dois chips de filtro extras ao lado dos existentes (`critico | atencao | cedo | recomprou`): `separado | combo`. Estado `filter` passa a aceitar `Category | 'separado' | 'combo' | 'all'`. Filtro aplicado no `filtered` useMemo por `sale_kind` quando o valor está entre os novos.

5. Na tabela/lista, adicionar uma coluna/badge pequeno "Combo" quando `sale_kind==='combo'` (badge roxo discreto ao lado do nome do lead).

## Passo 3 — Verificação

1. Rodar a RPC nova e conferir contagem separado vs combo:
   ```sql
   SELECT o->>'sale_kind' k, count(*) FROM (SELECT jsonb_array_elements(fn_rayshape_owners()) o) t GROUP BY 1;
   ```
2. Amostragem manual de 5 leads em cada bucket para validar a regra do regex (falso combo / falso separado).
3. Conferir no painel se os totais dos dois novos KPIs somam `kpis.total`.

## Fora do escopo

- Não altero thresholds Crítico/Atenção/Cedo agora (fica para outro turno se você pedir).
- Não incluo deals `is_deleted=true` no RPC — Renailda (58946144) e Raquel (59620258) continuam de fora até virarem manual owner.
- Não trato deals com `proposals` vazio (Matheus 56506351) — permanecem fora até proposals ser populado ou serem adicionados manualmente.
- Não altero a `fn_rayshape_status` (painel individual do lead).
