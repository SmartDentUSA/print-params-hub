

# Fix: Importacao via JSON em Lote - Selecao de arquivo nao funciona na segunda vez

## Problema

Quando o usuario seleciona um arquivo `.json` e depois tenta selecionar o mesmo arquivo novamente (ou outro), o `onChange` do input nao dispara porque o navegador nao detecta mudanca no valor. Alem disso, o clique no input hidden pode borbulhar de volta para o div pai, causando um loop.

## Solucao

Duas correcoes no arquivo `src/components/AdminApostilaImporter.tsx`:

### 1. Resetar o valor do input apos processar o arquivo (linha 358-374)

Adicionar `e.target.value = ""` no final do `handleBatchFile` para garantir que o mesmo arquivo possa ser selecionado novamente.

### 2. Prevenir propagacao de clique no input (linha 1039)

Adicionar `onClick={(e) => e.stopPropagation()}` no elemento `<input>` para evitar que o clique no file picker borbulhe de volta para o div pai e abra o dialogo duas vezes.

## Detalhe tecnico

```
// handleBatchFile - adicionar reset no final:
const handleBatchFile = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  // ... logica existente ...
  reader.readAsText(file);
  e.target.value = "";  // <-- permite re-selecionar o mesmo arquivo
};

// Input - adicionar stopPropagation:
<input
  ref={jsonFileInputRef}
  type="file"
  accept=".json"
  className="hidden"
  onChange={handleBatchFile}
  onClick={(e) => e.stopPropagation()}  // <-- evita loop de clique
/>
```

