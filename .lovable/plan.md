## Objetivo

Em `Admin → Smart Ops → WhatsApp → Campanhas em Grupos`:

1. Ocultar do grid principal os grupos onde a instância NÃO é admin (sem régua/flow disponível para eles).
2. Permitir alcançar esses grupos apenas via o wizard de Blast pontual (segmentação) — onde aparecem listados, claramente marcados como "não admin", e habilitados apenas para envio único.
3. Permitir editar o nome das réguas compartilhadas no card "Réguas compartilhadas".

## Mudanças

### 1. `src/components/smartops/wa-groups/SmartOpsWaGroupCampaigns.tsx`

- No `filtered` (memo do grid), adicionar `r.is_admin` ao filtro — grupos não-admin somem do grid principal.
- Recalcular `enabledCount` / `disabledCount` / contador "X grupos" considerando apenas admin (a métrica `adminCount` continua exibida no header).
- Adicionar botão no header: **"Blast pontual (wizard)"** que abre um novo modal de segmentação listando TODOS os grupos sincronizados (admin e não-admin), com badge "não admin" e tooltip "Apenas envio único; régua exige admin".
- No card de Réguas compartilhadas: adicionar botão lápis ao lado do nome que abre um pequeno Dialog (`Input` + Salvar) fazendo `update wa_campaigns set name where id=...`, refazendo `fetchShared` após sucesso.

### 2. `src/components/smartops/wa-groups/WaGroupBlastModal.tsx`

- Aceitar prop opcional `pickerMode` (default `false`). Quando `true`, renderiza um passo inicial de segmentação:
  - Lista de grupos (reaproveita `WaGroupMultiSelect` sem filtro de admin) com busca por nome, filtro por instância e checkboxes.
  - Mostra badge "não admin" nos grupos sem admin; ainda assim selecionáveis (Evolution permite enviar mensagem em grupo do qual a instância participa mesmo sem ser admin).
  - Após escolher os grupos, segue para o passo atual (tipo/mídia/agendamento).
- O caminho existente "Selecionar grupos → Blast pontual" no rodapé continua funcionando com `pickerMode=false` e `selectedGroupJids` pré-definidos.

### 3. `src/components/smartops/wa-groups/WaGroupMultiSelect.tsx`

- Adicionar prop opcional `includeNonAdmin?: boolean` (default `false`) para que, no novo wizard, a lista mostre grupos não-admin com badge visual.

### Sem mudanças de banco

Não há migrations. Política: réguas/flow continuam restritos a grupos admin; blast pontual (uma mensagem por vez) é liberado para qualquer grupo onde a instância participa.

## Validação

- Grid principal não mostra cards com badge "Não admin".
- Contadores no header e nos abas Ativados/Desativados refletem apenas admins.
- Botão "Blast pontual (wizard)" abre modal que lista admins + não-admins, envia para selecionados via `wa-group-blast` (já existente).
- Editar nome de régua compartilhada persiste e atualiza imediatamente.
