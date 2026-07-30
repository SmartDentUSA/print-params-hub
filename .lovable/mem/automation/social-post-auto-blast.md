---
name: Social Post Auto-Blast
description: Disparo automático de posts sociais para grupos WhatsApp, com filtro de rede social por grupo
type: feature
---
- `post_group_targets.platforms text[]` define quais redes o grupo recebe. Vazio = todas.
- Dedupe por `blast_seq`/`caption_fingerprint` continua: cada grupo recebe UMA única mensagem por publicação.
- Para cada grupo, a variante enviada é a primeira rede permitida (prioridade instagram > facebook > tiktok > youtube) que tenha URL e legenda.
- UI: `PostGruposAddModal` (seleção na adição) e `PostGruposInstanceCard` (popover por linha) em `/social/post-grupos`.
