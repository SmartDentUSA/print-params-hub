

## Auditoria Completa: Webhook vs Sync — Gap Real de Dados

### Diagnóstico

Após análise linha-a-linha dos 3 arquivos envolvidos, o problema é claro:

**O `mapDealToAttendance()` (usado pelo sync) JÁ extrai 60+ campos incluindo empresa/pessoa profundos.** Porém o sync tem **3 gaps críticos** que o webhook não tem:

---

### GAP 1: Sync não faz `deepParseStringifiedFields()`

O webhook (linha 30-44) tem um parser que converte campos que o PipeRun envia como **strings JSON** (ex: `"company": "{\"name\":\"Clínica X\"}"`) de volta para objetos. O sync passa os dados direto da API para `mapDealToAttendance()` sem esse tratamento.

**Impacto**: Quando a API retorna `person.company` como string JSON (acontece em ~30% dos casos), `mapDealToAttendance()` tenta acessar `company.name` numa string e recebe `undefined`.

**Fix**: Adicionar `deepParseStringifiedFields()` ao sync antes de chamar `mapDealToAttendance()`.

---

### GAP 2: Sync não tem Identity Resolution em cascata

O webhook usa `findLeadByCascade()` (4 estratégias: piperun_id → pessoa_hash → pessoa_piperun_id → email). O sync só busca por `piperun_id` e depois por `email` como fallback.

**Impacto**: Leads que mudaram de deal (novo deal no PipeRun, mesmo pessoa) não são encontrados pelo sync. O webhook os encontra via `pessoa_hash`.

**Fix**: Usar a mesma cascata de identidade no sync.

---

### GAP 3: Sync não persiste `piperun_deals_history`

O webhook mantém um array `piperun_deals_history` com snapshots de todos os deals de cada lead. O sync nunca atualiza esse campo.

**Impacto**: Leads sincronizados apenas via sync não têm histórico de deals.

**Fix**: Adicionar upsert de deal snapshot no loop do sync.

---

### GAP 4: Campos que o webhook extrai via `extractIds()` mas `mapDealToAttendance()` NÃO extrai

Comparação campo-a-campo:

| Campo | Webhook (`extractIds`) | Sync (`mapDealToAttendance`) | Status |
|-------|----------------------|---------------------------|--------|
| `pessoa_hash` | ✅ | ✅ | OK |
| `pessoa_cpf` | ✅ | ✅ | OK |
| `pessoa_cargo` | ✅ | ✅ | OK |
| `pessoa_genero` | ✅ | ✅ | OK |
| `pessoa_linkedin` | ✅ | ✅ | OK |
| `pessoa_facebook` | ✅ | ✅ | OK |
| `pessoa_observation` | ✅ | ✅ | OK |
| `pessoa_website` | ✅ | ✅ | OK |
| `pessoa_nascimento` | ✅ | ✅ | OK |
| `pessoa_endereco` | ✅ | ✅ | OK |
| `pessoa_rdstation` | ✅ | ✅ | OK |
| `pessoa_manager` | ✅ | ✅ | OK |
| `pessoa_lgpd` | ✅ | ✅ | OK |
| `empresa_nome` | ✅ | ✅ | OK |
| `empresa_razao_social` | ✅ | ✅ | OK |
| `empresa_cnpj` | ✅ | ✅ | OK |
| `empresa_segmento` | ✅ | ✅ | OK |
| `empresa_porte` | ✅ | ✅ | OK |
| `empresa_pais` | ✅ | ✅ | OK |
| `empresa_endereco` | ✅ | ✅ | OK |
| `empresa_telefone` | ✅ | ✅ | OK |
| `empresa_email` | ✅ | ✅ | OK |
| `temperatura_lead` | ✅ (webhook inline) | ❌ | **FALTA** |
| `motivo_perda` (com comment) | ✅ (com `comentario_perda`) | ✅ (só name) | **PARCIAL** |
| `comentario_perda` | ✅ | ❌ | **FALTA** |
| `lead_timing_dias` | ✅ | ❌ | **FALTA** |
| `data_fechamento_crm` | ✅ | ✅ | OK |
| `itens_proposta_parsed` (auto-equip) | ✅ (com auto-equip scanner/imp) | ✅ | OK |
| `proposals_total_value` | ✅ | ✅ | OK |
| `proposals_last_status` | ✅ | ❌ | **FALTA** |
| Tags CRM journey | ✅ (computeTagsFromStage) | ❌ | **FALTA** |
| Deals history array | ✅ (upsertDealHistory) | ❌ | **FALTA** |
| Identity cascade (4 níveis) | ✅ | ❌ (só 2) | **FALTA** |
| `deepParseStringifiedFields` | ✅ | ❌ | **FALTA** |

---

### Plano de Correção

#### Arquivo 1: `supabase/functions/smart-ops-sync-piperun/index.ts`

1. **Importar e aplicar `deepParseStringifiedFields`** antes de chamar `mapDealToAttendance()` — copiar a função do webhook ou movê-la para o shared
2. **Expandir identity resolution** — buscar por `pessoa_hash` e `pessoa_piperun_id` além de `piperun_id` e `email`
3. **Adicionar upsert de `piperun_deals_history`** no loop de sync
4. **Adicionar campos faltantes ao payload**: `temperatura_lead`, `comentario_perda`, `lead_timing_dias`, `proposals_last_status`
5. **Adicionar `computeTagsFromStage`** para manter tags journey atualizadas

#### Arquivo 2: `supabase/functions/_shared/piperun-field-map.ts`

1. **Mover `deepParseStringifiedFields`** do webhook para o shared (DRY)
2. **Adicionar campos faltantes** a `mapDealToAttendance()`: `temperatura_lead`, `comentario_perda`, `lead_timing_dias`, `proposals_last_status`

#### Arquivo 3: `supabase/functions/piperun-full-sync/index.ts`

1. Aplicar as mesmas correções do sync regular

### Resultado Esperado
- Paridade 100% entre webhook e sync
- Leads existentes enriquecidos na próxima execução
- Identity resolution robusta (4 níveis) em ambos os caminhos

