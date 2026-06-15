## Objetivo

A aba **Catálogo** da Base de Conhecimento (`/base-conhecimento?tab=catalogo`) só deve listar produtos que estejam marcados como **Visível na UI** no admin "Gestão de Catálogo de Produtos".

Hoje ela mostra todo produto `active=true AND approved=true` (121 itens), ignorando o toggle de visibilidade. Por isso "Direct Aligner" e "GOWhite" aparecem mesmo quando o operador os ocultou no admin.

## Diagnóstico

- Admin `src/components/AdminCatalog.tsx` controla a coluna `system_a_catalog.visible_in_ui` (toggle "Visível", batch "Ocultar/Mostrar").
- Aba Catálogo em `src/components/knowledge/KbTabCatalogo.tsx` faz `select` de `system_a_catalog` filtrando só por `active` e `approved`, sem olhar `visible_in_ui`.
- Contagem atual: 102 visíveis, 19 ocultos, 121 total.

## Mudança

Adicionar `.eq('visible_in_ui', true)` ao query da aba Catálogo no `KbTabCatalogo.tsx` (junto dos filtros `active` e `approved` já existentes).

```text
src/components/knowledge/KbTabCatalogo.tsx
  └─ supabase.from('system_a_catalog')
       .select(...)
       .eq('active', true)
       .eq('approved', true)
       .eq('visible_in_ui', true)   ← adicionar
       .not('product_category', 'is', null)
```

Nada mais muda: chips, normalização de categorias, enrich com `resins`/`products_catalog`/docs continuam iguais.

## Resultado esperado

- 19 produtos ocultos (entre eles "Resina 3D Smart Print Bio Direct Aligner" e "Resina 3D Smart Print Bio GOWhite", se desmarcados) somem da aba Catálogo.
- Para reexibir qualquer produto, basta ligar o toggle "Visível" no admin — sem deploy.
- Nenhuma mudança em RLS, schema ou dados: só leitura.

## Fora de escopo

- Normalizar categorias minúsculas (`Resinas`, `Scanners`, `Software`, etc.) — fica para outra rodada.
- Criar registros faltantes em `resins` para resinas órfãs.
