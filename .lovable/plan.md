## Diagnóstico

- Os dois links curtos existem no banco para **Ativação DentalCAD Ultimate Lab Bundle - RMS**:
  - `hxssbk` para landing page
  - `fwr5e6` para formulário
- A implementação anterior foi feita em `ProductPage`, ou seja, na página individual `/produtos/:slug`.
- O print atual é do catálogo em `/base-conhecimento?tab=catalogo`, renderizado por `KbTabCatalogo`, onde esses links ainda não são buscados nem exibidos.

## Plano de correção

1. **Buscar os short links no catálogo público**
   - Em `KbTabCatalogo`, carregar `smartops_forms` vinculados aos produtos exibidos por `product_catalog_id`.
   - Buscar `smartops_short_links` pelos `form_slug` encontrados.
   - Montar um mapa por `product_id` com:
     - `landingUrl`: `https://s.smartdent.com.br/{short_code}` quando `default_target = 'landing_page'`
     - `formUrl`: `https://s.smartdent.com.br/{short_code}` quando `default_target = 'form'`

2. **Renderizar os botões no card público**
   - No card do catálogo, exibir:
     - **Saiba mais** somente se existir short link de landing page
     - **Entre em contato** somente se existir short link de formulário
   - Manter o comportamento pedido: se não houver links curtos, não mostrar nada.

3. **Preservar o que já existe**
   - Não alterar regras de banco/RLS.
   - Não mudar os botões atuais de Loja/FDS/IFU/documentos.
   - Não mexer no card da página individual, que já foi implementado.

4. **Validar**
   - Conferir no preview `/base-conhecimento?tab=catalogo` se o produto passa a mostrar os dois botões no card.
   - Verificar que produtos sem short links continuam sem esses CTAs.