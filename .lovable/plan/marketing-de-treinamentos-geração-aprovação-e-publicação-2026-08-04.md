# Marketing de Treinamentos — Geração, Aprovação e Publicação

## 1. Mapa do que já existe (reutilizar)

**Turmas / cursos / pessoas**
- `smartops_course_turmas` (com `drive_folder_id` e `drive_subfolders`), `smartops_courses`, `smartops_course_enrollments`, `smartops_enrollment_companions`.
- Hooks prontos: `useTurmaParticipants`, `useTurmaDriveMedia`, `useTurmaDriveInventory`.

**Google Drive**
- `supabase/functions/_shared/drive.ts` (gateway OAuth, upload resumable, listagem detalhada).
- `training-create-drive-folder` já cria as subpastas de entrega: `entregas`, `entregas_carrossel`, `entregas_stories`, `entregas_reels`, `entregas_thumb_yt`, `entregas_reddit`, `entregas_legendas`.
- `training-drive-media-upload` (JWT + RPC `can_manage_training_media`) para mídias originais → `training_drive_media`.

**RAG oficial**
- `knowledge_contents`, `agent_embeddings` + RPC `match_agent_embeddings` (usada por `dra-lia` e `social-caption-generator`).
- `social-knowledge-fetch` já entrega produto + copies aprovadas + enriquecimento.

**Social Publisher / publicação / métricas**
- `social_scheduled_posts` (+ `per_channel_media`), `SocialCalendar` com drag-and-drop, `social-publish-worker`, `zernio-metrics-sync`, `social_posts`.
- Fábrica antiga de treinamentos: `training_factory_runs` / `training_factory_assets` + `training-factory-*` (geração de imagem/carrossel/render/publish).

**Endpoint do agente**
- `smartops-marketing-agent-api` (somente leitura, API key + rate limit + `marketing_agent_api_log`).

## 2. Decisões de reuso vs. novo

| Necessidade | Decisão |
|---|---|
| Turma/curso/etapas/pessoas | reutilizar tabelas e hooks |
| Mídias originais no Drive | reutilizar (nada muda) |
| Entrega final no Drive | reutilizar `drive.ts` + IDs de `drive_subfolders` |
| RAG | reutilizar `match_agent_embeddings` + `knowledge_contents` (nenhuma segunda RAG) |
| Publicação | reutilizar `social-publish-worker` (nenhum publicador novo) |
| Métricas/horário sugerido | reutilizar `social_posts` |
| Registro de entregas | **novo**: `training_social_deliverables` + `_media` (a `training_factory_assets` não tem plataforma/status de aprovação/snapshots de RAG; fica intacta e legada) |
| Escrita do agente | **nova** function `smartops-marketing-agent-deliveries` (a API de leitura não muda) |

## 3. Migrações

1. `training_social_deliverables` e `training_social_deliverable_media` com os campos do escopo, GRANTs (`authenticated` select/update, `service_role` all), RLS via `can_manage_training_media(auth.uid())`, `USING` + `WITH CHECK` no update, e índice único `(turma_id, kit_run_id, platform, post_type, version)` para idempotência.
2. RPC `approve_training_deliverable(deliverable_id)` — security definer, cria/reaproveita `social_scheduled_posts`, grava `scheduled_post_id`, aprovador e auditoria (idempotente).
3. RPC `suggest_training_post_slot(platform, post_type)` — score `likes + 2*comments + 3*shares + 3*saves` normalizado, janela 90 dias, retorna amostra + confiança + fallback.
4. Auditoria em `system_health_logs` (já existente) com `event` prefixado `training_deliverable.*`.

## 4. Edge Functions

- **Nova** `smartops-marketing-agent-deliveries` (segredo próprio `SMARTOPS_MARKETING_DELIVERIES_API_KEY`): valida turma/elegibilidade, confirma que o `drive_file_id` está na pasta correta via Drive API, grava `pending_review`, atualiza apenas entregas não aprovadas, idempotente, log sem chave. Proibido aprovar/agendar/publicar/escrever em `social_scheduled_posts`.
- **Nova** `training-deliverable-approve` (JWT): executa a RPC de aprovação e devolve o post agendado.
- **Nova** `training-deliverable-media-replace` (JWT): recebe o arquivo, resolve o destino pelo `drive_subfolders` da turma, gera o nome oficial (`TURMA-157_CURSO_DIA-01_INSTAGRAM_CARROSSEL_01.png`), sobe pelo `drive.ts`, versiona a mídia anterior. O frontend nunca envia `drive_folder_id`.
- **Estender** `smartops-marketing-agent-api`: `/trainings/by-number/{n}/context` com descrição oficial do curso, etapas/equipamentos do agendamento, participantes (sem PII: sem telefone, e-mail, CPF, endereço) e `/rag/search` contextual com score mínimo, dedupe e prioridade documental.
- **Estender** `social-caption-generator` com um modo `training_kit`: copy por rede (Instagram, Facebook, LinkedIn, TikTok, YouTube/Shorts, Stories), sem benefício sem fonte, devolvendo `rag_context_snapshot` com trechos, score e claims.

## 5. Frontend

- Novo `src/components/social/approvals/TrainingApprovals.tsx` renderizado **abaixo do calendário** em `SocialCalendar`: contadores por status, filtros (turma, curso, data, plataforma, formato, status, responsável), cards/lista e agrupamento por turma/KIT.
- `TrainingDeliverableCard.tsx`: preview/player, metadados, horário sugerido com confiança e justificativa, botões Aprovar e agendar / Editar / Solicitar ajuste / Abrir no Drive / Ver fontes / Ver contexto.
- `TrainingDeliverableEditDialog.tsx`: abas Publicação, Mídias, Pessoas (Instagram normalizado `@perfil`, sem inventar arroba), Contexto, Fontes da RAG; regeneração por plataforma isolada.
- Hooks novos em `src/hooks/social/`: `useTrainingDeliverables`, `useApproveDeliverable`, `useUpdateDeliverable`, `useReplaceDeliverableMedia`, `useSuggestedSlot`.
- Calendário: posts aprovados aparecem no fluxo atual; drag-and-drop já grava `scheduled_at` e passa a refletir no card.

## 6. Riscos e rollback

- Risco de duplicidade de agendamento → índice único + idempotência na RPC.
- Risco de mexer no publicador → nenhuma alteração em `social-publish-worker`.
- Risco de alucinação → benefício sem fonte é descartado e o card marca "contexto insuficiente".
- Rollback: as tabelas novas são aditivas; basta desmontar a seção do Publisher e remover as functions novas — nada do fluxo atual depende delas.

## 7. Testes

Os 30 casos do escopo, cobertos em três blocos: (a) elegibilidade e contexto (turma inexistente/inelegível/futura, descrição do curso, etapas, equipamentos); (b) RAG e pessoas (benefício sem fonte, snapshot de fontes, Instagram, cidade/especialidade, acompanhante, associação de mídia); (c) entrega e publicação (pasta correta, nada em Storage, card no Publisher, copy por rede, regeneração isolada, 403 sem permissão, agente não aprova, aprovação idempotente, worker publica, métricas, drag-and-drop, versão de mídia, arquivo fora da pasta, advisors).

## 8. Faseamento sugerido

1. Migrações + RPCs.
2. `smartops-marketing-agent-deliveries` + extensão de contexto/RAG da API de leitura.
3. Seção de aprovação no Social Publisher (cards + edição + fontes).
4. Aprovação/agendamento, substituição de mídia e testes.
