
# Corrigir cards de produtos que nao aparecem ao voltar para a rota

## Problema
Quando o usuario ja foi identificado (lead coletado), sai da rota "Quero conhecer mais dos produtos" e volta, os cards de categoria nao aparecem. Isso acontece porque:

1. `resetTopic` preserva `leadCollected = true` (correcao anterior)
2. `handleTopicSelect` para `products` NAO ativa o fluxo visual — ele apenas envia ao backend e espera a confirmacao do lead
3. A deteccao de lead (linha 391) tem a condicao `!leadCollected`, entao quando o lead ja esta coletado, ela nunca dispara
4. Resultado: `productsFlowStep` nunca e setado para `'category'`, e os cards nao aparecem

## Solucao

### Arquivo: `src/components/DraLIA.tsx`

Na funcao `handleTopicSelect`, quando `opt.id === 'products'`, verificar se o lead ja foi coletado. Se sim, ativar o fluxo visual imediatamente (sem esperar o backend):

```typescript
if (opt.id === 'products') {
  setTopicSelected(true);
  setTopicContext(opt.id);
  sessionStorage.setItem('dra_lia_topic_context', opt.id);

  // Se o lead ja foi coletado, mostrar os cards direto
  if (leadCollected) {
    setProductsFlowStep('category');
    return;
  }

  // Senao, enviar ao backend para coleta de e-mail
  // (o fluxo visual sera ativado apos confirmacao do lead)
}
```

Isso faz com que, na segunda vez que o usuario entra na rota de produtos (com lead ja identificado), os cards de categoria aparecam imediatamente sem precisar passar pelo backend novamente.

## Resultado Esperado
- Usuario entra em "Produtos" pela primeira vez -> pede e-mail -> confirma lead -> mostra cards
- Usuario sai e volta para "Produtos" -> cards aparecem imediatamente (sem pedir e-mail)
