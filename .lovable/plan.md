
## Diagnóstico

Rodei `fn_rayshape_owners()` no banco: **122 separado / 1 combo**. A regra atual só marca combo quando o item literalmente contém "scanner intraoral" ou uma marca conhecida (medit, itero, trios, i700 via aoralscan, etc.). Isso deixa de fora os bundles comerciais da Smart Dent que **já embutem** um scanner intraoral mas não citam a palavra no nome do item:

- `INO 200 - BLZ` — chairside completo (impressora + scanner + pós-cura + notebook)
- `KIT CHAIRSIDE` — mesmo conceito

Aparecem repetidamente ao lado de "RayShape - Edge Mini" em propostas ganhas (Clinica Kignel, REJANE, Cibely Cândido, CAJU Odontologia, etc.) e hoje caem como "separado".

Sobre o lead destacado **DENIZE PIMENTA REZENDE VASCONCELLOS**:
- `piperun_id=61809184`, telefone `+5548999296564`, 51 deals ganhos, R$362k LTV — é um cliente real.
- O campo `email` está literalmente com a string `e-mail não informado` (não é `NULL`). É lixo vindo do CSV/PipeRun.
- Existem **2.680 leads** com esse mesmo padrão de placeholder em `lia_attendances.email` (`e-mail não informado`, `não informado%`, `%placeholder%`).

## Escopo do plano

### 1. Regra de combo — incluir bundles Smart Dent

Migração em `fn_rayshape_owners()`: no CTE `deal_edge`, expandir a condição de combo para aceitar OU um scanner intraoral OU um bundle chairside no mesmo `prop->'items'` da Edge Mini:

```
EXISTS (item Edge Mini)
AND (
  EXISTS (item ~* '(scanner\s*intraoral|intraoral|medit|itero|trios|primescan|aoralscan|shining|helios|panda\s*p|runyes|launca|freedom|carestream\s*cs\s*3|3shape|emerald|i700)')
  OR EXISTS (item ~* '(\yINO\s*200\y|kit\s*chairside)')
)
```

Justificativa: o usuário definiu combo como "proposta que contém scanner intraoral". INO 200 e KIT CHAIRSIDE são SKUs que **incluem** o scanner intraoral no pacote, mesmo sem citar a palavra. Verificado nas propostas ganhas.

Sem outras mudanças na função: thresholds, escopo (só `status='ganha'` + `is_deleted=false`), manual owners, KPIs de recompra e ordenação permanecem.

### 2. Sanitizar e-mails placeholder

`UPDATE lia_attendances SET email = NULL WHERE email ILIKE 'e-mail não informado%' OR email ILIKE 'não informado%' OR email ILIKE '%@import.placeholder%';`

Afeta ~2.680 linhas. Com isso a UI mostra "—" em vez de texto ruído e evita que o `email` placeholder seja usado como identidade em merges/CRM. Nenhum lead perde identidade (todos têm `piperun_id` e/ou telefone).

Também protege o formulário de "Adicionar dono manual": hoje a busca por e-mail retornaria a string placeholder e poderia confundir o operador.

## Fora do escopo

- Não mexer em thresholds (Crítico ≥180d etc.), na definição de `status='ganha'`, em manual owners, na função `fn_rayshape_status`, nem em nenhuma outra tela.
- Não alterar o processo de ingestão que grava esse placeholder (isso fica para outro plano — aqui só limpo o histórico).

## Detalhes técnicos

- **Migração SQL 1**: `CREATE OR REPLACE FUNCTION public.fn_rayshape_owners()` com o novo predicado combo. Corpo idêntico ao atual exceto pelo `OR EXISTS` adicional.
- **Data-fix (via insert tool, não migração)**: `UPDATE lia_attendances SET email = NULL, updated_at = now() WHERE email ILIKE 'e-mail não informado%' OR email ILIKE 'não informado%' OR email ILIKE '%@import.placeholder%';`
- Sem mudanças em código frontend — `SmartOpsRayshape.tsx` já lê `sale_kind`, `recompra_combo_brl`, `recompra_separado_brl` e trata `lead_email` nulo.

## Validação

Após aplicar:
1. `SELECT count(*) filter (where row->>'sale_kind'='combo') FROM jsonb_array_elements(fn_rayshape_owners()) row;` — esperado subir de 1 para ~10–15.
2. Checar que Clinica Kignel, REJANE, CAJU Odontologia, Cibely Cândido migram para "combo".
3. Recarregar o card de DENIZE — coluna e-mail passa a mostrar "—".
