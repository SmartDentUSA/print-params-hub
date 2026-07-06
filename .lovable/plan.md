## Upload de imagem no formulário "Editar Produto"

Hoje, em `AdminCatalogFormSection.tsx` (usado pelo modal "Editar Produto" do catálogo), o campo **URL da Imagem** só aceita texto colado. Vou adicionar um botão de upload ao lado do input, mantendo o campo de URL para quem quiser colar link externo.

### Onde
- **Arquivo:** `src/components/AdminCatalogFormSection.tsx`, bloco "Imagem" (linhas 186–211).
- **Bucket:** `catalog-images` (já existe e já é usado por `SmartOpsROICardsManager.tsx` e `SmartOpsSdrCaptacaoEditor.tsx` — mesmo padrão de upload).

### O que muda na UI
```
URL da Imagem
[https://...                     ] [📤 Enviar imagem]
[preview 128×128]
```
- Input de URL continua editável (permite colar link).
- Botão "Enviar imagem" abre file picker (`accept="image/*"`).
- Ao selecionar um arquivo:
  1. Valida tipo (image/*) e tamanho (máx 5 MB).
  2. Faz upload para `catalog-images/products/{slug || uuid}-{timestamp}.{ext}` com `upsert: true`.
  3. Pega `getPublicUrl` e chama `handleInputChange('image_url', publicUrl)`.
  4. Preview atualiza automaticamente (já reativo ao `formData.image_url`).
- Estado de loading no botão ("Enviando…") e toast de sucesso/erro (usando `sonner`, já disponível no projeto).

### Escopo
- Só o formulário do catálogo (o pedido foi sobre "Editar Produto"). Não altero o modal de Modelos/Marcas.
- Não crio bucket novo (`catalog-images` já existe).
- Não mexo em RLS/policies do storage (o bucket já aceita uploads pelos outros formulários admin).
- Não altero backend nem o schema.

### Fora do escopo
- Múltiplas imagens/galeria.
- Crop/redimensionamento no navegador.
- Aplicar o mesmo botão no campo "URL da Imagem" de Modelos (`AdminModal.tsx` linha 1098) — posso fazer depois se quiser.
