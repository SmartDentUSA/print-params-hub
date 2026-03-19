
# Gerar Documento de Auditoria ISO — Workflow 7×3, Formulários e CRM

## Escopo do documento
Criar `/docs/AUDITORIA_WORKFLOW_FORMULARIOS_CRM.md` com documentação detalhada para o time de engenharia e processos ISO, cobrindo:

1. **Workflow Portfolio 7×3** — 7 etapas × subcategorias × 3 camadas (ativo/conc/sdr)
   - Mapeamento de todas as colunas do banco → células da grade
   - Regras de prioridade e classificação
   - Momento de leitura e construção do portfolio

2. **Formulários** — Criação, estrutura, campos disponíveis, submissão
   - Tabelas `smartops_forms` + `smartops_form_fields`
   - 76 campos base com mapeamento direto `db_column`
   - Fluxo de rendering em `PublicFormPage`

3. **Ingestão de leads** — `smart-ops-ingest-lead`
   - Detecção de campos, normalização de telefone, filtro de emails de teste
   - Smart Merge com categorias de campos (PROTECTED, ALWAYS_UPDATE, MERGE_ARRAYS)
   - Auditoria em `lead_enrichment_audit`
   - Novo lead vs lead existente (update vs insert)

4. **Envio ao CRM** — `smart-ops-lia-assign`
   - Hierarquia Pessoa → Empresa → Deal no PipeRun
   - Golden Rule (deal aberto em Vendas = never touch owner)
   - Round-robin de vendedores
   - Mensagens outbound (AI greeting vs template)

5. **Ações disparadas** — Orquestração pós-ingestão
   - Timeline (`lead_activity_log`)
   - Intelligence score recalculation
   - Cognitive analysis (DeepSeek)
   - SellFlux sync bidirecional

6. **Extração implícita** — `lia-lead-extraction.ts`
   - NLP sobre texto da conversa para detectar UF, equipamentos, concorrentes

## Formato
Documento .md completo, pronto para auditoria, com diagramas ASCII, tabelas de mapeamento e fluxogramas de processo.
