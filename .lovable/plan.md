## Diagnóstico

Os formulários gravam marca/modelo do scanner e impressora em chaves como `equip_scanner`, `como_digitaliza`, `equip_impressora`, `impressora_modelo` dentro de `lia_attendances.form_data[...].raw_fields`. As colunas canônicas são **`scanner_marca`** e **`impressora_modelo`**. Mas o código que monta os custom fields da Pessoa e do Deal no PipeRun não cobre esses nomes corretamente — por isso o PipeRun recebe só `"sim"` (ou `"Sim - Marca"` para impressora, mas nada de marca pro scanner).

### Bugs encontrados em `supabase/functions/_shared/piperun-field-map.ts`

**1. `buildPersonFormCustomFields` (Pessoa — campos 772727 Scanner / 772728 Impressora)**
- Linha 385: lê `lead.scanner_modelo` — **essa coluna não existe**. A coluna real é `scanner_marca`. Resultado: marca do scanner é sempre `null` e o campo da Pessoa vai apenas como `"sim"`.
- Linhas 385 e 398: sinônimos `["scanner_modelo","modelo_scanner","marca_scanner"]` e `["impressora_modelo","modelo_impressora","marca_impressora","printer_model"]` não cobrem `equip_scanner`, `como_digitaliza`, `equip_impressora`, `scanner_marca` — que são as chaves reais do `form_data` (Meta Lead Ads / formulários internos).
- Formato atual `"Sim — Marca"` polui o card da Pessoa. Para o campo da Pessoa, faz mais sentido enviar **só a marca/modelo** quando conhecido (e `"Sim"`/`"Não"` apenas quando não há marca).

**2. `mapAttendanceToDealCustomFields` (Deal — campos 1206/1207 Tem Scanner / Tem Impressora)**
- Linhas 1201-1204: scanner só envia o valor de `tem_scanner` (ex.: `"Sim"`), sem nunca concatenar a marca, mesmo quando `scanner_marca` está preenchido. Impressora já concatena `tem_impressora + impressora_modelo` (linhas 1205-1212), mas scanner não tem equivalente.
- `SYNONYMS` (linhas 1132-1140) não inclui `scanner_marca`, nem `equip_scanner`/`como_digitaliza`/`equip_impressora`.

### Evidência

Lead `Cristiano Braz` (form Meta "Impresoras - Smart Dent") tem em `form_data.raw_fields`:
```
tem_scanner: "sim", equip_scanner: "3shape", como_digitaliza: "3shape",
tem_impressora: "sim", impressora_modelo: "flashforge"
```
Coluna `impressora_modelo` foi promovida (`"flashforge"`), mas `scanner_marca` ficou `null`. Resultado no PipeRun: Pessoa recebe `"Sim"` para scanner e o Deal idem; impressora recebe `"Sim - Flashforge"` no Deal mas `"Sim"` na Pessoa (porque o Person mapper lê coluna inexistente `scanner_modelo` para scanner e, para impressora, hoje retorna `"Sim — flashforge"` em vez da marca limpa).

## Mudanças propostas (apenas `piperun-field-map.ts`)

### A. `buildPersonFormCustomFields`
- Trocar leitura `lead.scanner_modelo` → `lead.scanner_marca`.
- Expandir sinônimos do scanner: `scanner_marca, equip_scanner, como_digitaliza, scanner, marca_scanner, modelo_scanner`.
- Expandir sinônimos da impressora: `impressora_modelo, modelo_impressora, marca_impressora, equip_impressora, printer_model, impressora`.
- Novo formato dos valores enviados ao PipeRun (Pessoa):
  - Se marca/modelo conhecido → enviar **apenas a marca normalizada** (ex.: `"3Shape"`, `"Flashforge"`).
  - Senão, se `tem_scanner`/`tem_impressora` = `"sim"` → enviar `"Sim"`.
  - Senão, se `"não"` → enviar `"Não"`.
- Capitalização leve (primeira letra de cada palavra) para a marca, preservando termos já em CamelCase.

### B. `mapAttendanceToDealCustomFields`
- Adicionar `scanner_marca` ao bloco SYNONYMS: `["scanner_marca","equip_scanner","como_digitaliza","scanner_modelo","marca_scanner","modelo_scanner"]`.
- Adicionar `equip_impressora` aos sinônimos de `impressora_modelo`.
- Espelhar a lógica da impressora para o scanner (linhas 1201-1204):
  ```
  const scanner = resolve("tem_scanner");
  if (scanner) {
    const marca = resolve("scanner_marca");
    const v = marca && /^sim$/i.test(scanner.trim())
      ? `${humanizeValue(scanner)} - ${humanizeValue(marca)}`
      : humanizeValue(scanner);
    fields.push({ custom_field_id: DEAL_CUSTOM_FIELDS.TEM_SCANNER, value: v });
  }
  ```
- Adicionar `scanner_marca` como chave canônica em `SYNONYMS` para que `resolve("scanner_marca")` faça fallback no `form_data` quando a coluna ainda não tiver sido promovida.

### C. Backfill dos leads já criados
Após o deploy, rodar duas edge functions já existentes para reprocessar quem já tem `pessoa_piperun_id`/`piperun_id`:
1. `piperun-person-contact-backfill` (`{ days: 30, limit: 200 }`) — reenvia os 4 custom fields da Pessoa.
2. `smart-ops-piperun-backfill-customfields` (`{ dry_run: false, since: "30 days", limit: 300 }`) — reenvia custom fields do Deal e atualiza `lia_attendances.piperun_custom_fields`.

## Fora de escopo
- Não mexer em `dynamic-lead-ingestion` nem na promoção `form_data → scanner_marca` (já cobre `equip_scanner`/`como_digitaliza` via `lia-lead-extraction`; o fallback no mapper já resolve o gap).
- Sem mudanças de schema, RLS, grants, frontend ou outros endpoints.
- Sem mudança nos campos da Pessoa (IDs 772727/772728/673900/445631) nem nos IDs dos custom fields do Deal.

## Validação após implementação
1. `select` em `lia_attendances` de 1 lead recente com `equip_scanner` preenchido → conferir resolução pelo mapper (log `[mapAttendanceToDealCustomFields] fallback form_data → scanner_marca=...`).
2. Disparar `piperun-person-contact-backfill` para `lead_ids: ["27446c96-..."]` e conferir no PipeRun se o card da Pessoa mostra `"Flashforge"`/`"3Shape"` nos campos 772727/772728.
3. Conferir Deal correspondente: campo Tem Scanner = `"Sim - 3Shape"`, Tem Impressora = `"Sim - Flashforge"`.
