# Espelho local de Pessoas/Empresas PipeRun

**Contexto.** O CSV `pessoas-21-07-2026.csv` tem **53.720 pessoas** com Pessoa+Empresa+CFs (Área, Especialidade, Scanner, Impressora, ID Banco de Dados). Hoje, cada lead novo consulta a API PipeRun (`findPersonByContact`) por email/phone — funciona, mas: (1) custa round-trips, (2) sofre com o "silent reject" de emails/phones já usados por outra Pessoa, (3) não cobre casos onde a Pessoa existe no CRM mas o email/phone no lead novo é diferente (mesmo nome/CNPJ). Ter espelho local resolve tudo isso.

## Sim, é ideal — proposta em 4 partes

### 1. Tabela espelho `piperun_persons_mirror`
Colunas relevantes do CSV (mínimo viável):
- `piperun_person_id` (PK), `nome`, `cpf`, `email`, `email_normalized`, `telefone`, `telefone_principal`, `phone_digits` (últimos 10-11), `cargo`, `cliente_desde`, `data_cadastro`, `tags`, `origem_dados`
- Empresa vinculada: `piperun_company_id`, `empresa_nome`, `empresa_razao_social`, `empresa_cnpj`, `empresa_cnpj_digits`, `empresa_cidade`, `empresa_uf`
- CFs de qualificação: `area_atuacao`, `especialidade`, `scanner_form`, `impressora_form`, `tem_scanner`, `tem_impressora`
- `lia_attendance_id` (FK opcional para lead canônico já linkado)
- `raw` JSONB (linha original inteira para auditoria)
- Índices: `email_normalized`, `phone_digits`, `empresa_cnpj_digits`, `piperun_person_id`

Mesmo padrão para `piperun_companies_mirror` (dedupe por `cnpj_digits` + `nome_normalized`).

### 2. Ingestão do CSV
- Import via `supabase--insert` em batches (COPY-style, ~5k linhas por batch).
- Normalização em SQL: `lower(trim(email))`, `regexp_replace(telefone, '[^0-9]', '')`, canonicalização de Área/Especialidade/Scanner/Impressora usando os mesmos dicionários que já estão no `_shared/dental-taxonomy.ts`.
- Backfill de `lia_attendance_id` casando por `pessoa_piperun_id` já existente em `lia_attendances`.

### 3. Uso no fluxo de ingestão (dedupe pré-API)
Alterar `_shared/piperun-person-resolver.ts → findPersonByContact` para cascade local-first:
1. `email_normalized` no mirror → retorna `piperun_person_id` sem API.
2. `phone_digits` (últimos 10) no mirror → idem.
3. Fallback: `cpf` (se lead tiver) → idem.
4. Só chama API PipeRun se mirror não achou.

Ganho: elimina ~90% dos GETs por lead reprocessado e evita 100% dos "silent reject" onde a Pessoa já existe com aquele email/phone.

### 4. Enriquecimento reverso (opcional, aprovação separada)
Depois do dedupe, para leads sem `piperun_id` cujo nome+CNPJ (ou nome+cidade) casa com pessoa do mirror: linkar `pessoa_piperun_id` direto no `lia_attendances` sem re-criar Pessoa. Isso resolve o caso "lead chegou por email novo mas é o mesmo dentista que já existe no CRM".

## Sincronização contínua
Duas opções (escolher depois):
- **A. Refresh diário/semanal:** subir CSV atualizado + `INSERT ... ON CONFLICT (piperun_person_id) DO UPDATE`.
- **B. Webhook PipeRun (`persons.updated`):** já temos `piperun-webhook`; adiciono handler que faz upsert no mirror em tempo real. Mais robusto, mas exige config no PipeRun.

## Não altera
- Golden Rule, CommercialIntentGuard, VENDAS pipeline.
- `lia_attendances` schema (mirror é tabela nova, só adiciono FK opcional).
- Fluxo de criação de Deal (apenas o **lookup de Pessoa** ganha camada local).
- Canonicalização de taxonomia (usa a que já existe).

## Entregáveis
1. Migration: `piperun_persons_mirror` + `piperun_companies_mirror` com índices, GRANTs, RLS (service_role only).
2. Import SQL do CSV (via `supabase--insert` em batches).
3. Patch em `_shared/piperun-person-resolver.ts`: lookup local antes da API.
4. Relatório: pessoas importadas, quantas linkaram com `lia_attendances` existentes, quantos leads órfãos passariam a linkar automaticamente.

## Perguntas antes de executar
1. Confirma criar as tabelas `piperun_persons_mirror` + `piperun_companies_mirror` no schema `public`?
2. Quer que eu já plugue o lookup local no `findPersonByContact` nesta rodada, ou primeiro só importa e valida os matches num relatório?
3. Sincronização: começamos com refresh manual (CSV) e depois migramos para webhook, ou já configura webhook agora?
