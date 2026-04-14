

## Fix: Media cards da Dra. LIA — links canônicos internos + dedup + registro na timeline do lead

### Problemas identificados

1. **Links abrem em nova aba (`target="_blank"`)** em vez de navegar internamente na SPA — o usuário sai do site
2. **URLs absolutas** (ex: `https://parametros.smartdent.com.br/base-conhecimento/e/slug`) são usadas nos cards em vez de paths relativos — funciona em produção mas não no preview, e impede navegação SPA
3. **Cards duplicados** — o mesmo artigo/vídeo pode aparecer 2-3x porque vem de múltiplas fontes RAG (ILIKE + FTS + embedding) sem dedup
4. **Nenhum registro na timeline do lead** quando ele clica num card de mídia

### Mudanças

#### 1. Frontend — `src/components/DraLIA.tsx`

**Dedup dos media cards**: antes de renderizar, filtrar duplicatas por título (normalizado):
```typescript
const uniqueCards = msg.mediaCards.filter((card, i, arr) => 
  arr.findIndex(c => c.title === card.title) === i
);
```

**Converter link absoluto em path relativo** e usar `useNavigate` em vez de `<a target="_blank">`:
- Detectar se `card.url` começa com `SITE_BASE_URL` ou `/base-conhecimento/` 
- Se sim: `onClick` → `navigate(path)` (SPA navigation) + registrar contexto de tracking
- Se não (link externo): manter `target="_blank"` como está

**Registrar clique na timeline**: ao clicar num card interno, salvar em `sessionStorage` um pending context (`sd_pending_page_view_context`) com título e origem "dra_lia", que o `usePageTracking` vai incluir no próximo `lead_page_views.extra_data`.

#### 2. Backend — dedup no edge function `supabase/functions/dra-lia/index.ts`

Na construção de `mediaCards` (linha ~4014-4043), adicionar dedup por título antes do `.slice(0,3)`:
```typescript
// Dedup por título
const seen = new Set<string>();
const dedupedResults = filteredResults.filter(r => {
  const title = (r.metadata as any).title;
  if (seen.has(title)) return false;
  seen.add(title);
  return true;
});
```

#### 3. Tracking — `src/hooks/usePageTracking.ts`

No início do `setTimeout` callback, verificar se existe `sd_pending_page_view_context` no sessionStorage. Se sim, mesclar no `insertPayload.extra_data` e limpar o sessionStorage.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/DraLIA.tsx` | Dedup cards, SPA navigation, persist tracking context |
| `supabase/functions/dra-lia/index.ts` | Dedup por título no array de mediaCards |
| `src/hooks/usePageTracking.ts` | Consumir `sd_pending_page_view_context` do sessionStorage |

### Resultado
- Cards de mídia sem duplicatas
- Clique abre a página internamente (SPA) sem recarregar
- Timeline do lead registra que ele veio da Dra. LIA e qual conteúdo acessou

