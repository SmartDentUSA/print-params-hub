

# Diagnóstico: Cards de leads com seções diferentes

## O que está acontecendo

**Nenhum dado foi removido ou perdido.** As seções dos cards são condicionais — só aparecem quando o lead tem aquele tipo de dado. Isso é o comportamento que já existia ANTES das minhas edições.

### Dados reais do banco:

| Lead | Academy | Análise Cognitiva | Cursos |
|------|---------|-------------------|--------|
| danilohen@gmail.com | ✅ 6/6 cursos | ✅ Sim | ✅ 6 cursos |
| OTAVIO POZZA | ❌ 0 cursos | ❌ Não | ❌ 0 |
| Herold Endlich Garcia | ❌ 0 cursos | ❌ Não | ❌ 0 |
| LUCIANO CHAVES | ❌ 0 cursos | ❌ Não | ❌ 0 |

O danilohen é um lead **excepcionalmente rico** — tem 6 cursos na Academy, análise cognitiva salva, perfil psicológico, etc. A maioria dos leads (10 dos 10 mais recentes) não tem Academy nem análise cognitiva porque:

1. **Academy**: Só ~poucos leads estão inscritos na Astron Academy
2. **Análise Cognitiva**: Só é gerada quando alguém clica "Reanalisar" no card ou via batch
3. **Progresso de Cursos**: Depende da integração Astron Members

### O que as minhas edições anteriores mudaram:
- Corrigiram HTML nos nomes de itens de proposta
- Corrigiram valores unitários (mapeamento `it.value`)
- Backfill de itens a partir de `proposals_data`

**Nenhuma seção foi removida do card.** Todas as 6 tabs e todas as seções condicionais (Academy, Suporte, Timeline, Cognitivo, Propostas, etc.) continuam presentes.

## O que posso fazer para melhorar

Se o objetivo é que **todos os leads tenham as mesmas seções visíveis**, posso:

1. **Mostrar seções vazias com estado placeholder** — em vez de esconder seções sem dados, mostrar "Nenhum curso na Academy" / "Análise cognitiva não gerada"
2. **Rodar batch de análise cognitiva** — processar os leads mais relevantes automaticamente para preencher os cards
3. **Manter como está** — seções só aparecem quando há dados (UX mais limpa)

Recomendo a opção 1 para que o vendedor saiba que a seção existe, mesmo sem dados.

### Mudanças técnicas (opção 1):

| Arquivo | Mudança |
|---------|---------|
| `src/components/smartops/LeadDetailPanel.tsx` | Remover condicionais `{x > 0 && ...}` das seções Academy, Cognitivo e Suporte. Adicionar empty states com texto placeholder |

