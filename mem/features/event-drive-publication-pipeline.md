---
name: Event Drive Publication Pipeline
description: Pipeline de publicação de eventos/congressos no Google Drive (pastas por dia/palestrante, naming automático, copy contextual) espelhando o pipeline de treinamentos
type: feature
---

Espelha o pipeline de treinamentos, para eventos (`smartops_events`).

- Raiz no Drive: `1ged_8WdpJ-CQXfhAYw0SkQDmtNx8cX7b` (override: `GOOGLE_DRIVE_EVENTS_PARENT_FOLDER_ID`).
- Pasta canônica do evento: `{nome} | {local/país} | {Mês} {ano}`; descritivo gravado em `descritivo_do_evento.json` + `.docx`.
- Árvore: `01 - Bastidores` (Pré-evento → vídeos, chamadas KOL com subpasta por palestrante), `02.. Dia X` (vídeo abertura, depoimentos no stand, demonstrações/KOLs com subpasta por palestrante, fotos clientes no stand, fotos do stand, vídeo fechamento) e `03 - Final` (agradecimento, foto da equipe). Nº de dias vem de `smartops_events.days_count` (ou range de datas), máx. 10.
- Edge functions: `event-create-drive-folder` (idempotente, `refresh_description`), `event-drive-media-upload` (`prepare|chunk|status|cancel|inventory`, 4 MiB chunks, máx. 5 GiB), `event-media-copy` (transcrição Gemini/STT quando vídeo ≤24 MB + copy contextual).
- Naming servidor-side: `EVT_<EVENTO>_<DIA-n|GERAL>_<TOKEN>[_<PALESTRANTE>]_<seq>.<ext>` — o browser nunca decide o nome.
- Copy sempre cita o estande da Smart Dent no evento; nunca preço nem promessa clínica.
- Upload liberado só para membros ativos da equipe (`can_manage_training_media`), em `/agenda` (`EventsUploadAccordion`) e no editor de eventos.
