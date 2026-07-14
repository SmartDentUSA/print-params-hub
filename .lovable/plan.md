## Alterar opções da coluna "Pres" (Apresentação)

Substituir as 3 opções atuais (`Grs/Kg`, `Unit`, `Kit`) pelas **5 unidades de medida** pedidas:

- `g`
- `Kg`
- `ml`
- `mg`
- `Unid`

### Arquivos afetados

**`src/components/smartops/distributors/types.ts`**
- Trocar tipo:
  ```ts
  export type PresentationType = "g" | "Kg" | "ml" | "mg" | "Unid";
  export const PRESENTATION_OPTIONS: PresentationType[] = ["g", "Kg", "ml", "mg", "Unid"];
  ```

**`src/components/smartops/distributors/DealerPriceTable.tsx`**
- Trocar o default `"Unit"` (linhas 179, 216, 491) por `"Unid"` para que novos itens já apareçam com a nova unidade e itens legados sem valor caiam no novo default.

### Compatibilidade com dados existentes

Registros já salvos em `dealer_price_items.presentation` com `"Grs/Kg"`, `"Unit"` ou `"Kit"` continuarão a aparecer no dropdown (o Select renderiza o valor mesmo fora da lista), mas ao abrir e escolher outra opção o valor é normalizado para a nova lista. **Não é feita migração automática no banco** — se você quiser, posso incluir um `UPDATE` mapeando `Unit → Unid` e `Grs/Kg → g` em uma migration separada; hoje isso não está no escopo.

### Fora do escopo

- Nenhuma mudança na lógica de multiplicador (`quantity_multiplier`) — continua sendo o multiplicador do preço dealer.
- Nenhuma alteração no `DealerCatalogGrid` (a coluna Pres não aparece lá).
- Nenhuma tradução PT/EN/ES da lista (unidades são universais).
