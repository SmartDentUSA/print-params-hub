
# Dra. L.I.A. — Lista de Intenções + System Prompt Anti-Hallucination

## A pergunta central: lista de frases vs. aprendizado com uso?

A resposta mais honesta é: **as duas coisas se complementam**, mas para o problema que você está vendo agora, a solução mais rápida e eficaz é a lista de intenções — e ela já existe no código como `PARAM_KEYWORDS`, `GREETING_PATTERNS` e `PROTOCOL_KEYWORDS`.

O aprendizado com uso (fine-tuning, RLHF) seria um investimento de longo prazo com custos altos e exige milhares de interações etiquetadas. Para o problema atual, não é necessário.

---

## O que causa o problema hoje (análise técnica)

O fluxo da Dra. L.I.A. tem **3 camadas de decisão**:

```text
1. INTENT GUARD      → Saudação?  → Resposta fixa (sem RAG)
2. GUIDED DIALOG     → Impressora? → Pergunta guiada (sem RAG)
3. RAG (fallback)    → Qualquer outra coisa → LLM com dados do banco
```

O problema é que o **RAG (camada 3)** ainda tem muita liberdade para:
- Citar produtos do banco como "exemplos" mesmo que o usuário não pediu
- Incluir vídeos como conteúdo "relevante" quando não são
- Usar o conhecimento interno do modelo de IA para "completar" respostas

A solução está em **reforçar as regras do system prompt** que controlam o RAG — porque o código do system prompt atual (linha 935-982) ainda deixa brechas.

---

## Solução em 2 partes

### Parte 1 — Expandir a lista de intenções (INTENT GUARD) para cobrir casos que não devem ir ao RAG

Adicionar uma nova camada: **`SUPPORT_KEYWORDS`** — detecta perguntas de suporte técnico ("minha impressora não liga", "tá dando erro", "não consigo imprimir") e as desvia para o WhatsApp/contato, sem passar pelo RAG.

```typescript
// NOVO: Detectar perguntas de suporte técnico (problemas, erros)
const SUPPORT_KEYWORDS = [
  /(impressora|printer).*(não liga|not turning|no enciende)/i,
  /(erro|error).*(impressora|printer|resina)/i,
  /(falha|failure|falla).*(impressão|print)/i,
  /(não (está|esta|consigo)|can't|cannot|no puedo).*(imprimir|print)/i,
  /(peça|garantia|defeito|problema técnico)/i,
];
```

Quando detectado → resposta direta para o WhatsApp, sem RAG.

### Parte 2 — Reforçar o System Prompt do RAG com regras explícitas de restrição

O system prompt atual (linhas 935-982) já tem regras, mas faltam 3 regras críticas:

**Regra A — Proibir exemplos não solicitados (o problema principal)**
```
⛔ PROIBIDO: Citar qualquer produto, parâmetro ou vídeo como "exemplo" quando o usuário
   não especificou aquele produto/impressora. Se o usuário disse apenas "resina" sem nome,
   NÃO cite "Smart Print Gengiva" como exemplo.
```

**Regra B — Proibir vídeos quando não perguntados explicitamente**
```
⛔ PROIBIDO: Incluir vídeos na resposta a menos que o usuário tenha pedido um vídeo
   explicitamente (palavras-chave: "vídeo", "video", "assistir", "ver", "watch").
   Vídeos só aparecem quando SOLICITADOS.
```

**Regra C — Lista negra de palavras a evitar (que sinalizam alucinação)**
```
⛔ NUNCA use: "geralmente", "normalmente", "costuma ser", "em geral", "na maioria",
   "provavelmente", "pode ser que", "acredito que", "presumo que".
   Se não sabe, envie para o WhatsApp.
```

---

## Fluxo completo com as 2 partes implementadas

```text
Usuário: "minha impressora não liga"
    ↓
SUPPORT_KEYWORDS → TRUE
    ↓
L.I.A.: "Para problemas técnicos com equipamentos, nosso suporte pode ajudar melhor:
         💬 [WhatsApp](https://wa.me/...)"
[RAG NUNCA É CHAMADO]

Usuário: "comprei uma resina e preciso parametrizar"
    ↓
PARAM_KEYWORDS → TRUE (já corrigido)
    ↓
L.I.A.: "Qual é a marca da sua impressora?
         Marcas disponíveis: Anycubic, Creality..."
[RAG NUNCA É CHAMADO]

Usuário: "o que é resina biocompatível?"
    ↓
Nenhum intent guard ativa → vai para RAG
System Prompt com regras novas:
- Não cita exemplos não pedidos
- Não inclui vídeos automaticamente
- Não usa "geralmente" ou "normalmente"
    ↓
L.I.A.: "Resina biocompatível é um material aprovado para contato com tecidos orais...
         [resposta baseada APENAS no contexto do banco]"
```

---

## O que muda no código

**Arquivo único: `supabase/functions/dra-lia/index.ts`**

### Mudança 1 — Adicionar `SUPPORT_KEYWORDS` e `isSupportQuestion()` (linha ~27, após `GREETING_PATTERNS`)

```typescript
const SUPPORT_KEYWORDS = [
  /(impressora|printer|impresora).{0,30}(não liga|not turning|no enciende|erro|error|defeito|travando|falhou)/i,
  /(não consigo|can't|cannot|no puedo).{0,20}(imprimir|print|salvar|conectar)/i,
  /(erro|error|falha|falhou|travando|bug|problema).{0,20}(impressora|printer|software|resina)/i,
  /(garantia|suporte técnico|assistência|reparo|defeito de fábrica)/i,
  /(peça|peças|replacement|reposição)/i,
];

const SUPPORT_FALLBACK: Record<string, string> = {
  "pt-BR": `Para problemas técnicos com equipamentos, nossa equipe de suporte pode ajudar você diretamente 😊\n\n💬 **WhatsApp:** [Falar com suporte](https://api.whatsapp.com/send/?phone=551634194735&text=Ol%C3%A1+preciso+de+suporte+técnico)\n✉️ **E-mail:** comercial@smartdent.com.br\n🕐 **Horário:** Segunda a Sexta, 08h às 18h`,
  "en-US": `For technical issues with equipment, our support team can help you directly 😊\n\n💬 **WhatsApp:** [Contact support](https://api.whatsapp.com/send/?phone=551634194735&text=Hi+I+need+technical+support)\n✉️ **E-mail:** comercial@smartdent.com.br`,
  "es-ES": `Para problemas técnicos con equipos, nuestro equipo de soporte puede ayudarte directamente 😊\n\n💬 **WhatsApp:** [Contactar soporte](https://api.whatsapp.com/send/?phone=551634194735&text=Hola+necesito+soporte+técnico)\n✉️ **E-mail:** comercial@smartdent.com.br`,
};

const isSupportQuestion = (msg: string) => SUPPORT_KEYWORDS.some((p) => p.test(msg));
```

### Mudança 2 — Adicionar intent guard de suporte no fluxo principal (linha ~736, após o greeting guard)

```typescript
// 0c. Support question guard — redireciona para WhatsApp sem RAG
if (isSupportQuestion(message)) {
  const supportText = SUPPORT_FALLBACK[lang] || SUPPORT_FALLBACK["pt-BR"];
  // ... stream igual ao greeting guard
}
```

### Mudança 3 — Reforçar o system prompt do RAG (linha ~935-982)

Adicionar 3 blocos de regras após as regras existentes:

```typescript
const systemPrompt = `...regras atuais...

⛔ REGRAS ADICIONAIS ANTI-DESVIO:
14. NUNCA cite produtos, parâmetros ou vídeos como "exemplos" quando o usuário não mencionou
    aquele produto/marca/impressora específica. Se o contexto trouxer dados de "Anycubic Mono-X"
    mas o usuário perguntou sobre "resinas biocompatíveis", IGNORE os dados de parâmetros da Anycubic.
    Use apenas os dados diretamente relevantes à pergunta.

15. VÍDEOS: só inclua vídeos na resposta se o usuário pediu explicitamente por vídeo
    (palavras: "vídeo", "video", "assistir", "ver", "watch", "tutorial").
    Em outros casos, mencione no máximo "Também temos um vídeo sobre esse tema, quer ver?"

16. LISTA NEGRA — estas palavras indicam que você está inventando. NUNCA use:
    "geralmente", "normalmente", "costuma ser", "em geral", "na maioria dos casos",
    "provavelmente", "pode ser que", "acredito que", "presumo que", "tipicamente".
    Se não tiver certeza, redirecione para o WhatsApp.

17. SE O USUÁRIO MENCIONA UMA IMPRESSORA OU RESINA MAS NÃO PEDIU PARÂMETROS:
    Confirme apenas a existência ("Sim, temos parâmetros para a Anycubic Mono X")
    sem listar valores técnicos. Pergunte: "Quer que eu mostre os parâmetros?"
`;
```

---

## Resumo do benefício

| Situação | Antes | Depois |
|---|---|---|
| "minha impressora não liga" | Vai para RAG, pode citar produtos aleatórios | Intent guard → WhatsApp direto |
| Qualquer pergunta geral | RAG pode incluir vídeos e exemplos não pedidos | System prompt proíbe explicitamente |
| LLM usa "geralmente" ou "costuma ser" | Sem controle | Lista negra proíbe essas palavras |
| Usuário menciona impressora sem pedir parâmetros | RAG lista valores técnicos como exemplos | Proibido — só confirma existência |

## Sobre aprender com o uso

Não é necessário para esse problema. O que você precisa é de **regras explícitas** — e elas já estão sendo implementadas acima. O aprendizado com uso seria útil apenas se quisesse a IA evoluir automaticamente ao longo do tempo, o que exigiria:
- Coletar os feedbacks negativos (👎) já registrados na tabela `agent_interactions`
- Enviar esses exemplos periodicamente para fine-tuning
- Custo e complexidade significativos

Por agora, as regras explícitas são mais rápidas, baratas e controláveis.

## Seção Técnica

- Arquivo único: `supabase/functions/dra-lia/index.ts`
- Adições: `SUPPORT_KEYWORDS`, `SUPPORT_FALLBACK`, `isSupportQuestion()`, intent guard para suporte, e 4 novas regras no system prompt do RAG
- Sem migrações de banco
- Deploy automático
