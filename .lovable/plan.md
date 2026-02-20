
# Menu de Roteamento Inicial para a Dra. L.I.A.

## A ideia é boa — e vai resolver o problema na raiz

Os bugs recorrentes de interceptação (parâmetros de impressora sendo ativados por perguntas gerais) existem porque o RAG não sabe antecipadamente **qual o contexto da conversa**. Com um menu inicial, o usuário declara sua intenção antes de digitar qualquer coisa, e o backend pode usar isso como filtro prioritário.

## Como vai funcionar

### Fluxo completo

```text
1. Usuário abre o chat
2. L.I.A. exibe mensagem de boas-vindas + 4 botões de opção
3. Usuário clica em um botão (ex: "Parâmetros de Impressão")
4. O clique é tratado como mensagem enviada automaticamente
5. O backend recebe a mensagem + um campo "topic_context" na sessão
6. O RAG prioriza/filtra fontes baseado no contexto declarado
7. Conversa flui normalmente com contexto pré-definido
```

### As 4 opções do menu

```
🖨️  Parâmetros de Impressão
     "Configurações de resinas e impressoras 3D"

💼  Informações Comerciais
     "Preços, pedidos, contato e parceiros"

🔬  Produtos e Resinas
     "Catálogo, características e indicações"

🛠️  Suporte Técnico
     "Problemas com equipamentos ou materiais"
```

## Arquivos a modificar

### 1. `src/components/DraLIA.tsx` — Menu de boas-vindas com botões

**Novo estado `topicSelected`** (boolean) — controla se o menu já foi exibido/selecionado.

**Novo estado `topicContext`** — string que é passada junto com cada mensagem para o backend.

**Mensagem de boas-vindas especial** — em vez do texto atual, a primeira mensagem exibe um componente especial com os 4 botões:

```tsx
// Mensagem welcome com botões de opção (só aparece antes da primeira escolha)
{msg.id === 'welcome' && !topicSelected && (
  <div className="mt-3 grid grid-cols-2 gap-2">
    {TOPIC_OPTIONS.map((opt) => (
      <button
        key={opt.id}
        onClick={() => handleTopicSelect(opt)}
        className="flex flex-col items-start p-2 rounded-xl border border-gray-200 
                   bg-white hover:border-[#1e3a5f] hover:bg-blue-50 
                   transition-all text-left text-xs"
      >
        <span className="text-base mb-1">{opt.emoji}</span>
        <span className="font-semibold text-gray-800 leading-tight">{opt.label}</span>
        <span className="text-gray-400 leading-tight mt-0.5">{opt.description}</span>
      </button>
    ))}
  </div>
)}
```

**`handleTopicSelect(opt)`** — ao clicar:
1. Define `topicSelected = true` e `topicContext = opt.id`
2. Armazena o contexto no `sessionStorage` para persistência
3. Envia automaticamente uma mensagem curta como usuário: `opt.userMessage` (ex: "Quero saber sobre parâmetros de impressão")
4. O texto da mensagem é enviado via `sendMessage` normalmente — o usuário vê a escolha refletida no chat

**Persistência no `sessionStorage`** — junto com o `session_id`, salvar o `topic_context` para não perder se o chat fechar/abrir.

**Campo `topic_context` no body da requisição** — cada chamada ao backend inclui:
```json
{ "message": "...", "topic_context": "parameters" }
```

### 2. `supabase/functions/dra-lia/index.ts` — Usar topic_context no roteamento

**Extrair `topic_context` do body:**
```typescript
const { message, history = [], lang = "pt-BR", session_id, topic_context } = await req.json();
```

**Usar o contexto para ajustar o comportamento em 3 pontos:**

**Ponto A — Contexto de parâmetros já declarado:** Se `topic_context === "parameters"`, ativar diretamente o fluxo de diálogo de parâmetros sem precisar detectar `isPrinterParamQuestion`:
```typescript
// Se usuário já declarou que quer parâmetros, iniciar diálogo diretamente
if (topic_context === "parameters" && dialogState.state === "not_in_dialog") {
  const brands = await fetchAllBrands(supabase);
  await persistState("needs_brand", {});
  // Retorna needs_brand sem precisar detectar palavras-chave
}
```

**Ponto B — Contexto comercial:** Se `topic_context === "commercial"`, adicionar instrução ao system prompt para priorizar dados de contato, loja e parcerias, e suprimir sugestões de parâmetros técnicos.

**Ponto C — Contexto de suporte técnico:** Se `topic_context === "support"`, redirecionar diretamente para WhatsApp de suporte sem passar pelo RAG (já existe o `SUPPORT_FALLBACK` — só acionar diretamente).

**Ponto D — Instrução no system prompt:** Para todos os contextos, adicionar ao system prompt:
```
CONTEXTO DECLARADO PELO USUÁRIO: [label da opção selecionada]
Priorize respostas relacionadas a este tema. Se a pergunta sair deste contexto, responda normalmente mas mantenha o foco no tema declarado.
```

### Detalhes de UX importantes

- **Botões desaparecem** após a seleção — a mensagem welcome se transforma em texto normal
- **O usuário pode digitar livremente** sem selecionar — se não selecionar nenhuma opção e digitar, o menu desaparece e funciona como hoje (backward compatible)
- **Botão "Voltar ao menu"** — um link discreto no rodapé do chat permite resetar o contexto e ver o menu novamente
- **Mensagem confirmação** — após selecionar, L.I.A. responde com contexto: "Perfeito! Vou te ajudar com **parâmetros de impressão**. Qual impressora você está usando?"

## Resumo técnico das mudanças

| Arquivo | Mudança |
|---|---|
| `src/components/DraLIA.tsx` | + estados `topicSelected`, `topicContext` + constante `TOPIC_OPTIONS` + componente de botões na mensagem welcome + `handleTopicSelect()` + campo `topic_context` no body da requisição + botão "Novo assunto" no rodapé |
| `supabase/functions/dra-lia/index.ts` | + extração de `topic_context` do body + roteamento direto para parâmetros quando `topic_context === "parameters"` + instrução de contexto no system prompt + atalho de suporte quando `topic_context === "support"` |

Nenhuma migração SQL.

## Resultado esperado

| Cenário | Comportamento |
|---|---|
| Usuário clica "Parâmetros de Impressão" | L.I.A. pergunta diretamente "Qual impressora você usa?" sem ambiguidade |
| Usuário clica "Informações Comerciais" | RAG foca em contato, loja, parcerias — sem acionar fluxo de parâmetros |
| Usuário clica "Suporte Técnico" | Vai direto para mensagem de WhatsApp de suporte |
| Usuário digita sem clicar | Funciona exatamente como hoje (zero regressão) |
| Usuário pergunta "CEO" sem selecionar | Funciona como hoje com intent-break guard |
