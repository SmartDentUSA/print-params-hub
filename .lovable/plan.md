## Problema

Na página `/social/sequences` (componente `SocialSequences.tsx`) cada card de sequência só mostra nome + switch ativo/inativo. Não dá para:
- Renomear
- Editar passos (delays / mensagens)
- Editar público-alvo
- Duplicar
- Excluir

E os passos só aceitam **mensagem de texto** — não dá para usar Link Instagram, Link YouTube ou Sequência promo (7 msgs), que já existem no builder de grupos WhatsApp.

## Plano

### 1. Ações no card da sequência (`SocialSequences.tsx`)

Adicionar no canto direito de cada card, ao lado do Switch:

- Botão **Renomear** (ícone Pencil) → abre `Dialog` simples com Input + Salvar (`update social_sequences set name`).
- Botão **Editar** (ícone Settings2) → reabre o mesmo diálogo "Nova sequência" pré-preenchido com nome, canal, filtros de público, contatos selecionados e passos.
- Botão **Duplicar** (ícone Copy) → cria nova linha com `name = "<nome> (cópia)"`, `is_active=false`, mesmos `steps` / `audience_*`.
- Botão **Excluir** (ícone Trash2, vermelho) → `AlertDialog` de confirmação → `delete` em `social_sequences` (cascade já remove `social_sequence_enrollments`).

Refatorar o `Dialog` atual de criação em um componente `<SequenceEditorDialog mode="create"|"edit" sequence={...} />` que cobre os dois fluxos. No modo `edit`:
- Pula a tela de seleção de público se `audience_contact_ids` já existir (mostra contagem + botão "Re-selecionar público").
- Faz `update` em vez de `insert`, mantendo `id`.
- Não re-inscreve contatos já em `social_sequence_enrollments` (idempotência por `(sequence_id, contact_id)`).

### 2. Passos ricos (mensagem, link IG, link YT, sequência promo)

Hoje `steps: [{ delay_minutes, message }]`. Trocar por união discriminada:

```ts
type SequenceStep =
  | { kind: 'msg';      delay_minutes: number; message: string }
  | { kind: 'link_ig';  delay_minutes: number; url: string; caption: string }
  | { kind: 'link_yt';  delay_minutes: number; url: string; caption: string }
  | { kind: 'promo_seq';delay_minutes: number; product_slug: string; product_name: string; interval_seconds: number };
```

No editor de passos: dropdown "Tipo" + inspector dedicado por tipo (reaproveitando `SocialPostLinkPicker` e o `PromoSeqInspector` já criados no `WaGroupFlowBuilder`).

Backward compat: passos antigos sem `kind` são tratados como `kind: 'msg'`.

### 3. Runtime

Atualizar `supabase/functions/sequence-runner/index.ts` para despachar cada `kind`:
- `msg` → comportamento atual.
- `link_ig` / `link_yt` → envia `caption\n\n{url}` via Evolution (mesmo padrão de `wa-dispatcher`).
- `promo_seq` → busca produto via endpoint `knowledge-export-full` (cache curto), pega `messages.whatsapp_7msgs[]` e enfileira cada msg com `interval_seconds`. Para Instagram DM (Zernio) usa o canal correspondente.

Reusar utilitários já existentes em `wa-dispatcher` extraindo para `_shared/social-send.ts` (texto / link / promo_seq).

### 4. Sem novas migrations

`steps` já é `jsonb`, comporta a nova união. `audience_*` já existem. Só código frontend + edge function.

## Detalhes técnicos

- `SequenceEditorDialog` recebe `sequence?: SocialSequence`; estado interno espelha campos atuais.
- Excluir usa `AlertDialog` shadcn — não usar `confirm()`.
- Cache do endpoint `knowledge-export-full` no editor: 5 min via `react-query` `staleTime`.
- `sequence-runner` precisa de `Deno.env.get('SYSTEM_A_KNOWLEDGE_URL')` (fallback para a URL fixa informada).
- Tipos: atualizar `src/components/social/broadcasts/types.ts` (se existir) ou inline.

## Fora de escopo

- Mudar schema do banco.
- Editar mensagens individuais de `promo_seq` (sempre vêm do produto).
- Logs/analytics por passo.
