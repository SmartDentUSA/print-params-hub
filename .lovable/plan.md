

# Corrigir bloco de links/contatos repetido em toda resposta da Dra. LIA

## Problema

A LIA despeja automaticamente o bloco de Loja, Parametros, Cursos, WhatsApp, Email e Horario no final de TODA resposta. Isso acontece porque o system prompt tem esses dados expostos sem instrucao explicita de quando usa-los. O LLM interpreta como "informacao para sempre compartilhar".

## Causa raiz

1. A secao `DADOS DA EMPRESA` (linha 1438) injeta Loja, Parametros, Cursos, Instagram, YouTube como texto plano sem restricao de uso
2. A `INSTRUCAO ESPECIAL — CONTATO COMERCIAL` (linha 1442) diz "retorne SEMPRE" os dados de contato — o LLM interpreta como "em toda resposta"
3. Nao existe regra proibindo o despejo proativo desses links

## Solucao

### Arquivo: `supabase/functions/dra-lia/index.ts`

**Alteracao 1 — Linha 1438:** Adicionar instrucao restritiva na secao DADOS DA EMPRESA:

```text
### DADOS DA EMPRESA (fonte: sistema ao vivo)
IMPORTANTE: Estes dados sao para CONSULTA INTERNA sua. 
So compartilhe links (Loja, Parametros, Cursos) ou dados de contato 
quando o usuario PEDIR EXPLICITAMENTE ou quando for contextualmente 
relevante (ex: indicar loja ao falar de compra, parametros ao falar 
de configuracao). NUNCA despeje todos os links juntos no final da resposta.
```

**Alteracao 2 — Linhas 1441-1445:** Reescrever as instrucoes especiais para restringir o uso:

```text
INSTRUCAO — STATUS ONLINE: Se perguntarem "voce esta online/ativa?" — 
responda afirmativamente e mencione o horario humano.

INSTRUCAO — CONTATO COMERCIAL: So forneça dados de contato quando 
o usuario PEDIR (ex: "como falo com voces?", "telefone", "email", 
"whatsapp"). Nesse caso, retorne:
- WhatsApp: (16) 99383-1794
- E-mail: comercial@smartdent.com.br  
- Horario: Segunda a Sexta, 8h as 18h
```

**Alteracao 3 — Adicionar regra explicita na secao PERSONALIDADE (apos regra 10):**

```text
11. **PROIBIDO bloco de links generico:** Nunca encerre uma resposta 
com um bloco de "links uteis" ou "contatos para sua conveniencia". 
Compartilhe links apenas quando forem diretamente relevantes a pergunta.
```

### Deploy

A edge function sera deployada automaticamente apos a edicao.

