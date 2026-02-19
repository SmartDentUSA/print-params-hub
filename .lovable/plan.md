
# Correção: Gate de Relevância para Vídeos Solicitados por Sub-tema

## Diagnóstico Preciso da Cadeia de Erros

### Turno 1 — "como é a pós cura após a aplicação do Nanoclean POD?"
O LLM respondeu corretamente com os tempos de cura, **mas ao final gerou**: *"Também temos um vídeo sobre esse tema — quer ver?"*

Esta frase saiu mesmo com a Regra 8 já atualizada. Isso acontece porque o LLM internalizou o padrão de "convite para vídeo" da instrução anterior e ainda o reproduz por momentum de treinamento — a Regra 8 diz PROIBIDO, mas não explica que o LLM deve checar o `context_raw` antes de qualquer menção. A regra precisa ser ainda mais diretiva.

### Turno 2 — "Qual vídeo sobre tratamento térmico?"
Ao receber essa mensagem, o sistema de código faz:
```
userRequestedMedia = true  (pois contém "vídeo")
isProtocolQuery = false    (não contém "limpeza/cura/protocolo/secagem")
```
Resultado: retorna os 3 primeiros resultados do RAG com thumbnail/url, que eram sobre:
- "Protocolos sobre Implante e Próteses Metal Free" (Vitality - temático, não sobre tratamento térmico)
- "[COMPARATIVO] Impressora 3D ideal para chairside print" (irrelevante)
- "Impressão de protocolos sobre implante" (irrelevante)

O LLM então **inventou** que o primeiro vídeo "detalha os protocolos sobre implante e próteses metal free" como substituto para tratamento térmico — alucinação de relevância.

## Dois Problemas, Duas Correções

### Problema 1: Regra 8 ainda insuficiente

A instrução atual diz "PROIBIDO mencionar vídeos... a menos que o RAG tenha retornado VIDEO_INTERNO ou VIDEO_SEM_PAGINA". Mas o LLM não sabe diferenciar "o contexto tem um vídeo" de "o contexto tem um vídeo SOBRE o que o usuário perguntou agora". Ele vê que há vídeos sobre Vitality no contexto e generaliza.

**Correção:** Adicionar à Regra 8 uma instrução explícita:
> "Ao mencionar um vídeo, o título ou descrição do vídeo DEVE conter palavras relacionadas ao sub-tema pedido. Se o usuário perguntou 'Qual vídeo sobre tratamento térmico?' e os vídeos disponíveis no contexto não mencionam 'tratamento térmico', 'forno', '85°C' ou termos equivalentes no título/descrição, responda: 'Não tenho um vídeo específico sobre tratamento térmico cadastrado no momento.'"

### Problema 2: Lógica de mediaCards sem gate de relevância de sub-tema

Quando `userRequestedMedia = true`, todos os resultados com URL são retornados. Não há verificação se o título do vídeo é compatível com a intenção específica da pergunta.

**Correção cirúrgica na lógica de mediaCards:** Extrair o "tema pedido" da mensagem do usuário e comparar contra os títulos dos cards. Se nenhum card tem token em comum com o tema pedido, retornar array vazio.

```typescript
// Extrai palavras-chave do sub-tema pedido pelo usuário
// "Qual vídeo sobre tratamento térmico?" → ["tratamento", "térmico"]
// "Quero ver tutorial sobre NanoClean" → ["nanoclean"]
const VIDEO_TOPIC_STOPWORDS = new Set([
  'qual', 'vídeo', 'video', 'sobre', 'tem', 'ter', 'quero', 'ver', 
  'assistir', 'tutorial', 'mostrar', 'vocês', 'vocé', 'você', 'me',
  'um', 'uma', 'o', 'a', 'de', 'para', 'que', 'como', 'é', 'tem'
]);

function extractVideoTopic(msg: string): string[] {
  return msg.toLowerCase()
    .replace(/[?!.,]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !VIDEO_TOPIC_STOPWORDS.has(w));
}

function cardMatchesTopic(title: string, topicTokens: string[]): boolean {
  if (topicTokens.length === 0) return true; // sem tema específico, aceita qualquer card
  const titleLower = title.toLowerCase();
  return topicTokens.some(token => titleLower.includes(token));
}
```

Aplicar o gate na construção de `mediaCards`:

```typescript
const topicTokens = extractVideoTopic(message);

const mediaCards = userRequestedMedia
  ? allResults
      .filter(r => meta.thumbnail_url || meta.url_publica || meta.url_interna)
      .filter(r => !isProtocolQuery || !isParameterCard(title))
      .filter(r => cardMatchesTopic(title, topicTokens))  // ← NOVO GATE
      .slice(0, 3)
      .map(...)
  : [];
```

Se `mediaCards.length === 0` após o filtro, não enviamos nenhum card — e o LLM (via Regra 8 reforçada) dirá que não há vídeo específico sobre aquele sub-tema.

## Arquivo Modificado

| Arquivo | Seção | Ação |
|---|---|---|
| `supabase/functions/dra-lia/index.ts` | Linha ~1112 (Regra 8) | Acrescentar verificação de sub-tema ao texto da regra |
| `supabase/functions/dra-lia/index.ts` | Linhas ~1196–1246 (mediaCards) | Adicionar funções `extractVideoTopic` e `cardMatchesTopic` + aplicar filtro |

## Tabela de Validação

| Cenário | Antes | Depois |
|---|---|---|
| "Qual vídeo sobre tratamento térmico?" sem vídeo relevante no RAG | Mostra vídeos irrelevantes e afirma que cobrem o tema | Responde "Não tenho vídeo específico sobre tratamento térmico cadastrado" |
| "Qual vídeo sobre NanoClean?" com vídeo de NanoClean no RAG | Card aparece corretamente | Comportamento mantido ✓ |
| "Quero ver um tutorial de limpeza" com vídeo de protocolo no RAG | Funciona | Comportamento mantido ✓ |
| "Preciso saber o protocolo de limpeza" (sem pedir vídeo) | Sem card | Sem card ✓ |
| "Tem vídeo sobre impressora Anycubic?" com vídeo Anycubic no RAG | Card aparece | Card aparece ✓ |

## Impacto

- Nenhuma migração de banco
- Nenhuma alteração de lógica de busca RAG
- Deploy automático após edição
- Elimina a alucinação de "relevância fabricada" onde o LLM apresenta um vídeo disponível como cobrindo um sub-tema que ele não cobre
