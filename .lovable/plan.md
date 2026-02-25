

## Plano: Aba "Producao de Conteudo" no Smart Ops

### Contexto

A LIA ja registra lacunas de conhecimento na tabela `agent_knowledge_gaps` (80 registros: 42 low_confidence, 2 pending, 36 resolved). A tabela tem: `question`, `frequency`, `status`, `updated_at`, `lang`, `resolution_note`. Porem falta a visao orientada a **producao de conteudo** que o usuario descreveu, com campos como "Tema", "Rota" e um botao para gerar conteudo diretamente.

A tabela atual nao tem campo `tema` (topico agregado) nem `rota` (origem da pergunta). Precisamos enriquecer o registro ou derivar esses dados.

### Decisao de Arquitetura

Em vez de criar uma tabela nova, vamos **adicionar 2 colunas** a `agent_knowledge_gaps`:

- `tema` (text, nullable) — topico/tema extraido da pergunta (ex: "ioConnect TruAbutment", "Scanner Intraoral")
- `rota` (text, nullable) — rota/pagina de onde veio a pergunta (ja disponivel como contexto no DraLIA)

E um status adicional: o campo `status` ja aceita text livre, entao `"solicitado"` e `"publicado"` funcionam sem migracoes de enum.

### Entregas

---

#### 1. Migracao: adicionar colunas `tema` e `rota` a `agent_knowledge_gaps`

```sql
ALTER TABLE agent_knowledge_gaps
  ADD COLUMN IF NOT EXISTS tema text,
  ADD COLUMN IF NOT EXISTS rota text;
```

---

#### 2. Novo componente: `src/components/SmartOpsContentProduction.tsx`

Tabela com as colunas solicitadas:

| Data Atualiz. | Tema | Rota | Pendencia | Solicitacoes | Status | Acao |
|---|---|---|---|---|---|---|

- **Data Atualizacao**: `updated_at` formatado
- **Tema**: `tema` (se preenchido) ou extraido automaticamente das primeiras palavras da `question`
- **Rota**: `rota` (pagina de onde veio)
- **Pendencia**: `question` (texto completo da lacuna)
- **Solicitacoes**: `frequency` (badge com cor: verde <3, amarelo 3-5, vermelho >5)
- **Status**: Badge colorido — "solicitado" (amarelo), "publicado" (verde), "low_confidence" (cinza), "resolved" (azul)
- **Gerar Conteudo**: Botao que abre o `DocumentContentGeneratorModal` pre-preenchido com o titulo = tema/question, sem documento vinculado (modo "texto livre" usando `rawText` como source)

Cards de resumo no topo:
- Total de pendencias abertas (status != "resolved" e != "publicado")
- Top 3 temas mais solicitados
- Pendencias novas (ultimos 7 dias)

Filtros: por status, ordenacao por frequency ou data.

---

#### 3. Atualizar `SmartOpsTab.tsx`

- Adicionar nova aba "Conteudo" entre "Logs" e "Relatorios" (total: 8 abas)
- Importar e renderizar `SmartOpsContentProduction`
- Ajustar grid de `grid-cols-7` para `grid-cols-8`

---

#### 4. Atualizar `supabase/functions/dra-lia/index.ts`

Na funcao `upsertKnowledgeGap`, adicionar o parametro `rota` (extraido do contexto da conversa — a rota inicial do usuario que ja existe em `agent_sessions` e `lia_attendances.rota_inicial_lia`).

Opcionalmente, extrair `tema` da pergunta automaticamente (primeiras keywords significativas).

---

#### 5. Botao "Gerar Conteudo" — Integrar com modal existente

Criar um modal simplificado (ou reutilizar `DocumentContentGeneratorModal` em modo "texto livre") que:
1. Pre-preenche o titulo com o `tema` ou `question` da lacuna
2. Usa `ai-orchestrate-content` com `rawText` como source (a pendencia como contexto)
3. Ao salvar o artigo com sucesso, atualiza o `status` da lacuna para `"publicado"` e grava o `resolution_note` com o link/ID do conteudo criado

---

### Resumo de arquivos

| # | Arquivo | Acao |
|---|---------|------|
| 1 | Migracao SQL | Adicionar `tema` e `rota` a `agent_knowledge_gaps` |
| 2 | `src/components/SmartOpsContentProduction.tsx` | **Novo** — componente da aba |
| 3 | `src/components/SmartOpsTab.tsx` | Adicionar aba "Conteudo" |
| 4 | `supabase/functions/dra-lia/index.ts` | Passar `rota` ao `upsertKnowledgeGap` |

