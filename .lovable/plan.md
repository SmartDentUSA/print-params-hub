

# Corrigir Cards Duplicados na Categoria RESINAS 3D

## Problema
A categoria "RESINAS 3D" mostra 41 cards quando deveria mostrar ~14 produtos unicos. Dois problemas:

1. A tabela `system_a_catalog` tem cada resina duplicada (2 registros por produto com o mesmo nome). Resultado: 28 cards do catalogo em vez de 14.
2. A deduplicacao entre `system_a_catalog` e `resins` compara nomes exatos (case-insensitive), mas os nomes sao diferentes entre as tabelas. Exemplo:
   - Catalogo: "Resina 3D Smart Print Bio Bite Splint +Flex"
   - Resinas: "Smart Print Bio Bite Splint +Flex"

## Solucao

### Arquivo: `src/components/ProductsFlow.tsx`

**1. Deduplicar resultados do catalogo por nome**

Apos buscar os dados do `system_a_catalog`, usar um `Map` para manter apenas um registro por nome (case-insensitive), eliminando os duplicados internos:

```typescript
if (catalogData) {
  const seen = new Map<string, boolean>();
  catalogData.forEach(p => {
    const key = p.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, true);
      items.push({ id: p.id, name: p.name, ... });
    }
  });
}
```

**2. Melhorar deduplicacao entre catalogo e resinas**

Ao verificar se uma resina ja existe nos items do catalogo, usar comparacao parcial (normalizada) em vez de igualdade exata. Normalizar removendo prefixos comuns como "Resina 3D", "Resina Smart", "Smart Print" e comparando o nucleo do nome:

```typescript
function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^resina\s*(3d\s*)?/i, '')
    .replace(/^smart\s*(3d\s*)?print\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

Ao adicionar resinas, verificar se o nome normalizado ja existe:
```typescript
const normalizedExisting = items.map(i => normalizeProductName(i.name));
if (!normalizedExisting.includes(normalizeProductName(r.name))) {
  items.push(...);
}
```

**3. Corrigir contagem na tela de categorias**

A contagem da categoria "RESINAS 3D" tambem esta inflada porque soma os 28 duplicados do catalogo + 14 resinas. Aplicar a mesma logica de deduplicacao no calculo da contagem (ou simplesmente contar nomes unicos).

## Resultado Esperado
- RESINAS 3D mostrara ~14 cards unicos (sem duplicatas)
- A contagem na tela de categorias refletira o numero correto
- Produtos de outras categorias tambem serao deduplicados por seguranca
