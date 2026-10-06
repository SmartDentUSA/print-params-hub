# Nova aba "Automação de e-mails sequenciais" na Central de Campanhas

## O que o usuário verá

Uma nova aba na Central de Campanhas com 3 áreas:

### 1. Públicos (criar, salvar e reutilizar)
Construtor de filtros combináveis (E / OU), com contagem de leads ao vivo e prévia de 20 nomes:
- Data de cadastro no CRM (período)
- Leads de formulário(s) específico(s) (com data do envio)
- Leads de campanha(s) / anúncio(s)
- Funil e etapa atual do CRM + data de entrada na etapa
- Participantes de treinamentos (curso/turma, presença)
- Origem do lead
- Equipamentos presentes em propostas ganhas (scanner, impressora, CAD)
- Quem comprou resinas + seleção de resinas específicas (itens de propostas ganhas)
- Qualquer outro campo da tabela de leads (campo + operador + valor)
Sempre só leads canônicos (não mesclados). Públicos salvos com nome e descrição.

### 2. Réguas (editor visual em blocos, igual ao de respostas de formulários)
Toda régua começa obrigatoriamente por um nó "Origem: Público" (público salvo). Nós disponíveis:
- **E-mail**: nome do remetente, assunto, pré-cabeçalho, editor HTML com prévia ao vivo, e botão "Gerar com IA" no padrão visual Smart Dent, usando qualquer combinação de: produto(s) do catálogo, postagem(ns) do Instagram (imagem + texto baseado na legenda), conteúdos da base de conhecimento. Sem preços (regra existente).
- **Espera**: X minutos/horas/dias, ou até uma data/hora.
- **Condição**: abriu o e-mail / clicou / clicou em link específico → caminhos Sim / Não (com tempo limite).
- **WhatsApp**: editor de mensagem com variáveis ({{nome}} etc.) e seletor da instância a usar.
- **SMS**: editor com contador de caracteres.
- **Envio**: imediato, depois de X minutos, ou data marcada.
- **Saída automática** (configuração da régua): sair quando o lead converter (negócio ganho), fizer novo cadastro de formulário ou mudar de etapa no funil de vendas.

Lista de réguas com status (rascunho/ativa/pausada), quantos leads em cada nó, enviados, abertos, cliques, saídas.

### 3. Acompanhamento
Por régua: leads inscritos, posição atual de cada um, histórico de envios e motivos de saída.

## Regras mantidas
- E-mail continua na janela 07:30–19:00 e no limite de 499/dia.
- WhatsApp usa as credenciais próprias de cada instância.
- Nada altera funis, negócios ou o painel do lead.

## Detalhes técnicos
- Tabelas novas: `email_audiences` (definição JSON dos filtros), `email_flows` (nós/arestas do ReactFlow + regras de saída), `email_flow_enrollments` (lead, nó atual, próximo horário, status, motivo de saída), `email_flow_events` (envios/aberturas/cliques/condições). Grants + RLS restritos a admin/equipe.
- RPC `fn_audience_resolve(definition jsonb, preview bool)` monta a consulta parametrizada sobre `lia_attendances` (+ deals, itens de propostas ganhas, inscrições de cursos, envios de formulário, histórico de etapas) com `merged_into IS NULL`; sem SQL livre.
- Editor visual reaproveita o padrão do `SmartOpsFormFlowPreview`/ReactFlow; editor HTML reaproveita `EmailHtmlEditor`.
- IA: ampliar `smart-ops-generate-email-ai` para receber produtos, posts do Instagram e artigos da base como contexto.
- Executor: nova rotina `email-flow-runner` a cada 5 min, com lote limitado, trava única, marcação idempotente; envia e-mail pela fila Gmail existente, WhatsApp pela Evolution da instância escolhida, SMS pelo DisparoPro; checa regras de saída antes de cada passo. Rastreamento de abertura/clique reaproveita `email-track-open` e adiciona rastreio de clique.
- As réguas antigas (`email_sequences`) continuam funcionando; o botão "Criar régua" passa a abrir a nova aba.

## Entrega em etapas
1. Tabelas + construtor de Públicos.
2. Editor visual de régua + nós + IA de e-mail.
3. Executor automático + acompanhamento.
