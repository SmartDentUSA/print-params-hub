---
name: Rastreamento de conteúdo do cliente logado
description: Cliente autenticado no portal tem lead_id resolvido do user_metadata e todo conteúdo visto na Base de Conhecimento vai para lead_page_views e timeline
type: feature
---
- `resolveAuthenticatedLeadId()` (`src/hooks/usePageTracking.ts`) lê `user_metadata.lead_id` da sessão Supabase (gravado por `client-access-login`), persiste em `localStorage.sd_known_lead_id` e chama `fn_link_page_views_to_lead` para vincular as visitas anônimas da sessão.
- `trackContentEvent()` grava interações de conteúdo em `lead_page_views` com `page_type = kb_<tipo>` e `extra_data.action` (`open`, `audio_play`, `document_open`).
- Pontos instrumentados: abertura de artigo/vídeo/ebook (`KnowledgeBase.openArticle` + deep-link), `KnowledgeAudioPlayer` (primeiro play), `KbResinDocsDialog` (abrir documento).
- `fn_lead_timeline_unified` usa `extra_data.content_title` como título e expõe `action`/`content_type`/`content_slug`; `kb_%` conta como "Base de Conhecimento".
