## Plano de implementação — 4 lacunas confirmadas

Todas as lacunas validadas no lead `366ea619…`. Execução numa única passada, sem migração de schema.

---

### Ajuste A — `form_data` passa a fazer merge profundo por submissão

**Arquivo:** `supabase/functions/_shared/lead-enrichment.ts`

1. Adicionar `"form_data"` em `MERGE_JSONB_FIELDS` (junto com `sellflux_custom_fields` e `raw_payload`).
2. Estender o branch de merge JSONB para `form_data`: em vez de spread raso, fazer **append por submissão** sob a chave `form_name`:
   ```ts
   form_data[form_name] = [...(existing[form_name] || []), { submitted_at, responses, raw_fields }]
   ```
   (mantém histórico de cada envio, não sobrescreve.)
3. Quando o `form_name` for `unknown`/null, agrupar sob `_unnamed`.

**Arquivo:** `supabase/functions/smart-ops-ingest-lead/index.ts` (linhas 400–415)

- Continuar montando o snapshot da submissão atual; o merge profundo no shared faz o resto.
- Remover o `existingFormData` local (agora redundante) para evitar dupla aplicação.

---

### Ajuste B — Preservar histórico de `custom_fields`

**Arquivo:** `supabase/functions/smart-ops-ingest-lead/index.ts`

No ponto onde o payload é normalizado (antes do smart-merge), transformar:
```jsonc
payload.raw_payload = { custom_fields: {...} }
```
em:
```jsonc
payload.raw_payload = {
  custom_fields: {...},                       // última versão (compat)
  custom_fields_history: [                    // append-only
    { submitted_at, form_name, fields: {...} }
  ]
}
```

**Arquivo:** `supabase/functions/_shared/lead-enrichment.ts`

- Garantir que `raw_payload` continue em `MERGE_JSONB_FIELDS`.
- Adicionar lógica especial: se a chave entrante for `custom_fields_history` (array), **concatenar** com o existente em vez de sobrescrever (limitar a últimos 50 itens para não inflar a row).

---

### Ajuste C — Enriquecer o prompt da `cognitive-lead-analysis`

**Arquivo:** `supabase/functions/cognitive-lead-analysis/index.ts`

1. Ampliar o `select` na linha 148, adicionando:
   ```
   equip_scanner, sdr_software_cad_interesse,
   imprime_resinas_ld, imprime_guias,
   form_data, raw_payload
   ```
2. Após o `select` do lead, carregar `smartops_form_field_responses`:
   ```ts
   const { data: sdrResponses } = await supabase
     .from("smartops_form_field_responses")
     .select("field_label, value, created_at")
     .eq("lead_id", leadData.id)
     .order("created_at", { ascending: false })
     .limit(40);
   ```
   Deduplicar por `field_label` mantendo o `value` mais recente.
3. Construir bloco `**Perfil técnico (SDR Qualificação):**` no prompt, listando:
   - Marca do scanner (`equip_scanner`)
   - Software CAD em uso (`sdr_software_cad_interesse`)
   - Imprime resinas LD / guias cirúrgicas / placas / modelos
   - Custom fields do `raw_payload.custom_fields` (descoberta, motivo de perda de pacientes, contato com 3D)
   - Top 10 pares `field_label → value` mais recentes de `sdrResponses` não duplicados acima
4. Atualizar instruções do prompt para usar esses sinais ao decidir:
   - `lead_stage_detected` (uso de CAD + resinas LD → MQL avançado / SAL)
   - `objection_risk` (motivo de perde_pacientes vira pista de objeção)
   - `recommended_approach` (citar marca de scanner/CAD para contextualizar)

---

### Ajuste D — Observabilidade

**Arquivo:** `supabase/functions/_shared/lead-enrichment.ts`

- No `mergeSmartLead`, quando uma chave em `MERGE_JSONB_FIELDS` for ignorada por payload vazio, inserir log em `system_health_logs` com `event_type='jsonb_merge_noop'`, `metadata: { field, source }`.
- Quando o append em `form_data[form_name]` ocorrer, registrar `event_type='form_data_appended'` com `{ form_name, responses_count, raw_fields_count }`.

(Insert opcional via service role — usar fire-and-forget para não bloquear ingest.)

---

## Arquivos tocados

```text
supabase/functions/_shared/lead-enrichment.ts        (A, B, D)
supabase/functions/smart-ops-ingest-lead/index.ts    (A cleanup, B normalize)
supabase/functions/cognitive-lead-analysis/index.ts  (C: select + prompt + sdrResponses)
mem/architecture/lead-form-enrichment-v3.md          (atualizar — registrar merge profundo)
mem/architecture/lead-form-catch-all-jsonb.md        (atualizar — custom_fields_history)
mem/dra-lia/cognitive-prompt-sdr-enrichment.md       (NOVO — documentar Ajuste C)
mem/index.md                                          (referenciar nova memória)
```

## Validação pós-deploy

1. Submeter o `# - Formulário Padrão` 2× com respostas diferentes em `impressao_de_modelos`.
2. Checar `lia_attendances.form_data` → deve conter array com 2 entradas sob a chave `# - Formulário Padrão`.
3. Checar `raw_payload.custom_fields_history` → 2 itens, mais recente primeiro.
4. Disparar `cognitive-lead-analysis` para o lead e verificar nos logs que o prompt contém o bloco `Perfil técnico (SDR Qualificação)` com marca scanner + CAD + resinas.
5. `system_health_logs` deve mostrar 1 `form_data_appended` por submissão.

## Fora de escopo

- Nenhuma mudança em `PublicFormPage`, `smart-ops-lia-assign` ou PipeRun (payload já chega correto).
- Sem alteração de schema.
- Sem mudança nas tags / fluxo de hot-lead (Ajuste 1 do plano anterior continua aguardando decisão A/B/C).

Aprova a execução de A + B + C + D nesta passada?