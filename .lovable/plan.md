
## Plano: Edicao em Lote de Videos com Geracao de Conteudo

### Objetivo
Adicionar checkboxes na lista de videos, um botao "Editar em Lote" que abre um modal para aplicar metadados em massa (Categoria, Subcategoria, Produto, Tipo de Video, Categoria de Conteudo) e gerar automaticamente titulo + resumo via IA para todos os videos selecionados.

### Fluxo do Usuario

```text
1. Selecionar videos via checkbox (ou "Selecionar todos")
      |
2. Clicar em "Editar em Lote" (aparece quando >= 1 selecionado)
      |
3. Modal abre com campos compartilhados:
   - Categoria (produto)
   - Subcategoria (produto)
   - Produto vinculado
   - Tipo de Video (content_type)
   - Categoria de Conteudo (A-E para geracao)
      |
4. Botao "Aplicar Metadados" salva os campos nos videos selecionados
      |
5. Botao "Gerar Conteudo" (ativo apos selecionar Categoria de Conteudo)
   -> Para cada video selecionado sem artigo vinculado:
      a. Gera Titulo + Resumo via IA (ai-metadata-generator)
      b. Gera HTML via IA (ai-orchestrate-content)
      c. Salva artigo em knowledge_contents
      d. Vincula video ao artigo
      e. Exibe progresso em tempo real
```

### Mudancas por Arquivo

#### 1. `src/components/AdminVideosList.tsx`
- Adicionar coluna de checkbox no inicio da tabela (header com "selecionar todos da pagina")
- Estado `selectedVideoIds: Set<string>` para controlar selecao
- Barra de acoes flutuante quando ha selecao (ex: "5 videos selecionados | Editar em Lote | Limpar")
- Importar e renderizar o novo modal `VideoBatchEditModal`

#### 2. `src/components/VideoBatchEditModal.tsx` (novo arquivo)
- Modal (Dialog) que recebe os videos selecionados como prop
- Campos do formulario:
  - **Categoria** (Select com categorias existentes do hook)
  - **Subcategoria** (Select com subcategorias existentes)
  - **Produto** (Combobox com busca, igual ao existente na tabela)
  - **Tipo de Video** (Select com VIDEO_CONTENT_TYPES)
  - **Categoria de Conteudo** (Select A-E para geracao de artigos)
- Secao "Aplicar Metadados":
  - Botao que aplica os campos preenchidos em todos os videos selecionados via `updateVideoFields`
  - Indicador de progresso (X de Y)
- Secao "Gerar Conteudo":
  - So fica ativo se Categoria de Conteudo estiver selecionada
  - Para cada video sem `content_id`:
    1. Chama `ai-metadata-generator` para gerar titulo + resumo
    2. Chama `ai-orchestrate-content` para gerar HTML
    3. Insere em `knowledge_contents`
    4. Vincula video via `content_id`
  - Barra de progresso com contadores (processados, sucesso, erros)
  - Botao de pausar/cancelar
  - Rate limit de 2s entre chamadas para evitar throttling
  - Log de resultados por video (titulo gerado, status)

#### 3. `src/hooks/useAllVideos.ts`
- Adicionar funcao `batchUpdateVideoFields` que aceita array de IDs e aplica as mesmas atualizacoes em todos:
  ```typescript
  batchUpdateVideoFields(videoIds: string[], updates: {...}) => Promise<{success: number, failed: number}>
  ```

### Detalhes Tecnicos

**Estrutura do Modal:**
- 2 secoes separadas no modal: "Metadados" e "Geracao de Conteudo"
- Os campos de metadados usam estado "parcial" - so aplica campos que foram efetivamente alterados (nao sobrescreve com vazio)
- A geracao de conteudo reutiliza a mesma logica do `VideoContentGeneratorModal` existente (linhas 87-259)

**Batch Update no Supabase:**
- Para metadados: um unico UPDATE com `.in('id', videoIds)` (mais eficiente que N queries individuais)
- Para geracao: sequencial com delay de 2s (APIs de IA nao suportam burst)

**UI da barra de selecao:**
- Fixa no topo da tabela quando ha selecao
- Mostra: "X videos selecionados" + botao "Editar em Lote" + botao "Limpar Selecao"
- Checkbox no header: seleciona/deseleciona todos da pagina atual

**Progresso da geracao:**
- Barra de progresso com porcentagem
- Lista scrollavel mostrando cada video processado com status (aguardando/processando/sucesso/erro)
- Contadores: Total, Processados, Sucesso, Erros, Ignorados (ja tem artigo)

### Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/VideoBatchEditModal.tsx` | Criar novo componente |
| `src/components/AdminVideosList.tsx` | Adicionar checkboxes, barra de selecao, integrar modal |
| `src/hooks/useAllVideos.ts` | Adicionar `batchUpdateVideoFields` |

### Resultado Esperado
- Checkboxes visiveis na primeira coluna de cada video
- Selecao rapida com "Selecionar Todos"
- Modal de edicao em lote para classificar multiplos videos de uma vez
- Geracao automatica de titulo + resumo + artigo para todos os videos selecionados sem artigo vinculado
- Progresso em tempo real com opcao de pausar
