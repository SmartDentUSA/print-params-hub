# Diagnóstico — CSV `oportunidades-11-05-2026`

## O que o CSV revela

- **67 deals no total**, **63 criados hoje (11/05/2026)**.
- **Todos** têm `ID (Pessoa)` preenchido (não há deal "órfão" sem Person).
- **62 dos 63 Persons foram criados hoje** (apenas 1 reaproveitou Person antigo: Luiz Carlos / pessoa 18795614).
- **Origem dos 63**: 47 = `# - Impressoras - Smart Dent` (Meta) | **20 = `Dra. L.I.A.`** (chat — não-comercial, mesmo padrão do caso Bruna Mascarenhas).
- **Quase todos os Persons criados hoje têm `E-mail (Pessoa)` E `Telefone Principal (Pessoa)` VAZIOS** — só com nome.
- **Duplicata real detectada no mesmo minuto**: `Watillas T. Santos` aparece 2x (deals 59696290 e 59696291, persons 46857333 e 46857336). Sem email/phone, dedup é impossível.

## Os 3 problemas que quebraram a dedup

### 1. Persons criados sem email **e** sem telefone (dedup ghost)
`createPerson` em `smart-ops-lia-assign` só anexa `emails`/`phones` quando o lead tem esses campos populados. O retry-cron arrastou leads com identificadores ausentes → criou Persons "fantasma" no PipeRun (só nome). Esses Persons:
- nunca darão match em `findPersonByEmail` futuro,
- causam duplicação infinita a cada novo contato do mesmo dentista,
- contaminam a base PipeRun permanentemente.

**Regra violada**: `Identity & Merging: piperun_id > email > phone` — sem email/phone, não há identidade resolvível.

### 2. 20 deals de `Dra. L.I.A.` foram criados apesar do Commercial Intent Guard
Estes deals foram criados **hoje** — provavelmente **antes** do guard (`_shared/commercial-intent.ts`) ter sido efetivamente implantado, ou pelo retry-cron rodando com lista cacheada. Precisa-se confirmar se o guard está ativo em produção e se filtra a origem literal `Dra. L.I.A.` (canal de chat, não formulário).

### 3. Duplicata exata Watillas T. Santos
Dois Persons distintos para o mesmo nome no mesmo minuto. Sem email/phone, o `findPersonByEmail` retorna null e cai sempre em `createPerson`. Precisa de uma trava por **nome normalizado + janela de tempo** (debounce) ou recusa total a criar Person sem nenhum identificador.

---

## Plano de Ação

### Fase 1 — Bloqueio em produção (impedir mais contaminação)

**1.1 — Hard-gate em `createPerson` (`smart-ops-lia-assign/index.ts`)**
Recusar criação se o lead não tiver `email` **nem** `telefone_normalized/raw`. Marcar `crm_creation_blocked = true` com motivo `missing_identifiers`. Logar em `system_health_logs`.

**1.2 — Reforçar Commercial Intent Guard**
- Adicionar `Dra. L.I.A.` (literal) e variações (`dra. l.i.a.`, `lia`, `chat_lia`) à blacklist em `_shared/commercial-intent.ts`.
- Garantir que `smart-ops-lia-assign` chama `evaluateCommercialIntent` **antes** de qualquer chamada PipeRun (não só após o canonical-hop).
- Validar que o retry-cron está deployado com a versão nova (checar logs de hoje).

**1.3 — Debounce de Person por nome**
Antes de `createPerson`, consultar Supabase: existe outro lead com `nome` normalizado idêntico criado nos últimos 60s **na mesma origem**? Se sim, abortar com `409 person_debounce`.

### Fase 2 — Reparo retroativo

**2.1 — Identificar deals contaminados hoje**
Query: `lia_attendances.piperun_deal_id IN (lista dos 63)` + cruzar com origem não-comercial OU sem identificadores. Estimar 20+ deals (`Dra. L.I.A.`) + N deals Meta sem email/phone.

**2.2 — Migration de reparo**
- Para deals `Dra. L.I.A.`: limpar `piperun_id`/`piperun_deal_id` no Supabase, marcar `crm_creation_blocked`, mover IDs para `raw_payload.orphan_piperun_deal_id`.
- Para deals Meta sem email/phone: mesmo tratamento (ghost persons).
- Listar todos os Person IDs e Deal IDs órfãos para deleção manual no PipeRun.

**2.3 — Resolver a duplicata Watillas T. Santos**
Decidir qual Person manter (preferir o mais antigo: 46857333 / deal 59696290) e marcar o outro para deleção.

### Fase 3 — Auditoria & observabilidade

**3.1 — Dashboard de saúde do PipeRun sync**
Card no /admin: "Persons criados nas últimas 24h sem email/phone", "Deals criados a partir de origem não-comercial", "Duplicatas detectadas por nome".

**3.2 — Memory update**
Acrescentar regra core ao `mem://index.md`:
> **Person Creation Integrity**: NUNCA criar Person no PipeRun sem `email` OU `phone`. Sem identificador → marcar `crm_creation_blocked='missing_identifiers'`.

---

## Detalhes técnicos (referência)

**Arquivos a editar**:
- `supabase/functions/smart-ops-lia-assign/index.ts` — gate em `createPerson`, debounce por nome.
- `supabase/functions/_shared/commercial-intent.ts` — adicionar `Dra. L.I.A.` à blacklist literal.
- `supabase/functions/smart-ops-piperun-retry-failed-leads/index.ts` — re-validar deploy.
- Nova migration: limpar contaminação 11/05.
- `mem://index.md` + novo `mem://architecture/person-creation-integrity.md`.

**Perguntas para você confirmar antes de implementar**:
1. **Quero rodar a query exata** (Supabase `lia_attendances` filtrado por `piperun_deal_id` ∈ lista do CSV) **antes** de escrever a migration de reparo, pra te mostrar a contagem real de leads afetados? **(recomendo sim)**
2. **Os 20 deals `Dra. L.I.A.`** devem ser todos limpos, ou existem alguns que viraram conversa comercial real e devem ser preservados? **(default: limpar todos, marcar `commercial_override` apenas se você sinalizar manualmente)**
3. **Reparo no PipeRun**: gero a lista de Deal IDs + Person IDs pra você apagar manualmente, ou quer que eu chame a API PipeRun para arquivar/deletar? **(default: lista manual, mais seguro)**
