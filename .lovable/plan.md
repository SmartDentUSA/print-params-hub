# Por que o texto do "Único Glaze Opalescente..." está aparecendo em Cura profissional

## Diagnóstico (confirmado)

- O texto exibido em **Pós-impressão — Cura profissional** vem do campo `lia_attendances.equip_pos_impressao`.
- Ao consultar o banco, encontrei **10+ leads** com o mesmo valor literal armazenado nesse campo (ex.: `alexangelino@hotmail.com`, `gpandolfo@mac.com`, `drthiagocandidomariano@gmail.com` etc.):

  > "ÚNICO GLAZE OPALESCENTE DO MUNDO!!!Luz LED (1 minuto por fase)Luz Uv (2 minutos por Fase)Glaze Final: sob Luz UV até 48w mantenha por 10 minutos..."

- Esse valor entra via `_shared/piperun-field-map.ts` (`parsed.equipments.pos_impressao`) e `smart-ops-piperun-webhook/index.ts` (linha 1432). Origem provável: um custom field no PipeRun que armazena a **descrição marketing do produto GlazeON** em vez do modelo do equipamento de cura. Está sendo persistido cru em `equip_pos_impressao`.
- Quando o lead não tem `deal_items` nem pedidos, o fallback do `ProfessionalMixSummary` (adicionado recentemente) usa `equip_pos_impressao` como "equipamento de pós-impressão" e o `classifyEquipTable` joga na linha `cura_prof`, exibindo o texto inteiro.

Portanto o texto **não é uma classificação errada** — é lixo entrando pela integração PipeRun e sendo exibido fielmente.

## Plano de correção (3 camadas)

### 1) Sanitizer defensivo no front (MIX)
Em `src/components/smartops/ProfessionalMixSummary.tsx`, no bloco de fallback qualification (função `push` dentro do effect), rejeitar valores que claramente **não são modelo de equipamento**:
- comprimento > 80 caracteres, OU
- contém `\n`, OU
- contém `!!!`, OU
- casa `/(opalescente|glaze|mantenha por|cura final|luz uv|luz led|min(?:uto)s? por fase)/i`, OU
- possui mais que 8 palavras.

Aplicar a todos os `equip_*` (não só `pos_impressao`) para blindar contra reincidência em outras categorias.

### 2) Guard no ingest / mapping PipeRun
Em `supabase/functions/_shared/piperun-field-map.ts` e `smart-ops-piperun-webhook/index.ts`:
- Após `parsed.equipments.*` ser calculado, aplicar mesmo sanitizador (helper `isValidEquipmentLabel`) antes de gravar em `equip_scanner`, `equip_impressora`, `equip_pos_impressao`, `equip_cad`, `equip_fresadora`, `equip_notebook`.
- Se inválido → não sobrescrever coluna; logar `system_health_logs` (event `equip_field_rejected`) com `lead_id`, campo e trecho inicial.

### 3) Backfill único (limpeza histórica)
Migration one-shot (SQL) para zerar campos contaminados existentes:
```sql
UPDATE public.lia_attendances
SET equip_pos_impressao = NULL,
    equip_pos_impressao_serial = NULL
WHERE equip_pos_impressao ILIKE '%Opalescente do Mundo%'
   OR equip_pos_impressao ILIKE '%Mantenha por 10 minutos%'
   OR LENGTH(equip_pos_impressao) > 120;
```
(mesmo padrão para `equip_scanner`, `equip_impressora`, `equip_cad`, `equip_fresadora`, `equip_notebook` — apenas o filtro de LENGTH > 120, sem tocar em valores curtos legítimos)

## Detalhes técnicos

- Sanitizador central compartilhado: novo `supabase/functions/_shared/equipment-field-guard.ts` exportando `isValidEquipmentLabel(value: string): boolean` e `sanitizeEquipmentLabel(value)`. Front duplica a lógica em `src/utils/equipmentLabel.ts` (regra idêntica).
- Nenhum outro consumidor de `equip_*` precisa mudar: sanitizador roda **na escrita** (ingest) e **na leitura de fallback** (MIX).
- Não altero o parser do PipeRun em si — só o gate final antes do `update`.

## O que NÃO será alterado

- Regras de classify/EquipCat do MIX (já corretas).
- Fluxo de `deal_items` / Loja Integrada.
- Outras telas que leem `equip_*` (Ficha Profissional, Dra. LIA, tickets) — passam a ver `NULL` quando o valor era lixo, o que é o comportamento desejado.
