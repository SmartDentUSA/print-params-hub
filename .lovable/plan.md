## Objetivo
Melhorar a mensagem de compartilhamento WhatsApp do card de turma na página de Agenda (`/agenda` e `/agenda/online`) e corrigir o link gerado.

## Arquivo afetado
`src/pages/AgendaPublica.tsx` — função `ShareButton` (linhas 627-655).

## Problemas atuais
1. Mensagem muito curta (só título + data + link), sem instrutor, local, cronograma.
2. Caracteres especiais aparecem quebrados (`�`) por causa de emoji/encoding.
3. Link usa `window.location.origin`, que no preview Lovable gera URL errada — deve sempre apontar para o domínio público da agenda.

## Nova mensagem (padrão pedido)
```
Opção de treinamento, aqui estão os detalhes:

📚 *{{curso}}*

🏷 Turma: *{{turma_label}}*

👨‍🏫 Instrutor: {{instrutor}}

📍 {{local}}

{{cronograma}}

Inscreva-se: {{url}}
```

Onde:
- `{{curso}}` = `turma.course_title`
- `{{turma_label}}` = `turma.label` (ex: "Turma Junho 2026")
- `{{instrutor}}` = `turma.instructor_name` (omitido se vazio)
- `{{local}}` = `turma.location` se presencial; "Online ao vivo" se `online_ao_vivo`; "Online" caso contrário
- `{{cronograma}}` = montado a partir de `turma.days` (ou `start_date`/`start_time`/`end_time` quando `days` vazio), formato:
  - 1 dia: `📅 26/06/2026 (sexta) ⏰ 08:30–17:30`
  - múltiplos dias: lista numerada `📅 Dia 1 — 26/06/2026 | 08:30–17:30`
- `{{url}}` = `https://parametros.smartdent.com.br/agenda/online?turma=<id>` (presencial → `/agenda?turma=<id>`). Hardcoded igual `SmartOpsCourses.tsx` faz, para não depender de origin.

Linhas vazias entre blocos são removidas quando o campo correspondente não existe (evita "📍 \n\n").

## Detalhes técnicos
- Reaproveitar utilitários de `src/lib/courseUtils.ts` (`formatDatePtBr`, `formatWeekday`) — já usados no projeto.
- Reaproveitar `buildCronogramaText` de `src/lib/courseWhatsapp.ts` quando `turma.days` existir; fallback simples para `start_date`/`start_time` quando não.
- Garantir encoding correto: a string final é passada para `encodeURIComponent` antes de ir para `wa.me/?text=` (já é feito).
- Limpar linhas em branco consecutivas no fim com `.replace(/\n{3,}/g,'\n\n').trim()`.

## Fora de escopo
- Não alterar nenhum outro componente, lógica de inscrição, ou template de mensagem de pós-inscrição (`src/lib/courseWhatsapp.ts` continua intacto — só reaproveitamos a função `buildCronogramaText`).
