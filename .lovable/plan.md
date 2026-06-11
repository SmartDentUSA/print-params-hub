## Objetivo
1. Padronizar o card da página pública `/agenda/online` (modalidades `online` / `online_ao_vivo`).
2. Permitir **upload** de imagem de capa (não link), armazenando em Supabase Storage / CDN.
3. Adicionar **botão de compartilhar via WhatsApp** em cada card público.

---

## A) Card da agenda online — `src/pages/AgendaPublica.tsx`

### A.1 Badge "LIVE" no topo
- Apenas para `online_ao_vivo` → selo vermelho com `animate-pulse`: `● LIVE`.
- Para `online` (gravado/assíncrono) → selo azul `● ONLINE`.
- Posicionamento: sobreposto no canto superior esquerdo da imagem de capa (quando houver), `absolute top-2 left-2`. Sem capa → inline na primeira linha de badges.

### A.2 Linha de data compacta (substitui o bloco 2-colunas Início/Fim) para `isOnline`
Formato horizontal único:

```
📅 Início 15 de Jun   ·   ⏰ 09:00 — 11:00   ·   ⏱ Duração 2h
```

- Data: `15 de Jun` (sem ano) via `Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })`.
- Horários: `HH:MM`.
- Duração: calculada de `start_time`/`end_time` (mesmo dia). Se inteiro → `Xh`; fracionário → `Xh Ymin`; se multi-dia → mostra `total_days dias`.
- Componente novo `OnlineDateRow` substitui o `grid grid-cols-2` apenas quando `isOnline === true`. Presencial mantém o bloco atual.

### A.3 Botão compartilhar WhatsApp
- Ícone `Share2` ou `MessageCircle` (lucide) no canto superior direito do card.
- Ao clicar abre `https://wa.me/?text=<encoded>` com mensagem:
  ```
  {course_title} — Turma {turmaTag}
  📅 {data} · ⏰ {start_time}–{end_time}
  Inscreva-se: {public_share_url}
  ```
- `public_share_url` = `${window.location.origin}/agenda/online?turma={turma.id}` (mesma página, sem deep-link adicional por enquanto).

---

## B) Upload de imagem de capa — não link

### B.1 Storage
- Criar bucket Supabase `course-covers` (público) via migration.
- Policies: leitura pública, upload restrito a `authenticated`.

### B.2 Editor de curso — `src/components/smartops/CourseCreateModal.tsx`
- Substituir o input de texto `cover_image_url` por um componente `<CoverImageUpload>`:
  - Aceita arquivo (`image/png, image/jpeg, image/webp`), máx 5 MB.
  - Faz upload para `course-covers/{course_id || uuid}-{timestamp}.{ext}`.
  - Pega a `publicUrl` do Storage e grava em `smartops_courses.cover_image_url`.
  - Mostra preview + botão "Remover" (limpa o campo).
- Reaproveitar padrão de `ImageUpload` existente (se houver) ou criar novo simples baseado em `supabase.storage.from(...).upload(...)`.

### B.3 View pública
- `v_turmas_com_vagas` já expõe `cover_image_url` (feito anteriormente) → nenhuma mudança extra.
- Card mostra `<img src={coverUrl}>` em `aspect-[16/9]` (mantido).

---

## Arquivos afetados
- `src/pages/AgendaPublica.tsx` — badge LIVE, OnlineDateRow, botão share WhatsApp.
- `src/components/smartops/CourseCreateModal.tsx` — substituir input por upload.
- Novo: `src/components/smartops/CoverImageUpload.tsx`.
- Nova migration: cria bucket `course-covers` + policies.

## Fora de escopo
- Sem mudanças no presencial (mantém bloco Início/Fim 2 colunas).
- Sem mudanças no schema de `smartops_courses` (coluna `cover_image_url` já existe).
- Sem deep-link individual por turma (compartilha página geral com query `?turma=`).
