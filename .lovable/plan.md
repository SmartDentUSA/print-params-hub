
# Implementação dos 2 Ajustes Finais — Guard de Ruído + Card de Gaps

## Estado verificado nos arquivos

Ambos os ajustes ainda não estão no código:

- `evaluate-interaction/index.ts` linha 28: em branco — falta o guard `length < 10`
- `AdminDraLIAStats.tsx` linha 701→702: fecha o card do Webhook e vai direto ao `</TabsContent>` — falta o card laranja de Gaps

## Ajuste 1 — `supabase/functions/evaluate-interaction/index.ts`

Inserir 7 linhas entre as linhas 27 e 29 (entre o último guardrail de idempotência e a verificação de variáveis de ambiente):

```typescript
// Guard: mensagens muito curtas (< 10 chars) não têm conteúdo técnico para auditar
// Exemplos de ruído: "ok", "vlw", "oi", "sim" — nunca contêm perguntas técnicas
if ((record.user_message?.length ?? 0) < 10) {
  return new Response(
    JSON.stringify({ message: "Skip: user_message too short for meaningful evaluation" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
```

**Posição correta:** Após o último guardrail de idempotência (linha 27), antes da verificação de `LOVABLE_API_KEY` (linha 29). Isso mantém a hierarquia de guards: estado do registro → qualidade do conteúdo → recursos externos.

## Ajuste 2 — `src/components/AdminDraLIAStats.tsx`

Inserir o card de Knowledge Gaps entre as linhas 701 e 702 (após o fechamento do card do Webhook, antes do `</TabsContent>`):

```tsx
{/* Visão dual: Judge (qualidade de resposta) + Gaps (cobertura de conhecimento) */}
<Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900/30 dark:bg-orange-900/10">
  <CardContent className="pt-4 pb-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <div>
          <p className="text-sm font-medium">Lacunas de Conhecimento Pendentes</p>
          <p className="text-xs text-muted-foreground">
            Perguntas que a L.I.A. não soube responder — complemento ao Score do Juiz
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold text-orange-600">{stats.pendingGapsCount}</p>
        <p className="text-xs text-muted-foreground">ver em Visão Geral</p>
      </div>
    </div>
  </CardContent>
</Card>
```

`stats.pendingGapsCount` já está calculado no estado existente. `AlertTriangle` já está importado no componente. Zero dependências novas.

## Arquivos e localização exata

| Arquivo | Mudança | Localização |
|---|---|---|
| `supabase/functions/evaluate-interaction/index.ts` | +7 linhas: guard `length < 10` | Entre linhas 27 e 29 |
| `src/components/AdminDraLIAStats.tsx` | +16 linhas: card laranja de Gaps | Entre linhas 701 e 702 |

## Após o deploy

- `evaluate-interaction` será re-deployada automaticamente
- Validação: enviar "ok" no chat → logs devem mostrar `"Skip: user_message too short"` sem chamada ao Gemini
- Validação: Admin → aba Qualidade → card laranja deve exibir o mesmo número da aba Visão Geral
