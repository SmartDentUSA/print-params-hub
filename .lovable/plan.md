

# Reforcar ETAPA 1: Apenas perguntar, sem apresentar produtos

## Problema

A instrucao da ETAPA 1 ja diz para perguntar diretamente, mas a LIA ainda esta apresentando produtos (ex: "Smart Print Model Plus") na primeira resposta comercial. Isso acontece porque o prompt nao proibe explicitamente citar produtos nesta etapa - a LIA interpreta "reconheca o interesse" como oportunidade para mostrar algo.

## Mudanca

### Arquivo: `supabase/functions/dra-lia/index.ts` (linhas 75-79)

Reescrever ETAPA 1 com proibicao explicita de citar produtos:

**Antes:**
```
ETAPA 1 — ABERTURA (1 unica pergunta)
- Reconheca o interesse do lead e pergunte DIRETAMENTE: "Em qual produto voce esta interessado em conhecer ou aprender a usa-lo?"
- NAO pergunte especialidade ou equipamento neste momento.
- Se o lead nomear um produto especifico -> PULE para ETAPA 3.
- Se o lead disser algo generico ("resinas", "impressoras") -> faca UMA pergunta de refinamento e va para ETAPA 3.
```

**Depois:**
```
ETAPA 1 — ABERTURA (1 unica pergunta, SEM citar produtos)
- Responda APENAS com uma saudacao curta + a pergunta: "Em qual produto voce esta interessado em conhecer ou aprender a usa-lo?"
- NAO cite nenhum produto nesta etapa. NAO descreva nenhuma resina ou equipamento. Apenas PERGUNTE.
- NAO pergunte especialidade ou equipamento.
- Se o lead nomear um produto especifico -> PULE para ETAPA 3.
- Se o lead disser algo generico ("resinas", "impressoras") -> faca UMA pergunta de refinamento e va para ETAPA 3.
```

### Deploy da edge function `dra-lia`

## Resultado esperado

Lead clica "Quero conhecer produtos e resinas" -> LIA responde:
"Ola, Danilo! Que otimo que voce esta interessado em conhecer nossos produtos e resinas, em qual produto voce esta interessado em conhecer ou aprender a usa-lo?"

Sem mencionar nenhum produto especifico na primeira mensagem.

