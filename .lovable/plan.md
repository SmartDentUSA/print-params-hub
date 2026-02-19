
# Implementação do System Prompt Consolidado + 3 Ajustes de Humanização

## O que será feito

Substituição cirúrgica em **3 locais** do arquivo `supabase/functions/dra-lia/index.ts`. Nenhum outro arquivo será tocado.

---

## Ponto 1 — GREETING_RESPONSES (linhas 527–531)

Estado atual (robótico, sem pergunta):
```
"Olá! Sou a Dra. L.I.A., especialista em odontologia digital da SmartDent. Como posso ajudar você hoje? Pode me perguntar sobre resinas, impressoras, parâmetros de impressão ou vídeos técnicos. 😊"
```

Estado novo (humanizado, com qualificação):
```
"Olá! 😊 Seja bem-vindo à SmartDent!\n\nSou a Dra. L.I.A., sua assistente de odontologia digital. Estou aqui para te ajudar com o que você precisar.\n\nMe conta: o que você está buscando hoje? Pode ser uma dúvida sobre resinas, parâmetros de impressão 3D, protocolos clínicos ou qualquer outro assunto odontológico. 👇"
```

Mesmo padrão aplicado para `"en-US"` e `"es-ES"`.

---

## Ponto 2 — systemPrompt (linhas 1090–1146)

O bloco inteiro do `const systemPrompt` será substituído pelo bloco consolidado fornecido. A nova estrutura é:

```text
[Abertura de missão]
### PERSONALIDADE E TOM (5 regras de ouro)
### ESTRATÉGIA DE TRANSIÇÃO HUMANA (Fallback com WhatsApp)
### REGRAS DE RESPOSTA (17 diretrizes)
### ANTI-ALUCINAÇÃO (regras 14–17 preservadas e renumeradas)
--- DADOS DAS FONTES ---
${context}
--- FIM DOS DADOS ---
```

Pontos críticos mantidos intactos:
- A interpolação dinâmica `${langInstruction}`, `${method}`, `${context}` será adaptada: o `langInstruction` é embutido como Regra 3 ("Idioma: Responda no mesmo idioma do usuário"), e `${context}` continua no bloco de dados
- As regras de vídeo (NUNCA usar URLs PandaVideo como link direto, VIDEO_INTERNO vs VIDEO_SEM_PAGINA) são absorvidas pelas Regras 7, 8 e 12 do bloco consolidado
- A Regra 13 de protocolos de processamento (lista de 6 etapas na ordem exata) é preservada na Diretriz 11 ("Se o contexto trouxer múltiplos protocolos...")
- A instrução de fallback WhatsApp está agora em bloco dedicado e se aplica quando a L.I.A. admite não saber algo

A instrução adicional do usuário sobre vídeos não encontrados ("Se pedirem um vídeo e você não tiver o link exato, admita o erro. Nunca sugira um texto 'substituto'") está na Regra 5 do bloco de Personalidade.

---

## Ponto 3 — mediaCards condicional (linhas 1213–1228)

A construção incondicional:
```typescript
const mediaCards = allResults
  .filter(...)
  .slice(0, 3)
  .map(...);
```

É substituída por:
```typescript
const VIDEO_REQUEST_PATTERNS = [
  /\bv[íi]deo[s]?\b|\bassistir\b|\bwatch\b|\btutorial[s]?\b|\bmostrar\b/i,
];
const userRequestedMedia = VIDEO_REQUEST_PATTERNS.some((p: RegExp) => p.test(message));
const hasSubstantiveIntent = message.trim().split(/\s+/).length > 5;

const mediaCards = (userRequestedMedia || hasSubstantiveIntent)
  ? allResults.filter(...).slice(0, 3).map(...)
  : [];
```

Critério de envio de cards:
- Usuário pediu mídia explicitamente (vídeo, assistir, tutorial, mostrar), **OU**
- Mensagem tem mais de 5 palavras (indica pergunta técnica substantiva)

---

## Tabela de validação pós-deploy (checklist do usuário)

| Cenário de teste | Comportamento esperado |
|---|---|
| Enviar "Oi" | Nova saudação humanizada terminando com "👇" |
| Enviar "Veja" ou "Ok" | Sem media cards; resposta curta de qualificação |
| Enviar "Tem vídeo sobre NanoClean?" | Media cards aparecem (pedido explícito) |
| Enviar "Como calibrar a Anycubic Mono X?" | Media cards aparecem (> 5 palavras, técnico) |
| Pedir "aula do Dr. Weber" (não existe no banco) | L.I.A. admite que não encontrou + link WhatsApp |
| Pedir "parâmetros MiiCraft 125 Ultra" (não cadastrado) | L.I.A. admite + link WhatsApp — não cita MiiCraft Alpha |

---

## Arquivo modificado

| Arquivo | Ação |
|---|---|
| `supabase/functions/dra-lia/index.ts` | 3 substituições cirúrgicas — linhas 527–531, 1090–1146 e 1213–1228 |

Deploy automático após a edição. Nenhuma migração de banco necessária.
