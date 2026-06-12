## Mudança

Substituir todas as ocorrências do link `https://loja.smartdent.com.br/pos-cura-pionext-uv-02` por `https://loja.smartdent.com.br/shapecure` em **8 publicações** da Base de Conhecimento (`knowledge_contents`).

## Execução

UPDATE em `knowledge_contents`:
- `content_html` — `REPLACE(content_html, '…/pos-cura-pionext-uv-02', '…/shapecure')`
- `excerpt` — mesmo replace

Escopo limitado às linhas que já contêm o link antigo. Nenhum outro campo, tabela ou comportamento é alterado. Vídeos e fichas de resinas não contêm o link.