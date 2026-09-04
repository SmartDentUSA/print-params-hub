---
name: Engajamento de KOL em evento na timeline
description: Autoagendamento de evento grava event_participation na timeline do palestrante com nº de palestras, horas de palestra e horas de apoio comercial
type: feature
---
- `event-speaker-booking` (ação `book`) chama `logSpeakerEngagement` e grava/atualiza um único evento `event_participation` em `lead_activity_log` por `lead_id` (professional_id) + `entity_id` (evento).
- `event_data`: `evento`, `local`, `estande`, `palestras_qtd`, `palestras_minutos/horas`, `palestras[]` (data/início/fim/tema), `apoio_comercial_qtd`, `apoio_comercial_minutos/horas`, `apoio_comercial[]`, `dedupe_key = event_participation:{eventId}:{professionalId}`.
- `event_timestamp` = data de início real do evento (nunca `now()`); `value_numeric`/`duration_seconds` = total (palestra + apoio).
- `release` apaga o evento da timeline do profissional.
- **Apoio comercial não é bloqueante**: vários KOLs podem marcar o mesmo horário e o horário da própria palestra também pode ser marcado. Só a agenda de demonstrações tem exclusividade por horário.
- O modal "Adicionar novo palestrante" da página `/agenda-kol/:eventId` usa exatamente os campos do cadastro de Profissionais em Cursos (nome, e-mail, nascimento, área de atuação e especialidade por taxonomia, CRO, plataforma de cursos, WhatsApp DDI+número, Instagram, mini CV, foto) e grava nas colunas canônicas de `lia_attendances`.
