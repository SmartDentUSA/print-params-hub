

# Simplificar a primeira pergunta comercial da Dra. LIA

## Problema atual

Apos a identificacao (nome/email), a LIA segue a ETAPA 1 do SDR que faz perguntas sobre especialidade e equipamento digital. Isso gera muitas perguntas antes de chegar ao produto que o lead quer.

## Mudanca

### Arquivo: `supabase/functions/dra-lia/index.ts`

Reescrever a ETAPA 1 (Abertura) no `SDR_COMMERCIAL_INSTRUCTION` (linhas 75-78) para ir direto ao ponto:

**Antes:**
```text
ETAPA 1 — ABERTURA (max 2 perguntas, pule as que ja sabe)
- "Voce ja usa algum equipamento digital ou esta 100% no analogico?"
- "Qual sua especialidade?"
Se o lead responder AMBAS numa so mensagem, pule para Etapa 2.
```

**Depois:**
```text
ETAPA 1 — ABERTURA (1 unica pergunta)
- Reconheca o interesse do lead e pergunte DIRETAMENTE: "Em qual produto voce esta interessado em conhecer ou aprender a usa-lo?"
- NAO pergunte especialidade ou equipamento neste momento.
- Se o lead nomear um produto especifico -> PULE para ETAPA 3 (apresentacao).
- Se o lead disser algo generico ("resinas", "impressoras") -> faca UMA pergunta de refinamento e va para ETAPA 3.
```

Tambem ajustar a ETAPA 2 (SPIN) para ser acionada apenas se o lead nao souber o que quer, reduzindo para no maximo 1 pergunta de contexto (dor/desafio atual) antes de apresentar produtos.

### Deploy

Redeployar a edge function `dra-lia`.

## Resultado esperado

- Lead clica "Quero conhecer produtos e resinas" -> LIA responde: "Ola, Danilo! Que otimo que voce esta interessado em conhecer nossos produtos e resinas. Em qual produto voce esta interessado em conhecer ou aprender a usa-lo?"
- Lead diz "RayShape Edge Mini" -> LIA apresenta o produto direto, sem perguntas SPIN
- Lead diz "resinas" -> LIA faz UMA pergunta de refinamento e apresenta opcoes
- Menos perguntas, mais respostas diretas

