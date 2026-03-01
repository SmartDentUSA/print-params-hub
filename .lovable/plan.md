

## Problema

A mensagem do vendedor → lead no handoff (linha 1635 do `dra-lia/index.ts`) é um **template fixo** que se repete idêntico toda vez:

> "Olá Danilo! Aqui é o(a) Celular da BLZ Dental. 😊 Vi que você tem uma dúvida sobre '...' Vou buscar essa informação..."

Isso gera mensagens robóticas e repetitivas quando o lead recebe múltiplos handoffs.

## Solução

Substituir o template fixo por uma **chamada ao Gemini Flash** que gera uma mensagem personalizada e única a cada handoff, usando o contexto disponível.

### Dados disponíveis para personalização
- `leadName` — nome do lead
- `teamMember.nome_completo` — nome do vendedor
- `question` — a dúvida específica do lead
- `attendance.produto_interesse` — produto de interesse
- `attendance.impressora_modelo`, `attendance.area_atuacao`, `attendance.especialidade` — perfil do lead

### Implementação (no `dra-lia/index.ts`, bloco do step 7 ~linhas 1631-1667)

1. **Adicionar prompt para Gemini Flash** que gera a mensagem do vendedor→lead:
   - Tom: pessoal, direto, profissional (não robótico)
   - Estrutura base: saudação com nome do lead → apresentação do vendedor por nome → menção do produto/tema de interesse → convite para continuar conversa
   - Proibido: emojis excessivos, frases genéricas tipo "estou à disposição", copiar a pergunta literalmente
   - Máximo: 3-4 linhas
   - O prompt recebe: nome do lead, nome do vendedor, pergunta original, produto de interesse, área de atuação

2. **Fallback**: se a chamada ao Gemini falhar (timeout/erro), usar um template simples mas melhorado:
   ```
   Olá, {Nome do Lead}! Aqui é o {Nome do Vendedor}, da BLZ Dental.
   Acabei de receber sua solicitação sobre {produto_interesse || tema da pergunta}.
   Podemos continuar por aqui?
   ```

3. **Sem cache**: cada mensagem é gerada sob demida para nunca repetir

### Mudança técnica
- Apenas **1 arquivo**: `supabase/functions/dra-lia/index.ts`
- Substituir a construção hardcoded de `leadMsgToLead` (linha 1635) por uma função `generateSellerGreeting()` que chama Gemini Flash com timeout de 4s
- Usar a mesma `GEMINI_API_KEY` já disponível na função

