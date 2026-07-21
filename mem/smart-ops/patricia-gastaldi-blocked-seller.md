---
name: Patricia Gastaldi active seller
description: Owner 47675 (Patricia Gastaldi) voltou ao round-robin de vendas como vendedora ativa
type: feature
---
- `team_members.piperun_owner_id = 47675` (Patricia Gastaldi) está `ativo=true` e `role='vendedor'` → entra normalmente em `pickRandomActiveVendedor` (`smart-ops-lia-assign/index.ts` L1174-1202).
- `BLOCKED_SELLER_OWNER_IDS` e `BLOCKED_SELLER_NAME_PATTERNS` estão VAZIOS no código (L1215-1216). Fonte única de verdade = `team_members(ativo, role)`. Não readicionar hardcode do owner 47675.
- WhatsApp comercial dela: `+5516981596947` (registrado em `team_members.whatsapp_number`). O número antigo `5516981158403` era da era `lia_comms` e não é mais o WA de vendas dela.
- Pendências operacionais (não são bloqueio de sorteio, mas quebram disparo pós-atribuição): `evolution_instance_name` está com placeholder `'p'`, sem `evolution_api_key`/`evolution_phone`/`evolution_lid`. Preencher credenciais reais da instância Evolution dela antes de esperar mensagens automáticas de saudação.
- **Why**: A regra antiga (bloqueio duro do owner 47675) foi revertida em 2026-07 quando Patricia voltou ao time de vendas. Manter memória atualizada evita reintroduzir o bloqueio ao ver referências antigas.
