## Auditoria do painel Rayshape Edge Mini vs. CSV do PipeRun

CSV enviado (funil **CS Onboarding**) contém **140** oportunidades ganhas com item "RayShape - Edge Mini". A base atual do painel tem 118 linhas / 129 deals com Edge Mini ganha.

### Discrepâncias encontradas
| Categoria | Qtde | Ação |
|---|---|---|
| Deals do CRM **ausentes** no CDP (`deals`) | **19** | Enriquecer via `rayshape_manual_owners` + `lia_attendances` |
| Bucket **"Peru"** (3 deals colapsados em 1 lead genérico) | 3 | Desmembrar em 3 leads reais |
| Deals com `closed_at IS NULL` (Lilian, Gabriela Cé) | 2 | Corrigir onde houver data no CRM |
| Leads com e-mail **placeholder** (`@import.placeholder`, `@placeholder.local`) | 5 | Preencher nome/e-mail/telefone/CNPJ reais |

### Match preliminar dos 19 ausentes com `lia_attendances`
- 7 já existem por **CNPJ** (empresas)
- 11 já existem por **e-mail** (pessoas)
- Restantes: criar novo lead mínimo

---

## Plano de enriquecimento (Supabase apenas — PipeRun intocado)

### 1. Backfill dos 19 deals Edge Mini ganhos ausentes
Para cada linha (dados do CSV):
1. Buscar `lia_attendances` por CNPJ normalizado → depois por e-mail → depois por telefone_normalized.
2. Se achar lead canônico (`merged_into IS NULL`):
   - `UPDATE lia_attendances` preenchendo somente colunas vazias: `nome`, `email`, `telefone_normalized`, `empresa_cnpj`, `empresa_cidade`, `empresa_uf`, `cpf` (nunca sobrescreve valor existente — usa `COALESCE(NULLIF(col,''),?)`).
   - `INSERT INTO rayshape_manual_owners (lead_id, piperun_deal_id, printer_date, note)` — nota "Enriquecido do CSV PipeRun 13/07/2026".
3. Se não achar:
   - `INSERT INTO lia_attendances` com os campos mínimos + `origem_primeiro_contato='piperun_backfill_edge_mini'`, `crm_creation_blocked='backfill_manual'` (não cria pessoa no CRM).
   - Depois inserir em `rayshape_manual_owners`.

### 2. Desmembrar bucket "Peru"
Os 3 deals do lead genérico "Peru / e-mail não informado" pertencem a empresas reais:
- `59311370` → COELHO E VILAROUCA LTDA (CNPJ 30.486.607/0001-94, Teixeira de Freitas/BA)
- `59923317` → AG ODONTOLOGIA ESPECIALIZADA LTDA (CNPJ 52.917.447/0001-23, Fundão/ES)
- `60045277` → OPTICAL CURSOS LIMITADA (CNPJ 52.368.530/0001-90, Salvador/BA)

Ação: criar 3 novos leads + registrar em `rayshape_manual_owners`. Adicionar filtro `WHERE la.email <> 'e-mail não informado' AND la.nome NOT ILIKE 'Peru'` na CTE `printers_auto` do RPC `fn_rayshape_owners` (migration à parte) para o bucket sumir do painel sem apagar histórico.

### 3. Backfill de `closed_at`
- Deal `2z4knzjpsq75x24bdu7v5qfz8o5na2y` (Gabriela Cé) — CSV traz `51852538` com data 11/09/2025 mas com ID diferente. Vou apenas adicioná-lo via `rayshape_manual_owners` com `printer_date=2025-09-11` (deixa o deal legado quieto).
- Deal `59035481` (Lilian, Funil Estagnados) — **não está no CSV** de CS Onboarding e tem `closed_at` NULL. Fica de fora do painel Rayshape até o CRM fechar data; sem ação agora.

### 4. Placeholder emails
Nas 5 linhas do painel com e-mail `deal-*@import.placeholder` ou `import_*@placeholder.local` (`M Veraldi`, `Fabiano Rocha`, `REJANE`, `MILLIAN`, `Mitiko Yassuda`), atualizar `lia_attendances` com nome/e-mail/telefone/CNPJ reais extraídos do CSV correspondente ao `piperun_deal_id`.

### 5. Migration adicional (RPC)
Atualizar `fn_rayshape_owners`:
- Excluir lead "Peru" (`la.email='e-mail não informado' OR la.nome ILIKE 'Peru'`) da CTE `printers_auto`.
- Nenhuma outra mudança de lógica.

---

## Entregas
1. **1 migration** — nova versão do RPC `fn_rayshape_owners` com filtro anti-bucket.
2. **1 lote `supabase--insert`** — INSERTs/UPDATEs em `lia_attendances` (19 backfills + 3 Peru + 5 placeholders) + INSERTs em `rayshape_manual_owners` (22 registros).
3. Nenhuma alteração no PipeRun, no `deals` original ou no `stripe_payment_units`.

## Fora do escopo
- Sincronizar de volta para PipeRun (usuário pediu explicitamente para não tocar no CRM).
- Deletar deals órfãos do DB.
- Alterar UI do painel.
