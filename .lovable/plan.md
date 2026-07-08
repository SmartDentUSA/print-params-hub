## Onde fica a seção

A seção "O que os dentistas dizem" é a `testimonials` do `PremiumLandingTemplate` (linhas ~1146-1171 de `src/components/lp/PremiumLandingTemplate.tsx`). Hoje cada item só tem `quote`, `author` e `role` — não há foto, Instagram nem Facebook. E o editor (`LandingPageBuilderModal.tsx`) não tem UI para editar essa seção; ela só aparece se a IA gerar.

## O que vamos fazer

1. **Ampliar o schema `LPContent.testimonials.items`** em `PremiumLandingTemplate.tsx`:
   ```ts
   items: {
     quote: string;
     author: string;
     role?: string;
     avatar?: LPMedia;      // foto do cliente (upload)
     instagram_url?: string;
     facebook_url?: string;
   }[]
   ```

2. **Renderização** (mesmo arquivo, bloco testimonials):
   - Se `avatar?.url` existir, mostrar `<img>` redondo 56px ao lado do nome no `figcaption`.
   - Se `instagram_url` ou `facebook_url` existir, renderizar ícones (lucide `Instagram` / `Facebook`) como links com `target="_blank" rel="noopener nofollow"` à direita do bloco de autor.
   - Layout continua o mesmo card; alteração só dentro de `figcaption`.

3. **Editor no `LandingPageBuilderModal.tsx`**:
   - Adicionar uma nova aba/`TabsTrigger` "Depoimentos" (ou incluir na aba "Conteúdo" existente, dependendo do padrão atual do modal — verificar antes de implementar).
   - UI:
     - Campo `title` da seção.
     - Lista editável de depoimentos com botões "Adicionar" / "Remover" (mesmo padrão dos benefits/steps).
     - Por item: `Textarea` para `quote`, `Input` para `author`, `Input` para `role`, `MediaField` reutilizado para `avatar` (upload de foto — mesmo bucket `landing-page-media`, mesmo fluxo já implementado), `Input` para `instagram_url`, `Input` para `facebook_url`.
   - Persistir em `content.testimonials`.

4. **Sem mudança em edge functions nem banco** — `content` é JSONB, os novos campos são aditivos. Buckets e uploads já foram criados na etapa anterior.

## Arquivos afetados

- `src/components/lp/PremiumLandingTemplate.tsx` — expandir tipo + renderização (avatar + ícones sociais).
- `src/components/smartops/LandingPageBuilderModal.tsx` — nova seção de edição de depoimentos com upload de avatar e URLs sociais, reutilizando `MediaField`.

## Fora do escopo

- Buscar depoimentos automáticos do `system_a_catalog` (`video_testimonial`) — se você quiser depois "puxar depoimentos reais já cadastrados", posso adicionar num próximo passo; por ora ficamos com edição manual + upload.
