

## Diagnóstico da Autenticação - Loja Integrada API

### Confirmado pela documentação oficial

A API exige **duas chaves** obrigatórias em toda requisição:

| Chave | Nome oficial | O que é |
|-------|-------------|---------|
| `chave_api` | API Key da loja | Identifica a **loja** sendo integrada |
| `aplicacao` (header) / `chave_aplicacao` (querystring) | Chave de aplicação | Identifica o **integrador** |

### Formato correto de autenticação

**Via header:**
```
Authorization: chave_api {LOJA_INTEGRADA_API_KEY} aplicacao {LOJA_INTEGRADA_APP_KEY}
```

**Via querystring:**
```
?chave_api={API_KEY}&chave_aplicacao={APP_KEY}
```

### Bugs encontrados em `import-loja-integrada/index.ts`

| Linha | Atual (errado) | Correto |
|-------|----------------|---------|
| 170 | `app_key ${appKey}` | `aplicacao ${appKey}` |
| 181 | `app_key=${appKey}` | `chave_aplicacao=${appKey}` |

### Campos de retorno do GET `/produto/{id}/`

```text
id, sku, mpn, ncm, gtin, nome, apelido (slug)
descricao_completa (HTML)
ativo, destaque, bloqueado, removido, usado
peso, altura, largura, profundidade
tipo (normal | atributo | atributo_opcao)
categorias[] (URIs), marca (URI)
imagens[] (com url), imagem_principal
url, url_video_youtube, resource_uri, seo (URI)
data_criacao, data_modificacao
```

Preço **não** vem no GET produto. Precisa de endpoint separado: `GET /produto_preco/{id}/`.

### Plano de correção

1. **`import-loja-integrada/index.ts`** — Corrigir as duas estratégias de autenticação:
   - Header: `app_key` → `aplicacao`
   - Querystring: `app_key` → `chave_aplicacao`
   - Remover estratégia `basic-auth` (não documentada)

2. **Sobre a App Key** — Você tem apenas a API Key. A documentação confirma que **as duas chaves são obrigatórias**. Você precisa gerar a chave de aplicação seguindo: https://ajuda.lojaintegrada.com.br/pt-BR/articles/5360466-como-o-integrador-gera-a-chave-de-aplicacao

3. **Deploy**: `import-loja-integrada`

### Importante

Mesmo corrigindo o formato, a autenticação continuará falhando (401) até que a `LOJA_INTEGRADA_APP_KEY` seja configurada com uma chave de aplicação válida. As duas chaves são obrigatórias.

