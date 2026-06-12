# Ajustar topo do card da agenda

## Objetivo
Reorganizar os elementos do topo do card de turma em `src/pages/AgendaPublica.tsx` para ficar mais limpo e compacto, como no padrão YouTube/eventos.

## Mudanças

1. **Badge LIVE** — canto superior esquerdo da imagem de capa (já está com `absolute top-2 left-2`). Reduzir tamanho:
   - texto `text-[9px]`, padding menor (`pl-0.5 pr-1.5 py-0`), círculo branco `w-3 h-3`, play `w-2 h-2`.

2. **Tag "Turma #006"** — mover para canto superior direito sobre a capa (`absolute top-2 right-2`) em vez de ficar na barra de chips abaixo. Reduzir para `text-[9px] px-1.5 py-0` mantendo estilo (azul claro com borda).

3. **Countdown "10d 9h 22m"** — manter na barra de chips abaixo da capa, mas reduzir para `text-[10px]` e padding compacto, alinhado com o status pill.

4. **Barra de chips abaixo da capa** — remover a tag Turma daqui (agora vive no overlay). Manter apenas status + countdown, ambos menores.

5. Quando **não houver capa** (`!coverUrl`), renderizar LIVE + Turma + status numa única linha compacta no topo do conteúdo, todos no mesmo tamanho reduzido.

## Arquivos
- `src/pages/AgendaPublica.tsx` — único arquivo afetado (componentes `PublicTurmaCard` e `LiveBadge`).

## Fora de escopo
- Não alterar layout do grid, conteúdo do corpo do card, botão Inscreva-se, ou cores do tema.
