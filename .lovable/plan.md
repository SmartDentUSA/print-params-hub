
# Copilot Social Flows — end-to-end

Adiciona ao Copilot 6 tools para gerenciar `social_flows` (Instagram DM) via diálogo. Canvas `/automacoes/flows` permanece read-only — toda edição passa pelo Copilot.

## 1. `supabase/functions/smart-ops-copilot/index.ts`

**1a. Registrar 6 tools** no array `tools` (após a última existente):
- `list_social_flows({ channel?, only_active? })`
- `get_social_flow({ id })`
- `create_social_flow({ name, description?, channel?, template, config })` — sempre `is_active:false`
- `update_social_flow({ id, patch })` — suporta `replace_node:{node_id, fields}`
- `toggle_social_flow({ id, is_active })`
- `delete_social_flow({ id, confirmed })` — exige `confirmed:true`

**1b. Handlers** no switch de execução de tools (`list/get/create/update/toggle/delete`) — leem/escrevem em `social_flows` e `social_triggers` via service role; `delete` também limpa `social_sessions` e `social_triggers` antes de deletar o flow.

**1c. Função `buildFlowFromTemplate(template, config)`** antes do `serve(...)`, suportando 7 templates: `comment_keyword_dm`, `welcome_new_follower`, `mention_reply`, `lead_capture_dm`, `ads_click_to_messenger`, `dra_lia_handoff`, `content_sequence`. Cada um devolve `{nodes, edges, trigger}` no shape consumido por `flow-executor` e `SocialFlowEditor`.

**1d. Bloco no `SYSTEM_PROMPT`** definindo:
- Gatilhos: "automação", "flow", "IG DM", "social publisher", "quando comentarem", etc.
- Fluxo: listar → perguntar (editar / pausar / excluir / nova) → se nova, perguntar tipo, coletar inputs **um por vez**, mostrar resumo, confirmar, criar inativo, perguntar se ativa.
- Inferência de intent quando o usuário manda tudo em uma frase ("quando comentarem VITA…").
- Regras NUNCA: criar/ativar/excluir sem confirmação explícita.
- Aviso para `comment_keyword_dm`: depende de automação nativa Zernio.

## 2. `supabase/functions/flow-executor/index.ts`

Adicionar handlers (não removem nada existente):
- **`dra_lia_chat`**: conta sessões anteriores do `ig_user_id`, chama EF `lia-instagram-responder` com contexto e marca sessão `completed`.
- **`collect_input`**: pausa sessão (`status:'waiting_input'`, guarda `aguardando_campo` no state) avançando `current_node_id` para o próximo nó.
- **`create_lead`**: chama EF `smart-ops-ingest-lead` com `source:'instagram_flow'`, `form_name` do nó (fallback `# - INSTAGRAM - Auto atendimento`), campos do state (nome/telefone/email/área/especialidade) + `produto_interesse_auto` do nó/state + `tags` do nó; segue para o próximo nó.

## 3. `src/components/social/flows/SocialFlowEditor.tsx`

- `TRIGGER_TYPES`: adicionar `new_follower` e (se não existir) reforçar `mention`.
- `NODE_TYPES`: adicionar `dra_lia_chat`, `collect_input`, `create_lead`.
- Painel lateral: manter visualização atual; quando um nó é selecionado, exibir banner informativo no topo:
  > ℹ️ Para editar este flow, use o Copilot: "editar flow [nome]"

Sem edição inline.

## 4. Deploy e verificação

Ordem: (1) `flow-executor`, (2) `smart-ops-copilot`, (3) frontend.

Testes manuais no Copilot:
1. "quando alguém comentar VITA, responde 'Enviamos!' e manda DM com link https://…" → infere `comment_keyword_dm`, mostra resumo, confirma, cria inativo, pergunta se ativa.
2. "lista todos os flows" → `list_social_flows` em tabela.
3. "ativa o flow VITA" → `toggle_social_flow({is_active:true})`.
4. Conferir em `/automacoes/flows` que o flow aparece com os nós corretos e que o banner read-only é exibido no painel lateral.

## 5. Fora de escopo (NÃO fazer)

- Não alterar `social-publish-worker`, flows Copa 2026, `LeadDetailPanel.tsx`, `lead_activity_log`, contratos PipeRun/SellFlux.
- Não implementar edição inline no canvas.
- Não substituir `flow-executor` por LLM.
- Não ativar flows automaticamente.

## Notas técnicas

- Tools usam service role (já é o padrão da EF). Sem allowlist necessária (blocklist vazia — `mem://smart-ops/copilot-full-data-access`).
- IDs de nó gerados com `crypto.randomUUID()`/sufixo curto, compatíveis com o shape lido por `flow-executor` (`node.id`, `node.type`, `node.next_node_id`, `edges[]`).
- Após implementar, salvar memória `mem://smart-ops/copilot-social-flows-tools` documentando as 6 tools + 7 templates + fluxo conversacional; adicionar linha em `mem://index.md`.
