# Relatório (somente leitura) e ações propostas

## 1. Banco
- **Confirmado:** o banco voltou. Ele foi reiniciado às **15:09:07 UTC** (12:09 em Brasília). Às 15:16 UTC havia 27 de 90 conexões em uso, nenhuma sessão "idle in transaction" e nenhuma consulta ativa ou longa.
- **Hipótese:** a queda das 15:02 terminou com um reinício do Postgres feito pela plataforma. A verificação não mostrou se a causa foi falta de conexões, CPU, memória ou um incidente da Supabase, porque as consultas atuais só enxergam o estado depois do reinício.
- **Confirmado:** o cron `wa-dispatcher-every-minute` não voltou ao normal. As últimas execuções aparecem como `connecting`/`failed`, sem horário de início. O worker do pg_cron ainda não conseguiu abrir conexão depois do reinício.
- **Confirmado:** há 8 mensagens presas em `wa_message_queue` com status `sending`. A mais antiga é de **13/11 18:10 UTC**, então são anteriores à queda: vêm de execuções que estouraram o tempo.
- A campanha "[Black 26]" continua em `draft`, no nó 1.

## 2. Correção da v904 do wa-dispatcher
- **Confirmado:** o trecho `mode === 'absolute'` **não está no repositório**. `supabase/functions/wa-dispatcher/index.ts:376-379` ainda remarca para "hoje + days às time". O próximo deploy automático desfaria a v904.
- Os outros dispatchers (`wa-group-dispatcher`, `smart-ops-queue-processor`) não tratam nós de espera. Só o `wa-campaign-builder` conhece o modo `absolute`.

## Riscos que continuam
- Nós com o mesmo `scheduled_at` não têm ordem de envio garantida, porque não há desempate por `node_index`.
- Mensagens em `sending` nunca voltam para a fila depois de um timeout (as 8 atuais são um exemplo).
- A nova tentativa de 30 min pelo EvoGo não checa duplicidade antes de reenviar.

## Ações propostas (dependem da sua aprovação)
1. Levar o trecho da v904 para o repositório, sem mexer em mais nada, e fazer o deploy do mesmo código.
2. Ordenar os envios por `scheduled_at` e depois por índice do nó.
3. Devolver à fila (`pending`) as mensagens em `sending` com mais de 15 min, registrando o motivo. Antes da nova tentativa, checar duplicidade pelo grupo, pela campanha e pelo nó.
4. Cron: confirmar nas próximas execuções se ele volta sozinho. Se continuar falhando, recriar o job, o que é uma ação corretiva.
5. As 8 mensagens presas: decidir com você se viram `failed` ou voltam para `pending`.
