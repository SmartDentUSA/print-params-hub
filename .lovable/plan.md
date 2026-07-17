## Objetivo
Reorganizar visualmente o "Gestão de Catálogo de Produtos" agrupando cada item na etapa (Flow) e subetapa do workflow SmartDent, com cabeçalhos visuais separadores entre grupos.

## Estrutura canônica (Flow)

```text
1. SCAN
   1.1 Scanner Intraoral
   1.2 Scanner Bancada
   1.3 Notebook
   1.4 Acessórios
2. CAD
   2.1 Software
   2.2 Serviço
3. Impressão 3D
   3.1 Resinas
   3.2 Software
   3.3 Impressora
   3.4 Acessórios
   3.5 Peças/Partes
4. Pós-Impressão
   4.1 Equipamentos
   4.2 Limpeza/Acabamento
5. Finalização
   5.1 Caracterização
   5.2 Instalação
   5.3 Dentística/Orto
6. Cursos
   6.1 Presencial
   6.2 Online
7. Fresagem
   7.1 Equipamentos
   7.2 Insumos
```

## Abordagem

Usar as colunas já existentes em `system_a_catalog`:
- `product_category` → etapa (ex.: `3. Impressão 3D`)
- `product_subcategory` → subetapa (ex.: `3.1 Resinas`)

Não altera schema. Não altera resinas nem `resins`. Só reclassifica e ajusta a renderização.

### 1. Mapeamento (migration SQL — idempotente, name-based)

Uma migration única com UPDATEs por nome exato (case-insensitive, trim), cobrindo os ~180 itens da lista. Cada linha:

```sql
UPDATE system_a_catalog
SET product_category = '3. Impressão 3D',
    product_subcategory = '3.1 Resinas'
WHERE lower(trim(name)) = lower('Resina 3D Smart Print Bio Vitality');
```

Itens não listados mantêm categoria atual (não são afetados). Resinas espelhadas de `resins` são atualizadas na tabela `system_a_catalog` apenas (mirror read-only continua intacto na origem).

### 2. UI — `src/components/AdminCatalogTable.tsx`

Adicionar agrupamento visual:
- Ordenar `products` por `product_category` → `product_subcategory` → `name`
- Inserir linhas separadoras (`<TableRow>` com `colSpan` total) quando muda a etapa e a subetapa:
  - Cabeçalho grande (bg destaque, negrito): `1. SCAN`
  - Cabeçalho médio (bg suave, itálico): `1.1 Scanner Intraoral`
- Manter todas as demais colunas e ações inalteradas.

Nenhuma mudança em `AdminCatalog.tsx`, filtros, hooks ou lógica de docs.

### 3. Ordenação numérica

O prefixo `"1."`, `"1.1"` já garante ordem alfanumérica correta.

## Detalhes técnicos

- Migration idempotente: reexecutar não corrompe (UPDATE só sobrescreve os matches).
- Se algum nome não bater (typo, acento, mirror duplicado), fica registrado como "Sem categoria" no topo — visível para reclassificação manual pelo admin.
- Nenhum GRANT necessário (tabela existente).
- Sem alteração em RLS.

## Fora do escopo
- Deduplicar mirrors de resinas com slug divergente.
- Editor de etapa/subetapa na UI (pode ser feature futura).
- Traduções `product_category_en/es` (mantém valores atuais).

## Critério de aceitação
- Ao abrir `/admin` → Gestão de Catálogo, a tabela mostra os produtos agrupados em blocos com cabeçalhos `1. SCAN`, `1.1 Scanner Intraoral`, etc.
- Cada produto listado aparece exatamente sob sua subetapa.
- Filtros existentes (categoria, status, origem) continuam funcionando.
