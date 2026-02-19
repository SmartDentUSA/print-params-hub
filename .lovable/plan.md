
# Dra. L.I.A. — Diálogo Guiado para Parâmetros de Impressão

## O problema com o comportamento atual

O intercept atual é "dumb": detecta palavras-chave de parâmetros e imediatamente busca uma impressora na mensagem. Isso é frágil:

- "preciso de configurações para minha impressora" → não cita impressora → vai pro RAG e retorna resultado genérico
- "tenho uma miicraft, quais parâmetros?" → cita marca mas não o modelo → match errado ou sem match

O usuário tem razão: a abordagem correta é **conversa guiada**, perguntando passo a passo. E o frontend já envia o histórico das últimas 8 mensagens para a edge function — então a L.I.A. já tem contexto das perguntas anteriores sem precisar de nenhuma mudança no frontend.

## Fluxo proposto — 3 perguntas sequenciais

```text
Usuário: "preciso de parâmetros para minha impressora"
    ↓
L.I.A.: "Claro! Para te ajudar, qual é a marca da sua impressora?
         (ex: Anycubic, Phrozen, Bambu Lab, Elegoo...)"
    ↓
Usuário: "Anycubic"
    ↓
[verifica se "Anycubic" existe no banco — existe]
L.I.A.: "Ótimo! Qual é o modelo da Anycubic?
         (ex: Photon Mono 4, M3 Max...)"
    ↓
Usuário: "Photon Mono 4"
    ↓
[verifica se o modelo existe — existe → monta URL]
L.I.A.: "Perfeito! Acesse a página da impressora onde os parâmetros
         estão organizados por resina:
         👉 [Ver parâmetros da Anycubic Photon Mono 4](/anycubic/photon-mono-4)
         
         Se você já sabe qual resina vai usar, me diga o nome dela
         e busco os valores específicos para você!"

--- Cenário: marca não encontrada no banco ---
L.I.A.: "Não encontrei essa marca em nosso banco de dados ainda.
         Acesse nossa página de parâmetros e selecione a marca e modelo:
         👉 [Ver todos os parâmetros](/)"
```

## Onde a lógica vive — somente `supabase/functions/dra-lia/index.ts`

### Passo 1 — Substituir o intercept atual por `detectPrinterDialogState(message, history)`

A função lê o `history` (que já chega do frontend) para detectar em qual etapa do diálogo o usuário está:

```typescript
type DialogState =
  | { state: "needs_brand" }        // usuário pediu parâmetros, sem citar impressora
  | { state: "needs_model"; brand: string; brandSlug: string }  // respondeu marca, falta modelo
  | { state: "has_printer"; brandSlug: string; modelSlug: string; brandName: string; modelName: string } // modelo encontrado → enviar link
  | { state: "not_in_dialog" }      // não está no fluxo de parâmetros

async function detectPrinterDialogState(
  supabase,
  message: string,
  history: Array<{ role: string; content: string }>
): Promise<DialogState>
```

A lógica de detecção:

1. **`needs_brand`** — a mensagem atual contém keywords de parâmetros (`PARAM_KEYWORDS`) mas não cita nenhuma marca/modelo do banco → perguntar marca

2. **`needs_model`** — a última mensagem da L.I.A. (no history) perguntou "qual a marca?" e a mensagem atual do usuário é uma resposta curta (≤ 5 palavras) → tentar encontrar a marca no banco; se encontrar → perguntar modelo; se não encontrar → fallback para página geral

3. **`has_printer`** — a última mensagem da L.I.A. perguntou "qual o modelo?" e a mensagem atual do usuário contém palavras que fazem match com algum modelo da marca → montar link e retornar

### Passo 2 — Mensagens localizadas para cada etapa

```typescript
// Pergunta 1: Qual a marca?
const ASK_BRAND = {
  "pt-BR": "Claro! Para te ajudar com os parâmetros, qual é a **marca** da sua impressora?\n(ex: Anycubic, Phrozen, Bambu Lab, Elegoo...)",
  "en-US": "Sure! To help with parameters, what is your printer **brand**?\n(e.g. Anycubic, Phrozen, Bambu Lab, Elegoo...)",
  "es-ES": "¡Claro! Para ayudarte con los parámetros, ¿cuál es la **marca** de tu impresora?\n(ej: Anycubic, Phrozen, Bambu Lab, Elegoo...)",
};

// Pergunta 2: Qual o modelo? (quando a marca foi encontrada)
const ASK_MODEL = {
  "pt-BR": (brand: string) => `Ótimo! A **${brand}** está cadastrada aqui. Qual é o **modelo** da impressora?`,
  "en-US": (brand: string) => `Great! **${brand}** is in our database. What is the printer **model**?`,
  "es-ES": (brand: string) => `¡Genial! La **${brand}** está registrada aquí. ¿Cuál es el **modelo** de la impresora?`,
};

// Marca não encontrada → encaminhar para página geral
const BRAND_NOT_FOUND = {
  "pt-BR": (brand: string) => `Ainda não temos parâmetros cadastrados para impressoras **${brand}**.\n\nAcesse nossa página de parâmetros e veja todas as marcas disponíveis:\n👉 [Ver todos os parâmetros](/)`,
  "en-US": (brand: string) => `We don't have parameters for **${brand}** printers yet.\n\nVisit our parameters page to see all available brands:\n👉 [View all parameters](/)`,
  "es-ES": (brand: string) => `Aún no tenemos parámetros para impresoras **${brand}**.\n\nVisita nuestra página de parámetros para ver todas las marcas disponibles:\n👉 [Ver todos los parámetros](/)`,
};

// Modelo não encontrado → enviar para página da marca (se existir)
const MODEL_NOT_FOUND = {
  "pt-BR": (brand: string, brandSlug: string) => `Não encontrei esse modelo para a **${brand}**.\n\nConfira todos os modelos disponíveis:\n👉 [Ver modelos da ${brand}](/${brandSlug})`,
  ...
};
```

### Passo 3 — Detecção de contexto no `history`

A função verifica o histórico recente para saber se o usuário está respondendo uma das perguntas da L.I.A.:

```typescript
// Verificar se a última mensagem da LIA continha "qual a marca"
const lastAssistantMsg = [...history].reverse().find(h => h.role === 'assistant');

const LIA_ASKED_BRAND = lastAssistantMsg?.content.includes("qual") &&
  (lastAssistantMsg.content.includes("marca") || lastAssistantMsg.content.includes("brand") || lastAssistantMsg.content.includes("marca"));

const LIA_ASKED_MODEL = lastAssistantMsg?.content.includes("qual") &&
  (lastAssistantMsg.content.includes("modelo") || lastAssistantMsg.content.includes("model"));
```

### Passo 4 — Busca de marca por nome

```typescript
async function findBrandInMessage(supabase, message: string) {
  const { data: brands } = await supabase
    .from("brands")
    .select("id, slug, name")
    .eq("active", true);
  
  const msg = message.toLowerCase();
  return brands?.find(b => msg.includes(b.name.toLowerCase())) || null;
}
```

### Passo 5 — Substituir o bloco `0b` atual pelo novo

```typescript
// 0b. Diálogo guiado de parâmetros de impressão
const dialogState = await detectPrinterDialogState(supabase, message, history);

if (dialogState.state === "needs_brand") {
  return streamText(ASK_BRAND[lang], session_id, message, supabase);
}
if (dialogState.state === "needs_model") {
  return streamText(ASK_MODEL[lang](dialogState.brand), session_id, message, supabase);
}
if (dialogState.state === "brand_not_found") {
  return streamText(BRAND_NOT_FOUND[lang](dialogState.brand), session_id, message, supabase);
}
if (dialogState.state === "model_not_found") {
  return streamText(MODEL_NOT_FOUND[lang](...), session_id, message, supabase);
}
if (dialogState.state === "has_printer") {
  const url = `/${dialogState.brandSlug}/${dialogState.modelSlug}`;
  return streamText(PRINTER_LINK_RESPONSES[lang](dialogState.brandName, dialogState.modelName, url), ...);
}
// else: segue fluxo normal (RAG)
```

## O que não muda

- Frontend (`DraLIA.tsx`) — zero alterações. O `history` já é enviado normalmente.
- Se o usuário menciona impressora **E** resina na mesma mensagem (ex: "parâmetros Anycubic Photon Mono 4 com Smart Print Bio") → vai direto pro RAG como antes — o diálogo guiado é só para mensagens sem informação suficiente.
- Todas as outras funcionalidades da L.I.A. (RAG, protocolos, greeetings) continuam intactas.

## Seção Técnica

- Único arquivo alterado: `supabase/functions/dra-lia/index.ts`
- A detecção de estado usa o `history` que o frontend já envia (últimas 8 mensagens) — sem mudanças no contrato da API
- A busca de marcas (`brands`) é uma query leve de ~10-20 registros
- A busca de modelos filtra pelo `brand_id` da marca encontrada — também leve
- O estado do diálogo é inferido a partir do conteúdo das mensagens no histórico — sem banco de sessão adicional
- Para detectar se a L.I.A. fez uma pergunta, usamos strings-chave multilíngues presentes nas próprias mensagens de resposta que definimos (ex: verificar se a última resposta contém `"qual"` + `"marca"`)
- Deploy automático ao salvar
- Nenhuma migração de banco necessária
