

## Problema: Lead Rita não atualizado no PipeRun

### Diagnóstico

Existem **2 registros duplicados** na tabela `lia_attendances` para a mesma lead:

| Email | piperun_id | lead_status |
|---|---|---|
| `rita_castellucci@yahoo.com.br` | **37733255** | novo |
| `Rita_castellicci@yahoo.com.br` | **null** | em_atendimento |

O registro ativo (onde o handoff ocorreu) é o que tem o email com typo (`castellicci` em vez de `castellucci`) e **não tem piperun_id**. Quando o handoff detecta `piperun_id = null`, ele chama `smart-ops-lia-assign` para criar um deal, mas como já existe uma pessoa no PipeRun com email similar, provavelmente houve conflito ou o deal não foi criado.

### Correções necessárias

#### 1. Correção imediata (dados): Unificar os registros duplicados
Executar SQL para transferir o `piperun_id` do registro correto para o ativo, e desativar o duplicado.

#### 2. Correção preventiva (código): Busca fuzzy por email no handoff
No `notifySellerHandoff` (linha 1438 do `dra-lia/index.ts`), quando o `attendance.piperun_id` é null, adicionar uma busca secundária por email normalizado (lowercase, trim) na tabela `lia_attendances` para encontrar um `piperun_id` existente antes de chamar `lia-assign`.

**Arquivo:** `supabase/functions/dra-lia/index.ts`

Na seção do handoff (linha ~1767), antes do bloco `if (attendance.piperun_id)`:
- Se `attendance.piperun_id` é null, buscar outro registro em `lia_attendances` com email similar (ILIKE) que tenha `piperun_id` preenchido
- Se encontrar, usar esse `piperun_id` e atualizar o registro atual

```text
Fluxo atual:
  attendance.piperun_id? → SIM → add note + sync
                         → NÃO → lia-assign (criar deal)

Fluxo proposto:
  attendance.piperun_id? → SIM → add note + sync
                         → NÃO → buscar piperun_id por email similar
                                  → Encontrou? → usar + update attendance → add note + sync
                                  → Não encontrou? → lia-assign (criar deal)
```

### Detalhes técnicos

**Linha ~1766-1767:** Antes do `if (attendance.piperun_id)`, inserir lógica de fallback:
```typescript
// Fallback: find piperun_id from duplicate records with same email
if (!attendance.piperun_id) {
  const { data: altRecord } = await supabase
    .from("lia_attendances")
    .select("piperun_id, piperun_link, piperun_pipeline_id")
    .ilike("email", leadEmail)
    .not("piperun_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (altRecord?.piperun_id) {
    attendance.piperun_id = altRecord.piperun_id;
    attendance.piperun_link = altRecord.piperun_link;
    (attendance as any).piperun_pipeline_id = altRecord.piperun_pipeline_id;
    // Persist the piperun_id to the current record
    await supabase.from("lia_attendances")
      .update({ piperun_id: altRecord.piperun_id, piperun_link: altRecord.piperun_link })
      .eq("id", attendance.id);
    console.log(`[handoff] Found piperun_id ${altRecord.piperun_id} from alt record for ${leadEmail}`);
  }
}
```

**SQL para correção imediata dos dados da Rita:**
```sql
UPDATE lia_attendances 
SET piperun_id = '37733255', 
    piperun_link = (SELECT piperun_link FROM lia_attendances WHERE email = 'rita_castellucci@yahoo.com.br')
WHERE id = '21e06309-33aa-4e2f-b325-b3f4e8439238';
```

