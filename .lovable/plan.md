Plano de implementação:

1. Corrigir o scroll do preview da landing page
- Ajustar a estrutura do modal para propagar altura corretamente (`h-full`, `min-h-0`, `flex/grid`).
- Tornar o container interno da prévia realmente rolável com `overflow-y-auto`.
- Aplicar a correção nas abas de geração e edição, para a página completa poder ser vista no preview.

2. Criar 3 cards editáveis de condição
- Adicionar no conteúdo da landing um bloco próprio para 3 condições: `Condição 1`, `Condição 2`, `Condição 3`.
- Renderizar esses 3 cards na landing page como uma seção visual, seguindo o estilo do modelo enviado: card branco, faixa superior destacada e CTA/benefícios dentro do card.
- Manter os textos editáveis pelo editor lateral.

3. Atualizar o editor
- Adicionar uma seção “Condições” com campos para editar cada card individualmente.
- Cada condição terá campos como: título, preço/valor, descrição/observação, lista de itens e CTA.
- Limitar visualmente a 3 cards fixos, conforme solicitado.

4. Preservar o restante
- Não alterar lógica de publicação, formulário público ou geração por IA além do necessário para salvar/exibir esses novos campos.
- Manter a landing compatível com conteúdos já existentes, usando valores padrão quando o conteúdo antigo não tiver as condições.