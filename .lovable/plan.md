Plano de correção:

1. Corrigir o registro do produto no banco
   - Produto: `Scanner Intraoral BLZ Leap 500`
   - Alterar o campo interno `category` de `Scanners` para `product`
   - Manter `product_category = SCANNERS 3D`
   - Manter `active = true`, `approved = true`, `visible_in_ui = true`

2. Verificar o resultado
   - Confirmar que a consulta da tela de Gestão de Catálogo passa a retornar 117 produtos no total.
   - Confirmar que a categoria `SCANNERS 3D` passa de 8 para 9 produtos.
   - Confirmar que o Leap 500 aparece na lista.

Causa encontrada:

A tela carrega apenas registros com `category = product`. O Leap 500 está cadastrado com `category = Scanners`, então ele fica fora da listagem mesmo estando ativo, aprovado e visível na UI.