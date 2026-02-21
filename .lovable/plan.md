

# Remover logo das marcas no fluxo de parametros

## Problema
O card da marca Anycubic esta exibindo uma imagem (logo) ao lado do nome, enquanto as outras marcas mostram apenas texto. Isso causa inconsistencia visual.

## Solucao
Remover a renderizacao condicional do `brand.logo_url` no componente `PrinterParamsFlow.tsx`, para que todos os botoes de marca exibam apenas o nome em texto.

## Detalhe Tecnico

No arquivo `src/components/PrinterParamsFlow.tsx`, remover as linhas 165-167:

```
{brand.logo_url && (
  <img src={brand.logo_url} alt={brand.name} className="w-6 h-6 object-contain rounded" />
)}
```

O botao ficara apenas com `{brand.name}`, igual para todas as marcas.

