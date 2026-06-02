## Problema

No fluxo "Novo broadcast" (`/social/broadcasts`) o usuário define filtros (conta Zernio, tags, seguidores, opt-in) mas nunca vê QUAIS contatos serão atingidos. Falta também mostrar, em cada contato, há quanto tempo ele entrou (`first_seen_at`), o ID Instagram e o ID ManyChat.

## Solução

Inserir uma nova etapa **"Contatos"** entre o passo de Segmentação e o de Mensagem no wizard, mostrando em tempo real a lista de contatos que casam com os filtros, e permitir override manual (selecionar/deselecionar individualmente).

Mudanças concentradas em `src/components/social/broadcasts/SocialBroadcasts.tsx` (frontend puro, sem mexer em edge functions ou schema).

### Alterações

**1. Novo step "Contatos" (step 1, passa wizard para 4 passos)**

Query nova:
- Source: `public.social_contacts`
- Filtro base: `channel = 'instagram'` (broadcast é IG DM)
- Junção lógica com a conta Zernio escolhida via `custom_fields->>'zernio_account_id'` (se existir) — fallback: todos os IG contacts se o campo não estiver populado.
- Filtros do wizard:
  - `onlySubscribed` → `subscribed = true`
  - `onlyFollowers` → `is_follower = true`
  - `tagsInput` → `tags && {tags_array}` (overlap)
- Order: `first_seen_at DESC NULLS LAST`, limit 500.

Renderização (tabela compacta com checkbox em cada linha):

| ☑ | Handle / IG | Instagram ID | ManyChat ID | Tags | Entrou há |
|---|---|---|---|---|---|
| ☑ | @joao | 178201… | 9988… | vip, lead_quente | 3 dias |

- "Entrou há" = `formatDistanceToNow(first_seen_at, { locale: ptBR, addSuffix: false })`.
- "ManyChat ID" lê de `custom_fields->>'manychat_id'`; mostra "—" se ausente.
- Header da tabela: busca por handle, badge "X contatos selecionados / Y elegíveis", botões "Selecionar todos" / "Limpar".
- Estado novo: `selectedIds: Set<string>` (default = todos os elegíveis). Persiste pelo wizard.

**2. Avançar exige ≥1 contato selecionado**

Validação no botão "Avançar" do passo de contatos.

**3. Persistência no broadcast**

No `create()`, salvar no `segment`:
```ts
segment.contact_ids = Array.from(selectedIds)   // override manual
segment.contacts_count = selectedIds.size
```
Edge function `zernio-broadcast-dispatch` já lê `segment`; se houver `contact_ids` deve respeitar (fora deste escopo verificar — se hoje recomputa pelos filtros, vira melhoria futura; o frontend deixa a intenção explícita).

**4. Passo de revisão (último) — mostra contagem**

Card de resumo passa a incluir: "Destinatários: N contatos (selecionados manualmente / filtro automático)".

### Fora de escopo

- Editar `zernio-broadcast-dispatch` para respeitar `contact_ids` override (faço em iteração seguinte se a edge ainda recalcular pelos filtros).
- Sincronizar `manychat_id` em `custom_fields` (já existe no sync; quem não tiver aparece como "—").
- Mudanças no schema de `social_contacts`.

### Validação

- Abrir `/social/broadcasts` → "Novo broadcast" → preencher passo 1, avançar.
- Conferir passo "Contatos" carrega lista com handle, IDs e tempo desde `first_seen_at`.
- Mudar filtros volta e recarrega.
- Selecionar/desmarcar persiste ao avançar/voltar.
- Criar broadcast e validar em `social_broadcasts.segment` que `contact_ids` e `contacts_count` foram salvos.
