
## Diagnóstico Completo: Alucinação sobre Vídeos de Suportes em Placas Miorrelaxantes

### O Que Aconteceu (Cadeia de Falhas)

A pergunta foi: **"você tem algum vídeo que explica como colocar suportes em placas miorrelaxantes?"**

O banco de dados confirma que **não existe nenhum vídeo sobre o tema específico de suportes em placas miorrelaxantes**. O que existe são vídeos sobre *posicionamento geral* e *impressão* de placas, mas nenhum com foco em "como colocar suportes". A LIA deveria ter dito isso — mas não disse.

---

### Falha 1 — O RAG retornou contexto fraco (sem `url_interna`)

Os vídeos encontrados pelo RAG sobre "placa miorrelaxante" têm `embedding_count: 0` — ou seja, **0 desses vídeos estão indexados no RAG vetorial**. A busca caiu para o fallback ILIKE/keyword, que retornou títulos como "Curso Online - Lychee Slicer - Impresión de Placas Miorrelajantes" e "Posicionamento de Placa".

Mas todos esses vídeos retornaram com `url_interna: null` — sem link interno, pois têm `content_id: null` na tabela `knowledge_videos`. Isso significa que o campo `VIDEO_SEM_PAGINA` foi passado para a IA no contexto.

### Falha 2 — A IA ignorou a regra anti-alucinação do tema específico

A regra 8 do system prompt diz explicitamente:

> "CRÍTICO: Ao mencionar um vídeo, o título ou descrição do vídeo DEVE conter palavras diretamente relacionadas ao sub-tema pedido pelo usuário. Se o usuário perguntou 'sobre suportes' e os vídeos têm títulos sobre posicionamento geral — responda: 'Não tenho um vídeo específico sobre [sub-tema] cadastrado.'"

A IA recebeu vídeos de "posicionamento de placa" e "impressão de placas miorrelajantes" — que não abordam "colocar suportes" especificamente — mas mesmo assim **inventou os detalhes técnicos**:
- "inclinar o modelo entre 15° e 30° para evitar o efeito vácuo" — **inventado**
- "identificação manual de ilhas (pontos críticos)" — **inventado**
- "impressão da placa na horizontal para reduzir o tempo de exposição" — **inventado**

### Falha 3 — A regra existe mas não é forte o suficiente

O sistema prompt tem a regra 8 e a regra 18 (CONTEXTO FRACO → PERGUNTA CLARIFICADORA), mas o modelo `google/gemini-3-flash-preview` está **priorizando ser útil** em vez de ser preciso quando o contexto é ambíguo. A regra está lá, mas o framing não é forte o suficiente para impedir a geração criativa quando existem vídeos com títulos *relacionados*.

---

### As 2 Correções Necessárias

**Correção 1 — `supabase/functions/dra-lia/index.ts`: Reforçar a regra anti-alucinação de vídeos**

A regra 8 precisa de uma instrução mais **imperativa e explícita** sobre correspondência de sub-temas. Atualmente ela diz que o título "DEVE conter palavras relacionadas", mas o modelo está interpretando isso de forma liberal.

Mudança na regra 8 do system prompt (linha ~1242): adicionar um CHECK obrigatório com exemplos negativos concretos:

```
⚠️ VERIFICAÇÃO OBRIGATÓRIA ANTES DE CITAR QUALQUER VÍDEO:
  - Pergunta do usuário: "suportes em placas miorrelaxantes"
  - Vídeo disponível: "Posicionamento de Placa" → NÃO relevante (posicionamento ≠ suportes)
  - Vídeo disponível: "Impressão de Placas Miorrelajantes" → NÃO relevante (impressão geral ≠ suportes)
  - Vídeo relevante seria: "Suportes em Placas", "Como colocar suportes", "Supports for splints"
  
  Se nenhum vídeo tem o sub-tema exato → responda OBRIGATORIAMENTE:
  "Não tenho um vídeo específico sobre [colocar suportes em placas miorrelaxantes] cadastrado no momento. [Fallback WhatsApp]"
  NUNCA descreva o conteúdo técnico que o vídeo "provavelmente" contém.
```

**Correção 2 — `supabase/functions/dra-lia/index.ts`: Adicionar regra de proibição de inferência técnica**

Adicionar uma nova regra anti-alucinação (regra 19) explicitamente proibindo descrever o conteúdo de vídeos com `VIDEO_SEM_PAGINA`:

```
19. VÍDEOS SEM PÁGINA (VIDEO_SEM_PAGINA): NUNCA descreva, resuma ou infira o conteúdo técnico de um vídeo. Se o vídeo não tem página interna, apenas cite o título. PROIBIDO dizer "este vídeo ensina X" ou "este tutorial mostra Y" — você não tem acesso ao conteúdo real do vídeo, apenas ao título.
```

---

### Impacto Esperado

| Cenário | Antes | Depois |
|---|---|---|
| Vídeo relevante existe com url_interna | Link clicável ✅ | Link clicável ✅ |
| Vídeo de tema próximo, sem url_interna | Inventa conteúdo técnico ❌ | "Não tenho vídeo específico" + WhatsApp ✅ |
| Nenhum vídeo relevante | Inventa vídeos fictícios ❌ | "Não tenho vídeo específico" + WhatsApp ✅ |

---

### Problema Raiz Subjacente (médio prazo)

**499 vídeos no banco, apenas 20 indexados no RAG.** Os vídeos de placa miorrelaxante têm `content_id: null` — não estão associados a artigos da base de conhecimento — e por isso nunca terão `url_interna`. Para resolver definitivamente:

1. Associar os vídeos técnicos a artigos da base de conhecimento (preencher `content_id`)
2. Ou criar artigos dedicados para esses vídeos com slug próprio

Mas isso é trabalho editorial, não técnico.

---

### Resumo das Alterações

| Arquivo | Local | Mudança |
|---|---|---|
| `dra-lia/index.ts` | Regra 8 do system prompt (~linha 1242) | Adicionar verificação obrigatória de correspondência de sub-tema com exemplos negativos |
| `dra-lia/index.ts` | Nova regra 19 (~linha 1253) | Proibir descrição/inferência de conteúdo de vídeos VIDEO_SEM_PAGINA |

2 linhas do system prompt modificadas. Deploy automático. Nenhuma re-indexação necessária.
