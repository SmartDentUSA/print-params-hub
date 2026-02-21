

# Fix: Dra. LIA deve pedir nome e email em TODAS as rotas

## Problema

A linha 1467 do `dra-lia/index.ts` exige que a mensagem seja uma saudacao simples ("ola", "oi") para acionar a coleta de nome:

```text
if (isGreeting(message) && leadState.state === "needs_name")
```

Quando o usuario clica num botao como "Quero transformar minha vida profissional!" ou "Tenho duvidas tecnicas", a funcao `isGreeting()` retorna `false` e a ETAPA 0 e pulada completamente.

## Mudanca

### Arquivo: `supabase/functions/dra-lia/index.ts`

**1. Remover `isGreeting(message)` da condicao (linha 1467)**

Antes:
```text
if (isGreeting(message) && leadState.state === "needs_name")
```

Depois:
```text
if (leadState.state === "needs_name")
```

Isso garante que, independente do que o usuario digitou ou clicou, se o nome ainda nao foi coletado, a LIA pede o nome primeiro.

**2. Adaptar a resposta para reconhecer o contexto do usuario**

Em vez de usar apenas o `GREETING_RESPONSES` generico, adicionar uma logica que reconhece a mensagem original antes de pedir o nome:

- Se a mensagem e uma saudacao simples → resposta padrao ("Ola! Sou a Dra. LIA... qual o seu nome?")
- Se a mensagem e um pedido comercial/tecnico → reconhecer o interesse e pedir o nome ("Que otimo! Vou te ajudar com isso. Antes de comecarmos, qual o seu nome?")

**3. Deploy da edge function `dra-lia`**

## Resultado esperado

- Qualquer primeira mensagem (botao comercial, botao tecnico, saudacao, pergunta direta) → LIA pede nome primeiro
- Apos nome → LIA pede email
- Apos email → fluxo normal (SPIN comercial ou resposta tecnica)
- Nenhuma informacao de produto ou tecnica e fornecida sem identificacao do lead
