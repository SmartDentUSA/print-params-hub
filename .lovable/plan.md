## Problema

No compartilhamento presencial, a mensagem mostra só `📅 17 de Jun de 2026 (Qua) / ⏰ 08:30–17:30`, mesmo quando a turma é de 3 dias (17, 18, 19/06). Faltam:
- Data início / data fim (resumo)
- Horário início / horário fim (resumo)
- Cronograma completo (linha por dia)

Causa: o `ShareButton` em `src/pages/AgendaPublica.tsx` só usa `turma.days` quando o array vem populado. Se a turma tem só `start_date` (caso atual), ele cai no fallback de 1 linha. Mesmo no caminho multi-dia, ele não imprime um cabeçalho de "Início/Fim" antes do cronograma.

## Mudança (apenas `ShareButton`, sem alterar template do CS)

Reescrever o bloco de cronograma para sempre montar 3 partes, na ordem:

1. **Resumo (sempre)**
   ```
   📅 Início: 17/06/2026 — Fim: 19/06/2026
   ⏰ Horário: 08:30 às 17:30
   ```
   - `Início` = `days[0].date` se houver, senão `turma.start_date`
   - `Fim` = `days[last].date` se houver, senão `turma.end_date ?? turma.start_date`
   - Se Início == Fim, imprime só `📅 Data: 17/06/2026 (Qua)`
   - Horário = primeiro `start_time` e último `end_time` (de `days` ou de `turma.start_time/end_time`)

2. **Cronograma detalhado (se houver mais de 1 dia)**
   ```
   🗓 Cronograma:
   • Dia 1 — 17/06 (Qua) | 08:30–17:30
   • Dia 2 — 18/06 (Qui) | 08:30–17:30
   • Dia 3 — 19/06 (Sex) | 08:30–17:30
   ```
   - Fonte: `turma.days` ordenado por `day_number`. Se `topic` existir, vira `Dia N — Tópico (DD/MM)`.
   - **Fallback quando `days` está vazio mas a turma é multi-dia**: derivar os dias entre `start_date` e `end_date` (inclusive), usando `start_time`/`end_time` da turma para todos.

3. Mantém regra anterior: presencial sem `Inscreva-se`, online com link do forms. Continua usando Web Share API + `api.whatsapp.com/send` como fallback.

## Exemplo de saída (presencial 3 dias)

```
Opção de treinamento, aqui estão os detalhes:

📚 *Chairside Print - Odontologia Digital*
🏷 Turma: *146 BLZ ino 200 Dias 17,18,19/06*
👨‍🏫 Instrutor: Danilo Citigi e Livia Comar
📍 São Carlos/SP, na sede da Smart Dent.

📅 Início: 17/06/2026 — Fim: 19/06/2026
⏰ Horário: 08:30 às 17:30

🗓 Cronograma:
• Dia 1 — 17/06 (Qua) | 08:30–17:30
• Dia 2 — 18/06 (Qui) | 08:30–17:30
• Dia 3 — 19/06 (Sex) | 08:30–17:30
```

Turma de 1 dia continua compacta:
```
📅 Data: 17/06/2026 (Qua)
⏰ Horário: 08:30 às 17:30
```

## Escopo

100% frontend, isolado em `ShareButton` (`src/pages/AgendaPublica.tsx`). Sem mexer em backend, banco, template do CS (`courseWhatsapp.ts`), ou roteamento.
