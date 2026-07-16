## Objetivo
Cada mensagem de uma campanha de grupos terá um número incremental próprio (`1, 2, 3...`). O sistema enviará cada número uma única vez por campanha e grupo, independentemente de o conteúdo ser igual ao de outra mensagem.

## Diagnóstico confirmado
- A campanha usa hoje `node_index`, que inclui também os nós de espera; por isso a tela mostra `#2, #4, #6...`.
- O `wa-dispatcher` ainda compara o conteúdo por hash durante 30 dias. Isso bloqueou os nós `#12`, `#14` e `#16` como `dedupe_global`, embora fossem etapas legítimas da sequência.
- A fila já possui processamento atômico, mas ainda não tem uma identidade incremental exclusiva para cada mensagem da sequência.

## Implementação

### 1. Identidade imutável por nó de mensagem
- Adicionar à `wa_message_queue`:
  - `node_id`: identificador estável do nó criado no editor.
  - `sequence_no`: número incremental da mensagem no grupo/campanha.
- Nós de espera não recebem número e não entram na fila.
- Mensagens passam a aparecer como `#1, #2, #3...`, mesmo que existam esperas entre elas.
- Para `promo_seq`, cada mensagem interna terá seu próprio número e identidade estável.

### 2. Garantia no banco de “uma única vez”
- Criar unicidade para `(campaign_id, group_jid, sequence_no)`.
- Criar unicidade para `(campaign_id, group_jid, node_id)` quando houver `node_id`.
- Preencher os registros existentes com sequência consistente, sem reenviar histórico.
- O banco impedirá fisicamente que o mesmo número seja criado duas vezes para o mesmo grupo/campanha, inclusive em ativações concorrentes.

### 3. Builder incremental
- Atualizar `wa-campaign-builder` para reutilizar `node_id` e números já existentes.
- Nós já enviados nunca serão reconstruídos ou reenviados.
- Um nó novo recebe sempre `MAX(sequence_no) + 1`; seu número não muda ao editar ou acrescentar esperas.
- Ativações repetidas da mesma campanha serão idempotentes.

### 4. Dispatcher baseado em sequência
- Para campanhas `campaign_type = 'flow'`, remover o bloqueio por hash de conteúdo.
- Antes do envio, validar a identidade `(campanha + grupo + sequence_no)` e o estado da fila, não o texto.
- Manter a proteção atômica contra duas execuções simultâneas e a verificação pós-timeout, pois elas evitam duplicação quando o provedor envia mas não responde.
- Preservar o dedupe por conteúdo somente para campanhas pontuais/automáticas do tipo `blast`, onde ele continua necessário contra publicações duplicadas.

### 5. Tela da sequência
- Exibir `#1, #2, #3...` usando `sequence_no`, em vez do índice bruto do fluxo.
- Corrigir a estrutura HTML do cabeçalho que hoje gera o aviso de `<div>` dentro de `<p>`.
- Manter os estados e horários atuais, mostrando claramente que o bloqueio é por identidade da sequência e não por conteúdo.

### 6. Tratamento da campanha atual
- Preservar os envios históricos e os registros `skipped`; nenhuma mensagem antiga será disparada automaticamente.
- Corrigir as 14 mensagens futuras pendentes para seguirem a nova sequência e não serem bloqueadas por `dedupe_global`.
- Os nós antigos já ignorados (`#12`, `#14`, `#16`) permanecerão no histórico para auditoria, sem reenvio tardio.

### 7. Validação
- Testar reativação repetida da mesma campanha sem duplicar linhas.
- Testar duas mensagens com conteúdo idêntico e números diferentes: ambas devem enviar nas respectivas datas.
- Testar o mesmo número processado duas vezes: apenas um envio deve ocorrer.
- Testar timeout do provedor: confirmar por mensagem recente antes de qualquer tentativa adicional.
- Implantar `wa-campaign-builder` e `wa-dispatcher` e validar a campanha atual sem executar envios manuais.