## Problema

Card de resina virou uma "torre de botões": 12+ documentos empilhados verticalmente, apresentações repetindo "250 — R$ 1.850,00", FDA Vitality solto no meio. Hierarquia perdida, card 3x mais alto que os outros.

## Solução — `src/components/knowledge/KbTabCatalogo.tsx`

### Reagrupar ações em 3 níveis de hierarquia

**Linha 1 — Ações primárias (chips compactos, flexWrap):**
- 🛒 Loja (cheio, azul)
- 📄 FDS
- 📘 IFU
- 📑 Documentos (N) ← novo, colapsa TODOS os outros docs

**Linha 2 — Parametrização** (full-width, mantém)

**Linha 3 — Pré/Pós-Processamento** (full-width, mantém)

### Novo dialog `KbResinDocsDialog`
Abre ao clicar em "📑 Documentos (N)". Lista todos os `resin_documents` + `catalog_documents` extras (sem FDS/IFU já visíveis), agrupados por seções:
- **Certificados & Registros** (FDA, ANVISA, ISO, CE)
- **Laudos & Estudos Clínicos** (Avaliação…, Estudo…)
- **Apresentações & Materiais Comerciais**
- **Guias & Outros**

Cada item: ícone + nome completo (sem truncar) + botão "Abrir PDF".

### Apresentações (SKUs)
- Deduplicar por `label+price` (corrige o "250" repetido 3x).
- Se label é puramente numérico, sufixar `g` (ex.: `250g — R$ 1.850,00`).
- Render como chips outline pequenos, máx 3 inline, "+N" se exceder.
- Bloco só aparece se houver ≥1 SKU único.

### Polimento visual
- Reduzir `gap` entre botões: 6 → 4px.
- Padding dos chips de ação: `4px 10px`, `fontSize: 11`.
- Apresentações: borda 1px `#E0E3E7`, fundo transparente, não fundo cinza cheio.
- Garantir que cards permaneçam com altura aproximadamente uniforme na grade.

### Sem mudanças
- Queries, schema, matching resin↔catalog, parametrização: idênticos.
- Cards de produtos não-resina: não tocam.
- Conteúdo do dialog de Pré/Pós-Processamento: mantém.

## Detalhes técnicos

- Novo arquivo: `src/components/knowledge/KbResinDocsDialog.tsx` — recebe `{ open, onClose, resinName, docs: ResinDoc[] }`, agrupa por `kind`, renderiza com `Dialog`/`DialogContent` (shadcn) — padrão já usado em `KbResinSheetDialog`.
- Função helper `groupDocs(docs)` que mapeia `kind` → seção.
- `KbTabCatalogo` passa a calcular `allExtraDocs = [...extraResinDocs, ...otherDocs]` e abre o dialog via state `docsResin`.
- Dedup de apresentações: `Array.from(new Map(rPres.map(p => [\`${p.label}|${p.price}\`, p])).values())`.
