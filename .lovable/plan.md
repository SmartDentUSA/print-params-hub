## Problema
`https://parametros.smartdent.com.br/agenda` não atualiza em tempo real quando turmas/cursos são alterados no admin. A subscription Realtime existe, mas não é confiável (WebSocket pode cair, iframe pode bloquear, navegador throttla aba inativa).

## Solução: defesa em camadas

### 1. `src/pages/AgendaPublica.tsx` — adicionar polling como fallback
Adicionar nas duas `useQuery`:
- `refetchInterval: 30_000` (atualiza a cada 30 s mesmo sem evento Realtime)
- `refetchIntervalInBackground: true` (continua quando aba inativa, útil para iframe embed)
- `refetchOnWindowFocus: true` (já existe em uma; replicar na outra)
- `staleTime: 0`

### 2. Tornar a subscription Realtime mais robusta
- Logar status do canal (`.subscribe((status) => ...)`) para diagnóstico em produção
- Reinscrever automaticamente em `CHANNEL_ERROR` / `TIMED_OUT` com backoff simples
- Adicionar listener `document.visibilitychange` → ao voltar a aba visível, invalidar queries imediatamente

### 3. Indicador discreto de "última atualização"
Pequeno texto no rodapé da página: "Atualizado há Xs" (usa `dataUpdatedAt` do React Query), dando ao usuário/anunciante visibilidade de frescor.

## Escopo
- Apenas `src/pages/AgendaPublica.tsx`
- Nenhuma mudança no banco, RLS ou edge functions
- Realtime existente é mantido como caminho rápido; polling é safety net

## Validação
- Abrir `/agenda`, alterar uma turma no admin → mudança aparece em até 30 s mesmo se Realtime falhar
- Console deve mostrar `[agenda-realtime] SUBSCRIBED` quando WS conecta
- Voltar para aba inativa → refetch imediato em foco