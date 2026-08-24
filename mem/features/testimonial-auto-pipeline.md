---
name: Depoimentos de treinamento — pipeline automático
description: Upload na pasta Depoimentos cria registro, cron transcreve, identifica pela fala e publica artigo da Categoria E com ficha real
type: feature
---
- `training-drive-media-upload` (action `chunk`, ao concluir): se `destination_key = 'videos_depoimentos'`, faz upsert em `training_testimonials` (`onConflict: drive_file_id`, ignoreDuplicates) — falha nunca derruba o upload.
- Cron `training-testimonial-auto-process` a cada 2 min: claim atômico via RPC `fn_claim_testimonial_auto_jobs` (máx 5), transcreve → publica (`publish: true`), 3 tentativas, backoff 5/20/60 min. 402/403 de IA pausa a fila inteira (`auto_process=false`).
- Autenticação do cron: header `x-cron-key` = secret `TESTIMONIAL_CRON_KEY` (anon key nunca autoriza estas funções).
- Identificação pela fala em `training-testimonial-transcribe`: extrai nome falado e casa com inscritos/acompanhantes da turma via `matchParticipantByName` (aceita só match único). Sem match → `awaiting_identification` + `auto_process=false`.
- Artigo público expõe apenas: nome, cidade/UF, especialidade/área, curso e turma (bloco "Ficha do participante"), transcrição completa e JSON-LD Review/Person. Clínica, CNPJ, telefone, contrato e valores nunca vão ao público.
- Metadados dos chunks RAG carregam especialidade/cidade/UF/curso/turma para buscas demográficas.
- Cópia no Drive: `training-testimonial-drive-doc` grava, na pasta de Depoimentos da turma (`drive_folder_id` do vídeo → `drive_subfolders.videos_depoimentos` → raiz), um `.html` com o MESMO conteúdo publicado (título, resumo, meta, `content_html` final e FAQs). Nome `depoimento-{nome}-turma-{n}.html`, sobrescreve por nome (idempotente), grava `article_drive_file_id`/`article_drive_web_view_link`/`article_drive_synced_at`.
- Chamado pelo cron `training-testimonial-auto-process` logo após publicar (etapa 4, antes das redes). Backfill: `{"all":true,"limit":N}` com header `x-cron-key`.
