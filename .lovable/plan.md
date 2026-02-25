

## Plano: Redesign Completo da Dra. L.I.A. — Visual, Onboarding, Captura Implicita, MQL/SAL/SQL com Tom Empatico

O tom refinado fornecido substitui o tom anterior. Sem delay de 2 segundos. Todas as 6 frentes confirmadas.

---

### Arquivos a Modificar/Criar

```text
COPIAR:
  user-uploads://Untitled_design-2.gif → src/assets/dra-lia-avatar.gif

MODIFICAR:
  src/components/DraLIA.tsx               (GIF no header + botao flutuante)
  src/locales/pt.json                     (header_subtitle, welcome_message)
  src/locales/en.json                     (header_subtitle, welcome_message)
  src/locales/es.json                     (header_subtitle, welcome_message)
  supabase/functions/dra-lia/index.ts     (mensagens + captura implicita + classificacao + regua)
```

---

### Frente 1: Visual — GIF + Identidade

**DraLIA.tsx**
- Linha 1: adicionar `import draLiaGif from '@/assets/dra-lia-avatar.gif';`
- Linha 694: substituir `<div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm">🦷</div>` por `<img src={draLiaGif} alt="Dra. L.I.A." className="w-8 h-8 rounded-full object-cover" />`
- Linha 1202: substituir `<span className="text-base">🦷</span>` por `<img src={draLiaGif} alt="Dra. L.I.A." className="w-6 h-6 rounded-full object-cover" />`

**pt.json** (linhas 222-224)
- `header_subtitle`: `"I.A. generativa alimentada por 16 anos de expertise em odontologia digital"`
- `welcome_message`: `"Para que eu possa te reconhecer, informe seu **e-mail**."`

**en.json**
- `header_subtitle`: `"Generative AI powered by 16 years of digital dentistry expertise"`
- `welcome_message`: `"So I can recognize you, please provide your **email**."`

**es.json**
- `header_subtitle`: `"I.A. generativa alimentada por 16 años de experiencia en odontología digital"`
- `welcome_message`: `"Para que pueda reconocerte, infórmame tu **correo electrónico**."`

---

### Frente 2: Novas Mensagens de Onboarding

**Edge function `dra-lia/index.ts`**

| Constante | Linha | Novo valor (pt-BR) |
|---|---|---|
| `GREETING_RESPONSES["pt-BR"]` | 797 | `"Para que eu possa te reconhecer, informe seu **e-mail**."` |
| `GREETING_RESPONSES["en-US"]` | 798 | `"So I can recognize you, please provide your **email**."` |
| `GREETING_RESPONSES["es-ES"]` | 799 | `"Para que pueda reconocerte, infórmame tu **correo electrónico**."` |
| `contextAck["pt-BR"]` | 1935 | `"Para que eu possa te reconhecer, informe seu **e-mail**."` |
| `contextAck["en"]` | 1936 | `"So I can recognize you, please provide your **email**."` |
| `contextAck["es"]` | 1937 | `"Para que pueda reconocerte, infórmame tu **correo electrónico**."` |
| `ASK_NAME["pt-BR"]` | 943 | `"Ainda não sei o seu nome! Como devo te chamar?"` |
| `ASK_NAME["en-US"]` | 944 | `"I don't know your name yet! What should I call you?"` |
| `ASK_NAME["es-ES"]` | 945 | `"¡Aún no sé tu nombre! ¿Cómo debo llamarte?"` |
| `ASK_AREA["pt-BR"]` | 931 | `"Prazer em te conhecer, {name}! Agora, para que eu execute uma análise do seu perfil e conecte com nossa base de conhecimento com a sua realidade profissional, preciso saber: qual é sua **área de atuação**?"` |
| `ASK_AREA["en-US"]` | 932 | `"Nice to meet you, {name}! Now, so I can analyze your profile and connect our knowledge base with your professional reality, I need to know: what is your **field of work**?"` |
| `ASK_AREA["es-ES"]` | 933 | `"¡Encantada de conocerte, {name}! Ahora, para que pueda analizar tu perfil y conectar nuestra base de conocimiento con tu realidad profesional, necesito saber: ¿cuál es tu **área de actuación**?"` |
| `ASK_SPECIALTY["pt-BR"]` | 937 | `"Qual é a sua **especialidade**?"` |
| `ASK_SPECIALTY["en-US"]` | 938 | `"What is your **specialty**?"` |
| `ASK_SPECIALTY["es-ES"]` | 939 | `"¿Cuál es tu **especialidad**?"` |

**LEAD_CONFIRMED** (linha 1003-1007) — adicionar parametro `email`:
- Assinatura muda para `(name: string, email: string, topicContext?: string)`
- pt-BR: `"Acesso validado, seu token é o **{email}**, use-o sempre que me chamar para que possamos dar continuidade nas nossas conversas e eu aprender um pouco mais sobre você.\n\nComo posso te ajudar hoje, **{name}**?"`
- en-US: `"Access validated, your token is **{email}**, use it whenever you reach out so we can continue our conversations and I can learn more about you.\n\nHow can I help you today, **{name}**?"`
- es-ES: `"Acceso validado, tu token es **{email}**, úsalo siempre que me contactes para que podamos continuar nuestras conversaciones y yo pueda aprender más sobre ti.\n\nCómo puedo ayudarte hoy, **{name}**?"`
- Chamada na linha 2278 atualizada para incluir `leadState.email`

**buildReturningLeadMessage** (linha 972-995):
- pt-BR: `"Olá, {name}! Que bom te ver por aqui novamente. 😊"` + `"\nNos falamos no dia {date} às {time}."` + `"\nSobre {summary}."` + `"\nSobre o que vamos conversar hoje?"`
- en-US: `"Hi, {name}! Great to see you again. 😊"` + date/time + `"\nAbout {summary}."` + `"\nWhat shall we talk about today?"`
- es-ES: `"¡Hola, {name}! Qué bueno verte de nuevo. 😊"` + date/time + `"\nSobre {summary}."` + `"\n¿Sobre qué vamos a conversar hoy?"`

---

### Frente 3: Captura Implicita de Dados

Nova funcao `extractImplicitLeadData()` (~80 linhas) inserida apos `upsertLead` (apos linha 1084).

Logica:
- Concatena ultimas 10 mensagens do historico
- Regex patterns para: UF (nomes completos + siglas), equipamentos (impressora/scanner), modelos especificos (Phrozen, Medit, etc.), marcas concorrentes, estrutura do consultorio, o que imprime/quer imprimir
- Update via Supabase client: busca registro atual, aplica `COALESCE` (nunca sobrescreve), merge `raw_payload` via spread
- Chamada fire-and-forget apos cada interacao salva (~linha 3100, dentro do bloco `[DONE]`):
  ```
  if (currentLeadId && leadState.state === "from_session") {
    const convoText = history.map(h => h.content).join(" ") + " " + message + " " + fullResponse;
    extractImplicitLeadData(supabase, leadState.email, convoText).catch(console.warn);
  }
  ```

---

### Frente 4: Classificacao MQL/SAL/SQL

Nova funcao `classifyLeadMaturity()` (~30 linhas) inserida apos `extractImplicitLeadData`.

Logica:
- Query `lia_attendances` por email (campos: `ultima_etapa_comercial`, `status_atual_lead_crm`, `funil_entrada_crm`, `status_oportunidade`)
- Se `status_oportunidade = "ganha"` → CLIENTE
- Se funil contem "estagnado": etapas "contato feito/sem contato" → MQL; "em contato/apresentacao agendada" → SAL; "proposta enviada/negociacao/fechamento" → SQL
- Fallback por etapa isolada
- Retorna `"MQL" | "SAL" | "SQL" | "CLIENTE" | null`

---

### Frente 5: Regua de Conhecimento — Tom Empatico (REFINADO)

**buildCommercialInstruction** (linhas 37-96) — alteracoes:

1. Adicionar parametro `leadMaturity?: "MQL" | "SAL" | "SQL" | "CLIENTE" | null`

2. Adicionar Modulo 5 com o tom empatico fornecido pelo usuario:

```text
MQL — CONSCIENTIZAÇÃO: Apoiando a Jornada Inicial
  Tom educativo e protetor. "Quero que você tenha sucesso real".
  Foco em evitar desperdício. "A tecnologia só brilha com fluxo de trabalho sólido."
  "Cada profissional tem seu tempo, estarei aqui quando decidir."
  PROIBIDO: ROI, depoimentos ou links de venda.

SAL — CONSIDERAÇÃO: Parceria e Transparência
  Tom transparente e baseado em fatos. "Nosso sucesso depende do seu."
  "Se você não tiver retorno, nós também não temos."
  Speakers são dentistas que vivem o consultório.
  ENVIE: Casos de sucesso, Instagram @smartdentbr, calculadora ROI.

SQL — DECISÃO: Viabilizando o Projeto
  Tom resolutivo e entusiasmado. "Vamos transformar sua odontologia agora."
  "Fico feliz que você chegou até aqui com clareza."
  ENVIE: Condições facilitadas, agendamento, calculadora ROI final.

CLIENTE — RELACIONAMENTO: Crescimento Contínuo
  Tom de parceiro. "Como podemos ir além?"
  Sugira novos materiais, cursos avançados, integrações.
```

3. Injetar `${maturityInstruction}` antes de `${antiHallucination}` no return

4. Chamar `classifyLeadMaturity` antes de `buildCommercialInstruction` (~linha 2756):
   ```
   let leadMaturity = null;
   if (topic_context === "commercial" && leadState.state === "from_session") {
     leadMaturity = await classifyLeadMaturity(supabase, leadState.email);
   }
   ```

---

### Frente 6: Resumo Inteligente Aprimorado

**summarize_session** (linhas 1773-1883):

1. Prompt de resumo (linha 1834) atualizado para:
   `"Resuma em 2 frases curtas: 1) O assunto principal desta conversa (máx 15 palavras). 2) Nível de interesse do lead: pesquisando (1), comparando (2), ou pronto para comprar (3). Formato: 'RESUMO | NÍVEL: X'"`

2. Apos o upsert do resumo (linha 1862), chamar `extractImplicitLeadData` com todo o historico:
   ```
   if (leadEmail) {
     const fullConvoText = interactions.map(i => `${i.user_message} ${i.agent_response || ""}`).join(" ");
     extractImplicitLeadData(supabase, leadEmail, fullConvoText).catch(console.warn);
   }
   ```

---

### Detalhes Tecnicos

- GIF importado via ES6 module (Vite bundling)
- `extractImplicitLeadData` roda fire-and-forget (nao bloqueia stream)
- `classifyLeadMaturity` faz 1 query ao `lia_attendances` (rapido)
- Campos protegidos: COALESCE garante que dados existentes nao sao sobrescritos
- `raw_payload` merged via spread (`{...existing, ...new}`)
- Nenhuma migration de banco — todos os campos ja existem
- Regua de Conhecimento injetada APENAS na rota comercial
- Sem delay de 2 segundos (conforme solicitado)

### Ordem de Execucao

1. Copiar GIF → `src/assets/dra-lia-avatar.gif`
2. Atualizar `DraLIA.tsx` (visual)
3. Atualizar `pt.json`, `en.json`, `es.json` (textos)
4. Atualizar todas as mensagens fixas na edge function
5. Implementar `extractImplicitLeadData()`
6. Implementar `classifyLeadMaturity()`
7. Injetar Regua de Conhecimento empatica no `buildCommercialInstruction`
8. Aprimorar `summarize_session`
9. Deploy da edge function

