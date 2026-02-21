

# Manter identificacao do lead ao trocar de assunto

## Problema
Quando o usuario troca de assunto (clica no botao de voltar ou seleciona outro topico), a funcao `resetTopic` no frontend:
1. Reseta `leadCollected = false`
2. Limpa o `sessionStorage`
3. Gera um **novo session ID** (nova sessao)
4. Reseta as mensagens para o welcome inicial

Como o session ID e novo, o backend nao encontra os dados do lead (`lead_name`, `lead_email`, `lead_id`) na sessao anterior e pede o e-mail novamente.

## Solucao
Separar "trocar de assunto" de "resetar tudo". Ao trocar de assunto dentro da mesma conversa:
- Manter o mesmo `session_id`
- Manter `leadCollected = true` se o lead ja foi identificado
- Manter as mensagens anteriores (ou limpar mas sem perder a sessao)
- Apenas resetar o `topicContext` e os fluxos visuais (PrinterFlow, ProductsFlow)

## Detalhe Tecnico

### Arquivo: `src/components/DraLIA.tsx`

Modificar a funcao `resetTopic` (~linha 570):

**Antes:**
```
const resetTopic = useCallback(() => {
  setTopicSelected(false);
  setTopicContext('');
  setLeadCollected(false);
  setPrinterFlowStep(null);
  setProductsFlowStep(null);
  sessionStorage.removeItem('dra_lia_topic_context');
  sessionStorage.removeItem('dra_lia_lead_collected');
  sessionId.current = generateSessionId();
  setMessages([...welcome...]);
}, [t]);
```

**Depois:**
```
const resetTopic = useCallback(() => {
  setTopicSelected(false);
  setTopicContext('');
  setPrinterFlowStep(null);
  setProductsFlowStep(null);
  sessionStorage.removeItem('dra_lia_topic_context');
  // NAO resetar leadCollected nem session_id
  // Manter a sessao ativa para o backend reconhecer o lead
  // Adicionar mensagem da IA perguntando novo assunto
  setMessages(prev => [
    ...prev,
    { id: `topic-reset-${Date.now()}`, role: 'assistant', content: 'Posso te ajudar com mais alguma coisa? Escolha um assunto abaixo 👇' }
  ]);
}, []);
```

Isso mantem o `session_id` original, o `leadCollected = true`, e o backend vai detectar `from_session` com os dados do lead ja presentes — sem pedir e-mail novamente.

