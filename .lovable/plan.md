
# Dra. L.I.A. — Correção do Diálogo Guiado para Frases Contextuais

## Os dois problemas exatos

### Problema 1 — "parametrizar" não é detectado
A mensagem `"comprei uma resina de vocês e preciso parametrizar minha impressora"` não bate em nenhum `PARAM_KEYWORD`. O regex `/parametro/i` não captura "parametrizar" porque as letras divergem (parametr**o** vs parametr**izar**). Resultado: a mensagem vai direto ao RAG.

### Problema 2 — RAG gera resposta com dados aleatórios + vídeos
Com o diálogo guiado fora do caminho, o RAG busca conteúdo usando as palavras "resina", "impressora", "parametrizar" e encontra:
- Parâmetros cadastrados (ex: "Anycubic Mono-X, Smart Print Gengiva, Layer 0.05mm, Tempo 2.5s")
- Vídeos com título contendo "anycubic" ou "parâmetros"

O LLM então usa esses dados como "exemplos" na resposta — mesmo que o usuário nunca tenha citado Anycubic nem Smart Print Gengiva. É a aparência de "chatbot pré-definido" que o usuário detectou.

## Solução — 2 mudanças cirúrgicas

### Mudança 1 — Expandir `PARAM_KEYWORDS` (linha 118-127)

Adicionar padrões que capturam frases contextuais como a do usuário:

```typescript
// ADICIONAR ao array PARAM_KEYWORDS:
/parametrizar|parametrizaç/i,
/\bimpressora\b/i,                                    // "minha impressora" já basta
/(comprei|tenho|uso|adquiri).*(resina|impressora)/i,  // "comprei uma resina"
/(resina).*(impressora|imprimir)/i,                   // "resina ... impressora"
/(impressora).*(resina|configurar|usar)/i,            // "impressora ... resina"
```

A regra `/\bimpressora\b/i` sozinha já capturaria "preciso parametrizar minha **impressora**". Esse é o sinal mais forte: qualquer mensagem que mencione "impressora" tem alta probabilidade de ser uma pergunta de parâmetros.

### Mudança 2 — Guardar o diálogo guiado ANTES do RAG para mensagens com "impressora" + "resina" juntas

Quando a mensagem contém "impressora" mas não está num diálogo ativo (history vazio ou último assitante não perguntou nada), o estado correto é `needs_brand` — perguntar a marca primeiro.

Isso já acontece se a Mudança 1 for aplicada corretamente, porque `isPrinterParamQuestion` vai retornar `true` e `detectPrinterDialogState` vai retornar `{ state: "needs_brand" }`.

## Fluxo corrigido

```text
Usuário: "comprei uma resina de vocês e preciso parametrizar minha impressora"
    ↓
isPrinterParamQuestion() → TRUE  (agora detecta "parametrizar" + "impressora")
detectPrinterDialogState() → { state: "needs_brand", availableBrands: [...] }
    ↓
L.I.A.: "Claro! Para te ajudar com os parâmetros, qual é a marca da sua impressora?
         Marcas disponíveis: Anycubic, Creality, Elegoo, Ezy3d, Flashforge..."
    ↓
[RAG nunca é chamado — sem dados aleatórios, sem vídeos irrelevantes]
```

## O que muda no código

**Apenas `supabase/functions/dra-lia/index.ts` — linhas 118-130**

```typescript
// ANTES
const PARAM_KEYWORDS = [
  /parâmetro|parametro|parameter/i,
  /configuração|configuracao|setting/i,
  /\bexposição\b|exposicao|exposure/i,
  /layer height|espessura de camada/i,
  /como imprimir|how to print|cómo imprimir/i,
  /tempo de cura|cure time|tiempo de exposición/i,
  /configurar|configurações|configuracoes/i,
  /quais (os )?param|qual (o )?param/i,
];

// DEPOIS
const PARAM_KEYWORDS = [
  /parâmetro|parametro|parameter|parametrizar/i,
  /configuração|configuracao|setting/i,
  /\bexposição\b|exposicao|exposure/i,
  /layer height|espessura de camada/i,
  /como imprimir|how to print|cómo imprimir/i,
  /tempo de cura|cure time|tiempo de exposición/i,
  /configurar|configurações|configuracoes/i,
  /quais (os )?param|qual (o )?param/i,
  // Padrões contextuais — capturam intenção sem palavra exata "parâmetro"
  /\bimpressora\b/i,
  /(comprei|tenho|uso|adquiri).{0,30}(resina|impressora)/i,
  /(resina).{0,30}(impressora|imprimir|impressão)/i,
  /(impressora).{0,30}(resina|configurar|usar|parâmetro)/i,
  /calibrar|calibração|calibragem/i,
];
```

**Importante — a linha `/\bimpressora\b/i` sozinha pode ser muito ampla**
Frases como "minha impressora não liga" não devem ativar o diálogo. Para evitar falsos positivos, a regra de "impressora" precisa de contexto de intenção. Refinamento:

```typescript
  /(preciso|quero|busco|quais|como|qual|configurar|usar|parametrizar).{0,40}\bimpressora\b/i,
  /\bimpressora\b.{0,40}(resina|parâmetro|configurar|parametrizar)/i,
```

## O que não muda

- Lógica de detecção de etapas do diálogo — inalterada
- Frontend — zero mudanças
- Sistema de RAG — continua funcionando para perguntas que não são sobre parâmetros de impressora

## Seção Técnica

- Arquivo alterado: `supabase/functions/dra-lia/index.ts` — apenas o array `PARAM_KEYWORDS` (linhas 118-130)
- Impacto: qualquer mensagem que mencione "impressora" com contexto de intenção (preciso, configurar, parametrizar, usar, qual) agora aciona o diálogo guiado em vez de cair no RAG
- Falsos positivos tratados: "minha impressora não liga" não tem palavras-chave de intenção de parâmetros → não ativa o diálogo
- A raiz do problema de vídeos e exemplos aleatórios é o RAG rodando sem contexto correto — corrigido indiretamente ao ativar o diálogo guiado para essas mensagens
- Deploy automático ao salvar
