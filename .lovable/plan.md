

# Tornar a mensagem de retorno dinâmica via IA

## Problema
A função `buildReturningLeadMessage` (linha 1058) é um template fixo que sempre gera a mesma estrutura: "Olá, {nome}! ... Nos falamos no dia {data}... Sobre {resumo}... Sobre o que vamos conversar hoje?". Mesmo com dados diferentes, o formato é idêntico.

## Solução
Em vez de usar o template fixo, enviar os dados do lead para o LLM (Gemini Flash Lite) e deixar a IA gerar uma saudação personalizada e contextual.

Os dados já estão disponíveis no bloco de returning lead (linhas 3279-3406):
- `resumo_historico_ia` — resumo da última sessão
- `historico_resumos` — array com até 20 sessões anteriores
- `recentHistoryCompact` — últimas 5 interações
- `profileFields` — perfil completo (área, equipamentos, interesses)
- `leadArchetype` — arquétipo do lead
- `lastDate` — data do último contato

## Alteração em `supabase/functions/dra-lia/index.ts`

### 1. Nova função `generateDynamicGreeting`
Substitui `buildReturningLeadMessage`. Faz uma chamada rápida ao Gemini Flash Lite com um prompt curto:

```
Você é a Dra. L.I.A. Gere uma saudação personalizada (máx 3 frases) para um lead retornando.
Dados: Nome: {nome}, Última conversa: {data}, Resumo: {resumo}, Perfil: {profile}, Sessões anteriores: {N}
Regras: Seja calorosa, mencione algo específico da última conversa, e pergunte como pode ajudar hoje.
Não repita a mesma estrutura sempre. Varie o tom e o conteúdo.
```

- **Modelo**: `google/gemini-2.5-flash-lite` (barato, rápido)
- **max_tokens**: 150
- **Fallback**: Se a chamada falhar, usa o template fixo atual como fallback

### 2. Alterar linha 3404
Substituir a chamada a `buildReturningLeadMessage` por `generateDynamicGreeting`, passando todos os dados já disponíveis no escopo.

### 3. Buscar `historico_resumos` no SELECT (linha 3281)
Adicionar `historico_resumos` ao SELECT do `lia_attendances` para enriquecer o contexto da saudação.

### Custo estimado
~50 tokens de prompt + ~80 tokens de resposta por saudação de retorno. Custo negligível com Flash Lite.

