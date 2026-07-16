# Editor Visual de Fluxos Operacionais

Substituir `FlowEditorPlaceholder` por um editor ReactFlow real que edita `operational_flows` (5 fluxos: ingest_lead, form_ingest, assign, cs_rule, ltv). Padrão inspirado em `SocialFlowEditor`, mas para o domínio SmartOps.

## Escopo

- Frontend apenas. Nenhuma edge function nova, nenhuma migration.
- O motor genérico de execução continua no backend (fora deste incremento); este editor só edita o `graph` armazenado e cria versões.
- Não altero regra de negócio (Golden Rule, guards, cronjobs). O rollout continua `hardcoded` até o usuário promover manualmente.

## UX

Layout em 2 colunas dentro da aba "Fluxos":

```text
┌───────────────┬────────────────────────────────────────┐
│ Fluxos (5)    │  Toolbar: [nome] [rollout] [ativo] [Salvar] │
│ • Ingestão    ├────────────────────────────────────────┤
│ • Form SDR    │                                        │
│ • Atribuição  │        Canvas ReactFlow                │
│ • Régua CS    │        (drag, connect, minimap)        │
│ • LTV         │                                        │
│               ├────────────────────────────────────────┤
│ + Paleta nós  │  Inspector do nó selecionado           │
└───────────────┴────────────────────────────────────────┘
```

- **Sidebar esquerda**: lista dos 5 flows (fetch `operational_flows`), destaca o ativo, badge de `rollout_mode` e `active`. Abaixo, paleta de nós com botões "adicionar" por tipo.
- **Toolbar**: `name` (readonly, vem do banco), select `rollout_mode` (hardcoded / shadow / canary / live), switch `active`, botão **Salvar nova versão**.
- **Canvas**: ReactFlow com Background, Controls, MiniMap. Nós arrastáveis, conexões livres, seleção única.
- **Inspector**: painel inferior/lateral com campos do nó selecionado (label, config JSON textarea + campos rápidos por tipo). Botão remover nó.

## Modelo de dados usado

Tabela `operational_flows` já existe:
- `graph jsonb` — armazena `{ nodes: Node[], edges: Edge[] }`
- `current_version int` — incrementado ao salvar
- `rollout_mode text` — hardcoded | shadow | canary | live
- `active boolean`

Ao salvar:
1. `insert into operational_flow_versions (flow_id, version, graph, status, note)` com `version = current_version + 1`, `status = 'draft'`.
2. `update operational_flows set graph=..., current_version=..., rollout_mode=..., active=..., updated_at=now()`.

Graph vazio hoje (`{}`) — normalizo para `{nodes:[], edges:[]}` ao carregar.

## Paleta de nós (genérica, cobre os 5 fluxos)

| Tipo             | Uso                                            |
|------------------|------------------------------------------------|
| `trigger`        | Entrada do fluxo (webhook, cron, evento)      |
| `guard`          | Golden Rule / commercial intent / dedupe       |
| `enrich`         | Chamada de enrichment (Meta, Piperun, Omie)   |
| `merge`          | Smart merge / identity resolution              |
| `assign`         | Round-robin / distribuidor                     |
| `crm_action`     | Criar Person / Deal / Nota no Piperun          |
| `wait`           | Delay (D+30, cooldown)                         |
| `condition`      | if/else sobre payload                          |
| `notify`         | WhatsApp / SMS / e-mail                        |
| `end`            | Fim do fluxo                                   |

Config por tipo fica em `data.config` (JSON livre) — inspetor mostra textarea + campos comuns (label, note).

## Arquivos

**Novos**
- `src/components/smartops/reactivation/OperationalFlowEditor.tsx` — componente principal com ReactFlow, sidebar de flows, toolbar, inspector.
- `src/hooks/reactivation/useOperationalFlows.ts` — query list + query single flow + mutation save (usa `@tanstack/react-query` + supabase client).

**Alterados**
- `src/components/SmartOpsReactivationHub.tsx` — trocar `<FlowEditorPlaceholder />` por `<OperationalFlowEditor />` na `TabsContent value="flows"`.

**Removido**
- `src/components/smartops/reactivation/FlowEditorPlaceholder.tsx` — não usado após a troca.

## Detalhes técnicos

- Reusar `@xyflow/react` (já instalado, v12) — mesma versão do `SocialFlowEditor` para consistência.
- Salvar via `supabase.from('operational_flows').update(...)` + `insert('operational_flow_versions', ...)` em sequência com try/catch; se o insert de versão falhar, reverter update? → aceito best-effort: mostrar toast de erro, sem transação (RLS/serviço permite update simples e é reversível manualmente via histórico).
- Normalização dos nós idêntica ao `SocialFlowEditor` (garante `type: 'default'`, position válida, `data.label`/`data.nodeType`/`data.config`).
- Toast via `sonner` (já no projeto).
- Nenhuma mudança em `operational_flow_shadow_log` — permanece populado pelo motor no backend.

## Fora do escopo (próximos incrementos)

- Motor executor genérico que consome `graph` (hoje segue hardcoded).
- Editor de rollout progressivo com % canary.
- Diff visual entre versões / rollback UI.
- Validação semântica do grafo (nó `end` alcançável, guards obrigatórios, etc).
