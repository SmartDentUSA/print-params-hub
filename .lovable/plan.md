

# Plano: Mostrar TODOS os campos no detalhe do Lead

## Problema
O `KanbanLeadDetail` mostra apenas ~40 campos, mas a tabela `lia_attendances` tem ~150+ colunas. Faltam seções inteiras: Pessoa (CPF, cargo, LinkedIn), Empresa (CNPJ, razão social, segmento), Loja Integrada (pedidos, endereço), Astron (cursos, planos), SDR (interesses granulares), PipeRun estendido (probabilidade, MRR, frozen), e campos novos (informacao_desejada, codigo_contrato, data_treinamento, produto_interesse_auto).

## Abordagem

1. **LEAD_SELECT → `*`**: Em vez de listar 60+ campos manualmente, usar `select("*")` para buscar tudo. Mais simples e à prova de futuro.

2. **Lead interface → tipo genérico**: Expandir o tipo `Lead` com todos os campos da tabela (ou usar `Record<string, any>` com cast).

3. **KanbanLeadDetail → seções colapsáveis**: Adicionar seções com `Collapsible` (já importado) para cada grupo de dados, mostrando apenas se houver dados:

| Seção | Campos |
|---|---|
| Contato | email, telefone, cidade/uf (já existe) |
| Comercial | produto_interesse, valor, proprietário, funil, status, itens proposta, motivo perda (já existe) |
| Perfil | area_atuacao, especialidade, impressora, scanner, CAD, etc. (já existe) |
| Análise IA | stage, urgência, perfil psicológico, etc. (já existe) |
| PipeRun | pipeline, etapa, título, **+ probabilidade, MRR, lead_time, frozen, description, observation, hash, last_contact_at, stage_changed_at, closed_at** |
| **Pessoa** (NOVO) | pessoa_cpf, pessoa_cargo, pessoa_genero, pessoa_nascimento, pessoa_linkedin, pessoa_facebook, pessoa_observation |
| **Empresa** (NOVO) | empresa_nome, empresa_razao_social, empresa_cnpj, empresa_ie, empresa_segmento, empresa_porte, empresa_situacao, empresa_website, empresa_cnae |
| **SDR Interesses** (NOVO) | sdr_scanner_interesse, sdr_impressora_interesse, sdr_software_cad_interesse, sdr_caracterizacao_interesse, sdr_cursos_interesse, sdr_dentistica_interesse, sdr_insumos_lab_interesse, sdr_pos_impressao_interesse, sdr_solucoes_interesse, sdr_marca/modelo_impressora_param, sdr_resina_param, sdr_suporte_* |
| **Loja Integrada** (NOVO) | lojaintegrada_cliente_id, último pedido (número, data, valor, status), forma pagamento, envio, endereço, itens_json, cupom_desconto, utm_campaign |
| **Astron** (NOVO) | astron_user_id, astron_status, astron_plans_active, astron_courses_total, astron_courses_completed, astron_last_login_at, astron_login_url |
| Equipamentos & Técnico | (já existe) |
| Itens da Proposta | (já existe) |
| Origem & Meta | source, UTMs completas (source, medium, campaign, term), IP, país, **+ informacao_desejada, codigo_contrato, data_treinamento, produto_interesse_auto, form_name** |
| Mensagens | (já existe) |

4. **Seções colapsáveis com auto-hide**: Cada nova seção só aparece se pelo menos 1 campo do grupo tiver valor. Usar `Collapsible` com estado fechado por padrão para não sobrecarregar.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `SmartOpsKanban.tsx` | Trocar LEAD_SELECT por `"*"` |
| `KanbanLeadCard.tsx` | Expandir interface Lead com todos os campos da tabela |
| `KanbanLeadDetail.tsx` | Adicionar 6 novas seções colapsáveis (Pessoa, Empresa, SDR, Loja Integrada, Astron, PipeRun estendido) + campos faltantes nas seções existentes |

