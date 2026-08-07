---
name: Evolution ACK vem em MessageUpdate
description: Status real de entrega do Evolution está em MessageUpdate[].status, não em record.status — ler só record.status gera falso "PENDING"/sessão quebrada
type: feature
---
O POST `/message/sendText` do Evolution devolve SEMPRE `status: "PENDING"`.
O ACK real (SERVER_ACK / DELIVERY_ACK / READ / PLAYED) aparece de forma
assíncrona no registro de `/chat/findMessages`, dentro do array
**`MessageUpdate[]`** — o campo `record.status` não existe nessa versão.

Regras:
- Extrair status com o helper `extractRecordStatus` (`_shared/evolution.ts`) ou o
  `baileysStatus` de `smart-ops-wa-send`: coleta `status`, `message.status` e
  todos os `MessageUpdate[].status`, escolhendo o de maior rank
  (ERROR < PENDING < SERVER_ACK < DELIVERY_ACK < READ < PLAYED).
- Consultar em janelas curtas (1.5s → 2s → 3s) antes de declarar não confirmada;
  o ACK chega depois da resposta do POST.
- Nunca concluir "sessão quebrada"/"instância precisa reconectar" só porque
  `record.status` veio vazio — era a causa do falso negativo em `Suporte_tecnico`
  (instância `open`, mensagens entregues).
