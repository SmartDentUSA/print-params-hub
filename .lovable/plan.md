

## Adicionar "Desfazer" para restaurar formatacao anterior de artigos

### Problema atual

Quando voce edita um artigo (especialmente no modo Visual), a formatacao HTML rica e perdida permanentemente. Nao existe nenhum mecanismo para voltar ao conteudo anterior.

### Solucao

Salvar automaticamente uma copia do HTML original quando o artigo e aberto para edicao, e adicionar um botao "Restaurar HTML Original" que permite voltar a versao que existia antes de editar.

### Como vai funcionar

1. Quando voce abre um artigo para editar, o sistema guarda uma copia do `content_html` original em memoria
2. Um botao "Restaurar Original" fica disponivel ao lado do botao Salvar
3. Ao clicar, o conteudo volta exatamente ao HTML que estava salvo antes de qualquer alteracao
4. Funciona para PT, ES e EN independentemente

### Protecao extra: aviso ao trocar para modo Visual

Quando o artigo contem HTML rico (tabelas, classes CSS, veredict-box, etc.), ao clicar em "Visual" aparece um alerta:

> "Este artigo contem formatacao HTML rica que sera PERDIDA no modo visual. Deseja continuar?"

Isso evita perda acidental de formatacao.

### Detalhes tecnicos

**Arquivo:** `src/components/AdminKnowledge.tsx`

1. Adicionar estados para guardar o HTML original:
   - `originalContentPT`, `originalContentES`, `originalContentEN` (string | null)

2. No `handleOpenEdit`, salvar os valores originais:
   - `setOriginalContentPT(content.content_html)`
   - `setOriginalContentES(content.content_html_es)`
   - `setOriginalContentEN(content.content_html_en)`

3. Adicionar funcao `hasRichHTML(html)` que detecta tabelas, classes CSS, veredict-box, etc.

4. No botao "Visual", adicionar `window.confirm()` quando `hasRichHTML` retorna true

5. Adicionar botao "Restaurar Original" ao lado do botao Salvar, que:
   - So aparece quando `originalContentPT` existe e o conteudo foi modificado
   - Ao clicar, restaura `formData.content_html` para o valor original
   - Pede confirmacao antes de restaurar

**Arquivos alterados:** apenas `src/components/AdminKnowledge.tsx`

### Limitacoes

- A restauracao funciona apenas durante a sessao de edicao atual (enquanto o modal esta aberto)
- Se voce salvar e fechar, o conteudo anterior e perdido (nao e um historico de versoes completo)
- Para um historico completo seria necessario criar uma tabela de versoes no banco de dados (pode ser feito futuramente)

