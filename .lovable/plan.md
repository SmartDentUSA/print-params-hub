

# Plano: Auto-Detect com Mapeamento Manual e Criacao de Campos

## Alteracoes

### 1. `src/utils/leadParsers.ts`

**Exportar funcoes e constantes existentes:**
- `findColumn` (linha 566) — tornar exportavel
- `cleanEmail`, `cleanPhone`, `cleanMoney`, `cleanStr` (linhas 10-40) — tornar exportaveis

**Adicionar nova constante `LIA_SYSTEM_FIELDS`** — array de `{ value: string, label: string }` com todos os 170+ campos da tabela `lia_attendances` extraidos do schema, ordenados alfabeticamente. Exemplo:
```typescript
export const LIA_SYSTEM_FIELDS: { value: string; label: string }[] = [
  { value: "area_atuacao", label: "Área de Atuação" },
  { value: "astron_email", label: "Astron Email" },
  // ... todos os ~170 campos
];
```

**Adicionar `AUTO_DETECT_PATTERNS`** — mapa exportado `Record<string, RegExp[]>` extraido da logica existente do `parseAutoDetect` (linhas 578-598):
```typescript
export const AUTO_DETECT_PATTERNS: Record<string, RegExp[]> = {
  nome: [/^nome$/i, /^name$/i, /nome\s*completo/i, ...],
  email: [/^e-?mail$/i, /e-?mail.*pessoa/i, ...],
  telefone_raw: [/^telefone$/i, /^phone$/i, /^whatsapp$/i, ...],
  // ... demais campos
};
```

**Adicionar funcao `applyMappings`** exportada:
```typescript
export function applyMappings(
  rawRows: RawRow[],
  mappings: { csvColumn: string; systemField: string; newFieldName?: string; enabled: boolean }[]
): NormalizedLead[]
```
- Itera cada row, para cada mapping ativo aplica limpeza conforme tipo do campo (email→cleanEmail, telefone→cleanPhone, valor→cleanMoney, resto→cleanStr)
- Se `systemField === "__new__"` usa `newFieldName` como key
- Ignora mappings com `enabled === false` ou `systemField === "__ignore__"`

### 2. `src/components/SmartOpsLeadImporter.tsx`

**Novos estados** (so ativos quando `parserType === "auto_detect"`):
- `rawRows: Record<string, unknown>[]` — linhas brutas
- `csvColumns: string[]` — headers do ficheiro
- `fieldMappings: FieldMapping[]` com interface:
```typescript
interface FieldMapping {
  csvColumn: string;
  systemField: string;      // campo lia ou "__ignore__" ou "__new__"
  newFieldName: string;      // preenchido quando __new__
  enabled: boolean;
  samples: string[];         // 3 primeiros valores nao-nulos
}
```

**Fluxo alterado para auto_detect:**
1. Upload → parse XLSX → guardar `rawRows` e `csvColumns`
2. Para cada coluna CSV, correr auto-detect via `AUTO_DETECT_PATTERNS` + `findColumn` para sugerir `systemField`
3. Coletar 3 amostras nao-nulas de cada coluna
4. Mostrar **Step 3: Mapeamento de Campos** — tabela com:
   - Col 1: **Checkbox** ativar/desativar (email sempre disabled + checked + badge "chave")
   - Col 2: **Nome da coluna CSV** + 3 amostras em cinza
   - Col 3: **Select dropdown** com opcoes: `-- ignorar --`, todos `LIA_SYSTEM_FIELDS` (170+), `+ Criar novo campo`
   - Col 4: Se `__new__` selecionado → **Input de texto** para digitar o nome do novo campo
5. Botao "Confirmar e Enviar" chama `applyMappings(rawRows, fieldMappings)` e envia via `import-leads-csv`

**Para parsers que NAO sao auto_detect:** Comportamento actual mantido sem alteracoes.

### Sem migracoes de banco de dados

O gateway `import-leads-csv` ja faz upsert dinamico. Campos novos criados pelo usuario vao para `raw_payload` JSONB se nao existirem como colunas reais.

