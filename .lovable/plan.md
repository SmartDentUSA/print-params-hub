## Objetivo
Adicionar controle de velocidade (1x / 1.5x / 2x) no player de áudio dos artigos da Base de Conhecimento.

## Escopo
Apenas `src/components/knowledge/KnowledgeAudioPlayer.tsx` (o player customizado com botão redondo e barra de progresso). Os `<audio controls>` nativos (upload/preview no admin, WaLeads) já expõem velocidade via menu do navegador — não serão alterados.

## Mudanças
1. Adicionar state `rate` (1 | 1.5 | 2), default `1`.
2. Ao alternar, atualizar `audioRef.current.playbackRate`.
3. Renderizar um pequeno botão de texto ("1x" → "1.5x" → "2x" → "1x") à direita do tempo, no mesmo estilo minimalista do player (texto pequeno, uppercase, cor primary no hover).
4. Preservar aparência atual (pill arredondado, botão play, barra de progresso, halo animate-ping).

## Fora do escopo
- Não mexer em `HeroAudioUpload` nem em `WaLeadsMediaPreview` (usam `<audio controls>` nativo).
- Sem novas dependências.