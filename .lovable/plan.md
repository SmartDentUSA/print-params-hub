

## Plano: Adicionar Análise Cognitiva na Notificação do Vendedor

### Problema
A mensagem de handoff enviada ao vendedor não inclui os dados da análise cognitiva (estágio, urgência, timeline, perfil, motivação, objeção, abordagem recomendada). O vendedor recebe apenas dados básicos do lead.

### Alterações

**Arquivo:** `supabase/functions/dra-lia/index.ts`

#### 1. Adicionar campos cognitivos no SELECT da `notifySellerHandoff` (linha 1438)
Incluir na query: `cognitive_analysis, confidence_score_analysis, lead_stage_detected, urgency_level, interest_timeline, psychological_profile, primary_motivation, objection_risk, recommended_approach, piperun_id`

#### 2. Montar bloco cognitivo na mensagem (após linha 1498)
Após o bloco "⚡ Ação:", adicionar seção condicional:

```
📊 Análise Cognitiva - Confiança: {confidence_score_analysis}%

Estágio: {lead_stage_detected}
Urgência: 🟢/🟡/🔴 {urgency_level}
Timeline: {interest_timeline}
Perfil: {psychological_profile}
Motivação: {primary_motivation}
Risco objeção: {objection_risk}
Abordagem: {recommended_approach}
```

Só incluir este bloco se `confidence_score_analysis` existir (análise já foi feita).

Mapear urgência para emoji: `alta` → 🔴, `media` → 🟡, `baixa` → 🟢.

#### 3. Adicionar `piperun_id` na mensagem (linha 1488)
Incluir `🎯 ID_PipeRun: {piperun_id}` quando disponível.

#### 4. Mesma lógica para `notifySellerEscalation` (linha 2587)
Adicionar campos cognitivos no SELECT e no template de mensagem desta função também.

### Resultado esperado
A mensagem do vendedor passará a ter o formato solicitado, com a seção de análise cognitiva no final.

