
# Implementacao: archive-daily-chats + Secao E Admin

## Resumo

Criar a edge function `archive-daily-chats` que arquiva conversas da L.I.A. com filtro de qualidade (judge_score >= 4, escala 0-5), classificacao por heuristica e gold nuggets. Adicionar a Secao E na aba "Cerebro Externo" do Admin.

---

## Ficheiros

### 1. CRIAR: `supabase/functions/archive-daily-chats/index.ts`

Edge function production-ready com:
- Busca `agent_interactions` das ultimas 24h com `agent_response IS NOT NULL`
- Filtra apenas `judge_score >= 4` (qualidade validada pelo Judge)
- Classifica por heuristica (8 regras baseadas em `context_sources` e palavras-chave)
- Marca respostas com `judge_score = 5` como `[GOLD]`
- Agrupa por categoria e formata em texto puro
- Chama `ingest-knowledge-text` com formato correto (`{ entries: [...] }`) e `source_label: "LIA-Dialogos"`
- Retorna resumo JSON com total, por categoria e gold nuggets

**Correcao critica vs codigo do usuario:** O `ingest-knowledge-text` espera `{ entries: [{ title, content, category, source_label }] }` e nao campos soltos. O codigo sera ajustado para usar o formato correto.

### 2. MODIFICAR: `supabase/config.toml` (linha 151)

Adicionar:
```toml
[functions.archive-daily-chats]
verify_jwt = false
```

### 3. MODIFICAR: `src/components/AdminApostilaImporter.tsx`

Alteracoes:
- **3 novos states** (linhas ~170): `archiveRunning`, `archiveResult`, `archiveLastDate`
- **2 novas funcoes** (linhas ~500): `loadArchiveStatus()` e `runArchiveNow()`
- `loadArchiveStatus` chamada dentro do `loadSavedDriveConfig` para carregar junto com a aba drive
- **Secao E** inserida apos a Secao D (linha 1414, antes do `</TabsContent>` da aba drive):
  - Borda roxa, icone Activity
  - Status da ultima execucao
  - Botao "Exportar Conversas Agora"
  - Badges com resultado por categoria + gold count
  - SQL do Cron copiavel (23:55 = 02:55 UTC)
  - Botao copiar SQL do cron (reutiliza padrao existente)

### Nenhuma alteracao em:
- `dra-lia/index.ts` ou `system-prompt.ts` (conforme solicitado)
- Schema do banco (nao precisa de migration)
- O RAG ja busca automaticamente em `company_kb` que inclui os novos `LIA-Dialogos`
