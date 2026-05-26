## Contexto

Você confirmou: `INO 200 - BLZ` **às vezes** embute Rayshape Edge Mini, não sempre. Logo não dá pra whitelistar o SKU. A regra fica: **toda proposta ganha que menciona explicitamente Edge Mini entra; combos sem menção entram apenas via marcação manual**.

Hoje `fn_rayshape_owners` tem 2 limitações:

1. **`DISTINCT ON (d.id)`** escolhe **uma única proposta por deal** (preferindo aprovada/maior valor) e depois filtra por Edge Mini nessa proposta. Se o Edge Mini está em outra proposta do mesmo deal (ex.: proposta v1 tinha Edge Mini, v2 aprovada só tem insumos), o deal é perdido.
2. Não há porta de entrada para os combos INO 200 que embutiram Rayshape sem desmembrar — operação fica sem ferramenta para corrigir caso a caso.

## Mudanças propostas

### 1. Reescrever `fn_rayshape_owners` (migration)

- Trocar `DISTINCT ON (d.id)` por varredura completa: para cada deal ganho, percorrer **todas as proposals × todos os items** e marcar o deal como "tem Edge Mini" se **qualquer** item bater `ILIKE '%Edge Mini%'`.
- `printer_date` = `deals.closed_at` (mais confiável que data da proposta).
- `printer_price` = soma dos `(item->>'total')` Edge Mini de **todas** as proposals do deal (evita duplo-conta usando o item key).
- Manter `DISTINCT ON (la.id)` por `closed_at ASC` para fixar a "primeira compra".

### 2. Nova tabela `rayshape_manual_owners` (migration)

```sql
CREATE TABLE public.rayshape_manual_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.lia_attendances(id) ON DELETE CASCADE,
  piperun_deal_id text,           -- opcional, vincula a um deal específico
  printer_date date NOT NULL,     -- data informada manualmente
  note text,                       -- ex.: "INO 200 + Edge Mini embutido (confirmado por Sicilia)"
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
```

Com GRANT para `authenticated`/`service_role` e RLS permitindo leitura a todos autenticados + INSERT/DELETE apenas para admins (`has_role(auth.uid(),'admin')`).

### 3. UNION na `fn_rayshape_owners`

Após calcular `printers` via proposta, fazer `UNION` com leads de `rayshape_manual_owners` (que ainda não estejam em `printers`). Esses leads aparecem com `vendor='manual'`, `printer_price=0`, `printer_deal_id=NULL`, e mesma lógica de categoria/recompra.

### 4. UI — `SmartOpsRayshape.tsx`

- Botão **"+ Adicionar manualmente"** abre dialog com busca de lead (autocomplete por nome/email/phone via `lia_attendances`), campo data e nota.
- Inserção via `supabase.from('rayshape_manual_owners').insert(...)` → realtime já dispara reload via canal `deals` (adiciono canal extra para a tabela nova).
- Badge "manual" na linha quando `vendor === 'manual'`.

### 5. Memória

Atualizar `mem://smart-ops/copilot-product-owners-tool` (ou criar `mem://smart-ops/rayshape-owners-matcher-v2`) com a regra final:
- Inclui automaticamente quem tem `%Edge Mini%` explícito em qualquer proposta de qualquer deal ganho.
- Combos `INO 200 - BLZ` **não** são incluídos automaticamente (regra de negócio: só às vezes embutem).
- Override manual via `rayshape_manual_owners` para casos confirmados pela operação.

## Detalhes técnicos

- Migration única cria a tabela + RLS + GRANTs + recria a função.
- Sem mudança em `deals`/`lia_attendances`.
- A função continua `SECURITY DEFINER STABLE` retornando `jsonb`.
- Realtime: adicionar `ALTER PUBLICATION supabase_realtime ADD TABLE rayshape_manual_owners;` e canal correspondente no componente.

## Perguntas pendentes (não bloqueiam o plano)

- Você quer que a UI já mostre uma seção separada listando os 141 deals "INO 200 sem Edge Mini explícito" como **candidatos** a triagem manual? (1 click = adicionar à `rayshape_manual_owners`). Se sim, adiciono isso na mesma PR.
