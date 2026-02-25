

## Plano: Reformular Sistema de Pendencias — Extrair de Resumos, Nao de Mensagens Brutas

### Diagnostico

O problema e claro: as duas fontes de dados que alimentam tanto o "Top 10 Perguntas Sem Resposta" (AdminDraLIAStats) quanto a aba "Producao de Conteudo" (SmartOpsContentProduction) leem da mesma tabela `agent_knowledge_gaps`, que e alimentada pela funcao `upsertKnowledgeGap`. Essa funcao registra **toda mensagem** com `topSimilarity < 0.35` ou sem resultado RAG — incluindo respostas SPIN ("100% analogico", "Implantodontista"), dados pessoais (emails, telefones), e ruido conversacional ("ja respondi isso").

A fonte correta ja existe: o campo `resumo_historico_ia` em `lia_attendances` gera resumos estruturados com `PENDENCIAS:` reais. Exemplos encontrados no banco:

- `PENDENCIAS: Obter mais informacoes sobre equipamentos, sistemas e GlazeON.`
- `PENDENCIAS: Detalhes do combo, inclusao de resina.`

Esses sao os pedidos reais de conteudo. E de la que a aba deve se alimentar.

---

### Arquitetura Nova — 4 Entregas

#### 1. Nova tabela `content_requests`

```sql
CREATE TABLE content_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tema text NOT NULL,
  pendencia_original text NOT NULL,
  tipo_conteudo text DEFAULT 'artigo',
  prioridade integer DEFAULT 1,
  frequency integer DEFAULT 1,
  status text DEFAULT 'solicitado',
  source_sessions text[] DEFAULT '{}',
  source_leads text[] DEFAULT '{}',
  produto_relacionado text,
  resolution_note text,
  published_content_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON content_requests FOR ALL USING (is_admin(auth.uid()));
```

#### 2. Modificar `summarize_session` em `dra-lia/index.ts`

Apos gerar o resumo (linha 2365), adicionar logica:

1. Parsear `PENDENCIAS:` do texto via regex
2. Se houver pendencias, chamar a IA com prompt curto para classificar:
   ```
   Classifique esta pendencia de usuario de odontologia digital.
   Pendencia: "Obter mais informacoes sobre GlazeON"
   Assuntos: "GlazeON - Splint, resinas"
   
   JSON: { "tema": "...", "tipo_conteudo": "artigo|comparativo|tutorial|faq|ficha_tecnica", "prioridade": 1-5, "produto_relacionado": "..." }
   ```
3. Upsert em `content_requests`: se ja existe tema similar (match por texto normalizado), incrementar `frequency` e adicionar session/email aos arrays; senao, criar novo registro

Tambem: **remover** as duas chamadas a `upsertKnowledgeGap` no fluxo principal de mensagens (linhas 3129 e 3162). Isso para imediatamente de poluir `agent_knowledge_gaps` com lixo. O pipeline de `heal-knowledge-gaps` e `evaluate-interaction` continuam funcionando com os registros existentes.

#### 3. Refazer `SmartOpsContentProduction.tsx`

Mudar a fonte de `agent_knowledge_gaps` para `content_requests`:

| Data | Tema | Tipo | Pendencia | Leads | Freq. | Prioridade | Status | Acao |
|---|---|---|---|---|---|---|---|---|

- **Tema**: campo `tema` classificado pela IA (ex: "GlazeON - Splint para ferulizacao")
- **Tipo**: badge colorido (comparativo, tutorial, FAQ, ficha tecnica, artigo)
- **Pendencia**: texto original do resumo
- **Leads**: count de `source_leads[]` distintos (tooltip com emails)
- **Frequencia**: total de sessoes que mencionaram
- **Prioridade**: 1-5 com icones de estrela ou badge
- **Status**: solicitado / em_producao / publicado / descartado
- **Acao**: botao "Gerar" (abre modal pre-preenchido, igual ao atual)

Cards de resumo: pedidos abertos, top temas, alta prioridade (>=4).

#### 4. Limpar `agent_knowledge_gaps` e atualizar `AdminDraLIAStats.tsx`

- SQL DELETE para remover os ~60 registros de lixo da `agent_knowledge_gaps` (telefones, emails, respostas SPIN com < 25 chars sem `?`)
- Opcionalmente: migrar os poucos gaps reais (glazeON, softwares CAD, etc.) como seed para `content_requests`
- O "Top 10 Perguntas Sem Resposta" em `AdminDraLIAStats` continuara lendo de `agent_knowledge_gaps`, mas sem novos registros de lixo entrando

---

### Resumo de arquivos

| # | Arquivo | Acao |
|---|---------|------|
| 1 | Migracao SQL | Criar `content_requests` + RLS + limpar lixo de `agent_knowledge_gaps` |
| 2 | `supabase/functions/dra-lia/index.ts` | Parsear PENDENCIAS no `summarize_session`, classificar com IA, upsert em `content_requests`. Remover chamadas a `upsertKnowledgeGap` nas linhas 3129 e 3162 |
| 3 | `src/components/SmartOpsContentProduction.tsx` | Refazer para ler de `content_requests` |
| 4 | `src/integrations/supabase/types.ts` | Atualizado automaticamente |

### Resultado esperado

A aba "Producao de Conteudo" mostrara apenas pedidos reais extraidos dos resumos da LIA:
- "GlazeON - informacoes sobre aplicacao e indicacoes" (ficha_tecnica, prioridade 3)
- "Comparativo ioConnect TruAbutment vs outras opcoes" (comparativo, prioridade 4)
- "Combo scanner + CAD + impressora - detalhes" (tutorial, prioridade 5)

E nunca mais "100% analogico", "5519992612348" ou "ja respondi isso".

