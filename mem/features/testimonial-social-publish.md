---
name: Depoimentos — publicação automática em Story do Instagram e TikTok
description: Após publicar o artigo do depoimento, o cron publica o mesmo vídeo no Story do IG e no TikTok com copy IA, ficha real e CTA Link na Bio
type: feature
---
- Função `training-testimonial-social-publish` (verify_jwt=false, header `x-cron-key` = `TESTIMONIAL_CRON_KEY`). Aceita `{testimonial_id, force?, dry_run?}`.
- Chamada como etapa 4 de `training-testimonial-auto-process`, só quando o artigo ficou `published`/`rag_available` e `social_story_post_id` está vazio (idempotente).
- Copy gerada pela IA a partir da transcrição + ficha pública (nome, cidade/UF, especialidade), curso/turma e produtos relacionados. CTA obrigatório: "Quer saber mais sobre este treinamento? Link na Bio".
- Copy segue template humano fixo: gancho com 1 emoji → "Depois de N dias intensos de treinamento no {curso}, {Nome}, {especialidade} de {Cidade} (UF), encerrou a experiência na Smart Dent…" → 💬 frase LITERAL da transcrição → parágrafo de conhecimento + suporte pós-venda → linha de temas práticos → "▶️ Dê o play…" → CTA "Quer conhecer as próximas turmas do {curso}? Saiba mais no link na Bio ou comente \"{KEYWORD}\"". Proibido tom institucional/IA. Hashtags em CamelCase (8–10).
- `Equipamentos citados` é o parque do participante — nunca atribuir ao treinamento na copy. Só produtos do curso ou citados na transcrição.
- @ do Instagram: lido de `smartops_course_enrollments.instagram` / `smartops_enrollment_companions.instagram`. Só é marcado se o nome do dono do cadastro casar com o participante do depoimento (inscrição costuma ser do titular) — nunca usa o @ do lead como fallback.
- Publica via `social_scheduled_posts` (status `scheduled`, `publish_now=true`, channels `instagram/stories` + `tiktok/video`), consumido pelo `social-publish-worker`. Mídia = URL assinada temporária do `training-media-proxy` (TTL 1h), `type: 'video'` explícito.
- **Zernio ignora `postType` no corpo**: o formato real vai em `platforms[].platformSpecificData.contentType` (`'story'`). Sem isso, vídeo único no Instagram sai como **Reels**. O `social-publish-worker` monta esse campo em `buildPlatformSpecificData` — não remover.
- Parceiros fixos marcados em TODO depoimento: `@rayshape3d` e `@blz_dental` — via `platformSpecificData.userTags` no Story e linha "Parceria: @rayshape3d @blz_dental" nas captions (IG/TikTok). `collaborators` do Zernio não funciona em Stories.
- Controle em `training_testimonials`: `social_story_status/_post_id/_error/_published_at/_attempts/_snapshot`.
- Ficha do acompanhante lê `smartops_enrollment_companions` (a tabela `smartops_course_companions` não existe).
