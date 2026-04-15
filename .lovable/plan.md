

## Plano: Adicionar botão "Parametrização" nos cards de resinas

### O que será feito
Adicionar um botão "Parametrização" abaixo da linha de botões (Loja, FDS, IFU), visível apenas para produtos do tipo resina que possuem slug.

### Alterações em `src/pages/SupportResources.tsx`

1. **Interface `UnifiedProduct`**: adicionar campo `slug?: string | null`
2. **Mapeamento de dados**: popular `slug: r.slug` ao construir os itens de resina (linha ~182)
3. **UI**: após o `<div className="flex flex-wrap gap-1.5 mb-2">` dos 3 botões (linha ~371), adicionar:

```tsx
{product.source === "resin" && product.slug && (
  <Button size="sm" variant="tech" className="text-xs h-7 px-2 w-full" asChild>
    <a href={`/resinas/${product.slug}`}>
      <BookOpen className="w-3 h-3 mr-1" />
      Parametrização
    </a>
  </Button>
)}
```

O botão usará a variante `tech` para diferenciá-lo visualmente, ocupando largura total abaixo dos 3 botões, e linkará para `/resinas/:slug` que já faz o redirect automático para a página de parâmetros correta.

### Arquivo afetado
- `src/pages/SupportResources.tsx` — único arquivo

