

# WhatsApp LIA — 2 Bugs Criticos Encontrados

## Diagnostico

Analisei a `dra-lia-whatsapp` inteira e identifiquei **2 bugs fatais** que se combinam para criar o comportamento que voce esta vendo:

### Bug 1: `@lid` — WhatsApp mudou o formato de identificador

O WaLeads esta enviando IDs no formato `278404175765557@lid` em vez de numeros de telefone reais. A funcao `stripWaSuffix` (linha 33) remove o `@lid`, mas o numero que sobra (`278404175765557`) **nao e um telefone** — e um ID interno do WhatsApp.

Resultado:
- `phoneDigits` = `278404175765557` (nao e telefone)
- `phoneSuffix` = `175765557` (ultimos 9 digitos do LID, nao do telefone)
- Match por `telefone_normalized` **sempre falha**
- Cria um **novo lead** cada vez que alguem manda mensagem
- Os nomes na inbox aparecem como `278404175765557@lid`

**Solucao**: O WhatsApp envia o telefone real em campos alternativos do payload: `senderPn`, `remoteJidAlt`, `_data.key.senderPn`, `participant`. Preciso atualizar `extractFields` para procurar nesses campos e usar o telefone real quando disponivel.

### Bug 2: Session ID muda a cada mensagem (CRITICO)

Linha 330:
```
const sessionId = `wa_${phoneDigits}_${Date.now()}`;
```

`Date.now()` muda a cada chamada! Cada mensagem recebida cria uma **sessao nova**. A LIA ve historico vazio, detecta `needs_email_first`, e pede o email de novo. Mesmo que o usuario responda com o email, a proxima mensagem cria outra sessao e pede de novo. Loop infinito.

**Solucao**: Usar session ID estavel por telefone: `wa_${phoneDigits}` (sem timestamp).

### Cascata de Falhas

```text
Mensagem chega com @lid
  → phoneDigits = "278404175765557" (LID, nao telefone)
  → match por telefone_normalized FALHA
  → cria NOVO lead (wa_278..._1741...@whatsapp.lead)
  → sessionId = wa_278..._{timestamp} (NOVO cada vez)
  → dra-lia recebe sessao vazia
  → detecta needs_email_first
  → "Para que eu possa te reconhecer, informe seu e-mail"
  → proximo mensagem → repete TUDO
```

## Plano de Correcao

### 1. Extrair telefone real do payload WaLeads (`extractFields`)

Atualizar a funcao para buscar o telefone real nos campos alternativos que o WhatsApp envia junto com o `@lid`:

```typescript
// Prioridade: senderPn > remoteJidAlt > participant > phone original
const senderPn = body.senderPn || nested.senderPn || 
  (body._data as any)?.key?.senderPn || 
  (body.key as any)?.senderPn || "";
const remoteJidAlt = body.remoteJidAlt || nested.remoteJidAlt ||
  (body._data as any)?.key?.remoteJidAlt || "";

// Se o phone principal e @lid, tentar alternativas
let resolvedPhone = phone;
if (rawPhone.includes("@lid")) {
  const altPhone = stripWaSuffix(String(senderPn || remoteJidAlt));
  if (altPhone && altPhone.replace(/\D/g, "").length >= 10) {
    resolvedPhone = altPhone;
    console.log(`[dra-lia-wa] Resolved @lid to real phone: ${resolvedPhone}`);
  }
}
```

### 2. Session ID estavel (`dra-lia-whatsapp`)

Trocar:
```
const sessionId = `wa_${phoneDigits}_${Date.now()}`;
```
Por:
```
const sessionId = `wa_${phoneDigits}`;
```

### 3. Mesma correcao no `smart-ops-wa-inbox-webhook`

Aplicar a mesma logica de resolucao de `@lid` para que o webhook de inbox tambem armazene o telefone real.

### 4. Log de fallback quando @lid nao tem alternativa

Quando nenhum campo alternativo tem o telefone real, logar warning e continuar com o LID (melhor do que rejeitar). A LIA vai pedir email e identificar por email.

## Arquivos Alterados

- `supabase/functions/dra-lia-whatsapp/index.ts` (extractFields + sessionId)
- `supabase/functions/smart-ops-wa-inbox-webhook/index.ts` (phone resolution)

## Impacto

| Antes | Depois |
|-------|--------|
| Todos aparecem como `@lid` | Telefone real quando disponivel |
| Novo lead a cada mensagem | Lead correto por match de telefone |
| Pede email infinitamente | Sessao persistente, fluxo normal |
| Historico perdido | Historico acumulado por sessao |

