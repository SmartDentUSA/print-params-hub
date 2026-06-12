# Ajustes finais do card da agenda

## Mudanças em `src/pages/AgendaPublica.tsx` (`PublicTurmaCard`)

1. **Remover o cronômetro duplicado** — apagar a renderização do `<LiveCountdown />` (o digital "3d 09:08:07"). Manter apenas o status pill verde com tempo aproximado ("3d 9h 8m"), que já indica a contagem regressiva.

2. **Remover a métrica "Ocupação"** no rodapé do card.
   - Mudar o grid de `grid-cols-3` para `grid-cols-2`.
   - Deixar apenas **Vagas** e **Inscritos**.
   - Remover variáveis não usadas (`pct`, `pctColor`, cálculo de ocupação) se ficarem órfãs.

## Fora de escopo
- Não tocar no layout do header (LIVE / Turma) já aprovado.
- Não alterar TurmaCard do admin (`src/components/smartops/TurmaCard.tsx`) — esse continua com ocupação para uso interno.
