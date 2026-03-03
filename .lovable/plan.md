

# Plano: DeepSeek Watchdog + Dashboard Saúde do Sistema

## Resumo

Criar um sistema de monitoramento em tempo real com persistência de erros, auditoria automática via DeepSeek, e dashboard visual substituindo a aba "Relatórios" por "Saúde do Sistema" no SmartOps.

## Implementação

### 1. Migration: Tabela `system_health_logs`

```sql
CREATE TABLE system_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  function_name text NOT NULL,
  severity text DEFAULT 'error',
  error_type text,
  lead_email text,
  lead_id uuid,
  details jsonb DEFAULT '{}',
  ai_analysis text,
  ai_suggested_action text,
  auto_remediated boolean DEFAULT false,
  resolved boolean DEFAULT false,
  resolved_at timestamptz
);

ALTER TABLE system_health_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON system_health_logs FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "service_insert" ON system_health_logs FOR INSERT WITH CHECK (true);
```

### 2. Edge Function: `system-watchdog-deepseek`

Nova função que:
- Detecta leads órfãos (`leads` sem correspondente em `lia_attendances`)
- Detecta leads sem `piperun_id` com status avançado
- Detecta leads sem `cognitive_analysis` com `total_messages >= 5`
- Envia anomalias ao DeepSeek para classificação e sugestão de ação
- Auto-remedia: re-ingere órfãos via `smart-ops-ingest-lead`
- Persiste tudo em `system_health_logs`

Usa `DEEPSEEK_API_KEY` (já configurada).

### 3. Atualizar `dra-lia/index.ts`

Nos catches críticos (linhas 1181, 1188, 1193), além do `console.warn/error`, inserir na `system_health_logs`:

```typescript
await supabase.from("system_health_logs").insert({
  function_name: "dra-lia",
  severity: "error",
  error_type: "upsert_failed",
  lead_email: normalizedEmail,
  details: { error: insErr?.message, context: "upsertLead fallback" }
}).catch(() => {});
```

### 4. Atualizar `smart-ops-ingest-lead/index.ts`

Nos catches (linhas 187, 219, 240-242, 254-256, 276, 286), persistir erros na `system_health_logs`.

### 5. Novo componente: `SmartOpsSystemHealth.tsx`

Substitui `SmartOpsReports`. Contém:
- **Semáforo**: Verde (0 erros 24h) / Amarelo (warnings) / Vermelho (critical)
- **Cards**: Erros 24h, Leads órfãos, Leads sem PipeRun, Análises pendentes
- **Tabela de eventos**: Últimos erros com análise do DeepSeek, botão "Resolver"
- **Botão "Executar Watchdog"**: Dispara `system-watchdog-deepseek` manualmente
- **Botão "Recuperar Órfãos"**: Re-ingere leads perdidos
- Realtime via Supabase subscription na `system_health_logs`

### 6. Atualizar `SmartOpsTab.tsx`

- Substituir a aba "Relatórios" (`relatorios`) por "Saúde do Sistema" (`saude`)
- Importar `SmartOpsSystemHealth` no lugar de `SmartOpsReports`

### 7. Atualizar `supabase/config.toml`

Adicionar `system-watchdog-deepseek` com `verify_jwt = false`.

### 8. Recuperar 3 leads órfãos

Disparar `smart-ops-ingest-lead` para `lorraine96@gmail.com`, `daniohen@gmail.com` e `tester@smartdent.com.br`.

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar `system_health_logs` |
| `supabase/functions/system-watchdog-deepseek/index.ts` | **NOVO** |
| `supabase/functions/dra-lia/index.ts` | Persistir erros em `system_health_logs` |
| `supabase/functions/smart-ops-ingest-lead/index.ts` | Idem |
| `supabase/config.toml` | Adicionar `system-watchdog-deepseek` |
| `src/components/SmartOpsSystemHealth.tsx` | **NOVO** — dashboard |
| `src/components/SmartOpsTab.tsx` | Trocar "Relatórios" por "Saúde do Sistema" |

