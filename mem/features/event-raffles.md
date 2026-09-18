---
name: Sorteios de eventos
description: Sorteio de brindes por evento — prêmios, período, regras, formulário próprio, pesos, sorteio auditável e aviso no WhatsApp (ganhador + grupo)
type: feature
---

Editor de eventos → seção **Sorteios** (`EventRafflesPanel.tsx`, aparece só depois que o evento já foi salvo).

Tabelas: `event_raffles` (1 por evento no MVP), `event_raffle_entries`, `event_raffle_draws`.
RPC pública: `fn_public_raffle(p_slug)` (SECURITY DEFINER) — devolve sorteio ativo, prêmios, campos do formulário, regras, ganhadores (só se `public_results`) e consultores do estande (via `smartops_forms.event_consultant_ids`).

Página pública: `/sorteio/:slug` (`PublicRaffle.tsx`).

Edge functions:
- `smart-ops-raffle-entry` (verify_jwt=false) — valida período, aceite, contato, consultor e dedupe por telefone; calcula `tickets` pelos pesos; grava a participação e encaminha ao `smart-ops-ingest-lead` com `form_name = "# - [SORTEIO] - <nome>"`, `form_purpose = feira_evento`, `event_id` e o consultor do estande como dono do lead (mesma regra dos formulários de Feiras e Eventos).
- `smart-ops-raffle-draw` — sorteio ponderado por `tickets` com `crypto.getRandomValues`, exclui quem já ganhou, respeita `quantity` do prêmio, grava em `event_raffle_draws` e notifica: ganhador via `smart-ops-wa-send` e grupo via `wa-group-blast` (grupo e instância escolhidos no editor). Variáveis das mensagens: `{ganhador}`, `{premio}`, `{sorteio}`, `{participantes}`.

Regras de elegibilidade configuráveis: aceite das regras, contato válido, visita ao estande (consultor), compra no período, uma participação por pessoa. Pesos por ação (cadastro, visita, demonstração, compra, indicação) definem quantos cupons a pessoa tem no sorteio.
