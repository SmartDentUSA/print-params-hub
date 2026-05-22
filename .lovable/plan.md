## Objetivo
Adicionar painel **🖨 Rayshape** ao detalhamento do lead no SmartOps, com status de recompra em tempo real (RPC `fn_rayshape_status` + Realtime), conforme arquivo enviado.

## Passos

**1. Copiar componente**
- `user-uploads://RayshapePanel.tsx` → `src/components/smartops/RayshapePanel.tsx` (sem alterações).

**2. Editar `src/components/smartops/LeadDetailPanel.tsx`**
- Importar: `import { RayshapePanel } from './RayshapePanel'`.
- Estender o tipo `TabKey` (linha 95) com `| "rayshape"`.
- Adicionar entrada na lista `TABS` (linha 97), logo após `cs` (a base de TABS não tem "copilot" — `cs` é a posição equivalente mais próxima de pós-venda):
  ```ts
  { key: "rayshape", label: "🖨 Rayshape" },
  ```
- Adicionar bloco de render após o último `activeTab ===` (depois do bloco `financeiro`, ~linha 1996):
  ```tsx
  {activeTab === "rayshape" && (
    <div className="tab-content">
      <RayshapePanel leadId={lead.id} />
    </div>
  )}
  ```

**3. Observações**
- Nada mais é alterado. Migration `fn_rayshape_status` e Realtime já estão no Supabase, conforme indicado.
- O painel já trata `has_printer: false` (lead sem Rayshape → tela vazia, sem erro).
- Limitação conhecida: leads sem `lead_id` vinculado no deal (ex.: registros só no Omie) não aparecerão com histórico — comportamento esperado.

## Detalhes técnicos
- `TABS` em `LeadDetailPanel.tsx` é um array simples `{key,label}[]` sem campo `icon`, então o emoji vai dentro de `label` (padrão existente).
- O componente usa `supabase` do `@/integrations/supabase/client` (mesmo alias do projeto) e `useEffect`/Realtime channel já configurados.
- `lead.id` (UUID de `lia_attendances`) é passado como `leadId` ao painel.
