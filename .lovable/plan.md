## Diagnóstico

O botão “Gerar com IA” está chamando corretamente a Edge Function `social-caption-generator`, mas a função falha no backend com:

```text
Créditos Lovable AI esgotados. Adicione créditos.
```

Hoje esse erro volta como HTTP 500 e a UI mostra uma falha genérica, então parece que o recurso “não funciona”. Também há um ponto técnico no backend: a função chama o Lovable AI Gateway com `Authorization: Bearer`, mas o padrão correto do Gateway é o header `Lovable-API-Key`.

## Plano de correção

1. **Corrigir a chamada ao Lovable AI Gateway**
   - Trocar o header incorreto `Authorization: Bearer ...` por `Lovable-API-Key: ...`.
   - Adicionar `X-Lovable-AIG-SDK` para telemetria correta.
   - Trocar o modelo atual `google/gemini-2.5-flash` por um modelo mais leve/custo-eficiente para copy curta, reduzindo chance de falhas por crédito.

2. **Retornar status HTTP correto da Edge Function**
   - Quando o Gateway retornar falta de créditos, responder `402` em vez de `500`.
   - Quando retornar rate limit, responder `429`.
   - Preservar mensagem clara em JSON para o frontend.

3. **Melhorar feedback no botão “Gerar com IA”**
   - Ajustar `useGenerateCaption` para capturar status e payload da Edge Function.
   - Mostrar erro específico quando faltar crédito: orientar “Adicionar créditos em Settings > Workspace > Usage”.
   - Manter mensagem genérica apenas para erros inesperados.

4. **Evitar retorno vazio quando a IA responder fora do formato**
   - Validar se `caption`, `hashtags` e `first_comment` vieram preenchidos.
   - Se o JSON vier inválido ou incompleto, retornar erro legível em vez de preencher campos vazios.

5. **Validar a função após a alteração**
   - Reimplantar/testar `social-caption-generator`.
   - Fazer uma chamada real de teste com instruções simples.
   - Confirmar que, se ainda não houver créditos, a UI/backend retornam `402` claro em vez de falha silenciosa/500.

## Arquivos previstos

- `supabase/functions/social-caption-generator/index.ts`
- `src/hooks/social/useGenerateCaption.ts`
- `src/components/social/editor/steps/StepContent.tsx`

## Observação importante

Se o workspace realmente estiver sem créditos, a correção não cria crédito automaticamente; ela transforma a falha em um erro claro e corrige a integração para funcionar assim que houver saldo disponível.