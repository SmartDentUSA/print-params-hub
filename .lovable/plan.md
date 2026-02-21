

# Fix: Dra. LIA fazendo multiplas perguntas por mensagem

## Problema

A Dra. LIA esta fazendo 2-3 perguntas na mesma mensagem (especialidade + tipo de fluxo), mesmo havendo a regra "uma pergunta por vez" na Etapa 2. O problema e que a Etapa 1 lista 3 perguntas como bullets e nao tem uma instrucao explicita de "uma por vez", e a regra geral (linha 1487) diz "2-4 frases" mas nao proibe multiplas perguntas.

## Solucao

Duas alteracoes no arquivo `supabase/functions/dra-lia/index.ts`:

### 1. Adicionar regra rigida no topo do SDR_COMMERCIAL_INSTRUCTION (linha 41)

Logo apos a MISSAO, inserir:

```
**REGRA ABSOLUTA:** Faca NO MAXIMO 1 pergunta por mensagem. Nunca combine duas perguntas. Espere a resposta antes de avançar. Cada mensagem sua deve terminar com UMA UNICA pergunta.
```

### 2. Reformular Etapa 1 para deixar claro a sequencia (linhas 45-51)

De bullets simultaneos para sequencia explicita:

```
**ETAPA 1 — ABERTURA + RAPPORT + SITUACAO**
Comece personalizado ao que o lead disse. Faca UMA pergunta por mensagem nesta ordem:
1a mensagem: "Voce ja usa algum equipamento digital ou esta 100% no analogico?"
2a mensagem (apos resposta): "Qual sua especialidade?"
3a mensagem (apos resposta): "Possui mais de um consultorio ou profissional trabalhando no mesmo espaco?"
NAO combine essas perguntas. Avance uma por vez conforme o lead responde.
```

### 3. Reforcar na regra 5 da personalidade (linha 1487)

De:
```
5. **Direta ao Ponto:** 2-4 frases claras. Evite paredes de texto.
```

Para:
```
5. **Direta ao Ponto:** 2-4 frases claras. MAXIMO 1 pergunta por mensagem. Evite paredes de texto.
```

## Deploy

A edge function sera deployada automaticamente apos a edicao.
