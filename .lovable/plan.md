

## Plano: Adicionar `print_type` e `subcategory` nos cards de resinas

### Problema
1. O campo `print_type` existe em `resin_presentations` (ex: "Coroas sobre dente", "Facetas", "Protocolos") mas não é buscado nem exibido nos cards
2. O campo `product_subcategory` existe em `system_a_catalog` (ex: "BIOCOMPATÍVEIS", "USO GERAL") mas não aparece nos cards de resinas

### Alterações em `src/pages/SupportResources.tsx`

#### 1. Adicionar `print_type` à interface e query
- Adicionar `print_type?: string` em `PresentationInfo`
- Adicionar `subcategory?: string` em `UnifiedProduct`
- Na query de `resin_presentations`, incluir `print_type` no select

#### 2. Buscar subcategorias dos produtos RESINAS 3D
- Query adicional: `system_a_catalog` com `product_category = 'RESINAS 3D'` buscando `name, product_subcategory`
- Construir mapa `nome → subcategoria` e aplicar ao construir os items de resina no array unified

#### 3. Renderizar `print_type` em cada apresentação
Dentro do card de apresentação (linha ~448), antes do label:
```
(Tipo impressão) Coroas sobre dente
250
R$ 1850.00
2g/impressão
...
```

#### 4. Renderizar badge de subcategoria no card
Abaixo do nome do produto, exibir badge colorido:
- "BIOCOMPATÍVEIS" → badge com estilo verde
- "USO GERAL" → badge com estilo azul/cinza

### Arquivo afetado
- `src/pages/SupportResources.tsx` — único arquivo

