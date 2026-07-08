## Plano de correção

1. **Unificar o botão “Gerar por IA” em uma rota confiável**
   - Remover a dependência frágil da geração paralela obrigatória.
   - Fazer o botão chamar o orquestrador como etapa principal e tratar metadados como etapa opcional, sem bloquear a geração do artigo.

2. **Corrigir retorno silencioso do Orquestrador**
   - No frontend, validar `success: false`, `fallback: true`, `error` e ausência de `html` com mensagens claras no toast.
   - Se a edge function retornar erro encapsulado com status 200, o usuário verá o motivo em vez de “nada acontece”.

3. **Blindar a edge function `ai-orchestrate-content`**
   - Ajustar o `catch` para não devolver 500 bruto em falhas previsíveis de IA/API.
   - Retornar JSON estruturado com `success: false`, `error`, `message` e `fallback: true` para falhas de provider, parse ou indisponibilidade.
   - Manter 400 apenas para validação de entrada quando faltar fonte de conteúdo.

4. **Reduzir travamentos por payload grande/timeout**
   - Adicionar timeout controlado no cliente para a chamada do orquestrador.
   - Mostrar mensagem específica quando o conteúdo/PDFs forem grandes demais ou demorarem.
   - Evitar que a chamada de metadados rode em paralelo quando não houver HTML novo; ela passa a rodar depois do HTML gerado e sem impedir o preview.

5. **Corrigir inconsistência de metadados**
   - Hoje a geração paralela envia `formData.content_html`, que pode estar vazio/antigo, em vez do HTML recém-gerado.
   - Após gerar o artigo, usar o HTML novo para atualizar meta description/keywords de forma não bloqueante.

6. **Validar o fluxo no preview**
   - Testar com fonte “Texto Colado” mínima no modo Orquestrador.
   - Confirmar que aparece loader, depois preview ou toast de erro claro.
   - Conferir console/network para garantir que a função não deixa o usuário sem feedback.

## Arquivos previstos

- `src/components/AdminKnowledge.tsx`
- `supabase/functions/ai-orchestrate-content/index.ts`

## Fora do escopo

- Não alterar schema/tabelas.
- Não mexer em geração de landing pages.
- Não trocar provider/modelo de IA sem necessidade.