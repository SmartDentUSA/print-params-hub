Plano para corrigir o catálogo exposto:

1. Atualizar os 2 registros duplicados/incorretos em `system_a_catalog`
   - Ocultar e desativar os registros legados que hoje geram os cards duplicados:
     - `Resina 3D Smart Print Bio Direct Aligner` com subcategoria `Ortodontia`
     - `Resina 3D Smart Print Bio GOWhite` com subcategoria `Estética`
   - Também limpar a subcategoria desses registros para remover definitivamente `Estética` e `Ortodontia` do contexto de `RESINAS 3D`.

2. Manter visíveis os 2 registros canônicos
   - `Smart Print Bio Direct Aligner`
   - `Smart Print Bio GOWhite`
   - Ajustar `category = 'product'` nesses dois registros para que apareçam em Admin > Catálogo de Produtos e você consiga editar categoria/subcategoria por lá.
   - Manter `product_category = 'RESINAS 3D'` para continuarem no catálogo público.

3. Validar o resultado no banco
   - Confirmar que o catálogo público retorna apenas 1 card por resina.
   - Confirmar que `Estética` e `Ortodontia` não aparecem mais como subcategorias de `RESINAS 3D`.

Detalhe técnico: a aba Catálogo usa `product_category` e normaliza `Resinas` para `RESINAS 3D`; por isso os registros legados ainda aparecem como se fossem da categoria correta, mesmo com subcategorias inválidas.