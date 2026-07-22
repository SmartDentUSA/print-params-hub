---
name: Estagnados e CS - Regras de Reativacao por Formulario
description: Regras absolutas ao chegar novo formulario. VENDAS/CS intocaveis; Estagnados sempre fechado; CS ativo gera novo VENDAS
type: feature
---
Regras absolutas (smart-ops-lia-assign):
1. NUNCA tocar em deals abertos no Funil CS (CS_ONBOARDING / GANHOS_ALEATORIOS_CS).
2. NUNCA tocar (owner/stage) em deal aberto no Funil VENDAS. Enriquecimento de custom_fields permitido; criacao de duplicata proibida.
3. Novo formulario + deal em ESTAGNADOS -> SEMPRE fecha como Perdido motivo "Solicitou novo contato atraves de formularios" (LOST_REASON_NOVO_INTERESSE) e cria novo deal em VENDAS com round-robin fresco. Guard de intervencao do vendedor removido em jul/2026.
4. VENDAS aberto + Estagnados aberto coexistindo -> preserva VENDAS, fecha Estagnados como Perdido com o mesmo motivo.
5. CS aberto (sem VENDAS aberto) + novo formulario -> cria NOVO deal em VENDAS (bypass Golden Rule Primary e Won-Frozen). CS permanece intocado.

Ordem do decision tree: Won-Frozen (aplica so se csOpenDeals.length===0) -> vendaDeal preserve (+close estagnados) -> estagnDeal close+create -> csOpenDeals new VENDAS -> else new_deal com Golden Rule Primary.
