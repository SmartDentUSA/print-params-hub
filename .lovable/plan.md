## Problema

Em `/social/banco`, clicar nos chips 📸 Instagram / 👥 Facebook / 🎵 TikTok / ▶️ YouTube / 📌 Pinterest / 🔴 Reddit não dá feedback nem filtra visivelmente. Investigação:

1. **Classe inexistente** — `SOCIAL_CHANNELS[p].colorClass` aponta para `bg-social-instagram`, `bg-social-facebook`, etc. Nenhum desses tokens existe em `tailwind.config.ts` nem em `src/index.css`. Resultado: o chip "ativo" recebe `text-white border-transparent` mas sem cor de fundo — visualmente igual ao estado inativo.
2. **Edge function fantasma** — `useSocialPostsBank` chama `supabase.functions.invoke('social-posts-search')` que não existe (apenas `social-caption-generator` e `social-publish-worker` no projeto). A cada mudança de filtro o SDK faz um round-trip 404 antes do fallback, atrasando a re-query e poluindo o Network.
3. **Consulta real funciona** — testei `social_posts` com `platform IN ('instagram')` e período 30d: retorna registros corretamente. O bug é puramente do caminho cliente.

## Correções (frontend apenas)

### 1. `src/lib/socialChannels.ts`
- Remover dependência de classes Tailwind inexistentes para colorir o chip ativo. Vamos passar a cor diretamente via `SOCIAL_BRAND_HEX` (já existe).

### 2. `src/components/social/SocialPostsBank.tsx` — chips de canal
- Substituir `cn('text-white border-transparent', meta.colorClass)` por `style={{ backgroundColor: SOCIAL_BRAND_HEX[p], color: '#fff', borderColor: SOCIAL_BRAND_HEX[p] }}` quando `active`.
- Estado inativo continua `bg-background text-muted-foreground border-border` + hover sutil.
- Adicionar contador no header dos filtros ("X canais") quando há seleção, e botão "Limpar" que reseta `selectedPlats`.

### 3. `src/hooks/social/useSocialPostsBank.ts` — limpeza
- Remover o bloco `try { supabase.functions.invoke('social-posts-search', ...) } catch {}`. Vai direto na tabela `social_posts` (consulta já validada).
- Manter `placeholderData: keepPreviousData` para evitar flicker enquanto re-filtra.

### 4. Garantia de re-render
- Chave da query (`['social-posts-bank', filters]`) já reage a `selectedPlats` via objeto `effective`. Nada a mudar — só validar que `posts.length` (já no badge do título) atualiza ao alternar chip.

## Arquivos tocados

```
src/components/social/SocialPostsBank.tsx    (estilo dos chips + botão limpar)
src/hooks/social/useSocialPostsBank.ts       (remove invoke 404 + keepPreviousData)
```

Sem migrações, sem edge functions, sem mudanças em `socialChannels.ts` (tokens HEX já existem). Escopo cirúrgico em UI/data fetching.
