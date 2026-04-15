

# Plano: Limpeza profunda de HTML corrompido (V2)

## Diagnóstico atualizado

A primeira rodada do `fix-corrupted-links` corrigiu apenas links aninhados dentro de `href`. Mas a corrupção é sistêmica — o pipeline de IA substituiu nomes de produtos por `<a href="...">nome</a>` em **todos** os contextos:

| Padrão corrompido | Artigos afetados |
|---|---|
| `alt="<a href=...>texto</a>"` | 55 |
| `data-ai-summary="...<a href=...>...</a>..."` | 405 |
| `<h1>...<a href="loja.smartdent...">termo</a>...</h1>` | 501 |
| JSON-LD com `<a>` dentro de valores | ~500+ |
| `data-*-url="<a href=...>URL</a>"` | ~400 |

## Alterações

### 1. Reescrever `supabase/functions/fix-corrupted-links/index.ts`

Adicionar 5 novos padrões de limpeza à função `cleanCorruptedHtml`:

**Pattern 6 — `<a>` tags dentro de atributos HTML (alt, data-*, title)**
```
alt="<a href="URL">Text</a> - suffix" → alt="Text - suffix"
```
Regex: qualquer atributo que não seja `href` contendo `<a...>text</a>` → mantém apenas o texto.

**Pattern 7 — `<a>` tags dentro de JSON-LD `<script>` blocks**
```
"name":"<a href=\"...\">Impressão 3D</a>" → "name":"Impressão 3D"
```
Isola blocos `<script type="application/ld+json">`, faz strip de `<a>` tags dentro deles preservando o texto.

**Pattern 8 — `<a>` tags dentro de `<h1>` headings (links de loja indevidos)**
```
<h1>Treinamento: <a href="loja...">Impressão 3D</a> e...</h1>
→ <h1>Treinamento: Impressão 3D e...</h1>
```
Remove `<a>` tags apontando para `loja.smartdent.com.br` que estejam dentro de `<h1>`.

**Pattern 9 — `<a>` tags dentro de hidden E-E-A-T `data-*` attributes**
```
data-orcid-url="<a href="URL">URL</a>" → data-orcid-url="URL"
```

**Pattern 10 — `<a>` tags inline no corpo que substituem termos genéricos por links de loja**
```
"impressão 3D" linkado para shapecure, "odontologia digital" linkado para shapecure
```
Remove links de loja que usam texto-âncora genérico (não nome do produto). Mantém links onde o texto = nome real do produto.

### 2. Processar também `content_html_en` e `content_html_es`

A versão atual só limpa `content_html`. Adicionar processamento dos campos traduzidos.

### 3. Executar a limpeza V2

Após deploy, rodar com `dryRun: true` e depois `dryRun: false`.

## Arquivos afetados

- `supabase/functions/fix-corrupted-links/index.ts` — reescrita com patterns expandidos

## Detalhes técnicos

- A limpeza de JSON-LD usa `replace` dentro de blocos `<script>` para evitar corromper HTML externo
- Links internos legítimos (ex: `/base-conhecimento/...`) são preservados
- Links de produto nos `inline-product-card` div são preservados (apenas o card link principal)
- Safeguard mantido: se o HTML limpo ficar vazio, retorna o original

