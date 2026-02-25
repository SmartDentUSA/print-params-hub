

## Plano: Welcome Message como Saudacao Neutra + Email via Backend

### Problema

A mensagem "Para que eu possa te reconhecer, informe seu e-mail" esta hardcoded como `welcome_message` no estado inicial do componente (linha 216-222 de `DraLIA.tsx`). Isso faz com que ela fique SEMPRE fixa no topo do chat como primeira mensagem, mesmo durante e apos a qualificacao.

O pedido de email deve vir do **backend** (edge function) como parte natural do fluxo de conversa, nao como mensagem estatica inicial.

### Correcao

**1. Alterar `welcome_message` nos 3 locales para uma saudacao neutra:**

**pt.json** (linha 224):
```
ANTES: "Para que eu possa te reconhecer, informe seu **e-mail**."
DEPOIS: "Olá! 👋 Sou a Dra. L.I.A., sua consultora em odontologia digital. Como posso te ajudar?"
```

**en.json** (linha 224):
```
ANTES: "So I can recognize you, please provide your **email**."
DEPOIS: "Hi! 👋 I'm Dr. L.I.A., your digital dentistry consultant. How can I help you?"
```

**es.json** (linha 224):
```
ANTES: "Para que pueda reconocerte, infórmame tu **correo electrónico**."
DEPOIS: "¡Hola! 👋 Soy la Dra. L.I.A., tu consultora en odontología digital. ¿Cómo puedo ayudarte?"
```

**2. Nenhuma alteracao no backend** — o edge function ja envia `GREETING_RESPONSES` ("Para que eu possa te reconhecer, informe seu e-mail.") como primeira resposta quando o usuario manda qualquer mensagem sem estar identificado. O fluxo natural sera:

```text
[Welcome - fixo]  "Olá! 👋 Sou a Dra. L.I.A...."
[Usuário]          "Oi" / qualquer texto
[Backend]          "Para que eu possa te reconhecer, informe seu e-mail."
[Usuário]          "joao@email.com"
[Backend]          "Ainda não sei seu nome! Como devo te chamar?"
...continuação normal...
```

### Resumo

```text
MODIFICAR:
  src/locales/pt.json  — linha 224: welcome_message → saudação neutra
  src/locales/en.json  — linha 224: welcome_message → saudação neutra
  src/locales/es.json  — linha 224: welcome_message → saudação neutra
```

Tres alteracoes de string. Zero mudanca de logica. O backend ja cuida do pedido de email.

