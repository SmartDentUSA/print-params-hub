## Objetivo

Remover a etapa 2 (grade de checkboxes "Selecionar categorias e produtos") do gerador de propostas. O fluxo passa a ser **Distribuidor → Preview & Export**, e a inclusão/exclusão de itens acontece diretamente no preview.

## Escopo (apenas frontend)

Arquivo: `src/components/smartops/distributors/DealerProposalWizard.tsx`

### Mudanças

1. **Steps reduzidos para 2**
   - Tipo `step: 1 | 2` (era `1 | 2 | 3`).
   - Barra do topo mostra apenas: `1. Distribuidor` → `2. Preview & Export`.
   - Botão "Próximo" do passo 1 vai direto para o passo 2 (o gate `disabled` continua exigindo distribuidor + tabela vigente com itens).

2. **Remover completamente o bloco do antigo Step 2**
   - Deletar o `Card` com título "Selecionar categorias e produtos", o resumo "X produtos selecionados", os botões "Selecionar todos"/"Limpar" e a lista agrupada por categoria com checkboxes.
   - Remover estados que só serviam a esse passo: `selectedIds`, `selectedCats`, e as funções `toggleCategory` / `toggleItem`.
   - Remover a memo `proposalItems` (derivada de `selectedIds`).

3. **Preview passa a carregar todos os itens da tabela vigente**
   - `previewItems` inicializa com **todos** os `items` da tabela do distribuidor quando o passo 2 é aberto (ou quando o distribuidor muda).
   - Fica preservada a possibilidade de edição inline (preço, desconto, preço dealer, código, nome, variante, GTIN, NCM) já existente.

4. **Remoção de itens inline no preview**
   - Nova coluna à esquerda da tabela do preview com um botão "Remover" (ícone `Trash2` do `lucide-react`, `variant="ghost"`, `size="icon"`) que faz `setPreviewItems(prev => prev.filter(p => p.id !== it.id))`.
   - Cabeçalho da tabela ganha `<th />` correspondente.
   - Acima da tabela, um pequeno resumo: `Badge` com contagem "N itens na proposta" + botão "Restaurar todos" que reidrata `previewItems` a partir de `items` (útil quando o usuário remove demais e quer voltar).
   - `saveProposal` continua exigindo `previewItems.length > 0`; se o usuário zerar a lista, o botão "Salvar proposta" fica desabilitado (novo `disabled`).

5. **Ajuste de navegação**
   - Botão "Voltar" no passo 2 volta para `setStep(1)` (era `setStep(2)`).
   - Ao trocar de distribuidor no passo 1, resetar `previewItems` para vazio (será repopulado quando o passo 2 abrir com os novos `items`).

### Fora de escopo

- Nenhuma alteração em edge functions, banco, `dealer_price_items`, catálogo, exportadores (`DealerProposalExport`) ou tipos em `types.ts`.
- Nenhuma alteração visual no cabeçalho, totais ou export XLSX/PDF/DOCX — recebem `previewItems` como já recebem hoje.
- A tela `Tabela de Preço` do distribuidor (onde os itens são cadastrados por categoria) permanece intacta — o gerenciamento granular de quais SKUs pertencem à tabela do distribuidor continua acontecendo lá.

## Validação

- Passo 1 → Preview abre com todos os itens da tabela vigente já listados.
- Remover uma linha some do preview e dos totais imediatamente.
- "Restaurar todos" recompõe a lista sem recarregar a página.
- Salvar/Exportar (XLSX, PDF, DOCX) usam somente os itens que restaram no preview.
- Histórico de propostas (passo 1) continua funcionando.
