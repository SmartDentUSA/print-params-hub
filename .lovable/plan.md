
# Dra. L.I.A. — Protocolos de Processamento como Fonte Primária

## Problema Raiz

A função `searchKnowledge` em `dra-lia/index.ts` busca dados em 3 fontes:

1. `agent_embeddings` (pgvector) → artigos, parâmetros, vídeos vetorizados
2. `search_knowledge_base` (FTS) → artigos da base de conhecimento
3. `knowledge_videos` (keyword search) → vídeos por título

**A tabela `resins` nunca é consultada diretamente.** O campo `processing_instructions` — que contém os protocolos completos de pré-processamento, lavagem, cura UV, tratamento térmico, acabamento e polimento — fica **completamente invisível** para a L.I.A.

Hoje, 3 resinas têm instruções cadastradas:
- `Smart Print Bio Vitality`
- `Smart Print Bio Bite Splint +Flex`
- `Smart Print Try-in Calcinável`

---

## Detecção de Intenção — Palavras-Chave de Protocolo

Perguntas sobre processamento têm padrões identificáveis. A solução usará um detector de intenção específico, análogo ao `isGreeting()` já implementado:

```typescript
const PROTOCOL_KEYWORDS = [
  // PT
  /limpeza|lavagem|lavar|limpar/i,
  /cura|pós.cura|pos.cura|fotopolimerizar|uv/i,
  /finaliz|acabamento|polimento|polir/i,
  /pré.process|pos.process|processamento|protocolo/i,
  /nanoclean|isopropílico|álcool/i,
  /suporte|remov/i,
  // EN
  /clean|wash|washing/i,
  /post.cure|curing|cure/i,
  /finish|polish/i,
  /processing|protocol/i,
  // ES
  /limpieza|lavar/i,
  /curado|post.curado/i,
  /pulido|acabado/i,
  /procesamiento|protocolo/i,
];
```

Se a pergunta bater com algum desses padrões, a função executa uma **busca paralela e prioritária** nas `resins.processing_instructions`.

---

## Estratégia de Busca Dupla com Prioridade

A nova função `searchProcessingInstructions(supabase, message)` vai:

1. **Extrair nome de resina da pergunta** se disponível (ex: "NanoClean", "Vitality", "Bite Splint")
2. **Consultar `resins`** filtrando por nome ou retornando todas com `processing_instructions IS NOT NULL`
3. **Retornar os dados no formato unificado** já usado pelo RAG

```typescript
async function searchProcessingInstructions(supabase, message) {
  // Tenta identificar nome de resina na mensagem
  const { data: resins } = await supabase
    .from("resins")
    .select("id, name, manufacturer, slug, processing_instructions, cta_1_url, cta_1_label")
    .eq("active", true)
    .not("processing_instructions", "is", null);

  if (!resins?.length) return [];

  // Score por relevância: quantas palavras da pergunta batem com nome/fabricante da resina
  const scored = resins
    .map(r => {
      const text = `${r.name} ${r.manufacturer}`.toLowerCase();
      const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const score = words.filter(w => text.includes(w)).length;
      return { resin: r, score };
    })
    .filter(x => x.score > 0 || resins.length === 1)
    .sort((a, b) => b.score - a.score);

  // Se não achou por nome, retorna todas (pergunta genérica como "como lavar?")
  const targets = scored.length > 0 ? scored.map(x => x.resin) : resins;

  return targets.slice(0, 2).map(r => ({
    id: r.id,
    source_type: "processing_protocol",
    chunk_text: `${r.name} (${r.manufacturer}) — Instruções de Pré e Pós Processamento:\n${r.processing_instructions}`,
    metadata: {
      title: `Protocolo de Processamento: ${r.name}`,
      resin_name: r.name,
      cta_1_url: r.cta_1_url,
      url_publica: r.slug ? `/resina/${r.slug}` : null,
    },
    similarity: 0.95, // Alta prioridade — é a fonte da verdade
  }));
}
```

---

## Nova Regra no System Prompt

Adicionar uma regra específica para protocolos:

```
13. PROTOCOLOS DE PROCESSAMENTO (limpeza, lavagem, cura UV, acabamento):
    Estes dados vêm diretamente das fichas técnicas cadastradas pelo fabricante — são a FONTE
    DA VERDADE. Apresente as etapas na ordem exata do documento:
    1. Pré-processamento
    2. Lavagem/Limpeza
    3. Secagem
    4. Pós-cura UV (com tempos por equipamento se disponível)
    5. Tratamento térmico (se houver)
    6. Acabamento e polimento (se houver)
    Use listas com bullet points. Destaque produtos SmartDent com **negrito**.
    Nunca omita etapas — a ordem correta é crítica para o resultado clínico.
```

---

## Fluxo Completo Após a Mudança

```text
Usuário: "Como faço a limpeza e cura da Smart Print Bio Vitality?"
       │
       ▼
isGreeting()? → NÃO
       │
       ▼
isProtocolQuestion()? → SIM (palavras: "limpeza", "cura")
       │
       ├─→ searchProcessingInstructions() → retorna o processing_instructions completo da Vitality
       │   (similarity = 0.95, source_type = "processing_protocol")
       │
       └─→ searchKnowledge() normal → resultados adicionais (artigos/vídeos)
       │
       ▼
Merge: protocolResults + knowledgeResults (protocolo fica primeiro no contexto)
       │
       ▼
Gemini recebe as instruções completas + Regra 13 no system prompt
       │
       ▼
Resposta estruturada com etapas na ordem correta, usando os dados exatos do cadastro
```

---

## Arquivo Modificado

Apenas `supabase/functions/dra-lia/index.ts`:

| Mudança | Descrição |
|---|---|
| `PROTOCOL_KEYWORDS` (constante) | Array de regex para detectar perguntas sobre processamento |
| `isProtocolQuestion(msg)` | Função que verifica se a mensagem é sobre protocolos |
| `searchProcessingInstructions(supabase, message)` | Nova função que busca diretamente em `resins.processing_instructions` |
| Bloco após `isGreeting()` | Se `isProtocolQuestion()`, executa busca paralela e prefixa os resultados no contexto |
| `contextParts` builder | Adiciona `source_type = "processing_protocol"` ao formatador |
| Regra 13 no system prompt | Instrui o Gemini a apresentar protocolos em ordem e completamente |

---

## Comportamento Esperado

| Pergunta | Antes | Depois |
|---|---|---|
| "Como limpar a impressão?" | Resposta genérica ou fallback | Protocolo completo: NanoClean 60s → ar comprimido → pós-cura UV com tempos por equipamento |
| "Qual o protocolo de cura da Vitality?" | Busca fulltext em artigos (sem dados) | Instruções exatas do cadastro: Elegoo Mercury 20min, Anycubic 25min, ShapeCure presets |
| "Como é o pós-processamento das resinas Smart Dent?" | Não encontrava → fallback humano | Retorna protocolos das 3 resinas cadastradas com instruções completas |
| "Quanto tempo cura no Elegoo Mercury?" | Não sabia | "**20 min** para coroas, **16 min** para facetas na Smart Print Bio Vitality." |

---

## Seção Técnica

**Por que `similarity = 0.95` para os resultados de protocolo?**
Os resultados de `processing_instructions` são injetados com similaridade artificialmente alta (0.95) para garantir que apareçam **primeiro** no contexto montado para o Gemini. Isso implementa a "fonte da verdade" de forma determinística — o modelo verá as instruções do fabricante antes de qualquer artigo ou vídeo.

**Pergunta genérica sem nome de resina (ex: "como lavar?")**
Neste caso, o `score > 0` não filtra nenhuma resina, então `targets = resins` retorna todas as resinas com `processing_instructions IS NOT NULL`. O Gemini recebe os protocolos de todas e pode responder de forma consolidada ou pedir clarificação sobre qual resina o usuário está usando.

**Sem mudança no banco de dados.** A tabela `resins` já tem o campo `processing_instructions`. Não é necessária nenhuma migração SQL.
