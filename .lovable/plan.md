

## Priorizar conteúdos com vídeos e imagem hero na sidebar

### Problema
Os artigos na sidebar aparecem por data de criação, sem priorizar os que têm conteúdo visual rico (vídeos e imagem hero).

### Solução
Após carregar os conteúdos de uma categoria, buscar quais têm vídeos associados e reordenar a lista para priorizar:
1. Conteúdos com vídeo **E** imagem hero (maior prioridade)
2. Conteúdos com vídeo **OU** imagem hero
3. Demais conteúdos

Adicionar badge visual de "Vídeo" na sidebar para indicar conteúdos com vídeo.

### Mudanças

**`src/pages/KnowledgeBase.tsx`**
- Após `fetchContentsByCategory`, fazer query leve em `knowledge_videos` para obter `content_id`s que possuem vídeos
- Reordenar `contents` no state: primeiro os que têm vídeo + imagem, depois vídeo ou imagem, depois o resto
- Passar flag `hasVideo` para cada item do sidebar

**`src/components/KnowledgeSidebar.tsx`**
- Adicionar `hasVideo?: boolean` na interface `Content`
- Exibir badge pequeno (ícone Play) nos cards que têm vídeo
- Manter ordenação recebida do pai (já vem priorizada)

### Resultado
- Artigos com vídeo e imagem hero aparecem primeiro na lista lateral
- Badge de vídeo indica visualmente quais artigos têm conteúdo audiovisual
- Sem queries adicionais pesadas — apenas um select de `content_id` em `knowledge_videos`

