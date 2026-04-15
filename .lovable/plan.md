

## Plano: Ajustar posicionamento dos botões de categoria no mobile

### Problema
No mobile, os botões de categoria (A, B, C, D, E, G, F) aparecem empilhados sem ordem lógica e com espaçamento inconsistente. O botão "Voltar" fica desalinhado.

### Alterações em `src/components/KnowledgeCategoryPills.tsx`

1. **Layout mobile em grid**: Trocar `flex flex-wrap` por um grid de 2 colunas no mobile (`grid grid-cols-2 md:flex md:flex-wrap gap-2`), para os botões ficarem alinhados em pares
2. **Botões com largura total no mobile**: Adicionar `w-full md:w-auto` nos botões para ocuparem toda a coluna do grid
3. **Botão "Voltar" centralizado no mobile**: Adicionar `self-center md:self-auto` ou `justify-center` para alinhar melhor no mobile
4. **Ordem correta**: F antes de G (a ordem já vem do banco, mas o pill F de ROI é adicionado manualmente no final — mover para antes de G se necessário)

### Arquivo afetado
- `src/components/KnowledgeCategoryPills.tsx` — único arquivo

