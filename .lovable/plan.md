## Objetivo
Adicionar **Rayshape** como nova seção no menu lateral do SmartOps (logo abaixo do Copilot), exibindo a lista de todos os donos de impressora Rayshape Edge Mini, com status de recompra. Aba dentro do lead continua existindo.

## Passos

**1. Nova migration: `fn_rayshape_owners()`**
- Função `SECURITY DEFINER` retornando `jsonb[]` (uma linha por lead canônico com Edge Mini).
- Filtros: `lia_attendances.merged_into IS NULL`, deals com `proposals::text ILIKE '%Edge Mini%'` e `is_deleted` falso.
- Campos por linha:
  - `lead_id`, `lead_name`, `lead_email`, `lead_phone`
  - `printer_date_iso`, `days_since`, `vendor`, `printer_price`
  - `n_post`, `total_post`, `first_repurchase_days`
  - `category` (`recomprou` | `critico` | `atencao` | `cedo`) — mesma regra do `fn_rayshape_status`
- `GRANT EXECUTE TO authenticated`.

**2. Novo componente `src/components/SmartOpsRayshape.tsx`**
- Chama `supabase.rpc('fn_rayshape_owners')` no mount.
- KPIs no topo: total de donos, % recompraram, ticket médio recompra, nº críticos.
- Tabela ordenável: Lead | Vendedor | Comprou em | Dias | Recompras | Total recompra | Status (badge colorido por `category`).
- Filtros: busca por nome + chips por categoria.
- Clicar na linha abre o lead (mesma navegação que `SmartOpsLeadsList` usa — abrir `LeadDetailPanel` em modal/drawer).
- Realtime: subscribe em `deals` (INSERT/UPDATE) e refaz o `rpc()` (debounced 1s).

**3. `src/components/AdminSidebar.tsx`**
- Importar `Printer` de `lucide-react`.
- Adicionar entrada logo após `so-copilot` (linha 92):
  ```ts
  { id: "so-rayshape", title: "Rayshape", icon: Printer },
  ```

**4. `src/pages/AdminViewSecure.tsx`**
- Importar `SmartOpsRayshape`.
- Adicionar case no `renderContent` switch:
  ```ts
  case 'so-rayshape': return <SmartOpsRayshape key={`rayshape-${refreshKey}`} />;
  ```

**5. Não mexer**
- `RayshapePanel.tsx` (já usado na aba do lead) permanece intacto.
- `LeadDetailPanel.tsx` permanece intacto — aba 🖨 Rayshape continua disponível dentro do lead.

## Detalhes técnicos
- `fn_rayshape_owners` reaproveita a lógica de detecção/categorização do `fn_rayshape_status`, mas em CTE única varrendo todos os leads (`JOIN lia_attendances la ON la.id = d.lead_id WHERE la.merged_into IS NULL`).
- Para abrir o lead a partir da tabela: `SmartOpsLeadsList` hoje gerencia o modal localmente; vamos replicar o mesmo padrão dentro de `SmartOpsRayshape` (state `selectedLeadId` + `<LeadDetailPanel>` em `<Dialog>`) — sem mudar roteamento global.
- Cores das badges usam tokens do design system (`bg-emerald-500/10`, `bg-red-500/10`, etc.) consistentes com o restante do SmartOps.
- Limitação: leads sem `lead_id` vinculado no deal (registros só no Omie) não aparecem — comportamento esperado.

## Arquivos
- `supabase/migrations/<timestamp>_fn_rayshape_owners.sql` (novo)
- `src/components/SmartOpsRayshape.tsx` (novo)
- `src/components/AdminSidebar.tsx` (1 import + 1 linha)
- `src/pages/AdminViewSecure.tsx` (1 import + 1 case)
