## Importar dados em lote no Catálogo de Produtos (Distribuição)

Criar um botão **"Importar dados em lote"** no topo do `DealerCatalogGrid` (aba 📦 Catálogo de Produtos) que abre um modal para colar o texto tabular enviado (COD, Nome, Variação, NCM/HS, GTIN/EAN, Peso, Dimensões) e faz upsert direto em `catalog_product_variations`, casando cada linha pelo COD → `system_a_catalog.external_id`.

### 1. Parser (novo arquivo `src/components/smartops/distributors/parseCatalogPaste.ts`)

Recebe o blob concatenado do usuário e retorna `ParsedRow[]`:

```text
{ cod, name, variation, ncm, gtin (nullable se "Sob consulta"/"Ref"),
  weight_kg (number|null), dimensions_cm (string|null), unit }
```

Regra de quebra: cada linha começa com 3–5 dígitos seguidos de letra (`^(\d{2,5})(?=[A-Za-zÁ-ÿ])`), então uma regex global fatia o texto colado em blocos. Dentro do bloco:

- **COD** = dígitos iniciais.
- **Peso** = primeira ocorrência de `(\d+[,\.]\d+)\s*kg`, valor com `,` → `.`.
- **Dimensões** = trecho `\d+\.\d+\s*[×x]\s*\d+\.\d+\s*[×x]\s*\d+\.\d+\s*cm`.
- **NCM/HS** = padrão `\d{4}\.\d{2}\.\d{2}` ou `\d{4}\.\d{2}` (após a variação).
- **GTIN** = 12–14 dígitos após o NCM; textos `Sob consulta` ou `0756014741131 (Ref)` viram `null` (o "(Ref)" indica valor de referência não confirmado → tratamos como null e logamos).
- **Variação** = string entre o nome e o NCM: `250g`, `500g`, `1000g (1kg)`, `Seringa`, `Kit (5 un)`, `Kit (10 un)`, `1 un`, `2,5g`, `0,5g (Seringa)`. Derivar `unidade` daí (`g`, `kg`, `UN`, etc.).
- **Nome** = tudo entre o COD e a variação. Detecção da variação pela primeira ocorrência das keywords acima.

O parser expõe também um dry-run (`preview`) sem tocar no banco.

### 2. Modal `CatalogBulkImportDialog.tsx` (novo)

- Textarea para colar (pré-preenchida vazia).
- Botão **Analisar** → mostra tabela com todas as linhas parseadas e um badge de status por linha:
  - ✅ Match encontrado (mostra id do produto e se a variação já existe/será atualizada ou criada).
  - ⚠️ COD sem correspondência em `system_a_catalog.external_id` (linha será ignorada).
  - ⚠️ GTIN inválido (marcado, mas não bloqueia).
- Contadores no rodapé: `X para criar / Y para atualizar / Z ignoradas`.
- Botão **Aplicar**: executa em lote.

### 3. Execução (`applyBulkImport`)

Para cada linha com match:
1. Busca variação existente por `(catalog_product_id, presentation_qty)` (case-insensitive, trim).
2. Se existir → `update` apenas dos campos preenchidos: `ncm_hs`, `gtin_ean`, `weight_kg`, `dimensions_cm`, `unidade`. Nunca mexe em preços.
3. Se não existir → `insert` com `source = 'bulk_import'`, `sort_order` = próximo disponível, `presentation` inferida (`Item`, `Seringa`, `Kit`, `Godê` conforme a variação).
4. **Sempre** atualiza `system_a_catalog.external_id`, `system_a_catalog.ncm` (se null) e `system_a_catalog.gtin` (se null) na tabela mestre, para manter o COD/NCM/GTIN alinhados. Nunca sobrescreve dados já preenchidos.

No fim: `toast.success` com contadores e `loadAll()`.

### 4. Integração UI

Em `DealerCatalogGrid.tsx`, adicionar botão **Importar dados em lote** na barra de topo (perto de "Sincronizar do Sistema A") que abre o modal. Novos strings i18n em `I18N.pt/es/en` (`bulkImport`, `bulkImportTitle`, `analyze`, `apply`, etc.).

### 5. Segurança / escopo

- Só grava em `catalog_product_variations` (já com policies existentes) e faz `UPDATE` seletivo em `system_a_catalog`. Nenhuma migração de schema, nenhuma criação de tabela.
- Não altera preços (BRL/USD/EUR), imagens, categorias, nem status ativo.
- Idempotente: rodar de novo com o mesmo blob → 0 novas variações, N updates no-op.

### Fora do escopo

- Não cria produtos mestres novos em `system_a_catalog` (se o COD não existir, a linha é ignorada e listada como aviso; usuário cria o card na Base de Conhecimento primeiro).
- Não mexe em preços, tabelas de dealer, propostas.
- Não gera migration nova.
