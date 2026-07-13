## Objetivo
Adicionar upload de áudio explicativo (resumo narrado) no editor de conteúdo da Base de Conhecimento, com persistência em banco e player visível/piscante no artigo publicado — reaproveitando o mesmo padrão visual já usado nas landing pages dos formulários (`HeroAudioPlayer` em `PremiumLandingTemplate.tsx`).

## 1. Banco de dados (migration)
Adicionar duas colunas em `public.knowledge_contents`:
- `hero_audio_url TEXT NULL` — URL pública do MP3 no Storage
- `hero_audio_label TEXT NULL` — rótulo opcional (ex.: "Ouvir resumo do produto"); default no front = "Ouvir explicação"

Não altera RLS/GRANTS (tabela já existe). Após aprovação, o `types.ts` regenera com as colunas.

Storage: reutiliza o bucket já existente **`knowledge-images`** com prefixo `lp-audio/` (mesmo que o `HeroAudioUpload` do LP Builder usa — já validado em produção, aceita MP3 até 30 MB).

## 2. Frontend — Admin (upload persistente)
Arquivo: `src/components/AdminKnowledge.tsx`

- Estender `formData` com `hero_audio_url` e `hero_audio_label` (init `''`, reset no `handleNew`, hydrate no `handleEdit`).
- No bloco de edição PT (próximo ao `content_image_url`/`KnowledgeEditor` — linha ~2274), inserir um cartão "Áudio explicativo do produto (opcional)" com:
  - `<HeroAudioUpload value={formData.hero_audio_url} onChange={v => setFormData({...formData, hero_audio_url: v})} />` (componente já existente, MP3 até 30 MB).
  - `<Input>` para `hero_audio_label` (placeholder: "Ouvir resumo do produto").
- Incluir os dois campos no payload de `upsert` (linha ~1169) para persistir em `knowledge_contents`.

Nenhuma alteração no `KnowledgeEditor.tsx` em si — o campo é externo ao editor rico (áudio é metadado do artigo, não conteúdo inline), assim como `content_image_url` já funciona hoje.

## 3. Frontend — Renderização pública (player piscante)
Arquivo: `src/components/KnowledgeContentViewer.tsx`

- Extrair `HeroAudioPlayer` (função interna de `PremiumLandingTemplate.tsx`, linhas 442–530) para um componente compartilhado novo: `src/components/knowledge/KnowledgeAudioPlayer.tsx`.
  - Mesmo player redondo com `animate-pulse` no botão + halo `animate-ping` enquanto não iniciado, barra de progresso, ícone de alto-falante, formatador de tempo.
  - Ajustar apenas o posicionamento (não é `absolute -bottom-5`; renderiza inline no topo do artigo) e cores para tokens semânticos (`bg-primary`, `text-primary-foreground`) — mantendo o efeito piscante idêntico.
- Refatorar `PremiumLandingTemplate.tsx` para importar o componente compartilhado (mantém 100% da aparência atual na LP).
- Em `KnowledgeContentViewer.tsx`, logo abaixo do `<hero-content>` (após `ArticleMeta`, ~linha 495) renderizar:
  ```tsx
  {content.hero_audio_url && (
    <KnowledgeAudioPlayer url={content.hero_audio_url} label={content.hero_audio_label} />
  )}
  ```

## Arquivos tocados
- **Migration nova**: adiciona `hero_audio_url`, `hero_audio_label` em `knowledge_contents`.
- `src/components/AdminKnowledge.tsx` — form state + UI upload + payload upsert.
- `src/components/knowledge/KnowledgeAudioPlayer.tsx` — **novo**, player compartilhado piscante.
- `src/components/lp/PremiumLandingTemplate.tsx` — troca `HeroAudioPlayer` interno pelo import compartilhado (equivalência visual garantida).
- `src/components/KnowledgeContentViewer.tsx` — renderiza player quando `hero_audio_url` existe.

## O que NÃO muda
- `KnowledgeEditor.tsx` (editor rico intacto).
- Bucket/policies de Storage (`knowledge-images` já público).
- Layout do `hero` do artigo, cards da listagem, SEO/OG.
- Comportamento do LP Builder (mesmo componente, mesmo efeito).

## Perguntas em aberto
Nenhuma — padrão de UX/persistência já existe no projeto (LP Builder + `HeroAudioUpload`), então basta espelhar para a Base de Conhecimento.