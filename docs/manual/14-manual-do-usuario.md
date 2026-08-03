# Manual do Usuário — Smart Dent | Fluxo Digital

Guia prático, tela por tela e aba por aba. Cada item traz: **para que serve**, **como usar (passo a passo)**, **cuidados**.

Acesso: `/admin` (painel interno), `/social` (Social Publisher), `/painel-comercial` (TV da sala comercial).
Perfis: `admin` (tudo), `vendedor` (Smart Ops comercial), `cs` (pós-venda/treinamentos), `distribuidor` (somente Distribuição).

---

## 0. Barra de ações global (Smart Ops)

Aparece no topo de qualquer tela Smart Ops.

| Botão | Quando usar | Passo a passo |
|---|---|---|
| **Sync Incremental** | após mexer algo no PipeRun e querer ver no sistema | clicar → aguardar toast de conclusão → clicar **Atualizar** |
| **Full Sync** | só em conciliação geral (demora minutos) | avisar o time → clicar → não sair da tela → conferir Relatórios depois |
| **Exportar Tudo** | extrair base de leads/deals em CSV | clicar → aguardar o processamento → o download inicia sozinho |
| **Atualizar** | tela com dado velho | clicar (recarrega apenas a seção) |

Cuidados: **Full Sync** e **Exportar Tudo** não têm desfazer. Exportação contém dado pessoal — não repassar fora da empresa.

---

## 1. Catálogo

### 1.1 Modelos
Para que serve: cadastrar marcas, modelos de impressoras/scanners e resinas que sustentam as páginas de parâmetros.
Como usar: **Novo** → aba **Informações Básicas** (nome, marca, tipo; o slug é gerado automaticamente) → aba **Imagem** (upload) → **Salvar**.
Cuidados: mudar o nome muda o slug e o endereço público. Desative em vez de excluir.

### 1.2 Produtos (Gestão de Catálogo)
**Aba Catálogo**
1. **Novo produto** → preencher nome, categoria, descrição → **Salvar**.
2. Em **Variações**, clicar **Nova variação** e informar nome + peso/tamanho (aparece no rótulo, ex.: “… — 250 grs”).
3. Marcar a caixa **Dist.** nas variações que devem aparecer no catálogo de Distribuição (controle item por item).
4. Em **Documentos**, vincular fichas técnicas e laudos. Em **Kits**, montar os componentes.

**Aba Mapeamento de SKU**
1. Filtrar **Fora do catálogo** para ver itens que vieram das propostas do CRM sem SKU.
2. Selecionar o item → se existir no catálogo, **Vincular SKU** à variação correta.
3. Se não existir, **Criar nome canônico** e definir categoria/subcategoria.
4. Usar **Sugerir match** para acelerar; sempre revisar a sugestão.
Cuidados: vincular na variação errada contamina relatórios de mix de produto.

### 1.3 Docs Sistema
Upload e metadados de fichas técnicas/manuais. **Upload** → **Editar metadados** → **Vincular a produto/resina**.

---

## 2. Conteúdo

### 2.1 Artigos
Abas de tela: **Calculadoras ROI**, **Validador de Links**, **Casos de Suporte**.
Abas do artigo: **Conteúdo · Geração IA · SEO · FAQs · Mídia · Conversão**.
Passo a passo: **Novo artigo** → **Geração IA** para rascunho → revisar em **Conteúdo** → **SEO** (título até 60 caracteres, descrição até 160) → **FAQs** → **Mídia** → **Injetar cards de produto** se aplicável → **Validar links** → **Publicar** (dispara ping de indexação no Google).
Cuidado obrigatório: **nunca** incluir preços em conteúdo gerado.

### 2.2 Knowledge Hub
Abas **FAQs Comerciais · Fichas Técnicas · Casos de Sucesso**. Tudo que é salvo aqui alimenta as respostas da Dra. LIA — escreva já pensando na resposta ao cliente.

### 2.3 Autores
Cadastro de autor com bio, credenciais, foto e assinatura (usado para autoridade/E-E-A-T). Preencher todos os campos antes de assinar artigos.

---

## 3. Smart Ops — Comercial

### 3.1 Bowtie
Leitura apenas: aquisição → retenção → expansão. Selecionar o período e comparar etapas.

### 3.2 Público / Lista (ficha do lead)
1. Buscar o lead por nome, telefone, e-mail, CNPJ ou CPF.
2. Abrir a ficha e navegar pelas abas: dados do CRM, **ERP/Omie**, **Financeiro**, **CS** (treinamentos e NPS), **Timeline unificada** (formulários, atividades do CRM, mensagens, pedidos).
3. Ações: **Enviar WhatsApp**, **Enviar e-mail**, **Nota do vendedor**, **Reprocessar lead**, **Abrir no PipeRun**.
Cuidados: mudança de etapa do Funil de Vendas é feita **no PipeRun** (o botão de mover foi desativado de propósito). Nunca fundir manualmente leads de empresas diferentes.

### 3.3 Equipe
1. Abrir o membro → conferir `role`, metas e ID do PipeRun.
2. Seção **Evolution API** (conversas individuais): informar telefone e chave da instância → **Testar conexão**.
3. Seção **EvolutionGO** (grupos): ativar e testar separadamente.
4. Ativar/desativar o membro controla a entrada dele no sorteio de leads.
Cuidados: membro sem ID PipeRun válido gera erro na criação de negócio; instância desconectada não envia briefing.

### 3.4 Automações
Abas **Comercial** e **Fora do horário**: editar e ativar/desativar regras existentes. Criar nova automação ainda não está disponível.

### 3.5 Logs
Aba **Envios** (mensagens que saíram) e **Chegada** (leads que entraram). Use os filtros de período/canal/status para investigar “o lead não recebeu”.

### 3.6 Relatórios
Selecionar o mês → ler receita (maior valor entre CRM ganho e faturamento Omie, somado ao LTV de e-commerce), pipeline, mix de produto e metas → **Exportar**.

### 3.7 Saúde do Sistema
Abas **Check · Entrada · Funções · Logs**. Ver o semáforo, clicar **Executar Watchdog** se houver alerta e marcar ✔ nos itens resolvidos.

### 3.8 WhatsApp
Sincronizar grupos, ver filas, disparar broadcast, capturar conversas, revisar templates.
Regra fixa: individual sai pela Evolution; grupo sai pela EvolutionGO. Antes de disparar, confirme que a instância está conectada.

### 3.9 Formulários
1. **Novo formulário** → **Editar campos** (tipos, obrigatórios, condicionais) → **Publicar**.
2. **Copiar link curto** para usar em campanhas (não gere URL nova).
3. **Ver respostas** e **Métricas** para conversão.

### 3.10 Treinamentos
1. **Nova inscrição** → buscar o cliente (nome, telefone, CNPJ ou CPF) → selecionar o negócio ganho.
2. Matricular, adicionar acompanhantes e **Criar grupo WA** da turma.
3. Após o treinamento: **Gerar certificado**/crachás. O NPS sai automaticamente 24 h depois.

### 3.11 Tokens IA / AI Routing
Consulta de consumo por modelo e definição de qual modelo atende cada tarefa (**Salvar rota**, **Testar**). Telas de configuração — alterar só com orientação técnica.

### 3.12 Intelligence / Sentinela
Abas **Visão geral** e **Sentinela** (momentum, intenção de compra, atrito, concorrência, previsão, configuração). Use os filtros 24 h / 7 d / 30 d para priorizar contatos do dia.

### 3.13 ROI
Montar os cartões que alimentam a calculadora pública: estágios do fluxo digital, itens e tipos de CAD.

### 3.14 Mapeamento 7×3
Abas **SDR · Produtos · Concorrentes · Regras**. É daqui que sai o briefing enviado ao vendedor — manter atualizado melhora a abordagem.

### 3.15 Campanhas
Abas: **Biblioteca · Criar · Rascunhos · Histórico · Grupos WA · Origens · Mapeamentos · Link na bio**.
- **Origens**: revisar formulários Meta, formulários do sistema e origens orgânicas; mapear cada origem para produto e célula 7×3.
- **Criar (e-mail)**: 1) segmentar leads · 2) escolher canal · 3) escrever mensagem usando o link curto existente → **Enviar teste** → **Agendar** (janela 07:30–19:00, ~499 e-mails/dia).
- **SMS**: 160 caracteres (7-bit) ou 70 (8-bit); conferir saldo antes.
- **Grupos WA**: disparo com dedupe e intervalo entre grupos.
- **Histórico**: enfileirados × enviados × erros.

### 3.16 Distribuição
Abas **Cadastro · Catálogo · Tabela de Preço · Proposta**, mais a galeria **Mídias & Artes** (Google Drive) e o **Kit do distribuidor** em 3 idiomas. Único acesso do perfil `distribuidor`.

### 3.17 Reativação & Fluxos
Abas: **LTV** (réguas de recompra) · **Fluxos** (editor visual: arrastar nós, ligar, **Salvar** cria versão) · **Ingestão** e **CRM** (reprocessar/conciliar) · **Normalizar Campos** (escolher o valor canônico de cada um dos 32 campos) · **Configurações**.

### 3.18 Eventos
Cadastro de eventos com geração de imagem e texto por IA; publicação em `/eventos`.

### 3.19 Copilot
Pedir em linguagem natural: relatórios, envio de WhatsApp/SMS, consultas de lead e histórico de negócios. Respostas curtas e sem invenção; ações destrutivas exigem confirmação explícita.

### 3.20 Rayshape
Status das impressoras Rayshape por lead e donos manuais.

### 3.21 Stripe / Pagamentos
Assinaturas, eventos de webhook e licenças. Botões: **Reprocessar evento**, **Vincular pagamento a lead**, **Enviar cobrança**.

### 3.22 Cursos
Abas **Agendamentos · Catálogo · Inscrições · Imersões (pública) · Ao vivo (pública) · Calendário**. Criar curso → gerar turmas recorrentes → divulgar `/inscricao/:slug`.
Cuidado: turma com alunos matriculados não pode ser recriada.

---

## 4. Ferramentas
Cinco utilitários na mesma tela: exportar apostila, enriquecer artigo, reformatar artigo, páginas de parâmetros e vincular vídeos a produtos. Rode um por vez e confira o resultado antes do próximo.

## 5. PandaVideo
Sincronizar vídeos, testar player e ver analytics de vídeo. É a tela de produção de vídeos (apesar do nome “test”).

## 6. Sistema

### 6.1 Estatísticas
`Estatísticas gerais` + `Dra. LIA` (abas Visão geral · Qualidade · RAG · Autoheal · Alimentador).

### 6.2 Usuários
Criar usuário e atribuir papel. Exclusão de usuário ainda não está disponível — remova os papéis para bloquear o acesso.

### 6.3 Configurações
Abas **Marcas · Modelos · Resinas · Parâmetros · CTA · Hub · SEO · Dados**. A aba **Dados** faz importação/exportação em massa — sempre exporte um backup antes de importar.

---

## 7. Social Publisher (`/social`)

| Tela | Como usar |
|---|---|
| **Dashboard** | visão de publicações e métricas do período |
| **Criar Post** | upload da mídia (sem limite de tamanho) → gerar/escrever legenda → escolher canais → conferir requisitos de formato → **Agendar** ou **Publicar** |
| **Calendário** | arrastar o post para reagendar |
| **Banco de Posts** | biblioteca reaproveitável; posts sincronizados podem ir automaticamente para grupos WhatsApp (a rede permitida é definida por grupo) |
| **Analytics** | desempenho por canal |
| **Flows IG DM** | criar automação comentário → DM (pedir provisionamento Zernio; ativar só após teste) |
| **Broadcasts** | disparo em massa por segmento |
| **Sequências** | régua de mensagens |
| **Contatos / Avaliações** | base Zernio e reviews Google |
| **Post Grupos** | escolher grupos e quais redes cada grupo recebe |

---

## 8. Painel Comercial (`/painel-comercial`)
Abrir na TV → escolher o mês → acompanhar receita, meta, funil ativo (somente negócios abertos do Funil de Vendas) e ranking. Cache de 15 minutos. Se um número divergir do CRM, avisar o responsável técnico para rodar a reconciliação do funil.

---

## 9. Páginas públicas que o time compartilha
`/base-conhecimento` (parâmetros, catálogo, artigos) · `/base-conhecimento/calculadora-roi` · `/distribuidores` · `/eventos` · `/agenda` e `/agenda/online` · `/inscricao/:slug` · `/f/:slug` (formulários) · `/lp/:slug` (landing pages) · `/bio/:slug` · `/nps/:token` · `/support-resources`.

---

## 10. Regras de ouro para todo usuário
1. Nunca alterar deals do **Funil CS** nem mover deals do **Funil de Vendas** por fora do PipeRun.
2. Novo interesse do cliente → abre negócio **novo** em Vendas; não reaproveitar negócio antigo.
3. Não gerar URL nova quando já existe link curto.
4. Não publicar conteúdo de IA com preço.
5. Antes de qualquer disparo, checar se a instância de WhatsApp está conectada.
6. Antes de importar dados em massa, exportar backup.
