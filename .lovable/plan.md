## Erro gravíssimo: lead-agregador "CTRO" concentra 486 deals de 1 empresa real

### Diagnóstico técnico

Lead `b5494221-…` ("CTRO", `piperun_id=61809184`) hoje aparece com **600 deals / R$2,4M / 19 vendedores diferentes** no card. A investigação mostra:

- `deals` desta lead: **486 linhas**, todas apontando para **1 único** `person_id` (`87ae79d5…`) e **1 único** `company_id` (`1fc0f73f…` = **PROTESE DENTARIA ELTON HELVIG LTDA**, CNPJ 93.385.995/0001-37).
- O `lia_attendances` correspondente tem `nome='CTRO'`, `email='e-mail não informado'`, `telefone_normalized=+5548999296564`, mas `raw_payload.latest_payload` é de **Igor Peixoto de Mello** (telefone 5582996022004, e‑mail `igor.peixoto@yahoo.com.br`), e `alternate_emails` inclui `lourivall@hotmail.com`. Ou seja, o mesmo registro acumulou identidades de pelo menos 3 pessoas distintas.
- Existem **481 leads com nome-lixo** (`CTRO`, `CT`, `Cliente`, `Nome não informado`, etc.). Outros leads também estão inflados (ex.: `2b3d6f4c…` = "Nome não informado" com **193 deals**; `c8fc74f6…` = 94 deals; `d7f6fc7b…` = 92 deals).

Ou seja: temos **2 problemas independentes** que se combinam para produzir o card monstruoso:

1. **Regra de merge por chave frágil.** O merge está juntando leads distintos por `piperun_person_id`/`piperun_company_id` (ou por nome placeholder como "CTRO"), fazendo com que múltiplas pessoas físicas do mesmo CNPJ virem 1 só lead. No caso da Elton Helvig, é uma clínica com recompra real (486 pedidos em 4 anos), mas os identificadores do lead (nome, email, phone) foram sobrescritos por qualquer form novo que caiu com esse `person_id`.
2. **Enrichment sem `origin frozen`.** `nome/email/telefone` continuam sendo sobrescritos por payloads posteriores mesmo quando divergem, produzindo o mix "CTRO + Igor + lourivall + fone SC".

### Plano de ação

**Fase 1 — Congelar dano (imediato, sem tocar UI)**
- Auditar em `lead_enrichment_audit` quais campos foram sobrescritos em `b5494221-…` e nos outros top‑ofensores (`2b3d6f4c`, `c8fc74f6`, `d7f6fc7b`, `2cf598a1`).
- Publicar view `v_leads_suspeitos_agregacao` que sinaliza qualquer lead onde: `count(distinct deals.owner_name) > 3` E `count(distinct raw_payload.form_submissions.submitted_via_email) > 1` E (`nome` em lista de placeholders OU `email` LIKE '%placeholder%|não informado').

**Fase 2 — Corrigir o caso Elton Helvig**
- Restaurar identidade real do lead `b5494221-…`: pegar do PipeRun Person `#20540207` (dono do deal 61809184) e da Company `#11737184` os valores canônicos (nome pessoa, email, telefone, cidade, uf) e sobrescrever `lia_attendances`. Se a Person do PipeRun estiver vazia, promover para nome da razão social ("PROTESE DENTARIA ELTON HELVIG") e email institucional.
- **Não** dividir os 486 deals: eles pertencem realmente a essa empresa. A agregação por CNPJ está correta; o que estava errado era o rótulo humano do card.
- Registrar audit `source_priority=99, reason='canonical_identity_restore_from_piperun_person'`.

**Fase 3 — Fechar o vazamento no enrichment (`updatePersonFields` / lia‑assign)**
- Adicionar guard: se `raw_payload.latest_payload.email/phone/nome` **não bate** com o `piperun_person_id` atual do lead (via cache `companies`/futuro `persons`), o payload vira **novo lead** em vez de sobrescrever o existente. Regra: `piperun_id` do lead é imutável uma vez setado; email/telefone só podem ser atualizados se `alternate_emails` já contém ou se `origem_primeiro_contato` autorizar.
- Complementa `mem://architecture/person-origin-and-company-name-detection` — hoje protege origin, mas não nome/email/phone.

**Fase 4 — Backfill dos demais leads‑agregadores**
- Rodar Edge Function `smart-ops-lead-canonicalizer` (nova) sobre os N leads com `count(deals)>30 AND nome IN placeholders`. Para cada um: puxar Person/Company real do PipeRun via `piperun_id` e reescrever identidade.
- Não mexer em deals; apenas re‑rotular o container.

**Fase 5 — UI (`SmartOpsRayshape` e Lead Card)**
- Nenhuma alteração de negócio. Apenas exibir warning no header do card quando `v_leads_suspeitos_agregacao` sinalizar o lead, para que o time comercial veja "este cartão foi corrigido em <data>".

### O que NÃO fazer
- Não deletar deals — R$2,4M são reais da Elton Helvig.
- Não fazer split automático de deals por vendedor: 19 vendedores é normal em 4 anos de conta B2B.
- Não tocar em `fn_rayshape_owners` (agora está correto ao mostrar 1 dono para 1 CNPJ).

### Detalhes técnicos (para revisão)
- Tabelas: `lia_attendances`, `deals`, `companies`, `lead_enrichment_audit`.
- Edge functions envolvidas: `smart-ops-lia-assign` (guard novo), `piperun-webhook` (guard novo), `smart-ops-lead-canonicalizer` (nova).
- Migrations: 1 view + 1 índice em `deals(lead_id)` (já existe? verificar) + 1 função SQL de canonicalização.
- Nenhum breaking change no card / KPIs.

Confirma que sigo por essa ordem? Posso já começar pela **Fase 2 (caso Elton Helvig)** para você validar o card corrigido antes de sair fazendo backfill dos outros 480 casos.