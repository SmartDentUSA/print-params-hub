
# Dra. L.I.A. — Contato WhatsApp atualizado + Miniaturas de vídeo e cards de publicação

## O que será feito

Duas melhorias independentes nos dois arquivos principais da Dra. L.I.A.:

---

## Mudança 1 — Contato WhatsApp no FALLBACK_MESSAGES (edge function)

**Arquivo:** `supabase/functions/dra-lia/index.ts`

Atualizar o número e a URL do WhatsApp em todos os 3 idiomas (PT, EN, ES):

**Antes:**
```
[(16) 99383-1794](https://wa.me/5516993831794)
```

**Depois:**
```
[Chamar no WhatsApp](https://api.whatsapp.com/send/?phone=551634194735&text=Ol%C3%A1+poderia+me+ajudar%3F)
```

O link usa o formato `api.whatsapp.com/send/` com o número `551634194735` e a mensagem pré-preenchida `Olá poderia me ajudar?` (encodada como `Ol%C3%A1+poderia+me+ajudar%3F`).

---

## Mudança 2 — Miniaturas e cards de publicação no frontend

**Arquivo:** `src/components/DraLIA.tsx`

### Problema atual
O Gemini recebe `THUMBNAIL` e `URL_PUBLICA` no contexto, mas gera apenas texto markdown com links. O frontend apenas renderiza esse texto — não há cards visuais.

### Solução: chunk `media_cards` no meta + renderização no React

#### Parte A — Edge function envia `media_cards` no chunk meta

No `index.ts`, logo antes do stream SSE, adicionar ao chunk `meta` a lista de cards de mídia encontrados nos resultados (vídeos com thumbnail, artigos com imagem):

```typescript
// Montar media_cards a partir dos allResults
const mediaCards = allResults
  .filter((r) => {
    const meta = r.metadata as Record<string, unknown>;
    return meta.thumbnail_url || meta.url_publica;
  })
  .slice(0, 3)
  .map((r) => {
    const meta = r.metadata as Record<string, unknown>;
    return {
      type: r.source_type,           // 'video' | 'article'
      title: meta.title as string,
      thumbnail: meta.thumbnail_url as string | undefined,
      url: (meta.url_interna || meta.url_publica) as string | undefined,
    };
  });
```

O chunk `meta` passa de:
```json
{ "interaction_id": "uuid", "type": "meta" }
```
para:
```json
{ "interaction_id": "uuid", "type": "meta", "media_cards": [...] }
```

#### Parte B — Interface Message recebe `mediaCards`

```typescript
interface MediaCard {
  type: 'video' | 'article';
  title: string;
  thumbnail?: string;
  url?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  interactionId?: string;
  feedbackSent?: boolean;
  mediaCards?: MediaCard[];   // NOVO
}
```

#### Parte C — Frontend processa o chunk `meta` com `media_cards`

No `sendMessage`, onde o chunk `meta` é processado:

```typescript
if (parsed.type === 'meta') {
  if (parsed.interaction_id) interactionId = parsed.interaction_id;
  if (parsed.media_cards) mediaCards = parsed.media_cards;
  continue;
}
```

E ao atualizar a mensagem do assistente com os cards:

```typescript
setMessages((prev) =>
  prev.map((m) =>
    m.id === assistantMsg.id
      ? { ...m, content: fullContent, interactionId, mediaCards }
      : m
  )
);
```

#### Parte D — Componente `MediaCardStrip` renderizado abaixo da mensagem

Dentro do render da mensagem do assistente, logo abaixo do texto e antes dos botões de feedback, renderizar os cards:

```tsx
{msg.mediaCards && msg.mediaCards.length > 0 && (
  <div className="mt-2 space-y-2">
    {msg.mediaCards.map((card, i) => (
      <a
        key={i}
        href={card.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white 
                   hover:bg-gray-50 transition-colors overflow-hidden shadow-sm p-2"
      >
        {/* Thumbnail ou ícone */}
        <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-gray-100 
                        flex items-center justify-center">
          {card.thumbnail ? (
            <img
              src={card.thumbnail}
              alt={card.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="text-2xl">
              {card.type === 'video' ? '▶' : '📄'}
            </span>
          )}
        </div>

        {/* Título e tipo */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-800 leading-tight line-clamp-2">
            {card.title}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {card.type === 'video' ? '▶ Assistir no site' : '📖 Ver publicação'}
          </div>
        </div>
      </a>
    ))}
  </div>
)}
```

---

## Resultado Visual Esperado

**Antes:**
```
Com base nos dados cadastrados, temos o vídeo Comparativo de Resinas 3D.
[▶ Assistir no site](/base-conhecimento/c/comparativo-resinas)
```

**Depois:**
```
Com base nos dados cadastrados, temos o vídeo Comparativo de Resinas 3D.

┌─────────────────────────────────────────┐
│ [miniatura do vídeo] ▶ Comparativo      │
│                       ▶ Assistir no site│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ [📄]  Guia Técnico: Comparativo de      │
│       Resinas para Restaurações         │
│       📖 Ver publicação                 │
└─────────────────────────────────────────┘
```

---

## Arquivos Modificados

| Arquivo | Mudanças |
|---|---|
| `supabase/functions/dra-lia/index.ts` | 1. WhatsApp URL/número atualizado nos 3 idiomas; 2. `media_cards` adicionado ao chunk `meta` |
| `src/components/DraLIA.tsx` | 1. Interface `MediaCard` e campo `mediaCards` em `Message`; 2. Parse do `media_cards` no stream; 3. Componente de cards renderizado abaixo da mensagem |

---

## Seção Técnica

Os `media_cards` são enviados no primeiro chunk SSE (`meta`), antes do texto — então os cards aparecem assim que o usuário começa a ver a resposta.

Apenas os 3 primeiros resultados com thumbnail ou URL são exibidos como cards, para não sobrecarregar o chat.

O `onError` na `<img>` garante que thumbnails quebradas (CDN indisponível, etc.) mostrem o ícone emoji em vez de um elemento quebrado.

Não há mudanças no banco de dados. O deploy da edge function é necessário após a edição do `index.ts`.
