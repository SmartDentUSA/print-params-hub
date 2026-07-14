## Diagnóstico

O Catálogo de Produtos possui **80 variações em 48 produtos**, mas nenhuma delas foi vinculada às linhas atuais da Tabela de Preço. A importação também envia `presentation: "Unid"`, enquanto o banco aceita apenas `Unit`, `Kit` ou `Grs/Kg`; isso faz o lote de inserção falhar e nenhuma variação aparecer. Além disso, a interface ainda converte `presentation_qty` para número, descartando textos como `500g`, `1kg` e `—`.

## Implementação

1. **Corrigir o payload de importação**
   - Mapear cada variação de `catalog_product_variations` para uma linha própria em `dealer_price_items`.
   - Converter a unidade para um valor válido de apresentação: `g/kg → Grs/Kg`, kits/caixas → `Kit`, demais → `Unit`.
   - Manter preço, NCM, GTIN/EAN e unidade específicos da variação.

2. **Importar sem perder alterações existentes**
   - Atualizar linhas já correspondentes por `catalog_product_id + presentation_qty`.
   - Inserir somente variações ainda ausentes.
   - Preservar o desconto atual do distribuidor e recalcular o preço dealer.
   - Exibir mensagem de erro real caso alguma linha falhe, em vez de parecer que a importação concluiu.

3. **Aceitar variações textuais na interface**
   - Atualizar o tipo frontend de `presentation_qty` para texto.
   - Remover a conversão por `parseFloat` no campo de edição para preservar valores como `500g`, `1kg`, cores e `—`.

4. **Validar com dados reais**
   - Testar produtos com múltiplas apresentações e os produtos Atos, onde cada cor é um produto em uma linha própria.
   - Confirmar que o total importado aumenta e que cada variação aparece separadamente na Tabela de Preço.