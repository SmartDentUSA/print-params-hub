

# Mapeamento PipeRun CRM para lia_attendances

## Campos do XLSX PipeRun e mapeamento

### Campos que JA existem na tabela (mapeamento direto)

| # | Campo PipeRun (XLSX) | Coluna lia_attendances | Observacao |
|---|---|---|---|
| 1 | `ID` | `piperun_id` | Chave de vinculo, ja usado no sync |
| 2 | `Nome do dono da oportunidade` | `proprietario_lead_crm` | Ja sincronizado |
| 3 | `Dono da oportunidade` (email) | -- | Usado para buscar `team_member` mas nao armazenado |
| 4 | `Etapa` | `status_atual_lead_crm` | Ja sincronizado |
| 5 | `Funil` | `funil_entrada_crm` | Existe mas nao e populado pelo sync |
| 6 | `Nome completo (Pessoa)` | `nome` | Ja mapeado no ingest |
| 7 | `E-mail (Pessoa)` | `email` | Ja mapeado |
| 8 | `Telefone (Pessoa)` / `Whatsapp` | `telefone_raw` / `telefone_normalized` | Ja mapeado |
| 9 | `Cargo (Pessoa)` = area atuacao | `area_atuacao` | Mapeado como "CLINICA OU CONSULTORIO", "LABORATORIO DE PROTESE" etc. |
| 10 | `Especialidade principal` | `especialidade` | Campo customizado do PipeRun |
| 11 | `Tem impressora` | `tem_impressora` | Campo customizado |
| 12 | `Produto de interesse` | `produto_interesse` | Campo customizado |
| 13 | `Tags` | -- | Nao armazenado (novo campo necessario) |
| 14 | `Data de cadastro` | `created_at` / `data_primeiro_contato` | Ja existe |
| 15 | `Endereço - Cidade (Pessoa)` | -- | Nao existe (novo campo necessario) |
| 16 | `Endereço - Estado (UF) (Pessoa)` | -- | Nao existe (novo campo necessario) |
| 17 | `Tem scanner` | -- | Nao existe (novo campo necessario) |
| 18 | `Área de atuação` (campo custom) | `area_atuacao` | Duplicado com Cargo |

### Campos que PRECISAM ser adicionados a tabela

| # | Campo PipeRun | Nova coluna proposta | Tipo | Default |
|---|---|---|---|---|
| 1 | `Status` (Aberta/Perdida/Ganha) | `status_oportunidade` | TEXT | `'aberta'` |
| 2 | `Valor de P&S` | `valor_oportunidade` | NUMERIC | `NULL` |
| 3 | `Tags` | `tags_crm` | TEXT[] | `'{}'` |
| 4 | `Temperatura` (Quente/Frio/etc) | `temperatura_lead` | TEXT | `NULL` |
| 5 | `(MP) Motivo de perda` | `motivo_perda` | TEXT | `NULL` |
| 6 | `(MP) Comentário` | `comentario_perda` | TEXT | `NULL` |
| 7 | `Endereço - Cidade (Pessoa)` | `cidade` | TEXT | `NULL` |
| 8 | `Endereço - Estado (UF) (Pessoa)` | `uf` | TEXT | `NULL` |
| 9 | `Tem scanner` | `tem_scanner` | TEXT | `NULL` |
| 10 | `Data de fechamento` | `data_fechamento_crm` | TIMESTAMPTZ | `NULL` |
| 11 | `Lead-Timing` (dias no CRM) | `lead_timing_dias` | INTEGER | `NULL` |
| 12 | `Itens da proposta` | `itens_proposta_crm` | TEXT | `NULL` |
| 13 | `Link` | `piperun_link` | TEXT | `NULL` |
| 14 | `ID Banco de Dados` / `Banco de Dados ID` | `id_cliente_smart` | TEXT | Ja existe |
| 15 | `CODIGO CONTRATO` | -- | Mapeia para `data_contrato` (existente) |
| 16 | `DATA TREINAMENTO` | -- | Mapeia para `cs_treinamento` (existente) |

### Campos do PipeRun que NAO precisam ser armazenados

Estes campos sao informacionais, redundantes ou da empresa (nao do lead):

- `Hash`, `Link` (apenas referencia, mas Link sera util)
- `Lead-Timing da etapa` (derivavel)
- `Origem`, `Grupo de origens` (redundante com `source`)
- `Descricao`, `Observacoes`, `Notas` (textos longos, ficam no `raw_payload`)
- Todos os campos de `Empresa` (CNPJ, razao social, endereco empresa, etc.) -- nao sao do lead
- `Probabilidade de fechamento`, `Previsao de fechamento` -- derivaveis
- `Valor de MRR` -- nao aplicavel ao modelo atual
- `CPF`, `Genero`, `Data de nascimento` -- sensivel/nao necessario

---

## Alteracoes necessarias

### 1. Migration SQL

```sql
ALTER TABLE lia_attendances
  ADD COLUMN IF NOT EXISTS status_oportunidade TEXT DEFAULT 'aberta',
  ADD COLUMN IF NOT EXISTS valor_oportunidade NUMERIC,
  ADD COLUMN IF NOT EXISTS tags_crm TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS temperatura_lead TEXT,
  ADD COLUMN IF NOT EXISTS motivo_perda TEXT,
  ADD COLUMN IF NOT EXISTS comentario_perda TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS uf TEXT,
  ADD COLUMN IF NOT EXISTS tem_scanner TEXT,
  ADD COLUMN IF NOT EXISTS data_fechamento_crm TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_timing_dias INTEGER,
  ADD COLUMN IF NOT EXISTS itens_proposta_crm TEXT,
  ADD COLUMN IF NOT EXISTS piperun_link TEXT;
```

### 2. Edge function `smart-ops-sync-piperun/index.ts`

Atualizar para sincronizar TODOS os campos mapeados. Hoje so sincroniza `owner.name` e `stage.name`. Precisa extrair:

```typescript
// Mapeamento completo PipeRun API -> lia_attendances
const updatePayload = {
  piperun_id: String(deal.id),
  piperun_link: `https://app.pipe.run/pipeline/gerenciador/visualizar/${deal.id}`,
  proprietario_lead_crm: deal.owner?.name,
  status_atual_lead_crm: deal.stage?.name,
  funil_entrada_crm: deal.pipeline?.name,
  status_oportunidade: deal.status,       // "open", "won", "lost"
  valor_oportunidade: deal.value,
  tags_crm: deal.tags?.map(t => t.name),
  temperatura_lead: deal.temperature,
  motivo_perda: deal.loss_reason?.name,
  comentario_perda: deal.loss_reason?.comment,
  lead_timing_dias: deal.lead_timing,
  data_fechamento_crm: deal.closed_at,
  // Campos da pessoa (deal.person)
  nome: deal.person?.name,
  email: deal.person?.email,
  telefone_raw: deal.person?.phone,
  cidade: deal.person?.city?.name,
  uf: deal.person?.state?.abbr,
  // Campos customizados (deal.custom_fields ou deal.person.custom_fields)
  produto_interesse: customField("Produto de interesse"),
  especialidade: customField("Especialidade principal"),
  tem_impressora: customField("Tem impressora"),
  tem_scanner: customField("Tem scanner"),
  area_atuacao: customField("Área de atuação"),
};
```

Tambem paginar resultados (hoje pega so 100) usando `page` param da API PipeRun.

### 3. Edge function `smart-ops-piperun-webhook/index.ts`

Aplicar o mesmo mapeamento expandido quando o webhook dispara, extraindo todos os campos do payload do deal.

### 4. SmartOpsLeadsList (UI)

Adicionar colunas na tabela e no dialog de detalhes para os novos campos (cidade/UF, status oportunidade, valor, temperatura).

---

## Mapeamento visual dos funis PipeRun para lead_status

| Funil PipeRun | Etapa PipeRun | lead_status |
|---|---|---|
| Funil de vendas | Sem Contato | `sem_contato` |
| Funil de vendas | Contato Feito | `contato_feito` |
| Funil de vendas | Em Contato | `em_contato` |
| Funil de vendas | Apresentacao/Visita | `apresentacao` |
| Funil de vendas | Proposta Enviada | `proposta_enviada` |
| Funil de vendas | Negociacao | `negociacao` |
| Funil de vendas | Fechamento | `fechamento` |
| Funil Estagnados | Etapa 01 - Reativacao | `est1_0` |
| Funil Estagnados | Etapa 02 - Reativacao | `est2_0` |
| Funil Estagnados | Etapa 03 - Reativacao | `est3_0` |
| Funil Estagnados | Proposta Enviada - Estag | `est3_0` (ou manter no status anterior) |
| Funil E-book | Ebook Message Helper | `novo` (lead de conteudo) |
| CS Onboarding | * | Nao altera lead_status (usa campo `cs_treinamento`) |

---

## Arquivos afetados

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar -- 13 novas colunas em `lia_attendances` |
| `supabase/functions/smart-ops-sync-piperun/index.ts` | Reescrever -- mapeamento completo + paginacao |
| `supabase/functions/smart-ops-piperun-webhook/index.ts` | Editar -- mapeamento expandido |
| `src/components/SmartOpsLeadsList.tsx` | Editar -- novos campos na tabela e dialog |

