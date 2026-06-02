# Flows IG DM + Gerador de Legenda IA

## Parte 1 — Botões no `SocialFlowsList`

Hoje cada card mostra só `Switch` + "Sessões". Adicionar ações inline:

- **Editar** — `<Link to="/social/flows/:id">` (rota já existe), botão ghost ícone `Pencil`.
- **Sessões** — manter.
- **Duplicar** (bônus simples) — insert clone via Supabase (`name + " (cópia)"`, `is_active=false`).
- **Excluir** — `AlertDialog` confirmando, `supabase.from('social_flows').delete().eq('id', f.id)`.
- **Ativar/Desativar** — já existe o `Switch`; manter, com tooltip "Ativar/Desativar".

Layout: `Switch` + grupo de botões ícones (`Eye` sessões, `Pencil` editar, `Copy` duplicar, `Trash2` excluir). Usar `Tooltip` do shadcn.

Sem alterações de schema (todas as colunas necessárias já existem).

## Parte 2 — Gerador de legenda por IA no `StepContent`

### UX (no `StepContent.tsx`)
- Novo bloco acima da Legenda: card colapsável "Gerar com IA".
  - `Textarea` curto **"Instruções/Ângulo"** (placeholder: "Ex.: foco em ortodontistas, tom consultivo, destacar precisão").
  - Select de **tom** (Profissional / Educativo / Direto / Inspirador).
  - Botão **"Gerar legenda + hashtags + 1º comentário"** (disabled se `product_name` e `product_slug` vazios e instruções vazias).
  - Quando termina: preenche `caption`, `hashtags` (até 15 limpas, sem `#`), `first_comment` — sobrescrevendo somente se o usuário clicar "Aplicar" (mostra preview num diff simples) ou se os campos estiverem vazios. Toast de sucesso.
- Indicador de loading no botão.

### Edge Function: `supabase/functions/social-caption-generator/index.ts` (nova)
- POST: `{ product_name?, product_slug?, platform: 'instagram'|'facebook'|..., instructions?, tone?, language? }`.
- Pipeline:
  1. **RAG produtos**: query Supabase em `system_a_catalog`, `products_catalog`, `resins` filtrando por `slug` exato e fallback ILIKE no nome. Pega `name, description/short_description, category, features/specs, processing_instructions, product_url`. **Sem preço** (cumpre regra Content Generation no Core memory).
  2. **RAG conhecimento**: chamada vetorial em `agent_embeddings` via RPC `match_agent_embeddings` (mesma usada em `smart-ops-copilot`), top 5 chunks pelo nome do produto + instruções.
  3. Monta prompt para **Lovable AI Gateway** (`google/gemini-3-flash-preview`) com:
     - Persona "Smart Dent | Fluxo Digital" (brand voice).
     - Restrições: SEM preços/valores comerciais (Core rule), sem promessas regulatórias, max 2200 chars, idioma pt-BR.
     - Plataforma-aware: IG/FB = caption com quebras + CTA; TikTok/Reels = curto e direto; LinkedIn = mais formal.
     - Output JSON estrito: `{ caption, hashtags: string[], first_comment }`.
  4. Sanitiza: hashtags sem `#`, lowercase, dedupe, máx 15; trim caption ≤ 2200; first_comment ≤ 500.
- Auth: `verify_jwt = false` no `config.toml` (consumido pelo editor logado, validação por anon key client-side). LOVABLE_API_KEY já existe nos secrets (verificar via `fetch_secrets`).
- CORS padrão. Erros: 402/429 → mensagem clara.

### Hook: `src/hooks/social/useGenerateCaption.ts` (novo)
- Wrapper `supabase.functions.invoke('social-caption-generator', { body })`.
- Retorna `mutateAsync` (react-query) para usar no `StepContent`.

### Sem alteração em
- `postSchema`, banco, demais steps, fluxo de publicação, crons, Zernio.

## Validação
1. `/social/flows` → ver 4 botões (Sessões, Editar, Duplicar, Excluir) + Switch; testar excluir com confirmação.
2. `/social/novo` → preencher produto "BLZ INO 200", clicar "Gerar com IA" → ver caption + hashtags + 1º comentário coerentes, sem preços.
3. Trocar plataforma para TikTok → gerar de novo → caption mais curta.
4. Verificar logs da função: RAG executado, JSON parseado.