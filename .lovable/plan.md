

## Diagnóstico: Documento do Kit Atos Academic

### O que encontrei

O documento **existe** corretamente no banco de dados:
- **Tabela `catalog_documents`**: registro ativo com `document_name = "IFU Atos Academic"`, vinculado ao produto `Kit Resina Atos Academic - 06 cores` (ID: `88dd8797...`)
- **Storage**: arquivo PDF real existe no bucket `catalog-documents`
- **URL válida**: `https://okeogjgqijbfkudfjadz.supabase.co/storage/v1/object/public/catalog-documents/resina-atos-academic-6-cores-aprendizado-otimizado-1776194750363.pdf`
- **Produto**: ativo, aprovado, `visible_in_ui = true`, categoria "DENTÍSTICA, ESTÉTICA E ORTODONTIA"

### Por que pode não estar aparecendo

O produto "Kit Resina Atos Academic" aparece na categoria **"DENTÍSTICA, ESTÉTICA E ORTODONTIA"**, não em "RESINAS 3D" (que é a categoria padrão selecionada ao abrir a página). Se você estava olhando em "RESINAS 3D", o produto não aparece ali.

Além disso, a página carrega os dados apenas uma vez ao montar. Se o documento foi adicionado enquanto a página já estava aberta, é necessário **recarregar a página** (F5) para os novos dados aparecerem.

### Verificação rápida
1. Recarregue a página `/support-resources` (F5)
2. Clique na categoria **"DENTÍSTICA, ESTÉTICA E ORTODONTIA"** na barra lateral
3. Procure o card "Kit Resina Atos Academic - 06 cores"
4. O botão **IFU** e o accordion "Documentos (1)" devem aparecer

### Se ainda não aparecer — Plano de correção

Nenhuma alteração de código necessária se os passos acima resolverem. Caso contrário, posso investigar em tempo real usando as ferramentas do browser para ver exatamente o que está sendo renderizado.

