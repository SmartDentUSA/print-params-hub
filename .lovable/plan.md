## Objetivo

Remover **Patricia Gastaldi (piperun_owner_id `47675`)** do pool de vendedores. Seu WhatsApp (`5516981158403`) continua ativo, mas será usado apenas para:
- Comunicação interna da Dra. L.I.A. com a equipe
- Reativações orquestradas pelo Copilot

Sempre que um lead chegar com `proprietario_lead_crm = "Patricia Gastaldi"` (ou owner_id `47675` no PipeRun), ele deve ser **redirecionado para o funil "Distribuidor de Leads" → etapa "Distribuidor de leads"**, sem owner_id de vendedor.

---

## Mudanças

### 1. Banco — `team_members`
Migration única atualizando o registro existente (`Patrica Silva`, id `a49ade61-3671-4bab-982e-443f026422f7`, `piperun_owner_id=47675`):

- `role` → `lia_comms` (novo papel, fora de qualquer query `role='vendedor'`)
- `nome_completo` → `Patricia Gastaldi` (corrige o typo)
- `ativo` → permanece `true` (WhatsApp segue disponível para LIA/Copilot)
- `whatsapp_number` preservado (`5516981158403`)

Resultado: `pickRandomActiveVendedor` (que filtra `role='vendedor'`) deixa de sortear Patricia automaticamente, sem outras alterações nessa função.

### 2. Edge function — `supabase/functions/smart-ops-lia-assign/index.ts`

Adicionar uma constante e uma guarda de roteamento:

```ts
const BLOCKED_SELLER_OWNER_IDS = new Set<number>([47675]); // Patricia Gastaldi → LIA/Copilot only
```

Onde hoje resolvemos `assignedOwnerId` (linhas ~1581-1608):

- Se `currentOwner.piperun_owner_id ∈ BLOCKED_SELLER_OWNER_IDS` **ou** `proprietario_lead_crm` casar com "Patricia Gastaldi", **ignorar** o owner atual e ir direto para `FALLBACK_OWNER_ID` (Distribuidor) — não chamar `pickRandomActiveVendedor` (evita sortear outro vendedor "no lugar dela", já que o objetivo é triagem manual no Distribuidor).
- Logar `[lia-assign] Owner Patricia Gastaldi bloqueado → roteando para Distribuidor de Leads`.

Como `isDistribuidor = assignedOwnerId === FALLBACK_OWNER_ID` já existe (linha 1611), o pipeline/stage automaticamente vira `PIPELINES.DISTRIBUIDOR_LEADS` + `STAGES_DISTRIBUIDOR.DISTRIBUIDOR_DE_LEADS`, e a label `piperun_funil` vira `"Distribuidor de Leads"` / `piperun_etapa` vira `"distribuidor_leads"` (linhas 1865-1866). Nenhuma mudança extra precisa ser feita no payload de PipeRun — `owner_id` passa a ser o do distribuidor (Thiago Nicoletti) e o deal é criado/movido no funil correto.

### 3. Edge function — `supabase/functions/_shared/piperun-field-map.ts`

Não remover Patricia de `PIPERUN_USERS` (precisamos manter o nome para histórico/lookup de deals antigos), mas adicionar comentário inline:

```ts
47675: { name: "Patricia Gastaldi", email: "...", role: "lia_comms", cellphone: "5516981158403" }, // NÃO sortear como vendedora — uso interno LIA/Copilot
```

### 4. Memória de projeto

Atualizar `mem://index.md` com a regra Core:

> **Patricia Gastaldi (owner 47675)** não é vendedora. Leads com este owner são redirecionados para Distribuidor de Leads. WhatsApp `5516981158403` reservado para LIA inbound/team comms e reativações do Copilot.

E criar `mem://smart-ops/patricia-gastaldi-lia-comms.md` documentando a guarda.

---

## O que NÃO muda

- `pickRandomActiveVendedor` — continua filtrando `role='vendedor'`, e como Patricia agora é `role='lia_comms'`, sai naturalmente do round-robin.
- Componentes da equipe no frontend (`SmartOpsTeam`) seguem mostrando Patricia, apenas com badge/role diferente — nenhuma alteração de UI necessária para essa request.
- Deals históricos de Patricia no PipeRun não são reatribuídos retroativamente. A guarda só atua em **novos roteamentos** via lia-assign. Se quiser reatribuição em massa dos deals legados dela no funil de Vendas, é um passo separado.

---

## Aprovação

Posso seguir com a migration + edits acima?
