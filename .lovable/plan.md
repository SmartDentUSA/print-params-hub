## Objetivo
Adicionar coluna **ID Smart Dent** na tabela Stripe / Pagamentos, posicionada imediatamente antes de **ID Dongle**.

## Mudança
Em `src/components/SmartOpsStripePayments.tsx`:

1. Adicionar `<th>ID Smart Dent</th>` no cabeçalho, entre `Vendedor` e `ID Dongle`.
2. Na linha do grupo (com `rowSpan`), renderizar uma célula compartilhada com o ID Smart Dent do lead (campo `lia_attendances.smart_dent_id` — se não existir, uso o `lia_attendances.id` truncado/curto como fallback consistente com o restante do admin). Confirmo o campo exato lendo o hook/consulta atual antes de escrever.
3. Ajustar `colSpan` de qualquer linha de "vazio/loading" para refletir a nova coluna.

## Fora de escopo
- Nenhuma mudança em banco, webhook ou lógica de gravação.
- ID Smart Dent é apenas leitura (compartilhado por grupo, não por unidade).
