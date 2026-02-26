

## Plano: Adicionar categoria "Base de dados estratégicos" ao Alimentador de Cérebro

### O que será feito

Adicionar a nova categoria **"Base de dados estratégicos"** na lista `CATEGORIES` do componente `AdminApostilaImporter.tsx`, posicionada logo abaixo de "Geral". Essa categoria será usada para os arquivos CSV grandes (faturamento, CRM, ERP, e-commerce) que serão enviados via Google Drive.

### Alteração

**Arquivo:** `src/components/AdminApostilaImporter.tsx`

- Inserir `{ value: "dados_estrategicos", label: "Dados Estratégicos" }` após a linha do "Geral" na constante `CATEGORIES` (linha 79→80).

Nenhuma alteração necessária no Edge Function `sync-google-drive-kb` — ele já aceita qualquer categoria dinamicamente via `folder_map`.

### Resultado

Na aba **Cérebro Externo**, aparecerá um novo campo "Dados Estratégicos" para colar o link da pasta do Google Drive onde ficarão os CSVs de faturamento, leads do CRM, vendas ERP e e-commerce.

