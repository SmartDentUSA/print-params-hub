# 02 — Mapa de Navegação e UX

## 2.1 Mapa navegável do sistema

```text
SmartDent Revenue OS
├── Site público (Index / base de conhecimento)          [sem login]
│   ├── /:brandSlug[/:modelSlug[/:resinSlug]]           parâmetros de impressão
│   ├── /base-conhecimento (+ /en, /es)                  abas: parametros | catalogo | artigos | videos
│   ├── /produtos/:slug · /categoria/:slug · /depoimento/:slug
│   ├── /distribuidores[/:pais[/:dist]] · /eventos
│   ├── /calculadora-roi · /sobre · /support-resources · /docs/*
│   └── Widgets globais: Dra. LIA (chat), Footer, tracking
├── Formulários e páginas públicas de conversão          [sem login]
│   ├── /f/:slug            formulário dinâmico
│   ├── /lp/:slug           landing page
│   ├── /bio/:slug          link na bio
│   ├── /inscricao/:slug    inscrição em curso/turma
│   ├── /nps/:token         resposta de NPS pós-treinamento
│   ├── /cadastro-distribuidor
│   └── /embed/dra-lia      agente embutido (iframe)
├── /painel-comercial       dashboard de TV da sala comercial
├── /admin                  AdminViewSecure  [Supabase Auth + role]
│   ├── Catálogo   → Modelos · Produtos · Docs Sistema
│   ├── Conteúdo   → Artigos · Knowledge Hub · Autores
│   ├── Smart Ops  → 24 seções (ver 2.4)
│   ├── Ferramentas→ Ferramentas · PandaVideo
│   └── Sistema    → Estatísticas · Usuários · Configurações
├── /social/*               Social Publisher (sub-app, 15 rotas)
├── /admin/form-flow/:formId    editor de fluxo de formulário (standalone)
└── /smartops/wa-flow-visualizer  visualizador de fluxo WhatsApp
```

## 2.2 Rotas (evidência `src/App.tsx`)

| Rota | Componente | Acesso | Obs. |
|---|---|---|---|
| `/` | redirect | público | → `/base-conhecimento?tab=parametros` (`App.tsx:72`) |
| `/:brandSlug`, `/:brandSlug/:modelSlug`, `+/:resinSlug` | `Index` | público | catálogo de parâmetros (`73-75`) |
| `/admin` | `AdminViewSecure` | **auth + role** | guarda interna, não wrapper (`76`) |
| `/painel-comercial` | `PainelComercial` | sem guarda de rota | lê apenas `painel_comercial_cache` via RPC `SECURITY DEFINER` (`77`) |
| `/admin/form-flow/:formId` | `SmartOpsFormFlowStandalone` | sem guarda de rota | (`78`) |
| `/smartops/wa-flow-visualizer` | `WaFlowVisualizerPage` | sem guarda de rota | (`79`) |
| `/social` + 14 filhas | `SocialLayout` + páginas | sem guarda de rota visível | (`82-98`) |
| `/base-conhecimento`, `/produtos/:slug`, `/categoria/:slug`, `/depoimento/:slug`, `/sobre`, `/calculadora-roi`, `/support-resources`, `/docs/*` (+ `/en`, `/es`) | páginas públicas | público | (`104-171`) |
| `/distribuidores*`, `/eventos` | públicas | público | (`113-116`) |
| `/cadastro-distribuidor`, `/inscricao/:slug`, `/nps/:token`, `/f/:slug`, `/lp/:slug`, `/bio/:slug` | públicas por design | público | (`118-168`) |
| `/embed/dra-lia` | `AgentEmbed` | público | sem header/footer (`156`) |
| `*` | `NotFound` | público | (`173`) |

Widgets globais (`App.tsx:192-215`) escondem chat/footer em `/embed`, `/admin`, `/social`, `/agenda`, `/ferramentas`, `/lp`, `/bio`.

## 2.3 Autenticação e permissões na UI

```text
/admin → getSession() (timeout 8s)  AdminViewSecure.tsx:158-163
   ├── sem sessão            → <AuthPage>                     :249-251
   ├── busca role em user_roles                                :166-177
   │      role=author       → força activeSection='knowledge'
   │      role=distribuidor → força activeSection='so-distribuicao'
   └── nenhuma das 3 roles  → tela "Acesso Negado"             :253-274
```

| Role | Vê | Fonte |
|---|---|---|
| `admin` | todos os 5 grupos (34 seções) | `AdminSidebar.tsx:136` |
| `author` | apenas grupo "Conteúdo" (Artigos, Knowledge Hub, Autores) | `AdminSidebar.tsx:136` (`adminOnly` filtra o resto) |
| `distribuidor` | menu substituído por 1 item: Smart Ops → Distribuição | `AdminSidebar.tsx:137-144` |
| sem role | "Acesso Negado" | `AdminViewSecure.tsx:253-274` |

`user_roles` tem 5 linhas em produção; enum `app_role` = `admin | user | moderator? (não) | author | distribuidor` (valores reais: `admin, user, author, distribuidor`).

**Risco de UX/segurança**: as rotas `/painel-comercial`, `/social/*`, `/admin/form-flow/:formId` e `/smartops/wa-flow-visualizer` não têm guarda de rota; o que protege os dados é RLS + funções `SECURITY DEFINER`. Ver cap. 07.

## 2.4 Menu do Admin — grupos e seções

Definição em `AdminSidebar.tsx:55-130`; renderização em `AdminViewSecure.tsx:280-348`.

| Grupo | `adminOnly` | Seções (id → componente) |
|---|---|---|
| Catálogo (aberto por padrão) | sim | `models`→AdminModels · `catalog`→AdminCatalog · `documents`→AdminDocumentsList |
| Conteúdo | não | `knowledge`→AdminKnowledge · `knowledge-hub`→AdminKnowledgeHub · `authors`→AdminAuthors |
| Smart Ops | sim | `so-bowtie`, `so-kanban`, `so-equipe`, `so-reguas`, `so-logs`, `so-reports`, `so-conteudo`, `so-saude`, `so-whatsapp`, `so-formularios`, `so-treinamentos`, `so-tokens-ia`, `so-ai-routing`, `so-intelligence`, `so-roi`, `so-mapeamento`, `so-campanhas`, `so-distribuicao`, `so-reativacao`, `so-eventos`, `so-copilot`, `so-rayshape`, `so-stripe`, `so-cursos` |
| Ferramentas | sim | `tools` (5 ferramentas empilhadas) · `pandavideo-test` (3 painéis) |
| Sistema | sim | `stats` (AdminStats+AdminDraLIAStats) · `users` · `settings` |

Comportamento: os grupos são `Collapsible` (abre se contiver a seção ativa); seções `so-*` recebem `key={id-refreshKey}` e **remontam** ao clicar "Atualizar" (`AdminViewSecure.tsx:408-415`). Sidebar colapsável em modo ícone com tooltips (`AdminSidebar.tsx:147,185`).

## 2.5 Análise UX por família de tela

### Padrões positivos observados
- **Consistência estrutural**: toda seção grande usa o mesmo tríptico shadcn `Tabs → Card → Table`, com `Badge` para status e `sonner`/`useToast` para feedback. Curva de aprendizado transfere entre telas.
- **Feedback de ação**: praticamente toda mutação dispara toast de sucesso/erro com a mensagem do backend (ex.: `SmartOpsSystemHealth.tsx:118-123`).
- **Estados de loading em botão**: ícones com `animate-spin` e label alternado ("Executando…") — `SmartOpsSystemHealth.tsx:170-177`.
- **Estado vazio tratado** nas telas principais (ex.: "Nenhum evento registrado. Sistema operando normalmente." com ícone verde — `SmartOpsSystemHealth.tsx:224-228`).
- **Semáforo de saúde** (verde/amarelo/vermelho) como resumo cognitivo antes da tabela — `SmartOpsSystemHealth.tsx:141-147`.

### Problemas de UX recorrentes (avaliação heurística)

| # | Problema | Heurística de Nielsen violada | Onde | Severidade |
|---|---|---|---|---|
| 1 | Menu Smart Ops com 24 itens planos, sem agrupamento semântico nem busca | Reconhecimento em vez de memorização; flexibilidade | `AdminSidebar.tsx:82-107` | Alta |
| 2 | Botões que só mostram "em breve" (excluir usuário, novo curso por profissional, nova automação LIA) | Consistência e padrões; controle do usuário | `AdminUsers.tsx:157-169`, `CoursesPage.tsx:262-270`, `SmartOpsLiaAutomations.tsx:138-140` | Alta |
| 3 | Ações destrutivas/pesadas ("Full Sync", "Exportar Tudo") sem diálogo de confirmação nem estimativa | Prevenção de erros | `AdminViewSecure.tsx:384-406` | Alta |
| 4 | Export "Tudo" faz polling de até 12 min preso na tela; sem cancelamento | Visibilidade do status; controle | `AdminViewSecure.tsx:104-152` | Média |
| 5 | Sem atualização em tempreal (Realtime desligado) — o operador precisa clicar "Atualizar" | Visibilidade do estado do sistema | `client.ts:19-31` | Média |
| 6 | Telas com 2.000+ linhas e muitas abas (`AdminKnowledge`, `SmartOpsCampaigns` com 8 abas) → carga cognitiva alta | Estética e design minimalista | vários | Média |
| 7 | Ausência de rota protegida em `/social/*` e `/painel-comercial`: usuário sem permissão vê layout vazio em vez de mensagem clara | Ajuda a reconhecer e recuperar de erros | `App.tsx:77,82-98` | Média |
| 8 | Acessibilidade não auditada: ícones-botão sem `aria-label` em vários lugares (ex.: botão de resolver log é só um ícone) | Acessibilidade (WCAG 4.1.2) | `SmartOpsSystemHealth.tsx:279-281` | Média |
| 9 | Mobile: admin é desktop-first; tabelas largas dependem de `overflow-x-auto`, sem visão de cartão | Responsividade | `SmartOpsSystemHealth.tsx:230` | Média |
| 10 | Cores hardcoded (`bg-red-50`, `text-green-600`) em vez de tokens semânticos — quebra tema/dark mode | Consistência | vários componentes SmartOps | Baixa |

### Estados por tela (contrato esperado)

| Estado | Padrão atual | Lacuna |
|---|---|---|
| Loading | spinner no botão + `loading` local | falta skeleton de tabela em várias telas |
| Vazio | mensagem + ícone nas telas principais | ausente em abas secundárias |
| Erro | toast com mensagem do backend | sem retry inline; erro desaparece com o toast |
| Sucesso | toast + refetch/remount | ok |
| Sem permissão | "Acesso Negado" só em `/admin` | ausente nas demais rotas |

### Métricas de esforço (estimativa por contagem de cliques observada)

| Tarefa | Caminho | Cliques |
|---|---|---|
| Ver ficha 360º de um lead | /admin → Smart Ops → Público/Lista → busca → card | 4–5 |
| Disparar campanha de e-mail | Smart Ops → Campanhas → aba Criar → wizard (3 passos) | 8–12 |
| Agendar treinamento | Smart Ops → Treinamentos → Nova inscrição → busca de deal → confirmar | 6–8 |
| Diagnosticar erro de integração | Smart Ops → Saúde do Sistema → aba Logs → filtro → resolver | 4–6 |
| Mapear SKU fora de catálogo | Catálogo → Produtos → aba Mapeamento de SKU → filtro off-catalog → vincular | 5–7 |