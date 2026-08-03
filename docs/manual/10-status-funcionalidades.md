# 10 — Status das Funcionalidades

Legenda: ✅ ativa · ⚠ parcial · ❌ morta/legada.

## 10.1 Matriz por módulo

| Módulo | Status | Observação |
|---|---|---|
| Ingestão Meta (pull + webhook Zernio) | ✅ | redundância dupla, dedupe, lookback adaptativo |
| Sync PipeRun (15 crons + webhook) | ✅ | reconciliação horária; funil de Vendas com 1.294 abertos após hidratação |
| Sync Omie (NF, NFSe, snapshot) | ✅ | lacuna histórica conhecida (NFes de abr/2025) |
| Loja Integrada | ✅ | mapeamento de produto de interesse ainda incompleto |
| WhatsApp dual (Evolution + EvolutionGO) | ✅ | router obrigatório; algumas instâncias com 404/permissão de grupo |
| E-mail (Gmail + fila) | ✅ | limite ~499/dia |
| SMS (Disparo Pro) | ✅ | migrado para HTTPS MT |
| Campanhas / Origens / Link na bio | ✅ | |
| Formulários / LP / short links | ✅ | |
| Cursos, turmas e inscrições | ⚠ | "Adicionar curso" por profissional é placeholder |
| NPS pós-treinamento | ✅ | |
| Painel Comercial de TV | ✅ | lê só cache |
| Relatórios comerciais | ✅ | receita Max(CRM, Omie) |
| Catálogo + Mapeamento de SKU | ⚠ | cobertura de SKU em itens históricos incompleta (~28%) |
| Base de conhecimento / SEO / RAG | ✅ | 813 conteúdos, 10,5 k embeddings |
| Dra. LIA (público) | ✅ | |
| Copilot (interno) | ✅ | lê schema `copilot_brain` |
| Sentinela / Intelligence | ✅ | |
| Reativação / LTV / Fluxos ReactFlow | ✅ | |
| Normalizar Campos (32 campos) | ✅ | |
| Distribuição + Mídias & Artes (Drive) | ✅ | |
| Stripe / Pagamentos | ✅ | webhook corrigido; retry 20 min |
| Social Publisher (15 telas) | ✅ | upload sem limite de tamanho |
| Rayshape | ✅ | nicho |
| Automações LIA | ⚠ | criação de nova automação desabilitada ("Em breve") |
| Tokens IA / AI Routing | ⚠ | telas prontas, séries sem dados |
| Gestão de usuários | ⚠ | exclusão é placeholder (impacto LGPD) |
| Kanban — mover etapa | ❌ por decisão | `smart-ops-kanban-move` desligado; etapa muda no PipeRun |
| Realtime (todas as assinaturas) | ❌ | kill-switch em `client.ts:19-31` |
| Waleads (remetente antigo) | ❌ | substituído por `smartdent_marketing` |
| ManyChat / Sellflux | ❌ | funções retornam 410 |
| `AdminViewSupabase.tsx`, `SmartOpsTab.tsx`, `social/ComingSoon.tsx` | ❌ | sem rota/import |
| ~40 Edge Functions sem chamador e sem cron | ❌ (candidatas) | listadas em `edge-functions-inventario.csv` na coluna `suspeita_morta` |
| `piperun-api-test` | ❌ | `enabled = false` em `config.toml` |
| 222 tabelas sem linhas | ⚠/❌ | features planejadas ou abandonadas |

## 10.2 Botões-placeholder (lista completa encontrada)

| Local | Botão | Comportamento atual |
|---|---|---|
| `AdminUsers.tsx:157-169` | Excluir usuário | toast "Funcionalidade em desenvolvimento" |
| `CoursesPage.tsx:262-270` | Adicionar curso (por profissional) | toast informativo |
| `SmartOpsLiaAutomations.tsx:138-140` | Nova automação | `disabled`, `title="Em breve"` |

## 10.3 Dívida técnica priorizada

1. `lia_attendances` com 610 colunas (custo de performance e LGPD).
2. 158 policies RLS `USING (true)`.
3. Ausência total de testes automatizados.
4. Componentes de 1.000–2.800 linhas (`AdminKnowledge`, `SmartOpsCampaigns`, `SmartOpsCourses`).
5. Realtime desligado com código morto remanescente.
6. Duas filas de WhatsApp concorrentes.
7. Sem retenção de logs.
8. ~40 Edge Functions e 3 telas mortas.