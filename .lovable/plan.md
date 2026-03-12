

# Plano: Adicionar Upload de Imagens no Formulario de Suporte

## Problema
O formulario de casos de suporte tem o campo `image_urls` no modelo de dados, mas nao possui nenhum elemento de UI para upload de imagens. O campo existe na interface `SupportCase` e no `emptyForm()` mas nunca e renderizado.

## Solucao
Adicionar uma secao de upload de imagens dentro do accordion "Dados do Caso", apos o campo de tags. Usar o bucket `model-images` (ja existente e publico) com path `support-cases/`.

## Mudancas

### `src/components/AdminSupportCases.tsx`
1. Importar `ImageIcon, Upload` do lucide-react e `useRef` 
2. Adicionar estado `uploading` e `fileInputRef`
3. Criar funcao `handleImageUpload` que faz upload para `model-images/support-cases/{timestamp}.{ext}` via Supabase Storage
4. Criar funcao `removeImage` para remover URL do array
5. Renderizar apos o campo de Tags:
   - Grid com thumbnails das imagens ja adicionadas (com botao X para remover)
   - Botao "Adicionar Imagem" que aciona o input file hidden
   - Limite de 8 imagens
   - Validacao de tipo (image/*) e tamanho (max 10MB)

A secao ficara assim no form:
```
📸 Imagens (0/8)
[thumb1 X] [thumb2 X] [+ Adicionar Imagem]
```

