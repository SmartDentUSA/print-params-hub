
# Dra. L.I.A. — Internacionalização Completa PT / ES / EN

## Contexto

O projeto já possui uma estrutura de i18n consolidada:
- `src/locales/pt.json`, `en.json`, `es.json` com todas as keys organizadas por seção
- Hook `useLanguage()` com função `t('key')` usada em 100% dos componentes
- `LanguageContext` com fallback automático para PT quando key não existe em outro idioma
- Sistema de prompt do Gemini que já usa os dados do banco em PT/ES/EN (campos `content_html_en`, `content_html_es`, etc.)

A Dra. L.I.A. ainda **não existe** no código. Tudo será criado com i18n nativo desde o início.

---

## O Que Precisa de Tradução (3 camadas)

### Camada 1 — UI do Widget (`DraLIA.tsx`)
Todos os textos visíveis ao usuário no chat:

| Elemento | PT | EN | ES |
|---|---|---|---|
| Botão flutuante | "Dra. L.I.A." | "Dr. L.I.A." | "Dra. L.I.A." |
| Subtítulo header | "Assistente SmartDent" | "SmartDent Assistant" | "Asistente SmartDent" |
| Boas-vindas | "Olá! Sou a Dra. L.I.A., especialista em odontologia digital. Como posso ajudar?" | "Hello! I'm Dr. L.I.A., a digital dentistry specialist. How can I help?" | "¡Hola! Soy la Dra. L.I.A., especialista en odontología digital. ¿Cómo puedo ayudar?" |
| Placeholder input | "Digite sua dúvida..." | "Type your question..." | "Escribe tu pregunta..." |
| Botão enviar (aria) | "Enviar" | "Send" | "Enviar" |
| Feedback positivo | "Isso me ajudou!" | "This helped me!" | "¡Esto me ayudó!" |
| Feedback negativo | "O que faltou?" | "What was missing?" | "¿Qué faltó?" |
| Botão feedback enviar | "Enviar feedback" | "Send feedback" | "Enviar comentario" |
| Digitando | "Digitando..." | "Typing..." | "Escribiendo..." |
| Erro de conexão | "Erro de conexão. Tente novamente." | "Connection error. Please try again." | "Error de conexión. Inténtalo de nuevo." |

### Camada 2 — Fallback Humano (respostas geradas pela edge function)
Quando `similarity < 0.70`, a `dra-lia` retorna texto estático no idioma do usuário:

**PT:**
```
Ainda não tenho essa informação em nossa base de conhecimento, mas nossos especialistas podem ajudar você:

💬 **WhatsApp:** [(16) 99383-1794](https://wa.me/5516993831794)
✉️ **E-mail:** comercial@smartdent.com.br
🕐 **Horário:** Segunda a Sexta, 08h às 18h

Nossa equipe está pronta para explicar melhor!
```

**EN:**
```
I don't have this information in our knowledge base yet, but our specialists can help you:

💬 **WhatsApp:** [(16) 99383-1794](https://wa.me/5516993831794)
✉️ **E-mail:** comercial@smartdent.com.br
🕐 **Hours:** Monday to Friday, 8am–6pm (BRT)

Our team is ready to help!
```

**ES:**
```
Todavía no tengo esa información en nuestra base de conocimiento, pero nuestros especialistas pueden ayudarte:

💬 **WhatsApp:** [(16) 99383-1794](https://wa.me/5516993831794)
✉️ **E-mail:** comercial@smartdent.com.br
🕐 **Horario:** Lunes a Viernes, 08h–18h (BRT)

¡Nuestro equipo está listo para ayudarte!
```

### Camada 3 — System Prompt do Gemini (dentro da edge function `dra-lia`)
O idioma da resposta do modelo é controlado pelo parâmetro `lang` enviado pelo widget. O system prompt instrui o Gemini a responder no idioma certo:

**Instrução adicionada ao system prompt:**
```
IDIOMA DA RESPOSTA:
- O usuário está utilizando o sistema em: {{LANG}} (pt-BR / en-US / es-ES)
- RESPONDA SEMPRE nesse idioma, independente do idioma dos dados de contexto
- Se os dados do contexto estiverem em português e o usuário perguntou em inglês,
  traduza a resposta para inglês mantendo os valores técnicos (ex: cure time: 2.5s)
- Termos técnicos numéricos (parâmetros, tempos, medidas) nunca traduzir, apenas o texto
```

---

## Arquivos a Criar/Modificar (10 arquivos)

| Arquivo | Ação | Descrição |
|---|---|---|
| Migração SQL | Criar | `pgvector` + `agent_embeddings` (vector 768) + HNSW + `match_agent_embeddings` + `agent_interactions` + `agent_knowledge_gaps` + RLS |
| `supabase/functions/index-embeddings/index.ts` | Criar | Vetoriza 509 chunks em PT (artigos, parâmetros, resinas, vídeos com transcrição) |
| `supabase/functions/dra-lia/index.ts` | Criar | RAG semântico + fallback humano trilíngue + streaming SSE |
| `supabase/config.toml` | Modificar | Registrar `dra-lia` e `index-embeddings` com `verify_jwt = false` |
| `src/locales/pt.json` | Modificar | Adicionar seção `"dra_lia": {...}` com todas as keys em PT |
| `src/locales/en.json` | Modificar | Adicionar seção `"dra_lia": {...}` com todas as keys em EN |
| `src/locales/es.json` | Modificar | Adicionar seção `"dra_lia": {...}` com todas as keys em ES |
| `src/components/DraLIA.tsx` | Criar | Widget flutuante usando `t('dra_lia.xxx')` para 100% dos textos + envia `lang` para a edge function |
| `src/pages/AgentEmbed.tsx` | Criar | Página limpa para iframe em `/embed/dra-lia` |
| `src/App.tsx` | Modificar | Adicionar rota `/embed/dra-lia` |

---

## Keys de Tradução a Adicionar (seção `dra_lia`)

As 3 keys críticas que mudam de acordo com o idioma do usuário e são enviadas como contexto para o Gemini:

```json
"dra_lia": {
  "button_label": "Dra. L.I.A.",
  "header_subtitle": "Assistente SmartDent",
  "welcome_message": "Olá! Sou a Dra. L.I.A., especialista em odontologia digital. Como posso ajudar?",
  "input_placeholder": "Digite sua dúvida...",
  "typing": "Digitando...",
  "feedback_helpful": "Isso me ajudou!",
  "feedback_missing": "O que faltou?",
  "feedback_send": "Enviar feedback",
  "feedback_thanks": "Obrigado pelo feedback!",
  "connection_error": "Erro de conexão. Tente novamente.",
  "fallback_intro": "Ainda não tenho essa informação em nossa base de conhecimento, mas nossos especialistas podem ajudar você:",
  "fallback_hours": "Segunda a Sexta, 08h às 18h",
  "fallback_closing": "Nossa equipe está pronta para explicar melhor!",
  "send_aria": "Enviar mensagem"
}
```

*(Idem em `en.json` e `es.json` com traduções correspondentes)*

---

## Como o Widget Envia o Idioma para a Edge Function

O `DraLIA.tsx` lê o idioma do `useLanguage()` e envia no corpo de cada requisição:

```typescript
const { language } = useLanguage();

// Mapeamento para locale completo
const localeMap = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

// Enviado em cada POST para /dra-lia?action=chat
const body = {
  message: userInput,
  history: conversationHistory.slice(-8),
  lang: localeMap[language],        // ← 'pt-BR' | 'en-US' | 'es-ES'
  session_id: sessionId,
};
```

A edge function `dra-lia` usa o `lang` para:
1. Selecionar o texto do fallback humano (no idioma certo)
2. Injetar a instrução de idioma no system prompt antes de chamar o Gemini

---

## Comportamento por Idioma

### Usuário em PT pergunta sobre NanoClean:
- Busca semântica em `agent_embeddings` (vetores estão em PT)
- Gemini instrução: `RESPONDA em pt-BR`
- Resposta em português com links

### Usuário em EN pergunta sobre NanoClean:
- Mesma busca semântica (embeddings são language-agnostic por cosine similarity)
- Gemini instrução: `RESPOND in en-US`
- Resposta: "Yes! I found 2 videos about NanoClean: **NanoClean - Step by Step Application** ▶ [Watch video](link)"

### Usuário em ES pergunta sobre NanoClean:
- Mesma busca semântica
- Gemini instrução: `RESPONDE en es-ES`
- Resposta: "¡Sí! Encontré 2 videos sobre NanoClean: **NanoClean - Aplicación paso a paso** ▶ [Ver video](link)"

### Fallback < 0.70 em EN:
- O widget renderiza o texto da key `t('dra_lia.fallback_intro')` em inglês
- O link do WhatsApp abre `https://wa.me/5516993831794` (universal)

---

## Seção Técnica

**Por que os embeddings ficam apenas em PT?**
O modelo `text-embedding-004` do Google gera representações semânticas cross-linguísticas. Uma pergunta em inglês sobre "NanoClean application video" vai encontrar o chunk em português "NanoClean Passo a passo aplicação" com similaridade > 0.80, porque o modelo entende equivalência semântica entre idiomas. Isso é chamado de *multilingual semantic search* — não é necessário vetorizar o conteúdo nos 3 idiomas.

**Se no futuro os artigos tiverem `content_html_en` e `content_html_es`:**
A função `index-embeddings` pode ser estendida para gerar chunks adicionais em EN/ES e salvar em `agent_embeddings` com campo `lang: 'en'` na metadata — melhorando ainda mais a precisão para usuários não-portugueses.

**Secrets necessários:** zero novos. `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` já configurados.
