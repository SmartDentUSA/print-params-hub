## Problema

Ao importar `https://loja.smartdent.com.br/dispositivo-blz-dental-dmc`, a edge function `get-product-data` retorna 404, apesar do produto existir no `system_a_catalog`:

| Campo         | Valor real no banco | O que a função exige |
|---------------|---------------------|----------------------|
| slug          | `blz-dental-dmc`    | `dispositivo-blz-dental-dmc` (da URL da loja) |
| category      | `Acessórios`        | `product` (filtro fixo) |
| approved      | `true`              | ok                   |

Dois bloqueios simultâneos:
1. **Filtro rígido de categoria**: todas as buscas no `system_a_catalog` (exata, external_id numérico e ILIKE) usam `.eq('category', 'product')`, então qualquer item em `Acessórios`, `Resinas`, etc. é invisível ao importador.
2. **Slug com prefixo "dispositivo-"**: a loja publica com prefixo que o catálogo local não tem. O match exato falha e o ILIKE `%dispositivo-blz-dental-dmc%` também não encontra `blz-dental-dmc`.

## Correção em `supabase/functions/get-product-data/index.ts`

1. **Remover o filtro `.eq('category', 'product')`** de todas as três consultas ao `system_a_catalog` (exata, `external_id` numérico e ILIKE de fallback). O importador do admin trata qualquer produto aprovado; hoje a restrição está silenciosamente escondendo acessórios e resinas do catálogo.

2. **Fallback tolerante por sufixo do slug**: se o match exato e o ILIKE `%slug%` falharem, tentar remover prefixos comuns da loja (`dispositivo-`, `kit-`, `combo-`) e refazer:
   - `.eq('slug', stripped)` 
   - `.ilike('slug', '%' || stripped || '%')`
   
   Isso resolve o caso atual (`dispositivo-blz-dental-dmc` → `blz-dental-dmc`) sem cair no anti-padrão de match por token de nome, que já foi vetado no código atual.

3. **Manter `approved=true`** como filtro quando enviado — não mexer nessa parte.

4. **Logs**: adicionar log da tentativa com slug reduzido para facilitar debug futuro.

Nenhuma outra função, tabela ou componente frontend precisa mudar. O `PublicAPIProductImporter` continua chamando `get-product-data?slug=...&approved=true` normalmente.

## Validação após aplicar

- Chamar `get-product-data?slug=dispositivo-blz-dental-dmc&approved=true` e confirmar retorno 200 com `data.slug === 'blz-dental-dmc'`.
- Rechamar com um slug conhecido de produto (`resina-smart-print-bio-vitality` ou similar) e garantir que o comportamento anterior não regrediu.
- Testar `scanner-intraoral-blz-ino200` (category `product`) para confirmar que remover o filtro não trouxe efeitos colaterais.
