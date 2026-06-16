# Galeria "Carrosseis do Sistema A" em /social/novo

## Problema

Hoje os slides do Sistema A só aparecem no editor quando ele é aberto por deep-link:
`?source=carrossel&ref=<pasta>&total=<N>&produto=<slug>&tipo=<tipo>`

Quem entra em `/social/novo` direto pela sidebar não vê nenhum carrossel — não existe um lugar no editor para escolher um carrossel já gerado.

## O que vou construir

Uma nova seção no topo do passo **Conteúdo** chamada **"Carrosseis do Sistema A"** que lista os carrosseis disponíveis no bucket `wa-media`, com miniatura, produto/tipo e número de slides. Clicar em um carrossel popula automaticamente todos os slides selecionados (mesma máquina que hoje recebe os query params).

Comportamento da galeria:
- Mostra os carrosseis mais recentes primeiro (até 50)
- Cada item exibe: 1ª miniatura, nome do produto/tipo (se identificável pelo nome da pasta), nº de slides, data
- Botão **"Usar este carrossel"** → popula `selectedCarrosselImages` com todas as URLs `slide-0.png … slide-(N-1).png`
- Botão **"Limpar seleção"** quando já houver um carrossel ativo
- Skeleton de loading e mensagem amigável se o bucket não tiver nenhum carrossel ainda

A galeria fica **oculta** quando o editor é aberto via deep-link (já tem carrossel pré-selecionado) e fica **oculta no modo edição** (`/social/:id/editar`).

## Detalhes técnicos

**Novo hook** `src/hooks/social/useSystemACarousels.ts`
- Usa `supabase.storage.from('wa-media').list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })` para enumerar pastas no root
- Para cada pasta candidata, faz `list(folder, { search: 'slide-' })` e conta arquivos `slide-N.{png,jpg,jpeg,webp}`
- Considera "carrossel" qualquer pasta com ≥ 2 arquivos `slide-N`
- Cacheia com `useQuery` (staleTime 60s) para não martelar storage
- Retorna `{ ref, total, firstSlideUrl, createdAt, productHint }` ordenado por data desc
- O bucket `wa-media` já tem policy "public read" → anon consegue listar e exibir as URLs públicas

**Novo componente** `src/components/social/editor/SystemACarouselPicker.tsx`
- Grid responsivo (2 cols mobile / 4 cols desktop) com `Card` + thumbnail (lazy)
- Recebe props `onPick(urls: string[])` e `selectedRef?: string`
- Item selecionado fica com borda primária

**Edits em `src/components/social/editor/SocialPostEditor.tsx`**
- Passa novos handlers para `StepContent`: `onPickSystemACarousel(refUrls: string[])`
- Quando o usuário escolhe um carrossel pela galeria, chama `setSelectedCarrosselImages(urls)` — todo o resto (preview, StepMedia, post_type='carousel') continua funcionando porque já é alimentado por esse mesmo state
- Não renderiza o picker se já vier carrossel por query param (`isCarrosselMode`) nem em modo edição (`isEdit`)

**Edits em `src/components/social/editor/steps/StepContent.tsx`**
- Renderiza `<SystemACarouselPicker>` logo abaixo do header da etapa, antes do seletor de produto, quando habilitado

## Fora do escopo

- Não mexe em edge functions, ai-router, geração de caption, persistência de posts, schema do banco
- Não cria/altera buckets nem policies (a policy pública já existe)
- Não toca no fluxo de deep-link existente do Sistema A (continua funcionando igual)
- Não adiciona filtros/busca avançada nessa primeira versão (só a galeria recente)

## Validação

Após o build, abro `/social/novo` no preview e confirmo que:
1. A galeria aparece no topo do passo Conteúdo
2. Carrosseis recentes do `wa-media` são listados (ou mensagem de "nenhum carrossel disponível" se o bucket estiver vazio de pastas `slide-N`)
3. Clicar em um carrossel popula o preview lateral com os slides e ativa o modo carrossel automaticamente