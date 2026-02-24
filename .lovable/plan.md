

## Plano: Saudacao de Lead Retornante com Resumo do Historico

### O que muda

A mensagem de boas-vindas para leads retornantes passa a incluir a **data/hora do ultimo contato** e um **resumo curto do que foi conversado**, buscado do campo `resumo_historico_ia` da tabela `lia_attendances`.

### Fluxo atual vs. desejado

```text
ATUAL:
"Que bom te ver de novo, João! 😊 Agora sim, estou pronta para te ajudar.
 Como posso te ajudar hoje?"

DESEJADO:
"Olá, João! Que bom que voltou! 😊
 Nos falamos no dia 09/02 às 14:30.
 Falamos a última vez sobre impressoras 3D e resinas biocompativeis para protese.
 Em que posso te ajudar hoje?"
 → Cards de rotas aparecem imediatamente
```

### Implementacao

#### 1. Backend — `supabase/functions/dra-lia/index.ts`

**A. Nova action `summarize_session` (chamada pelo frontend apos 5 min de inatividade):**

- Busca todas as `agent_interactions` daquela `session_id`
- Monta texto da conversa cronologicamente
- Chama Lovable AI (`google/gemini-2.5-flash-lite`, nao-streaming) com prompt:
  - "Resuma em 1 frase curta (max 15 palavras) o assunto principal desta conversa. Apenas o tema, sem saudacoes."
  - Exemplo de saida: "impressoras 3D e resinas biocompativeis para protese"
- Upsert em `lia_attendances`:
  - `nome`, `email`, `source: 'dra-lia'`
  - `resumo_historico_ia`: resumo gerado
  - `rota_inicial_lia`: topic_context da sessao
- Retorna `{ success: true }`

**B. Modificar handler de lead retornante (linhas 1717-1768):**

Quando encontra lead existente por email:
1. Buscar `lia_attendances` pelo email para pegar `resumo_historico_ia`
2. Buscar a ultima `agent_interactions` com `lead_id` para pegar a data/hora
3. Formatar a data no idioma do usuario (ex: "09/02 as 14:30" em PT, "Feb 9 at 2:30 PM" em EN)
4. Montar mensagem personalizada com resumo

**C. Atualizar constante `RETURNING_LEAD` (linha 903):**

Nova assinatura: `(name, lastDate, summary, topicContext) => string`

```text
pt-BR:
  "Olá, {nome}! Que bom que voltou! 😊
   Nos falamos no dia {data} às {hora}.
   Falamos a última vez sobre {resumo}.
   Em que posso te ajudar hoje?"

en-US:
  "Hi, {name}! Great to have you back! 😊
   We last talked on {date} at {time}.
   Last time we discussed {summary}.
   How can I help you today?"

es-ES:
  "¡Hola, {nombre}! ¡Qué bueno que volviste! 😊
   Hablamos el {fecha} a las {hora}.
   La última vez hablamos sobre {resumen}.
   ¿En qué puedo ayudarte hoy?"
```

Se `resumo_historico_ia` for `NULL` (primeiro retorno antes de qualquer resumo ter sido gerado), omite a linha "Falamos a ultima vez sobre..." e mostra apenas data/hora.

Se nao encontrar nenhuma interacao anterior (edge case), usa a mensagem atual sem data.

**D. Injetar resumo anterior no system prompt:**

Quando lead retornante tem `resumo_historico_ia`, adicionar ao system prompt:
```text
CONTEXTO DE CONVERSA ANTERIOR:
O lead ja conversou anteriormente. Resumo: {resumo}
Use esse contexto para personalizar a conversa, mas nao repita informacoes ja coletadas.
```

#### 2. Frontend — `src/components/DraLIA.tsx`

**A. Timer de inatividade (5 minutos):**
- `useRef` com `setTimeout` de 300.000ms
- Resetar a cada mensagem enviada pelo usuario
- Quando dispara: `POST /dra-lia` com `{ action: "summarize_session", session_id }`
- Fire-and-forget (nao mostra nada ao usuario)
- Marcar `sessionStorage('dra_lia_summarized', 'true')` para nao disparar duas vezes

**B. Atualizar deteccao de lead retornante (linhas 397, 575):**
- Atualizar o regex para detectar a nova mensagem de boas-vindas ("Que bom que voltou" ja esta coberto)
- Garantir que `leadCollected = true` e os cards de rotas aparecem imediatamente

#### 3. Nenhuma migracao de banco necessaria

Todos os campos ja existem:
- `lia_attendances.resumo_historico_ia` — campo text existente
- `lia_attendances.rota_inicial_lia` — campo text existente  
- `agent_interactions.created_at` — para pegar data/hora do ultimo contato
- `leads.email` — para busca do lead retornante

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/dra-lia/index.ts` | Nova action `summarize_session` + atualizar `RETURNING_LEAD` com data/hora/resumo + buscar `lia_attendances` no handler de retornante + injetar resumo no system prompt |
| `src/components/DraLIA.tsx` | Timer de inatividade 5 min + fire-and-forget para `summarize_session` |

