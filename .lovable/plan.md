## Problema

Ao agendar inscrição em treinamento, o salvamento falha com:
```
date/time field value out of range: "24/08/2022"
```

### Causa raiz

O campo `ativacao` dos equipamentos (em `equipment_data`) é uma `date` no Postgres (`lia_attendances.equip_*_ativacao`). O modal aceita `<input type="date">` (sempre `YYYY-MM-DD`), mas em alguns leads o valor já existente vem em formato brasileiro `DD/MM/YYYY` (extraído de propostas antigas ou digitado manualmente em outro lugar). Quando o `writebackEquipment` em `src/hooks/useEnrollment.ts` envia esse valor cru para a coluna `date`, o PostgREST devolve `22008 / out of range`.

Não há, na verdade, um bloqueio funcional por "Inscrições encerradas" — o badge vermelho é apenas informativo (em `SmartOpsCourses.tsx` e `AgendaPublica.tsx`) e o `EnrollmentModal` só bloqueia turmas `lotado`. O que o usuário percebe como "bloqueio" é o erro 500 acima abortando o agendamento.

## Mudanças

### 1. `src/hooks/useEnrollment.ts` — normalizar datas antes do writeback
- Adicionar helper `normalizeDateBR(value)`:
  - Aceita `YYYY-MM-DD` → retorna como está.
  - Aceita `DD/MM/YYYY` ou `DD-MM-YYYY` → converte para `YYYY-MM-DD` (com validação de dia/mês).
  - Qualquer outro formato inválido → retorna `null` (campo é ignorado em vez de quebrar).
- Em `writebackEquipment`, ao montar `payload[cfg.lia_date_field]`, passar `entry.ativacao` por `normalizeDateBR`. Se retornar `null`, não enviar o campo.

### 2. `src/components/smartops/EquipmentSerialsSection.tsx` — proteger o `<input type="date">`
- Ao popular o draft de edição (linha ~101) e ao montar `equipmentData` inicial, sanitizar `ativacao` com o mesmo `normalizeDateBR` para que o campo nativo de data exiba corretamente quando o lead já tem valor legado em `DD/MM/YYYY`.
- Mover o helper para `src/lib/courseUtils.ts` (export `normalizeDateBR`) e importar nos dois arquivos.

### 3. Confirmação do "bloqueio"
- Não há código que bloqueie agendamento por "Inscrições encerradas". O `EnrollmentModal` mostra apenas o badge informativo (🟢/🔴/✅) sem `disabled`. Nenhuma alteração extra necessária; após o fix de data o fluxo volta a concluir normalmente.

## Fora de escopo
- Não alterar a regra de turma lotada (continua bloqueando).
- Não alterar labels de countdown.
- Não tocar em `equipment_data` legado já gravado no banco (apenas a normalização em runtime resolve para novos saves).

## Validação
- Abrir lead com `equip_*_ativacao` legado em `DD/MM/YYYY`, agendar nova turma e confirmar que o save retorna 200 e `lia_attendances.equip_*_ativacao` recebe `YYYY-MM-DD`.
- Lead sem `ativacao`: comportamento inalterado.
