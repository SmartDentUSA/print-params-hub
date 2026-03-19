# Auditoria de Processos — Workflow 7×3, Formulários e CRM

> **Versão**: 1.0 · **Data**: 19/03/2026  
> **Classificação**: Documento interno — Engenharia & Processos ISO  
> **Sistema**: Revenue Intelligence OS — SmartDent 3D  

---

## Sumário

1. [Workflow Portfolio 7×3](#1-workflow-portfolio-7×3)
2. [Formulários — Criação e Estrutura](#2-formulários--criação-e-estrutura)
3. [Ingestão de Leads — `smart-ops-ingest-lead`](#3-ingestão-de-leads)
4. [Envio ao CRM — `smart-ops-lia-assign`](#4-envio-ao-crm)
5. [Ações Disparadas — Orquestração Pós-Ingestão](#5-ações-disparadas)
6. [Extração Implícita — NLP `lia-lead-extraction.ts`](#6-extração-implícita)
7. [Fluxogramas de Processo](#7-fluxogramas-de-processo)
8. [Matriz de Rastreabilidade](#8-matriz-de-rastreabilidade)

---

## 1. Workflow Portfolio 7×3

### 1.1 Conceito

O **Workflow Portfolio** é uma grade visual que mapeia a jornada completa do lead/cliente no ecossistema de odontologia digital em **7 etapas** (colunas) × **subcategorias** (sub-colunas) × **3 camadas** (linhas).

### 1.2 Estrutura da Grade

| # | Etapa | Subcategorias |
|---|-------|--------------|
| 1 | **Captura Digital** | Scanner Intraoral · Scanner Bancada · Notebook · Acessórios · Peças/Partes |
| 2 | **CAD** | Software · Créditos IA CAD · Serviço |
| 3 | **Impressão 3D** | Resina · Software · Impressora · Acessórios · Peças/Partes |
| 4 | **Pós-Impressão** | Equipamentos · Limpeza/Acabamento |
| 5 | **Finalização** | Caracterização · Instalação · Dentística/Orto |
| 6 | **Cursos** | Presencial · Online |
| 7 | **Fresagem** | Equipamentos · Software · Serviço · Acessórios · Peças/Partes |

**Total de subcategorias**: 25 células por camada × 3 camadas = **75 células** na grade completa.

### 1.3 As 3 Camadas (Linhas)

| Camada | Código | Cor | Significado |
|--------|--------|-----|-------------|
| **Ativos SmartDent** | `ativo` | 🟢 Verde `#4ade80` | Lead/cliente possui produto SmartDent nesta subcategoria |
| **Concorrente Mapeado** | `conc` | 🟡 Amarelo `#fbbf24` | Lead possui produto concorrente mapeado |
| **Interesse SDR** | `sdr` | 🔵 Azul `#60a5fa` | Lead demonstrou interesse (via formulário, conversa, NLP) |
| **Sem Sinal** | `vazio` | ⚪ Cinza `#333` | Nenhum dado disponível |

### 1.4 Campos do Banco de Dados → Células da Grade

A construção do portfolio é realizada pela Edge Function `backfill-intelligence-score` e pela lógica no frontend (`WorkflowPortfolio.tsx`). Os campos da tabela `lia_attendances` alimentam a grade:

#### Etapa 1 — Captura Digital
| Subcategoria | Campo `ativo` | Campo `sdr` | Campo `conc` |
|---|---|---|---|
| Scanner Intraoral | `equip_scanner` = SmartDent brand | `sdr_scanner_interesse = "Sim"` | `equip_scanner` = concorrente |
| Scanner Bancada | `equip_scanner` (tipo bancada) | `sdr_scanner_interesse = "Sim"` | idem |
| Notebook | `equip_notebook` ≠ null | — | — |
| Acessórios | `insumos_adquiridos` (match) | — | — |
| Peças/Partes | `insumos_adquiridos` (match) | — | — |

#### Etapa 2 — CAD
| Subcategoria | Campo `ativo` | Campo `sdr` | Campo `conc` |
|---|---|---|---|
| Software | `equip_cad` = exocad SmartDent | `sdr_software_cad_interesse = "Sim"` | `software_cad` = concorrente |
| Créditos IA CAD | `deal_items` com SKU créditos | — | — |
| Serviço | — | — | — |

#### Etapa 3 — Impressão 3D
| Subcategoria | Campo `ativo` | Campo `sdr` | Campo `conc` |
|---|---|---|---|
| Resina | `insumos_adquiridos` (resinas SD) | `sdr_insumos_lab_interesse` | — |
| Software | — | — | — |
| Impressora | `equip_impressora` = SmartDent | `sdr_impressora_interesse = "Sim"` | `impressora_modelo` = concorrente |
| Acessórios | `insumos_adquiridos` (match) | — | — |
| Peças/Partes | `insumos_adquiridos` (match) | — | — |

#### Etapa 4 — Pós-Impressão
| Subcategoria | Campo `ativo` | Campo `sdr` | Campo `conc` |
|---|---|---|---|
| Equipamentos | `equip_pos_impressao` ≠ null | `sdr_pos_impressao_interesse = "Sim"` | `equip_pos_impressao` = concorrente |
| Limpeza/Acabamento | `equip_pos_impressao` (tipo limpeza) | — | — |

#### Etapa 5 — Finalização
| Subcategoria | Campo `ativo` | Campo `sdr` | Campo `conc` |
|---|---|---|---|
| Caracterização | — | `sdr_caracterizacao_interesse = "Sim"` | — |
| Instalação | — | — | — |
| Dentística/Orto | — | `sdr_dentistica_interesse = "Sim"` | — |

#### Etapa 6 — Cursos
| Subcategoria | Campo `ativo` | Campo `sdr` |
|---|---|---|
| Presencial | `astron_courses_completed > 0` (tipo presencial) | `sdr_cursos_interesse = "Sim"` |
| Online | `astron_courses_completed > 0` (tipo online) | `sdr_cursos_interesse = "Sim"` |

#### Etapa 7 — Fresagem
| Subcategoria | Campo `ativo` | Campo `sdr` |
|---|---|---|
| Equipamentos | `deal_items` (fresadora) | `sdr_solucoes_interesse = "Sim"` |
| Software | — | — |
| Serviço | — | — |
| Acessórios | — | — |
| Peças/Partes | — | — |

### 1.5 Regras de Prioridade de Classificação

```
PRIORIDADE DE CAMADA:
  1. ativo  → Lead possui produto SmartDent (cor verde)
  2. conc   → Lead possui concorrente mapeado (cor amarela)  
  3. sdr    → Lead demonstrou interesse (cor azul)
  4. vazio  → Nenhum dado (célula vazia)

REGRA: Se um lead possui ativo + conc na mesma subcategoria,
       a célula mostra "ativo" (prioridade maior).
```

### 1.6 Workflow Score (Função SQL `fn_calc_workflow_score`)

O workflow score é calculado automaticamente via trigger e combina 5 dimensões:

```sql
workflow_score = (
  -- E1: Scanner (0-2)
  CASE WHEN status_scanner = 'tem_smartdent' THEN 2
       WHEN status_scanner IN ('bancada','tem_concorrente') THEN 1
       ELSE 0 END +
  -- E2: CAD (0-2)
  CASE WHEN status_cad = 'completo' THEN 2
       WHEN status_cad = 'tem_exocad' THEN 1
       ELSE 0 END +
  -- E3: Impressão 3D (0-2)
  CASE WHEN status_impressora = 'completo' THEN 2
       WHEN status_impressora IN ('tem_com_resina_sd','tem_concorrente','terceiriza') THEN 1
       ELSE 0 END +
  -- E4: Pós-impressão (0-2)
  CASE WHEN status_pos_impressao = 'completo' THEN 2
       WHEN status_pos_impressao = 'tem_cura' THEN 1
       ELSE 0 END +
  -- E5: Insumos/Cursos (0-2)
  CASE WHEN status_insumos = 'ativo' THEN 2
       WHEN status_insumos = 'interesse' THEN 1
       ELSE 0 END
)
-- Score máximo: 10 pontos
```

### 1.7 Momento de Construção

O portfolio é **construído sob demanda** quando o card do lead é aberto no frontend (`LeadDetailPanel.tsx`). Os dados são lidos da coluna `portfolio_json` (JSONB) na tabela `lia_attendances`, que é atualizada pela Edge Function `backfill-intelligence-score` de forma batch.

### 1.8 Summary Bar

Abaixo da grade, um resumo exibe:
- **N ativos SmartDent** — Total de subcategorias onde o lead é cliente
- **N concorrentes mapeados** — Total de subcategorias com concorrente
- **N interesses SDR** — Total de subcategorias com interesse registrado

---

## 2. Formulários — Criação e Estrutura

### 2.1 Arquitetura de Tabelas

```
┌─────────────────────┐       ┌──────────────────────────┐
│   smartops_forms     │──1:N──│   smartops_form_fields    │
├─────────────────────┤       ├──────────────────────────┤
│ id (uuid PK)        │       │ id (uuid PK)             │
│ name                │       │ form_id (FK → forms.id)  │
│ slug (unique)       │       │ label                    │
│ form_purpose        │       │ field_type               │
│ title               │       │ db_column (nullable)     │
│ subtitle            │       │ custom_field_name (null.) │
│ description         │       │ options (jsonb)          │
│ theme_color         │       │ required (bool)          │
│ success_message     │       │ placeholder              │
│ success_redirect_url│       │ order_index (int)        │
│ active (bool)       │       └──────────────────────────┘
│ submissions_count   │
│ created_at          │
└─────────────────────┘
```

### 2.2 Propósitos de Formulário

| Código | Label | Uso |
|--------|-------|-----|
| `nps` | NPS | Pesquisa de satisfação |
| `sdr` | SDR | Qualificação de leads (interesse em etapas) |
| `roi` | ROI | Calculadoras de ROI |
| `cs` | CS | Customer Success (treinamento, suporte) |
| `captacao` | Captação | Captação geral de leads |
| `evento` | Evento | Formulários de eventos |

### 2.3 Os 76 Campos Base (db_column mapping)

O sistema oferece **76 campos base** pré-definidos que mapeiam diretamente para colunas da tabela `lia_attendances`:

#### Grupo: Contato (5 campos)
| # | Label | `field_type` | `db_column` |
|---|-------|-------------|-------------|
| 1 | Nome | text | `nome` |
| 2 | E-mail | email | `email` |
| 3 | Telefone | phone | `telefone_raw` |
| 4 | Cidade | text | `cidade` |
| 5 | UF | select (27 opções) | `uf` |

#### Grupo: Profissional (4 campos)
| # | Label | `field_type` | `db_column` |
|---|-------|-------------|-------------|
| 6 | Especialidade | select (12 opções) | `especialidade` |
| 7 | Área de atuação | select (6 opções) | `area_atuacao` |
| 8 | Empresa | text | `empresa_nome` |
| 9 | Cargo | text | `pessoa_cargo` |

#### Grupo: Equipamentos (5 campos)
| # | Label | `field_type` | `db_column` |
|---|-------|-------------|-------------|
| 10 | Tem impressora 3D? | radio | `tem_impressora` |
| 11 | Modelo da impressora | text | `impressora_modelo` |
| 12 | Tem scanner? | radio | `tem_scanner` |
| 13 | Software CAD | text | `software_cad` |
| 14 | Como digitaliza? | select | `como_digitaliza` |

#### Grupo: Interesse (4 campos)
| # | Label | `field_type` | `db_column` |
|---|-------|-------------|-------------|
| 15 | Produto de interesse | select (10 opções) | `produto_interesse` |
| 16 | Resina de interesse | text | `resina_interesse` |
| 17 | Principal aplicação | select (8 opções) | `principal_aplicacao` |
| 18 | Volume mensal | select | `volume_mensal_pecas` |

#### Grupo: SDR — Interesse por Etapa (9 campos)
| # | Label | `db_column` |
|---|-------|-------------|
| 19 | Interesse em scanner | `sdr_scanner_interesse` |
| 20 | Interesse em impressora | `sdr_impressora_interesse` |
| 21 | Interesse em software CAD | `sdr_software_cad_interesse` |
| 22 | Interesse em cursos | `sdr_cursos_interesse` |
| 23 | Interesse em insumos lab | `sdr_insumos_lab_interesse` |
| 24 | Interesse em pós-impressão | `sdr_pos_impressao_interesse` |
| 25 | Interesse em soluções | `sdr_solucoes_interesse` |
| 26 | Interesse em dentística | `sdr_dentistica_interesse` |
| 27 | Interesse em caracterização | `sdr_caracterizacao_interesse` |

#### Grupo: Empresa Extras (7 campos)
| # | Label | `db_column` |
|---|-------|-------------|
| 28 | CNPJ | `empresa_cnpj` |
| 29 | Razão Social | `empresa_razao_social` |
| 30 | Segmento | `empresa_segmento` |
| 31 | CPF | `pessoa_cpf` |
| 32 | Gênero | `pessoa_genero` |
| 40 | Website | `empresa_website` |
| 41 | Inscrição Estadual | `empresa_ie` |
| 42 | Porte | `empresa_porte` |

#### Grupo: SDR Parâmetros (3 campos)
| # | Label | `db_column` |
|---|-------|-------------|
| 33 | Marca impressora (param) | `sdr_marca_impressora_param` |
| 34 | Modelo impressora (param) | `sdr_modelo_impressora_param` |
| 35 | Resina (param) | `sdr_resina_param` |

#### Grupo: SDR Suporte (3 campos)
| # | Label | `db_column` |
|---|-------|-------------|
| 36 | Equipamento (suporte) | `sdr_suporte_equipamento` |
| 37 | Tipo de suporte | `sdr_suporte_tipo` |
| 38 | Descrição do suporte | `sdr_suporte_descricao` |

#### Grupo: Equipamentos Ativos — Seriais (11 campos)
| # | Label | `db_column` |
|---|-------|-------------|
| 59-68 | Scanner, Impressora, CAD, Pós-imp., Notebook (modelo + nº série) | `equip_*` e `equip_*_serial` |
| 69 | Insumos adquiridos | `insumos_adquiridos` |

#### Grupo: Marketing/UTM (4 campos)
| # | `db_column` |
|---|-------------|
| 70-73 | `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` |

#### Grupo: CS & Suporte, Funil, Tags (restante até #76)
| `db_column` |
|-------------|
| `cs_treinamento`, `data_treinamento`, `data_contrato`, `reuniao_agendada`, `data_primeiro_contato`, `status_oportunidade`, `valor_oportunidade`, `proprietario_lead_crm`, `produto_interesse_auto`, `motivo_perda`, `comentario_perda`, `id_cliente_smart` |

### 2.4 Campos Customizados

Quando `db_column` é `null`, o campo usa `custom_field_name` e os dados são armazenados no JSONB `raw_payload.custom_fields`:

```json
{
  "custom_fields": {
    "nota_nps": 9,
    "comentario_livre": "Excelente atendimento"
  }
}
```

### 2.5 Criação de Formulário — Fluxo Admin

```
┌──────────────────────────────────────────────────────┐
│  SmartOpsFormBuilder (admin UI)                      │
│                                                      │
│  1. Admin clica "Novo formulário"                    │
│  2. Define: nome, propósito (NPS/SDR/ROI/CS/etc)     │
│  3. Sistema gera slug automaticamente                │
│  4. INSERT → smartops_forms                          │
│                                                      │
│  --- ou ---                                          │
│                                                      │
│  1. Admin clica "Criar Base (todos os campos)"       │
│  2. Sistema cria form + 76 campos pré-definidos      │
│  3. INSERT → smartops_forms + smartops_form_fields    │
│                                                      │
│  --- Edição ---                                      │
│                                                      │
│  1. Admin abre SmartOpsFormEditor                     │
│  2. Adiciona/remove/reordena campos                  │
│  3. Define db_column OU custom_field_name            │
│  4. Ativa/desativa formulário                        │
└──────────────────────────────────────────────────────┘
```

### 2.6 Renderização Pública — `PublicFormPage.tsx`

```
Rota: /f/:slug

1. Busca formulário por slug em smartops_forms (active=true)
2. Busca campos ordenados por order_index em smartops_form_fields
3. Renderiza campos conforme field_type:
   - text → <Input>
   - email → <Input type="email">
   - phone → <PhoneInputWithDDI> (DDI + máscara)
   - number → <Input type="number">
   - textarea → <textarea>
   - select → <select> com options[]
   - radio → Radio buttons com options[]
   - checkbox → Checkboxes com options[] (multi-select → array)
   - slider → <Slider> com min/mid/max de options{}
4. Captura UTMs da URL (?utm_source=...&utm_medium=...)
5. On submit → smart-ops-ingest-lead (Edge Function)
6. Se success_redirect_url → redireciona
7. Senão → exibe success_message com ✓
```

---

## 3. Ingestão de Leads

### 3.1 Edge Function: `smart-ops-ingest-lead`

**Endpoint**: `POST /functions/v1/smart-ops-ingest-lead`  
**Autenticação**: Service Role Key ou Anon Key  
**Fontes de entrada**: Formulários, Meta Ads webhook, SellFlux webhook, E-commerce webhook, API direta

### 3.2 Fluxo Detalhado

```
┌──────────────────────────────────────────────────────────────┐
│                   INGESTÃO DE LEAD                           │
│                                                              │
│  ① RECEBER PAYLOAD                                          │
│     ├─ Detectar source: meta_lead_ads | sellflux |          │
│     │   formulario | loja_integrada | vendedor_direto        │
│     └─ Detectar form_name do payload                        │
│                                                              │
│  ② EXTRAIR CAMPOS                                           │
│     ├─ nome: payload.nome || full_name || name ||            │
│     │         first_name + last_name                         │
│     ├─ email: extractField("email","user_email") → lower()  │
│     ├─ telefone: extractField("phone","celular") →           │
│     │            normalizePhone() → "+55XXXXXXXXXXX"         │
│     ├─ ~76 campos explícitos (ver §2.3)                     │
│     └─ detectProductFromFormName(form_name)                  │
│                                                              │
│  ③ FILTROS DE SEGURANÇA                                     │
│     ├─ Email obrigatório (400 se vazio)                     │
│     ├─ Test domains: @test.com, @example.com → skip         │
│     └─ Regex teste: /^teste?[\-_@]/i → skip                 │
│                                                              │
│  ④ BUSCA LEAD EXISTENTE                                     │
│     └─ SELECT * FROM lia_attendances WHERE email = ?         │
│                                                              │
│  ⑤ DECISÃO: NOVO vs EXISTENTE                               │
│     ├─ SE existente → Smart Merge (§3.3)                    │
│     └─ SE novo → INSERT com lead_status = "novo"            │
│                                                              │
│  ⑥ ORQUESTRAÇÃO (fire-and-forget)                           │
│     ├─ smart-ops-lia-assign (CRM sync)                      │
│     ├─ cognitive-lead-analysis (DeepSeek)                    │
│     ├─ SellFlux Campanhas webhook (V2)                      │
│     ├─ SellFlux Leads webhook (V1)                          │
│     └─ Timeline: lead_activity_log INSERT                   │
│                                                              │
│  ⑦ RESPOSTA                                                 │
│     └─ { success, lead_id, is_existing, fields_updated }    │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Smart Merge — Módulo `lead-enrichment.ts`

O merge de leads existentes segue **4 categorias de campos**:

#### Categoria 1: PROTECTED (nunca sobrescrever)
```
entrada_sistema, piperun_id, piperun_created_at,
pessoa_hash, pessoa_piperun_id,
li_cliente_id, astron_user_id,
id, created_at, email
```
**Regra**: Se o campo já tem valor → pular silenciosamente.

#### Categoria 2: ALWAYS_UPDATE (último valor vence)
```
utm_source, utm_medium, utm_campaign, utm_term,
tags_crm, valor_oportunidade, status_oportunidade,
temperatura_lead, lead_status, proprietario_lead_crm,
sellflux_custom_fields
```
**Regra**: Sobrescreve SEMPRE, independente de valor anterior.

#### Categoria 3: MERGE_ARRAYS (append + dedup)
```
tags_crm, emails_secundarios, telefones_secundarios
```
**Regra**: Concatena arrays, remove duplicatas, ordena.

#### Categoria 4: MERGE_JSONB (deep merge)
```
sellflux_custom_fields, raw_payload
```
**Regra**: Merge profundo `{ ...existing, ...incoming }`.

#### Categoria 5: ENRICHMENT_ONLY (padrão)
Todos os demais campos.  
**Regra**: Só preenche se atualmente `null`, `undefined` ou `""`.

### 3.4 Prioridade de Fonte

| Fonte | Prioridade | Descrição |
|-------|-----------|-----------|
| `piperun_webhook` | 1 | Mais autoritativo (CRM é source of truth) |
| `piperun_sync` | 2 | Sincronização batch |
| `ecommerce_webhook` / `loja_integrada` | 3 | Dados de compra real |
| `astron_postback` | 4 | Plataforma de cursos |
| `sellflux_webhook` / `sellflux` | 5 | Automação marketing |
| `meta_lead_ads` / `meta_ads` | 6 | Meta Ads leadgen |
| `formulario` | 7 | Formulários públicos |
| `vendedor_direto` | 8 | Input manual do vendedor |
| `default` | 10 | Qualquer outra fonte |

### 3.5 Normalização de Telefone

```typescript
function normalizePhone(raw: string): string | null {
  1. Remove todos os caracteres não-numéricos
  2. Remove zero à esquerda
  3. Adiciona prefixo "55" se ausente
  4. Valida: 12-13 dígitos (DDD + 8-9 dígitos)
  5. Retorna "+55XXXXXXXXXXX" ou null
}
```

### 3.6 Detecção de PQL (Product Qualified Lead)

```
SE source ≠ "vendedor_direto"
   E existingLead.status_oportunidade = "ganha"
ENTÃO → detectedStage = "PQL_recompra"
```
Indica cliente existente re-entrando no funil (oportunidade de recompra).

### 3.7 Auditoria de Enriquecimento

Cada merge gera um registro em `lead_enrichment_audit`:

```json
{
  "lead_id": "uuid",
  "source": "formulario",
  "source_priority": 7,
  "fields_updated": ["cidade", "uf", "sdr_scanner_interesse"],
  "previous_values": { "cidade": null, "uf": null },
  "new_values": { "cidade": "São Paulo", "uf": "SP" },
  "timestamp": "2026-03-19T..."
}
```

### 3.8 Histórico de Submissões

Cada submissão de formulário é registrada no JSONB `raw_payload.form_submissions[]`:

```json
{
  "form_submissions": [
    {
      "form_name": "SDR Scanner Interesse",
      "source": "formulario",
      "submitted_at": "2026-03-19T10:30:00Z",
      "fields_updated": ["sdr_scanner_interesse", "cidade"]
    },
    {
      "form_name": "NPS Pós-venda",
      "source": "formulario",
      "submitted_at": "2026-03-20T14:00:00Z",
      "fields_updated": ["custom_fields.nota_nps"]
    }
  ],
  "latest_payload": { ... } // Último payload recebido
}
```

---

## 4. Envio ao CRM

### 4.1 Edge Function: `smart-ops-lia-assign`

**Endpoint**: `POST /functions/v1/smart-ops-lia-assign`  
**Disparador**: Chamado automaticamente pelo `ingest-lead` (fire-and-forget)  
**CRM**: PipeRun (REST API v1)

### 4.2 Fluxo Completo

```
┌──────────────────────────────────────────────────────────────┐
│                   LIA-ASSIGN — CRM SYNC                      │
│                                                              │
│  ① FETCH LEAD                                               │
│     └─ lia_attendances WHERE id = ? OR email = ?            │
│                                                              │
│  ② IDEMPOTÊNCIA                                             │
│     └─ SE proprietario_lead_crm preenchido                  │
│        E updated_at < 5 min atrás → SKIP                   │
│                                                              │
│  ③ SELECIONAR VENDEDOR (Round Robin)                        │
│     ├─ SE lead já tem proprietario_lead_crm →               │
│     │   busca team_member ativo com esse nome                │
│     │   ├─ Encontrou ativo → mantém                         │
│     │   └─ Não encontrou → Round Robin                      │
│     └─ SE sem proprietário → Round Robin                    │
│         ├─ Prioridade: vendedores com waleads_api_key       │
│         ├─ Fallback: qualquer vendedor ativo                │
│         └─ Último recurso: admin (Thiago, ID 64367)         │
│                                                              │
│  ④ DETERMINAR PIPELINE & STAGE                              │
│     ├─ SE owner = admin → Distribuidor de Leads             │
│     └─ SE owner = vendedor → Funil de Vendas, Sem Contato  │
│                                                              │
│  ⑤ HIERARQUIA PIPERUN: Pessoa → Empresa → Deal             │
│     ┌─────────────────────────────────────────┐             │
│     │  5a. PESSOA                             │             │
│     │     ├─ Busca por email no PipeRun       │             │
│     │     │  GET /persons?email=X             │             │
│     │     ├─ Encontrou → usa person_id        │             │
│     │     └─ Não encontrou → POST /persons    │             │
│     │        (name, emails[], phones[],       │             │
│     │         job_title, custom_fields[])     │             │
│     │                                         │             │
│     │  5b. UPDATE PERSON                      │             │
│     │     └─ PUT /persons/:id                 │             │
│     │        (custom_fields: area_atuacao,    │             │
│     │         especialidade)                  │             │
│     │                                         │             │
│     │  5c. EMPRESA                            │             │
│     │     ├─ SE person.company_id → enriquece │             │
│     │     │  PUT /companies/:id               │             │
│     │     └─ SE sem company → POST /companies │             │
│     │        + PUT /persons/:id (company_id)  │             │
│     │        (name, cnpj, segment, website)   │             │
│     │                                         │             │
│     │  5d. BUSCAR DEALS DA PESSOA             │             │
│     │     └─ GET /deals?person_id=X&show=50   │             │
│     │        → filtrar deleted ≠ 1            │             │
│     │        → classificar: open vs won       │             │
│     │                                         │             │
│     │  5e. DECISION TREE (ver §4.3)           │             │
│     └─────────────────────────────────────────┘             │
│                                                              │
│  ⑥ UPDATE lia_attendances                                   │
│     ├─ proprietario_lead_crm                                │
│     ├─ funil_entrada_crm, ultima_etapa_comercial            │
│     ├─ piperun_id, piperun_link                             │
│     ├─ pessoa_piperun_id, empresa_piperun_id                │
│     └─ Enrichment: empresa_cnpj, empresa_nome, etc          │
│                                                              │
│  ⑦ OUTBOUND MESSAGES                                        │
│     ├─ LIA source → AI Greeting (seller → lead)             │
│     ├─ Form source → Template Message (cs_automation_rules)  │
│     └─ SEMPRE: AI Briefing → seller WhatsApp                │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Decision Tree — Deals

```
                     ┌─────────────┐
                     │ Pessoa tem   │
                     │ deals?       │
                     └──────┬──────┘
                            │
                   ┌────────┴────────┐
                   │                 │
              ┌────▼────┐      ┌────▼────────┐
              │ Deal em  │      │ Deal em      │
              │ VENDAS   │      │ ESTAGNADOS   │
              │ (aberto) │      │ (freezed)    │
              └────┬─────┘      └────┬─────────┘
                   │                 │
         ┌────────▼────────┐  ┌────▼──────────────┐
         │ 🔒 GOLDEN RULE  │  │ REATIVAR           │
         │                 │  │ Move → Vendas      │
         │ NÃO MUDA:       │  │ pipeline_id =      │
         │  - owner_id     │  │   VENDAS            │
         │  - stage_id     │  │ stage_id =          │
         │  - pipeline_id  │  │   SEM_CONTATO       │
         │                 │  │ owner_id = novo     │
         │ SÓ ATUALIZA:    │  │ freezed = 0         │
         │  - custom_fields│  │ Nota de reativação  │
         │  - company_id   │  └───────────────────┘
         │  - nota         │
         │                 │            ┌──────────────┐
         │ Owner do deal = │            │ NENHUM DEAL  │
         │ source of truth │            │ aberto       │
         └─────────────────┘            └──────┬───────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │ CRIAR NOVO DEAL     │
                                    │ POST /deals         │
                                    │ pipeline = Vendas   │
                                    │ stage = Sem Contato │
                                    │ owner = round robin │
                                    │ person_id = X       │
                                    │ company_id = Y      │
                                    │ custom_fields[]     │
                                    │ + Nota estruturada  │
                                    └─────────────────────┘
```

### 4.4 Golden Rule — Proteção de Vendas

> **Se existe um deal ABERTO no pipeline de VENDAS, o sistema NUNCA sobrescreve o owner_id nem o stage_id.**

Isso garante:
- Continuidade do atendimento comercial
- O vendedor que abriu a negociação mantém a titularidade
- O `lia-assign` lê o owner do deal como source of truth e propaga de volta para `lia_attendances.proprietario_lead_crm`

### 4.5 Mensagens Outbound

| Fonte | Mensagem → Lead | Mensagem → Vendedor |
|-------|-----------------|---------------------|
| **LIA** (dra-lia, whatsapp_lia, handoff_lia) | AI Greeting personalizada (Gemini 2.5 Flash Lite) | AI Briefing estruturado (DeepSeek) |
| **Formulário/Outros** | Template message (`cs_automation_rules`) | AI Briefing estruturado (DeepSeek) |

**AI Greeting**: Mensagem 3-4 linhas, profissional, menciona conversa com Dra. L.I.A.  
**Template Message**: Busca em `cs_automation_rules` WHERE trigger_event = "NOVO_LEAD", prioriza regras do team_member e do produto_interesse.  
**AI Briefing**: Notificação estruturada com dados do lead, última pergunta, análise cognitiva, histórico e oportunidade.

---

## 5. Ações Disparadas

### 5.1 Cadeia de Orquestração Pós-Ingestão

```
                    ┌────────────────────┐
                    │  Formulário / API   │
                    └────────┬───────────┘
                             │
                    ┌────────▼───────────┐
                    │ smart-ops-ingest-  │
                    │ lead               │
                    └────────┬───────────┘
                             │
           ┌─────────────────┼─────────────────┬──────────────┐
           │                 │                 │              │
  ┌────────▼────────┐ ┌─────▼──────┐ ┌───────▼──────┐ ┌────▼─────────┐
  │ smart-ops-lia-  │ │ cognitive- │ │ SellFlux V2  │ │ SellFlux V1  │
  │ assign          │ │ lead-      │ │ (Campanhas)  │ │ (Leads)      │
  │ (CRM Sync)     │ │ analysis   │ │              │ │              │
  └────────┬────────┘ └─────┬──────┘ └──────────────┘ └──────────────┘
           │                │
  ┌────────▼────────┐ ┌─────▼──────────────┐
  │ WaLeads         │ │ lia_attendances    │
  │ (AI greeting +  │ │ UPDATE:            │
  │  briefing)      │ │ cognitive_analysis │
  └─────────────────┘ │ lead_stage_detected│
                      │ confidence_score   │
                      │ urgency_level      │
                      │ etc.               │
                      └────────────────────┘
```

### 5.2 Registro na Timeline

Cada ingestão gera um evento em `lead_activity_log`:

| Fonte | `event_type` | `entity_type` |
|-------|-------------|--------------|
| Meta Ads | `meta_ads_lead_entry` | `meta_ads` |
| SellFlux | `sellflux_lead_entry` | `form` |
| Formulário | `form_submission` | `form` |
| Outros | `lead_ingested` | `form` |

Campos registrados:
```json
{
  "lead_id": "uuid",
  "event_type": "form_submission",
  "entity_id": "form_name ou meta_leadgen_id",
  "entity_name": "Formulário: SDR Scanner",
  "event_data": {
    "label": "Formulário: SDR Scanner",
    "form_name": "SDR Scanner",
    "source": "formulario",
    "utm_source": "google",
    "is_existing": true,
    "fields_updated": ["sdr_scanner_interesse", "cidade"],
    "produto_interesse": "Scanner intraoral",
    "pql_detected": false
  },
  "source_channel": "formulario"
}
```

### 5.3 Intelligence Score

Após ingestão (novo ou existente), o sistema chama:
```sql
SELECT calculate_lead_intelligence_score(p_lead_id := 'uuid');
```
Recalcula o score baseado em:
- Completude de dados (preenchimento dos 76 campos)
- Interações com a Dra. L.I.A.
- Histórico de compras (LTV)
- Atividade no Academy
- Engajamento e-commerce

### 5.4 Análise Cognitiva (DeepSeek)

`cognitive-lead-analysis` processa o lead com DeepSeek v3 para extrair:
- `lead_stage_detected`: visitante → MQL → SAL → SQL → CLIENTE
- `psychological_profile`: Analítico, Expressivo, etc.
- `primary_motivation`: Eficiência, Custo, Qualidade, etc.
- `objection_risk`: Preço, Complexidade, Concorrência, etc.
- `urgency_level`: alta, media, baixa
- `interest_timeline`: imediato, 30d, 90d, indefinido
- `recommended_approach`: Abordagem recomendada para o vendedor
- `confidence_score_analysis`: 0-100

---

## 6. Extração Implícita

### 6.1 Módulo: `lia-lead-extraction.ts`

Este módulo processa o **texto da conversa** do lead com a Dra. L.I.A. para detectar informações implícitas via NLP/regex.

### 6.2 Dados Extraídos

| Categoria | Detecção | Campo atualizado |
|-----------|----------|-----------------|
| **UF** | Nome do estado ("são paulo", "minas gerais") ou padrão "sou de/moro em XX" | `uf` |
| **Impressora** | "tenho/comprei/possuo/uso" + "impressora/printer" (até 30 chars de distância) | `tem_impressora = "sim"` |
| **Scanner** | "tenho/comprei/possuo/uso" + "scanner/escaner" | `tem_scanner = "sim"` |
| **Modelo Impressora** | Match de brands: phrozen, anycubic, elegoo, rayshape, asiga, formlabs, prusa, creality, miicraft, blz, envisiontec, bego, dentsply | `impressora_modelo` |
| **Modelo Scanner** | Match: medit, 3shape, trios, itero, primescan, aoralscan, shining3d | `como_digitaliza` |
| **Software CAD** | Match: exocad, 3shape, blender, meshmixer, dental system, ceramill, zirkonzahn, hyperdent | `software_cad` |
| **Volume Mensal** | Padrão "faço/imprimo N peças/casos" ou "muito/pouco volume" | `volume_mensal_pecas` |
| **Aplicação** | Padrões: provisórios, guias cirúrgicos, modelos, placas, coroas, alinhadores, moldeiras | `principal_aplicacao` |
| **Produto Interesse** | 25+ patterns de marcas e produtos (RayShape, MiiCraft, exocad, Medit, Smart Slice, NanoClean...) | `produto_interesse` |
| **Concorrentes** | 30+ marcas concorrentes: formlabs, nextdent, keystone, bego, sprintray, asiga, stratasys... | `raw_payload.marcas_concorrentes[]` |
| **Estrutura** | "sozinho" vs "equipe/parceiro/sócio" | `raw_payload.estrutura_consultorio` |
| **Conhece SmartDent** | "já conheço/uso smart/cliente smart" | `raw_payload.conhece_smart_dent` |
| **O que imprime** | "imprimo/faço" + tipo de peça | `raw_payload.o_que_imprime` |
| **O que quer imprimir** | "quero imprimir/gostaria de" + tipo | `raw_payload.o_que_quer_imprimir` |

### 6.3 Regra COALESCE

A extração implícita só atualiza campos **que estão atualmente `null`** no banco:

```typescript
for (const [field, value] of Object.entries(updates)) {
  if (field === "raw_payload") {
    // Deep merge com raw_payload existente
    safeUpdates.raw_payload = { ...current.raw_payload, ...value };
  } else if (current[field] === null || current[field] === undefined) {
    // Só preenche se vazio
    safeUpdates[field] = value;
  }
}
```

Isso garante que dados explícitos do formulário nunca sejam sobrescritos por inferências.

---

## 7. Fluxogramas de Processo

### 7.1 Fluxo Completo: Formulário → Lead → CRM → Vendedor

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Visitante   │────▶│ PublicForm   │────▶│ smart-ops-       │
│  preenche    │     │ Page.tsx     │     │ ingest-lead      │
│  /f/:slug    │     │ (frontend)   │     │ (edge function)  │
└─────────────┘     └──────────────┘     └────────┬─────────┘
                                                   │
                    ┌──────────────────────────────┘
                    │
        ┌───────────▼───────────┐
        │ lia_attendances       │
        │ INSERT ou UPDATE      │
        │ (Smart Merge)         │
        └───────────┬───────────┘
                    │
    ┌───────────────┼───────────────────┐
    │               │                   │
┌───▼───────┐ ┌─────▼──────┐ ┌─────────▼──────┐
│ lia-assign│ │ cognitive  │ │ SellFlux sync  │
│ (PipeRun) │ │ analysis   │ │ (bidirecional) │
└───┬───────┘ └────────────┘ └────────────────┘
    │
    ├─── Pessoa PipeRun (find/create)
    ├─── Empresa PipeRun (find/create)  
    ├─── Deal PipeRun (golden rule / create / reactivate)
    │
    ├─── AI Greeting → Lead WhatsApp
    ├─── AI Briefing → Vendedor WhatsApp
    └─── Timeline log
```

### 7.2 Fluxo: Lead Existente (Update + Merge)

```
Payload → email match → lia_attendances
                          │
                    ┌──────▼──────┐
                    │ mergeSmartLead()
                    │              │
                    │ Para cada campo:
                    │  PROTECTED? → skip
                    │  ALWAYS_UPDATE? → overwrite
                    │  MERGE_ARRAY? → append+dedup
                    │  MERGE_JSONB? → deep merge
                    │  default? → COALESCE (só se null)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ UPDATE       │
                    │ lia_attendances
                    │ + audit log  │
                    │ + form_submissions[]
                    └──────┬──────┘
                           │
                    ┌──────▼──────────────┐
                    │ intelligence_score   │
                    │ recalculation        │
                    └─────────────────────┘
```

---

## 8. Matriz de Rastreabilidade

### 8.1 Tabelas Envolvidas

| Tabela | Papel |
|--------|-------|
| `lia_attendances` | Hub central do lead (CDP) |
| `smartops_forms` | Definição de formulários |
| `smartops_form_fields` | Campos de cada formulário |
| `lead_activity_log` | Timeline de eventos |
| `lead_enrichment_audit` | Auditoria de merge/enriquecimento |
| `team_members` | Vendedores e equipe |
| `cs_automation_rules` | Regras de automação de mensagens |
| `deals` | Deals sincronizados do PipeRun |
| `deal_items` | Itens de proposta por deal |
| `people` | Grafo de identidade (pessoas) |
| `companies` | Grafo de identidade (empresas) |
| `identity_keys` | Chaves de identidade (email, phone, cpf) |
| `system_health_logs` | Logs de erro do sistema |
| `ai_token_usage` | Consumo de tokens IA |

### 8.2 Edge Functions Envolvidas

| Função | Trigger | Responsabilidade |
|--------|---------|-----------------|
| `smart-ops-ingest-lead` | POST (forms, webhooks) | Ingestão e merge de leads |
| `smart-ops-lia-assign` | Fire-and-forget do ingest | CRM sync + seller routing |
| `cognitive-lead-analysis` | Fire-and-forget do ingest | Análise cognitiva DeepSeek |
| `smart-ops-send-waleads` | Chamado pelo lia-assign | Envio de mensagens WhatsApp |
| `smart-ops-sellflux-sync` | Fire-and-forget do ingest | Sincronização SellFlux |
| `backfill-intelligence-score` | Batch/cron | Cálculo de scores e portfolio |

### 8.3 Controles de Qualidade

| Controle | Implementação |
|----------|--------------|
| Dedup por email | `lia_attendances.email` UNIQUE |
| Dedup por telefone | Trigger `auto_dedup_by_phone()` |
| Filtro de teste | Test domains + regex no ingest-lead |
| Idempotência CRM | Check 5min no lia-assign |
| Golden Rule | Deal aberto em Vendas → owner preservado |
| Audit trail | `lead_enrichment_audit` com before/after |
| Timeline | `lead_activity_log` para cada evento |
| Health monitoring | `system_health_logs` para erros |
| Token tracking | `ai_token_usage` para custos IA |

---

## Histórico de Revisões

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0 | 19/03/2026 | Lovable AI | Criação inicial — Auditoria completa |
