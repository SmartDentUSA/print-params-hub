

## Plano Refinado: Importacao Massiva de 17 Fontes — com Sugestoes Tecnicas Incorporadas

Todos os refinamentos sugeridos foram incorporados ao plano. Segue a versao final ajustada, pronta para implementacao.

---

### Fase 1: Backend Base

**1.1 Instalar `xlsx` (SheetJS)**
- Adicionar ao `package.json`

**1.2 Atualizar `supabase/config.toml`**
- Adicionar `[functions.import-leads-csv]` com `verify_jwt = false`

---

### Fase 2: Edge Function `import-leads-csv/index.ts`

Arquivo unico: `supabase/functions/import-leads-csv/index.ts`

**Entrada (POST):**
```text
{
  type: "master" | "manychat" | "facebook" | "involveme" | "resin_clients" | "scanner_owners" | "facebook_kommo" | "hadron_vendas" | "omie_vendas",
  leads: object[],        // array ja parseado e agregado (client-side)
  override: boolean       // se true, sobrescreve campos (para hadron/omie)
}
```

**Retorno:**
```text
{ inserted: number, updated: number, skipped: number, errors: { row: number, email: string, error: string }[] }
```

**Logica central:**
- Para cada lead no array, normalizar telefone com funcao agressiva (remove nao-digitos, adiciona "9" se 10 digitos celular BR, prefixo +55)
- Match primario: `email` via `ON CONFLICT (email) DO UPDATE`
- Match secundario (se email placeholder ou ausente): query por `telefone_normalized`
- Match terciario (parser `omie_vendas`): query por `similarity(nome, ?) > 0.6` usando pg_trgm
- Se `override = false`: usar `COALESCE(excluded.field, lia_attendances.field)` para nao sobrescrever
- Se `override = true`: usar `excluded.field` diretamente (para hadron/omie que confirmam venda)
- Campos protegidos (nunca sobrescritos): `resumo_historico_ia`, `rota_inicial_lia`, campos da L.I.A.
- Retornar array de erros por linha para download posterior

**9 Parsers — normalizacao especifica recebida do client-side:**

| Parser | Normalizacoes no Client |
|---|---|
| `master` | 60+ colunas PipeRun mapeadas. Custom fields extraidos |
| `manychat` | Tags ManyChat para `tags_crm`. Telefone E.164 |
| `facebook` | `form_name` para `produto_interesse` (Resinas/EdgeMini/IoConnect). `area_atuacao`, `como_digitaliza`, `tem_impressora` |
| `involveme` | Campos financeiros para `raw_payload`. "Qual equipamento" para `produto_interesse`. `area_atuacao`, `especialidade` |
| `resin_clients` | Telefone notacao cientifica para string. Valor "R$ 1,200.00" para numero. Email "#N/A" para null |
| `scanner_owners` | DESCRICAO para `como_digitaliza`. Modelo scanner para `produto_interesse` |
| `facebook_kommo` | Estagios Kommo para `lead_status`. Rotulos para `tags_crm[]`. Proprietario mapeado |
| `hadron_vendas` | Agregacao por email (SUM valor, flags ativo_*, MIN data). NOME GRUPO para flags. `override: true` |
| `omie_vendas` | Agregacao por nome cliente. Fill-down de vendedor/CFOP. Mes PT para numero. Vendedor "1 - MMTECH" limpo. `override: true` |

A normalizacao/agregacao e feita **no browser** antes de enviar. A edge function recebe dados ja normalizados e faz apenas upsert + match + merge.

---

### Fase 3: UI Foundation — `SmartOpsLeadsList.tsx`

**3.1 Novas colunas na tabela:**
- `temperatura_lead` (badge colorido: quente/morno/frio)
- `ultima_etapa_comercial` (texto truncado)
- Compactar coluna "Ativos" existente

**3.2 Novos filtros:**
- Por `temperatura_lead` (quente/morno/frio/todos)
- Por `source` (ja existe, manter)
- Por estagnacao: checkbox "Sem update > 30 dias"

**3.3 Modal de detalhes reorganizado em secoes:**
- **Dados Pessoais**: nome, email, telefone, cidade/uf, area_atuacao, especialidade
- **CRM/PipeRun**: piperun_id, piperun_link, proprietario, status, funil, etapa, temperatura, tags
- **Oportunidade**: status_oportunidade, valor, itens_proposta, data_fechamento, motivo_perda
- **Campanha/UTM**: source, form_name, origem_campanha, utm_source/medium/campaign/term
- **Equipamentos**: tem_impressora, impressora_modelo, como_digitaliza, tem_scanner, produto_interesse, resina_interesse
- **IA/LIA**: rota_inicial_lia, resumo_historico_ia, score
- **Ativos**: flags ativo_* com datas de ultima compra
- **Datas**: created_at, updated_at, data_primeiro_contato, data_contrato, lead_timing_dias

---

### Fase 4: The Engine — Componente de Upload

**4.1 Botao "Importar" no header do SmartOpsLeadsList:**
- Dropdown com 9 opcoes de fonte (+ label descritivo)
- Input de arquivo aceita `.csv` e `.xlsx`

**4.2 Preview Mode (refinamento incorporado):**
- Apos parse, mostrar tabela com **primeiras 5 linhas** ja normalizadas pelo parser selecionado
- Colunas: nome, email, telefone, produto_interesse, source, campos especificos do parser
- Botao "Confirmar e Enviar" / "Cancelar"
- Isso evita enviar 5.000 linhas com colunas mapeadas erradas

**4.3 Logica de parse client-side:**
- XLSX: `XLSX.read(arrayBuffer, { type: 'array', cellDates: true })` + `XLSX.utils.sheet_to_json(sheet, { defval: null })` (refinamento incorporado)
- CSV: split por linhas com tratamento de aspas
- Agregacao client-side para hadron (por email) e omie (por nome)
- Fill-down para omie (vendedor/CFOP propagados)

**4.4 Envio em batches de 500:**
- Progress bar com `{batchAtual}/{totalBatches}` e contadores `inserted/updated/skipped/errors`
- Toast final com resumo

**4.5 Estado de Erro Parcial (refinamento incorporado):**
- Se qualquer batch retornar errors, acumular no state
- Ao final, se houver erros, mostrar botao "Baixar CSV de Erros"
- CSV de erros: `linha, email, erro` para cada registro que falhou
- Isso permite corrigir e re-importar apenas os registros com problema

---

### Fase 5: Intelligence — `SmartOpsBowtie.tsx`

**Atualizar classificacao das faixas:**
- Atualmente usa `score` numerico para classificar em faixas (Contato Realizado, Em Contato, Em Negociacao, Fechamento)
- Novo: usar `ultima_etapa_comercial` e `temperatura_lead` quando disponiveis
- Mapeamento: etapas CRM do PipeRun para faixas do Bowtie
- Fallback: manter score numerico se campos CRM ausentes

---

### Fase 6: `SmartOpsTab.tsx`

- Botao "Sync PipeRun" ao lado de "Atualizar Dados" (chama `smart-ops-sync-piperun`)
- Badge informativo "Webhook ativo" com icone verde

---

### Resumo de Arquivos

```text
CRIAR:
  supabase/functions/import-leads-csv/index.ts  (edge function com 9 parsers)

MODIFICAR:
  package.json                                   (adicionar xlsx)
  supabase/config.toml                           (adicionar import-leads-csv)
  src/components/SmartOpsLeadsList.tsx            (importador + preview + progress + erros + novas colunas/filtros + modal reorganizado)
  src/components/SmartOpsTab.tsx                  (botao Sync PipeRun + badge webhook)
  src/components/SmartOpsBowtie.tsx               (classificacao CRM real)
```

### Detalhes Tecnicos Finais

- `cellDates: true` no `XLSX.read()` para evitar datas como numeros Excel
- `defval: null` no `sheet_to_json()` para manter colunas vazias no objeto
- `override: boolean` no payload da edge function controla COALESCE vs sobrescrita
- Telefones: remover nao-digitos, se 10 digitos adicionar "9", prefixar +55, comparar via `telefone_normalized`
- Indice funcional `telefone_normalized` ja existe na tabela
- `similarity()` do pg_trgm ja disponivel no banco (funcoes confirmadas no schema)
- Edge function com timeout de 60s suporta ~500 upserts por batch
- Total estimado: ~78.200 registros brutos, ~25-30k leads unicos apos dedup

