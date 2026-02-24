## Plano: Saudação de Lead Retornante com Resumo do Histórico — ✅ IMPLEMENTADO

### Resumo da implementação

**Backend (`supabase/functions/dra-lia/index.ts`):**
1. ✅ Nova action `summarize_session` — busca histórico, gera resumo via Gemini-flash-lite, salva em `lia_attendances.resumo_historico_ia`
2. ✅ Handler de lead retornante atualizado — busca `lia_attendances` + última interação, monta saudação com data/hora/resumo
3. ✅ Meta chunk `ui_action: "show_topics"` enviado para leads retornantes
4. ✅ Resumo anterior injetado no system prompt (`CONTEXTO DE CONVERSA ANTERIOR`)

**Frontend (`src/components/DraLIA.tsx`):**
1. ✅ Timer de inatividade de 5 min (fire-and-forget `summarize_session`)
2. ✅ Detecção de meta chunk `show_topics` para mostrar cards imediatamente
3. ✅ Regex de detecção de lead retornante atualizado
