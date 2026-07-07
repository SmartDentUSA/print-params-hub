## Objetivo
Cada post novo que entra no **Banco de Posts** (via sync Zernio) passa a ser **disparado automaticamente** para todos os grupos configurados em **Post Grupos**, em todas as instâncias com `enabled=true` — sem clique humano.

## Como vai funcionar

```text
Zernio sync ──► social_posts (INSERT)
                    │
                    ▼
        social-post-auto-blast (edge fn, service role)
                    │
                    ├── lê post_group_instance_config WHERE enabled=true
                    ├── lê post_group_targets ligados a essas instâncias
                    ├── monta content = { type:'msg', text: caption + "\n\n" + permalink }
                    ├── chama wa-group-blast (1 campanha por instância)
                    └── marca social_posts.auto_blast_at = now()
```

- **Dedupe global** já existe no `wa-group-blast` via `wa_group_sent_fingerprints` (janela 30d por `group_jid + content_hash`), portanto reruns do sync não enviam duas vezes.
- **Coluna nova `social_posts.auto_blast_at timestamptz null`** para marcar posts já processados e evitar retrabalho a cada sync.
- Só dispara para posts com `permalink/url` válido e `caption` não vazia. Formatos sem permalink (ex.: rascunhos) ficam de fora.
- Instância desativada em Post Grupos ignora aquele lote (comportamento já esperado da tela).

## Passo a passo

### 1. Migration
- Adicionar `social_posts.auto_blast_at timestamptz null` + índice parcial `WHERE auto_blast_at IS NULL`.
- Nada mais — `post_group_instance_config`, `post_group_targets`, `wa_groups`, `wa_group_sent_fingerprints` já existem.

### 2. Edge function nova: `supabase/functions/social-post-auto-blast/index.ts`
- Serve como worker; aceita POST sem payload (varredura) ou `{ post_id }` (pontual).
- Para cada `social_posts` pendente (`auto_blast_at IS NULL AND permalink IS NOT NULL AND caption IS NOT NULL`):
  1. Para cada instância em `post_group_instance_config WHERE enabled=true`:
     - Buscar `post_group_targets` → `wa_groups.group_jid` (filtrando `is_admin AND enabled`).
     - Se vazio, pular.
     - Chamar `wa-group-blast` com `group_jids`, `message_type:'msg'`, `content:{ text: caption + "\n\n" + permalink }`, `campaign_name: "Auto | ${platform} | ${post_id.slice(0,8)}"`.
  2. Setar `auto_blast_at = now()` no post.
- Retorna resumo `{ processed, dispatched_campaigns, skipped }`.

### 3. Gatilho automático
Duas camadas complementares para robustez:
- **Fire-and-forget no `useZernioSync`**: após `social-posts-sync` retornar ok, invocar `social-post-auto-blast` (sem `await` no toast). Cobre 99% dos casos (sync manual do usuário).
- **Cron a cada 10min** em `supabase/config.toml` chamando `social-post-auto-blast` para pegar qualquer atraso (syncs automáticos futuros, retries).

### 4. UI (mudanças mínimas)
- No **PostGrupos.tsx** adicionar aviso no cabeçalho: *"Todo post novo sincronizado é disparado automaticamente para os grupos ativos abaixo."*
- No **SocialPostCard**, mostrar badge sutil `Enviado aos grupos` quando `auto_blast_at` estiver preenchido (leitura opcional; se preferir não mexer no card, tudo bem).

## O que NÃO muda
- `HistoricalPostBroadcast` continua existindo como envio manual pontual (mesmo modal `WaGroupBlastModal`).
- `wa-group-blast` não é alterado — apenas passa a ser chamado programaticamente.
- Copilot, flows do Zernio, e sync existentes ficam intactos.

## Riscos e mitigações
- **Duplicidade se o mesmo post trocar de caption** → `content_hash` muda, mas `auto_blast_at` já está preenchido, então não redispara. OK.
- **Blast em massa involuntário na primeira execução**: histórico do banco pode ter dezenas de posts sem `auto_blast_at`. Mitigação: no primeiro deploy, o backfill marca todos os posts antigos como `auto_blast_at = created_at` (só posts sincronizados de agora em diante disparam).
- **Instância ATIVA sem grupos selecionados** → função só pula, não erra.

## Arquivos tocados
- Migration nova (coluna + índice + backfill de `auto_blast_at`).
- `supabase/functions/social-post-auto-blast/index.ts` (novo).
- `supabase/config.toml` (schedule do cron).
- `src/hooks/social/useZernioSync.ts` (invoca a nova função após o sync).
- `src/components/social/PostGrupos.tsx` (aviso de comportamento automático).
