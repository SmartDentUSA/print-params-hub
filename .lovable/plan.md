

## Plano: Mapeamento Completo PipeRun + Configuracao SellFlux

### Status das Conexoes

| Servico | API Key | Status |
|---------|---------|--------|
| **PipeRun** | `PIPERUN_API_KEY` | Conectado e funcionando |
| **SellFlux** | `SELLFLUX_API_KEY` | **NAO CONFIGURADA** |

### Dados Mapeados do PipeRun (via API)

#### Funis (Pipelines) - 10 funis

| ID | Nome | Tipo |
|----|------|------|
| 18784 | Funil de vendas | Vendas (principal) |
| 73999 | Funil Atos | Vendas |
| 39047 | Exportacao | Vendas |
| 70898 | Distribuidor de Leads | Vendas |
| 72938 | Funil Estagnados | Vendas |
| 82128 | Funil E-book | Vendas |
| 83813 | Tulip-Teste-Nv-Automacao | Vendas |
| 83896 | CS Onboarding | Customer Success |
| 93303 | Interesse em cursos | Vendas |
| 100412 | Funil Insumos | Vendas |

#### Etapas (Stages) - 74 total (amostra)

Funil Insumos (100412): Sem Contato → Contato Feito → Amostra Enviada → Retorno Amostra → Fechamento

CS Onboarding (83896): Treinamento Agendado → Treinamento Realizado → Acompanhamento 15 Dias CS → Acompanhamento Atencao → Acompanhamento Finalizado → Nao quer Imersao

#### Usuarios (Vendedores)

| ID | Nome | Email |
|----|------|-------|
| 100600 | Marcela Brito | marcela.brito@smartdent.com.br |
| 98054 | Gabriella Ferreira | gabriella.ferreira@smartdent.com.br |
| (+ outros na pagina 2) |

#### Campos Customizados (20 campos)

**Deal (belongs=1):**
- `549059` Especialidade principal (texto)
- `549058` Produto de interesse (texto)
- `549148` Produto de interesse (auto) (texto)
- `549150` Whatsapp (texto)
- `549241` Area de atuacao (texto)
- `549242` Tem scanner (texto)
- `549243` Tem impressora (texto)
- `621083` Pais de Origem (texto)
- `623602` Informacao desejada (texto)
- `650066` Banco de Dados ID (numerico)
- `673917` CODIGO CONTRATO (texto)
- `673925` DATA TREINAMENTO (texto)

**Person/Organizacao (belongs=2):**
- `445631` Especialidade principal (dropdown: CLINICO GERAL, IMPLANTODONTISTA, etc.)
- `546566` Tem impressora (dropdown: SIM/NAO)
- `546567` Tem scanner (dropdown: SIM/NAO)
- `546568` Informacao desejada (texto)
- `646806` ID Banco de Dados (numerico)
- `673900` AREA DE ATUACAO (dropdown)

**Pessoa (belongs=3):**
- `674001` Area de Atuacao (dropdown)
- `674002` Especialidade (dropdown)

### Mapeamento PipeRun → lia_attendances

```text
PipeRun Deal                  →  lia_attendances
─────────────────────────────────────────────────
deal.id                       →  piperun_id
deal.title                    →  (parse nome)
deal.pipeline_id              →  funil_entrada_crm
deal.stage_id                 →  ultima_etapa_comercial
deal.owner_id                 →  proprietario_lead_crm
deal.status (0/1/2)           →  status_oportunidade
deal.value                    →  valor_oportunidade
deal.created_at               →  data_primeiro_contato
deal.closed_at                →  data_fechamento_crm
person.name                   →  nome
person.emails                 →  email
person.phones                 →  telefone_raw/normalized
person.job_title              →  area_atuacao
cf[549059] Especialidade      →  especialidade
cf[549058] Produto interesse  →  produto_interesse
cf[549242] Tem scanner        →  tem_scanner
cf[549243] Tem impressora     →  tem_impressora
cf[621083] Pais de Origem     →  pais_origem
cf[650066] Banco de Dados ID  →  id_cliente_smart
```

### Proximos Passos

1. **SellFlux**: Preciso da API key para configurar como secret e mapear os campos/templates disponiveis
2. **Implementacao**: Criar `_shared/piperun-field-map.ts` com o mapeamento acima (IDs de campos, stages e pipelines) para uso centralizado em todas as edge functions
3. **Sync bidirecional**: Usar esse mapeamento no `smart-ops-sync-piperun` e no `smart-ops-piperun-webhook`

### Acao Necessaria do Usuario

Fornecer a **API Key do SellFlux** para eu configurar como secret (`SELLFLUX_API_KEY`). Voce pode encontra-la no painel do SellFlux em Configuracoes → API/Integracao.

