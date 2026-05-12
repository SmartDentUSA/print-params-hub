## Problema

O lead **Dr.Valente / Dentista Macapa** está no deal PipeRun **59697957** (não `59698741` — esse é do Jonathan, outro lead do mesmo formulário). Em ambos, os custom fields do PipeRun (`Tem scanner`, `Tem impressora`, `Whatsapp`, `Produto de interesse`, `Área de Atuação`) aparecem como "Adicionar valor", apesar de:

- `form_data.BLZ- Smart Dent.raw_fields` conter todos os valores.
- `lia_attendances.tem_scanner = "não"`, `tem_impressora = "não"`, `produto_interesse = "BLZ Ino200"`, `area_atuacao = "CLÍNICA OU CONSULTÓRIO"` já estarem populados.

## Causa raiz

Dois fatores cumulativos:

1. **Race condition de timing**: o deal foi criado via integração nativa Meta→PipeRun (origem "» BLZ- Smart Dent", diferente de `Dra. L.I.A.` que o `createNewDeal` aplicaria). Quando `smart-ops-lia-assign` rodou em seguida e chamou `updateExistingDeal` no deal já existente, as colunas top-level (`tem_scanner` etc.) podiam ainda não estar promovidas a partir de `form_data` pelo ingest dinâmico. Resultado: `mapAttendanceToDealCustomFields(lead)` devolveu array vazio e o PUT não enviou hash_fields.
2. **Sem fallback no mapper**: `mapAttendanceToDealCustomFields` em `_shared/piperun-field-map.ts` só lê de `lead.<col>` top-level; não usa `lead.form_data.<form_name>.raw_fields` como fallback.

## Correção

### 1. Resiliência no mapper (cobre todos os leads futuros, não só Meta)
Em `supabase/functions/_shared/piperun-field-map.ts`, dentro de `mapAttendanceToDealCustomFields`:

- Antes do return, se algum dos campos prioritários (`tem_scanner`, `tem_impressora`, `produto_interesse`, `area_atuacao`, `especialidade`) ainda não foi adicionado, varrer `attendance.form_data` (qualquer chave de form, qualquer `raw_fields`/`responses`) buscando os mesmos nomes (case-insensitive, sinônimos: `tem_scanner|scanner`, `tem_impressora|impressora`, `produto|produto_interesse|equipamento`, `area_atuacao|area_de_atuacao`, `especialidade`).
- Normalizar valores de área (UPPER → Capitalized) e produto (trim).
- Logar quais campos vieram do fallback para auditoria.

Efeito imediato: na próxima execução de qualquer fluxo que use esse mapper (lia-assign retry, piperun-retry-failed-leads, sync periódico), os custom_fields serão enviados ao PipeRun mesmo se a race condition recorrer.

### 2. Backfill direcionado
Criar uma edge function nova: `supabase/functions/smart-ops-piperun-backfill-customfields/index.ts`.

- Aceita `{ dry_run?: boolean, lead_ids?: string[], since?: ISO, limit?: number }`.
- Query: `lia_attendances` onde `merged_into IS NULL` AND `piperun_id IS NOT NULL` AND (`piperun_custom_fields IS NULL OR piperun_custom_fields = '[]'::jsonb`) AND (`tem_scanner IS NOT NULL OR tem_impressora IS NOT NULL OR produto_interesse IS NOT NULL OR area_atuacao IS NOT NULL OR form_data IS NOT NULL`). Default `since = now() - 90 days`, `limit = 500`.
- Para cada lead: chamar `mapAttendanceToDealCustomFields` (já com novo fallback) → `customFieldsToHashMap` → `piperunPut('deals/{piperun_id}', hashFields)`.
- Se Person tiver custom fields também (`PESSOA_*` aceitos), enviar via `piperunPut('persons/{pessoa_piperun_id}', ...)`.
- Atualizar `lia_attendances.piperun_custom_fields` localmente após sucesso (para refletir o estado).
- Logar resultado por lead em `lia_attendances_logs` ou retornar JSON.
- Rodar `dry_run: true` primeiro, depois `dry_run: false`.

Casos confirmados que serão corrigidos pelo backfill: deal **59697957** (Dr.Valente) e **59698741** (Jonathan), além de todos os outros leads vindos de "BLZ- Smart Dent" e formulários Meta similares dos últimos 90 dias.

### 3. Memória
Atualizar `mem://integration/piperun-sync-spec-v6` (ou criar `mem://integration/piperun-customfields-resilience`) registrando que `mapAttendanceToDealCustomFields` faz fallback em `form_data` e que existe a edge `smart-ops-piperun-backfill-customfields`.

## Fora de escopo

- Eliminar a race condition na origem (mudar o ingest dinâmico para promover colunas síncronamente antes do lia-assign).
- Reescrever o webhook Meta para criar Deals via nossa API (atualmente o PipeRun cria o Deal via integração nativa).
- Custom fields da Person (PESSOA_*) que o PipeRun rejeita com 422 (já desabilitado).
