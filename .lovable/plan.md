# Portal Profissional Parceiro (evolução do portal de cursos KOL)

## Objetivo

Transformar a página `/portal-cursos/:token` (hoje "Meus cursos") no **Portal Profissional Parceiro**: o lugar onde o profissional acompanha toda a parceria — indicações, comissões, cursos (colaboração Smart Dent e próprios), inscritos, lista de espera e engajamento nas redes.

## 1. Renomeação e identidade

- Título da página passa a **"Portal Profissional Parceiro"**, com a foto do profissional (`prof_photo_url`) no cabeçalho.
- Mesmo nome e dados refletidos no card do profissional no SmartOps (link/botão passa a se chamar "Portal Profissional Parceiro").

## 2. Seção de transparência da parceria (já existe parcialmente)

- Manter e consolidar os dados já estipulados: indicações, comissionamento, conversão (card de contrato/comissões já existente no portal).

## 3. Cursos em colaboração Smart Dent (smartops_courses vinculados ao profissional)

Para cada curso, além do nome:

- **Métricas:** Visualizações | Inscritos | Lista de espera | Confirmados | Avaliações (média e quantidade, vindas de `smartops_nps_responses`).
- **Perfil do público** (a partir das respostas do formulário de inscrição):
  - Quantos são clientes Smart Dent x quantos não são (cruzamento com deals ganhos);
  - Área de atuação e Especialidade;
  - Marcas de scanner, de impressora e de pós-cura dos participantes — listas com o que os leads responderam;
  - "Qual a maior dor atual no atendimento" e demais perguntas do formulário, com itens e quantidade de respostas.
- **Inscritos confirmados:** lista com Nome | E-mail | Área de atuação | Especialidade | Celular | botão **Chamar no WhatsApp** (wa.me com o número do inscrito, mensagem pré-pronta: "Olá {nome}, tudo bem? Aqui é o {profissional}. O que você achou do curso? Se puder faça uma avaliação, seu feedback é muito importante para nós" + link NPS do curso correspondente).
- **Lista de espera:** mesma lista com botão **Chamar no WhatsApp** e mensagem: "Olá {nome}, tudo bem? Aqui é o {profissional}. Que pena que desta vez você não consegui participar do curso. Quando liberar a próxima turma, você teria interesse em participar? Vamos avisar com 30 dias de antecedência."

## 4. Cursos enviados pelo próprio profissional (professional_courses)

- O botão público **"Quero participar"** deixa de apontar para URL externa e passa a abrir o **formulário dinâmico com cara de WhatsApp** (mesmo padrão dos formulários do sistema), gerado automaticamente com a URL correta do curso.
- **Ingestão seguindo a regra de ouro**, com origem `# CHAT - Qualificação Curso - Profissional` e produto de interesse do curso.
- **Nota no card do CRM** com: "O lead preencheu o formulário para participar do curso {título}, {modalidade}, datas, carga horária e vagas" + link de informações do curso.
- **Exceção à regra de ouro:** se o lead já é cliente (deal ganho), apenas insere a nota e atualiza os campos preenchidos — **não cria novo deal** e **não altera a origem do deal existente no funil CS** (rastreabilidade preservada).
- Métricas por curso: Visualizações | Inscrições via formulário | Chamar no WhatsApp, com a mesma lista de inscritos (nome, e-mail, especialidade, celular, botão WhatsApp).

## 5. Seção Engajamento — redes sociais

- Foto do perfil | Seguidores | Posts | Engajamento, por rede, com visão dia a dia.
- Fonte: métricas dos posts publicados pelo pipeline de reels KOL (`social_posts` sincronizados via Zernio) e contas vinculadas; quando não houver dados, exibir estado vazio explicativo (sem inventar números).

## 6. Implementação técnica

- **Edge function `professional-course-portal`**: novas ações somente-leitura — `course_stats` (métricas + perfil de público + listas de inscritos/espera por curso) e `social_stats`. Tudo escopado pelo `lead_id` do token (nunca por IDs enviados pelo cliente), mantendo o padrão de segurança atual.
- **Ingestão do formulário WhatsApp dos cursos próprios:** reutilizar o fluxo dinâmico existente (mesma edge de ingestão de formulários), passando origem fixa `# CHAT - Qualificação Curso - Profissional` e metadados do curso; a exceção "cliente ganho → só nota" será implementada no caminho de ingestão, sem tocar nas regras dos funis Vendas/CS nem em `LeadDetailPanel.tsx`.
- **Frontend:** `ProfessionalCoursePortal.tsx` reorganizado em seções (Parceria, Cursos Smart Dent, Meus cursos, Engajamento), novos componentes em `src/components/smartops/courses/portal/`.
- Timeline KOL: novas visualizações relevantes registradas via `fn_kol_log` onde fizer sentido (ex.: profissional chamou inscrito no WhatsApp — registro por clique, sem bloquear).

## 7. O que NÃO será alterado

- Regras de ingestão/CRM existentes, funis Vendas/CS, `LeadDetailPanel.tsx`, Evolution/WaLeads, guardas do Painel Comercial.
- Nenhum dado inventado: seções sem dados mostram estado vazio.

## 8. Verificação

- Teste com o token de exemplo (`/portal-cursos/koltesttoken...`) cobrindo: renomeação, métricas de curso colaboração, listas com botões WhatsApp (links wa.me corretos), formulário WhatsApp do curso próprio gerando lead com a origem correta e nota no CRM, e seção de engajamento.
