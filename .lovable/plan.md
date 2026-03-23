

# Bug Fix: Dra. L.I.A. Loop de Saudação — Sessão Nunca Persiste

## Problema
Toda mensagem do lead é tratada como "primeiro contato", gerando uma saudação repetida em loop. O bot nunca avança para o fluxo de RAG/conversa real.

## Causa Raiz
A tabela `agent_sessions` tem uma foreign key `agent_sessions_lead_id_fkey` que referencia `leads(id)`. Porém, o sistema migrou para usar `lia_attendances` como tabela principal de leads. Leads que existem apenas em `lia_attendances` (como Thiago — `f611bce3-2bc8-49bd-a6f5-976eb91075a3`) **não existem em `leads`**, causando violação de FK silenciosa.

Resultado: o `upsert` em `agent_sessions` (linha ~2030) falha silenciosamente. Na próxima mensagem, `sessionEntities` é `null`, e o `detectLeadCollectionState` retorna `needs_name` em vez de `from_session`. O ciclo se repete infinitamente.

```text
Fluxo atual (bug):
  MSG 1 (email) → needs_name → encontra lead → gera saudação → tenta upsert session → FK FAIL (silencioso)
  MSG 2 (qualquer) → session lookup → NULL → detecta email no history → needs_name → saudação de novo
  MSG 3 → mesmo ciclo...
```

## Plano de Correção

### 1. Migração: Alterar FK de `agent_sessions.lead_id`
Mudar a foreign key para referenciar `lia_attendances(id)` em vez de `leads(id)`.

```sql
ALTER TABLE agent_sessions DROP CONSTRAINT agent_sessions_lead_id_fkey;
ALTER TABLE agent_sessions ADD CONSTRAINT agent_sessions_lead_id_fkey 
  FOREIGN KEY (lead_id) REFERENCES lia_attendances(id) ON DELETE SET NULL;
```

### 2. Backfill: Sincronizar leads ausentes (proteção temporária)
Inserir na tabela `leads` os registros de `lia_attendances` que não existem lá, para evitar quebra de outras dependências.

### 3. Melhorar tratamento de erro no upsert de sessão
No `dra-lia/index.ts`, adicionar log explícito quando o upsert de sessão falha (atualmente é silencioso no catch).

### 4. Validar fix
- Reenviar mensagem como Thiago e confirmar que a segunda mensagem NÃO gera saudação.
- Verificar que `agent_sessions` contém o registro com `lead_id` preenchido.

## Detalhes Técnicos
- **Tabela afetada:** `agent_sessions` (constraint `agent_sessions_lead_id_fkey`)
- **Lead de teste:** `thiago.nct@gmail.com` — ID `f611bce3-2bc8-49bd-a6f5-976eb91075a3` existe em `lia_attendances` mas não em `leads`
- **Arquivo principal:** `supabase/functions/dra-lia/index.ts` linhas ~2030-2051 (upsert session)
- **Impacto:** afeta TODOS os leads que foram criados diretamente em `lia_attendances` sem correspondência em `leads`

