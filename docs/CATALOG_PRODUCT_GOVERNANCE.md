# Governança — Gestão de Catálogo de Produtos

## Regra canônica

`public.system_a_catalog` é um repositório universal sincronizado do Sistema A. A tabela não contém apenas produtos.

A Gestão de Catálogo e a aba **Base de Conhecimento → Catálogo** devem usar uma allowlist, nunca carregar a tabela inteira.

### Tipos comerciais permitidos

- `product`
- `resin`
- `Resinas`
- `consumables`
- `Serviços`

### Entidades proibidas no catálogo de produtos

- `video_testimonial`: clientes e depoimentos.
- `category_config`: definições de categorias e filtros.
- `company_info`: dados institucionais da empresa.
- Qualquer tipo futuro não incluído explicitamente na allowlist comercial.

## Motivo

Os registros exibidos como “Sem classificação” não eram produtos sem categoria. Eram clientes, configurações de categoria e dados institucionais presentes na mesma tabela universal.

Filtrar apenas por `product_category` ou remover o filtro de `category` mistura entidades diferentes e recria o problema. Resinas e consumíveis devem ser recuperados adicionando seus tipos comerciais à allowlist, sem liberar toda a tabela.

## Pontos protegidos

- Gestão de Catálogo de Produtos (`useCatalogCRUD`).
- Cards da Base de Conhecimento → Catálogo (`KbTabCatalogo`).
- Links automáticos de produtos em conteúdos (`useCatalogProducts`).

Ao introduzir um novo tipo comercial, atualizar a constante compartilhada `PRODUCT_CATALOG_ENTITY_TYPES` em `src/lib/catalogEntityTypes.ts`. Não criar filtros divergentes por tela.