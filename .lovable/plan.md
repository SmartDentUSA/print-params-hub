

## Plano: Implementar smart-ops-lia-assign + Auditoria Completa LIA

Este plano cobre duas partes: (A) criar a edge function de atribuicao de leads e (B) auditoria/correcao de bugs encontrados.

---

### PARTE A: smart-ops-lia-assign (3 fluxos)

#### 1. Adicionar `STAGES_DISTRIBUIDOR_LEADS` no piperun-field-map.ts

Preciso consultar a API PipeRun para descobrir o stage_id da primeira etapa do pipeline 70898. Vou usar a funcao `piperunGet` diretamente na edge function. Caso falhe, uso um fallback.

Adicionar no `piperun-field-map.ts`:
```typescript
export const STAGES_DISTRIBUIDOR_LEADS = {
  DISTRIBUIDOR: 0, // sera resolvido dinamicamente via API
} as const;
```

Na pratica, a function `smart-ops-lia-assign` fara `GET /stages?pipeline_id=70898` para obter o primeiro stage_id automaticamente.

#### 2. Criar `supabase/functions/smart-ops-lia-assign/index.ts`

Logica completa:

1. Recebe `{ email }` via POST
2. Busca lead em `lia_attendances` por email
3. **Opcao 1 (Lead novo — sem piperun_id):**
   - Query `team_members WHERE ativo=true AND role='vendedor' ORDER BY random() LIMIT 1`
   - Se nenhum ativo → fallback Thiago Nicoletti (piperun 64367)
   - Se owner === 64367 → `pipeline_id = 70898` (Distribuidor de Leads), etapa = "Distribuidor de Leads" (primeira etapa do pipeline 70898 via API)
   - Senao → `pipeline_id = 18784` (Vendas), `stage_id = 99293` (Sem Contato)
   - `piperunPost("deals", { title, pipeline_id, stage_id, owner_id, custom_fields, origin: "dra-lia" })`
   - Salva `piperun_id`, `proprietario_lead_crm`, `funil_entrada_crm`, `ultima_etapa_comercial` no lead
4. **Opcao 2 (Lead existente — tem piperun_id):**
   - Busca `team_members` pelo `proprietario_lead_crm`
   - Se dono inativo/nao encontrado → sorteia novo vendedor ativo (ou fallback 64367)
   - Mesma logica de pipeline: 64367 → Distribuidor, senao → Vendas/Sem Contato
   - `piperunPut("deals/{piperun_id}", { stage_id, owner_id })`
   - `addDealNote` com `resumo_historico_ia`
5. **Opcao 3 (Fallback):**
   - Se nenhum vendedor ativo → owner = 64367, pipeline = 70898 (Distribuidor de Leads), stage = primeira etapa
   - Sempre cria/atualiza deal com marcador `dra-lia`
6. **Automacao Outbound:**
   - Query `cs_automation_rules WHERE trigger_event='NOVO_LEAD' AND ativo=true`
   - Filtra por `produto_interesse` do lead. Se nao encontrar → busca `produto_interesse IS NULL` (coringa)
   - Envia via `smart-ops-send-waleads` com telefone do lead

#### 3. Editar `dra-lia/index.ts` — fire-and-forget no summarize_session

Apos linha ~2608 (apos `console.log("[summarize_session] Done for..."`), adicionar:
```typescript
if (leadEmail) {
  fetch(`${SUPABASE_URL}/functions/v1/smart-ops-lia-assign`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: leadEmail }),
  }).catch(e => console.warn("[summarize_session] lia-assign error:", e));
}
```

#### 4. Adicionar em `supabase/config.toml`
```toml
[functions.smart-ops-lia-assign]
verify_jwt = false
```

---

### PARTE B: Auditoria — Bugs e Problemas Encontrados

#### BUG 1: Apenas 1 vendedor ativo no sistema
`team_members` tem apenas **1 vendedor ativo** ("Celular da Patricia", piperun 47675). Round Robin com 1 pessoa = sempre a mesma. Isso nao e bug de codigo, mas o fallback para 64367 sera frequente se Patricia ficar inativa.

**Acao:** Nenhuma correcao de codigo necessaria, mas documentar no log.

#### BUG 2: `cs_automation_rules` sem regras NOVO_LEAD
A tabela `cs_automation_rules` nao tem nenhuma regra com `trigger_event = 'NOVO_LEAD'`. A automacao outbound nao enviara mensagens ate que regras sejam criadas manualmente.

**Acao:** Documentar. Nao criar dados via migration.

#### BUG 3: DraLIA.tsx — Duplicacao massiva de codigo SSE
Os handlers de area grid (linhas ~895-980) e specialty grid (linhas ~984-1090) contem **200+ linhas de codigo SSE duplicado** que sao copias exatas do `sendMessage`. Isso causa manutencao difícil e bugs inconsistentes.

**Acao:** Refatorar para reutilizar uma funcao `sendChatMessage(text, extraPayload?)` compartilhada.

#### BUG 4: SmartOpsGoals.tsx — Verificar se esta conectado
**Acao:** Verificar se o componente `SmartOpsGoals` tem dados reais ou e placeholder.

#### ITEM 5: `smart-ops-lia-assign` nao existia — criacao pendente
Confirmado que a function nao existe ainda. Sera criada neste plano.

---

### Arquivos a criar/editar

| # | Arquivo | Mudanca |
|---|---------|---------|
| 1 | `supabase/functions/smart-ops-lia-assign/index.ts` | **NOVO** — 3 fluxos de atribuicao + PipeRun sync |
| 2 | `supabase/functions/dra-lia/index.ts` | Fire-and-forget `smart-ops-lia-assign` no final do `summarize_session` |
| 3 | `supabase/config.toml` | Adicionar `[functions.smart-ops-lia-assign]` |
| 4 | `src/components/DraLIA.tsx` | Refatorar SSE duplicado em area/specialty grids para funcao reutilizavel |

### Regra chave
- Owner 64367 (Thiago Nicoletti) → Pipeline **Distribuidor de Leads** (70898), Etapa = primeira etapa do pipeline (resolvida via API PipeRun `GET /stages?pipeline_id=70898`)
- Qualquer outro owner → Pipeline **Vendas** (18784), Etapa = **Sem Contato** (99293)
- Origin `dra-lia` obrigatorio em todos os payloads PipeRun

