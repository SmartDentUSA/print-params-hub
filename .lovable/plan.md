

# Plano: Copilot como Verificador de Consolidação de Dados

## Contexto

O sistema já possui:
- **Watchdog** (`system-watchdog-deepseek`): verifica leads órfãos, missing PipeRun, missing cognitive — mas roda sob demanda/cron, não em tempo real
- **Copilot** com `check_missing_fields` e `unify_leads` — mas são ferramentas manuais, acionadas por comando

O que falta: **verificação automática pós-integração** — quando chega dado do PipeRun, SellFlux ou Loja Integrada, o sistema confirma que a consolidação foi completa e registra anomalias.

## Implementação

### 1. Nova tool no Copilot: `verify_consolidation`

Adicionar ao array `tools` do `smart-ops-copilot/index.ts`:

```text
verify_consolidation
  - lead_id ou email (opcional — se vazio, verifica os últimos 10 leads atualizados)
  - Checa:
    • Chaves de identidade preenchidas (pessoa_hash, empresa_hash, piperun_id)
    • Campos críticos não-nulos (nome, email, telefone, etapa_crm, pipeline)
    • Consistência: se tem empresa_piperun_id, deve ter empresa_nome
    • Deals history: se piperun_id existe, deve estar no array piperun_deals_history
    • Proposals: se proposals_data existe, proposals_total_value deve ser > 0
    • Cross-check: se piperun_id existe, person fields não devem estar todos nulos
  - Retorna: relatório com score de completude (%) e lista de campos faltantes
```

### 2. Hook automático no webhook PipeRun

No final do `smart-ops-piperun-webhook/index.ts`, após o update bem-sucedido, disparar uma verificação leve (fire-and-forget):

```typescript
// Após update/insert do lead
fetch(`${SUPABASE_URL}/functions/v1/smart-ops-copilot`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
  body: JSON.stringify({
    message: `Verifique a consolidação do lead ${leadId} que acabou de ser atualizado pelo webhook PipeRun. Liste campos faltantes.`,
    model: "deepseek",
    system_trigger: true
  })
});
```

Alternativamente (mais leve e sem custo de IA): criar uma função SQL ou verificação inline que checa os campos críticos e loga em `system_health_logs` se a completude estiver abaixo de 70%.

### 3. Abordagem recomendada: Verificação inline (sem IA)

Para evitar custo desnecessário de tokens a cada webhook, a verificação automática seria **SQL puro** no final do webhook:

```typescript
// Post-update verification
const { data: check } = await supabase
  .from("lia_attendances")
  .select("pessoa_hash, empresa_hash, nome, email, telefone_normalized, etapa_crm, piperun_deals_history, empresa_nome")
  .eq("id", leadId)
  .single();

const missing = [];
if (!check.pessoa_hash) missing.push("pessoa_hash");
if (!check.telefone_normalized) missing.push("telefone");
if (!check.empresa_nome && check.empresa_hash) missing.push("empresa_nome");
// ... etc

if (missing.length > 3) {
  await supabase.from("system_health_logs").insert({
    function_name: "piperun-webhook-consolidation",
    severity: "warning",
    error_type: "incomplete_consolidation",
    lead_email: personEmail,
    details: { lead_id: leadId, missing_fields: missing, completeness: Math.round((totalFields - missing.length) / totalFields * 100) }
  });
}
```

O Copilot então pode **consultar** esses logs via `query_table` a qualquer momento, ou o admin pode pedir: *"Copilot, como está a consolidação dos últimos leads?"*

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `smart-ops-piperun-webhook/index.ts` | +30 linhas: verificação inline pós-update com log em `system_health_logs` |
| `smart-ops-copilot/index.ts` | +1 tool `verify_consolidation` (~50 linhas) |

## Resultado

- Cada lead que entra pelo webhook é **automaticamente auditado** (sem custo de IA)
- Anomalias de consolidação ficam em `system_health_logs` para consulta
- O Copilot ganha a tool `verify_consolidation` para auditoria sob demanda com análise detalhada
- Admin pode perguntar: *"Copilot, verifique a consolidação dos últimos 10 leads do PipeRun"*

