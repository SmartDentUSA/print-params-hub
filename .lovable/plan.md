

## Plano: Parser `piperun_cs` com mapeamento de Tags como gatilhos de liberação

### Contexto
O campo **Tags** do CSV do Funil CS contém gatilhos de liberação de aulas/materiais na plataforma (ex: `cursos-onboarding`, `cursos-lives`, `cursos-caracterizacao`, `plataforma-confirmada`, `bot-treinamento`). Não são tags de jornada CRM — são indicadores de progresso no treinamento.

### Implementação

#### 1. Novo parser `parsePiperunCS` em `src/utils/leadParsers.ts`

**Mapeamento de etapas CS** (baseado em `piperun-field-map.ts` `STAGES_CS_ONBOARDING`):
- "CS - Em espera" → `cs_em_espera`
- "CS - Sem data (Agendar)" / "CS - Sem Data" → `cs_sem_data_agendar`
- "CS - Agendado" / "CS - Treinamento Agendado" → `cs_treinamento_agendado`
- "CS - Treinamento realizado" → `cs_treinamento_realizado`
- "CS - Não quer imersão" → `cs_nao_quer_imersao`
- "CS - Enviar imp3D" → `cs_enviar_imp3d`
- "CS - Equipamentos entregues" → `cs_equipamentos_entregues`
- "CS - Acompanhamento 15 dias" → `cs_acompanhamento_15d`
- "CS - Acompanhamento finalizado" → `cs_finalizado`
- "Auxiliar E-mail" → `cs_auxiliar_email`
- Demais → `cs_em_espera` (fallback)

**Tags como gatilhos de treinamento** — converter tags do CSV em:
- `cs_treinamento` field: derivar de tags presentes
  - Se contém `cursos-onboarding` ou `plataforma-confirmada` → `"iniciado"`
  - Se contém `cursos-lives` ou `cursos-caracterizacao` ou `cursos-kit-imp` → `"realizado"`
  - Se contém `bot-treinamento` → `"pendente"`
  - Default → `"pendente"`
- `tags_crm`: migrar as tags via `migrateSellFluxTags()` para normalizar prefixos (`CS_ONBOARDING_INICIO`, `CS_TREINAMENTO_OK`, etc.)

**Fallback de dados Empresa → Pessoa:**
- Email: `E-mail (Pessoa)` → `E-mail de contato (Empresa)` (validar `@`)
- Telefone: `Telefone Principal (Pessoa)` → `Whatsapp` → `Telefone principal (Empresa)`
- Cidade/UF: Pessoa → Empresa

**Campos CS-específicos:**
- `id_cliente_smart` ← `Banco de Dados ID`
- `data_contrato` ← `CÓDIGO CONTRATO` ou `DATA TREINAMENTO`
- `funil_entrada_crm` = `"CS Onboarding"` fixo

#### 2. Registrar no `PARSER_MAP` e `PARSER_OPTIONS`
- Key: `piperun_cs`
- Label: "PipeRun Funil CS Onboarding"
- Override: false

#### 3. Atualizar `parsePiperunFull` com fallback Empresa
Adicionar cascata `E-mail de contato (Empresa)`, `Telefone principal (Empresa)`, `Endereço - Cidade (Empresa)`, `Endereço - Estado (UF) (Empresa)` ao parser existente.

### Arquivos modificados
- `src/utils/leadParsers.ts` — novo parser + fallback empresa no `piperunFull`

