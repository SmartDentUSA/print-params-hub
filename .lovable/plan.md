
# Plano: Sistema Autônomo Dra. L.I.A. — 4 Pilares

## Visão Geral

Transformar a Dra. L.I.A. de uma FAQ inteligente em uma **consultora autônoma** que:
- Lembra o contexto de cada lead
- Inicia conversas proativamente
- Decide quando escalar para humano
- Adapta discurso ao perfil do profissional

---

## Pilar 1 — Memória Conversacional Persistente

### Objetivo
Lead volta → LIA retoma com contexto da última conversa, sem repetir qualificação.

### Implementação

**1a. Usar `resumo_historico_ia` no `lia_attendances`** (campo já existe)

- No `dra-lia` edge function, ao detectar lead retornante (email match):
  - Buscar `resumo_historico_ia` do lead
  - Injetar no system prompt: "Histórico: {resumo}"
  - Gerar saudação contextual: "Dr. João, da última vez conversamos sobre X. Decidiu algo?"

**1b. Sumarização automática ao final de sessão** (já existe via inactivity timer)

- Garantir que o `summarize_session` salve em `resumo_historico_ia` do `lia_attendances`
- Formato do resumo: tópicos discutidos, produtos mencionados, dúvidas pendentes, próximo passo

**1c. Histórico de interações como contexto**

- Buscar últimas 3-5 interações do lead em `agent_interactions` (via `lead_id`)
- Incluir como contexto compacto no prompt

### Arquivos a modificar
- `supabase/functions/dra-lia/index.ts` — injetar resumo + histórico no prompt
- `supabase/functions/archive-daily-chats/index.ts` — garantir que resumo salva em `lia_attendances`

---

## Pilar 2 — Outreach Proativo via WaLeads

### Objetivo
Sistema inicia contato com leads que esfriaram, usando mensagens geradas pela IA.

### Implementação

**2a. Criar edge function `smart-ops-proactive-outreach`**

Lógica de triggers:
```
Lead com proposta_enviada há > 7 dias sem interação → Outreach "acompanhamento"
Lead quente que não voltou há > 3 dias → Outreach "reengajamento"  
Lead novo que completou qualificação mas não perguntou nada → Outreach "primeira dúvida"
Lead com status Perdida há < 30 dias → Outreach "recuperação" (1x só)
```

**2b. Mensagens inteligentes (não templates fixos)**

- Usar IA para gerar mensagem personalizada baseada em:
  - `produto_interesse`
  - `impressora_modelo`
  - `area_atuacao`
  - `resumo_historico_ia`
- Guardar em `cs_automation_rules` com `tipo: 'proactive_ai'`

**2c. Integrar com WaLeads existente**

- Usar `smart-ops-send-waleads` já existente
- Adicionar campo `proactive_sent_at` no `lia_attendances` para evitar spam
- Máximo 1 outreach a cada 5 dias por lead

### Arquivos a criar/modificar
- `supabase/functions/smart-ops-proactive-outreach/index.ts` — NOVO
- Migration: adicionar `proactive_sent_at` e `proactive_count` ao `lia_attendances`

---

## Pilar 3 — Régua de Escalonamento IA → Humano

### Objetivo
LIA decide automaticamente quando resolver sozinha vs escalar para vendedor/CS.

### Implementação

**3a. Definir régua no system prompt da LIA**

```
RESOLVO SOZINHA:
- Dúvida técnica (resina, parâmetro, protocolo, workflow)
- Comparativo de produtos/resinas
- Informações de catálogo e preço público
- Orientação de pós-processamento

ESCALO PARA VENDEDOR:
- Pedido de desconto ou negociação
- Lead com score > 80 pedindo orçamento
- Solicitação de visita/reunião
- Lead menciona concorrente com intenção de compra

ESCALO PARA CS/SUPORTE:
- Problema com equipamento (peça, defeito, reposição)
- Reclamação de produto
- Solicitação de treinamento

ESCALO PARA ESPECIALISTA:
- 3+ interações sem resolução na mesma sessão
- Lead expressa frustração/insatisfação
```

**3b. Ação de escalonamento**

- Quando decidir escalar:
  1. Identificar vendedor responsável via `proprietario_lead_crm` → `team_members`
  2. Enviar notificação via WaLeads para o vendedor com resumo
  3. Marcar `lia_attendances.ultima_etapa_comercial = 'escalado_lia'`
  4. Informar o lead: "Vou conectar você com [Nome], nosso especialista para esse assunto."

**3c. Auto-agendamento de reunião**

- Lead quente + score alto + pediu demo/reunião:
  - LIA coleta data/horário preferido
  - Cria registro no `message_logs` com tipo `agendamento`
  - Notifica vendedor com os detalhes

### Arquivos a modificar
- `supabase/functions/dra-lia/index.ts` — adicionar lógica de escalonamento
- `supabase/functions/_shared/system-prompt.ts` — régua de escalonamento

---

## Pilar 4 — Personalização por Perfil

### Objetivo
LIA adapta tom, conteúdo e recomendações baseado no perfil completo do lead.

### Implementação

**4a. Perfil como contexto no prompt**

Ao identificar lead, construir bloco de contexto:
```
PERFIL DO LEAD:
- Área: Protesista
- Especialidade: Implantodontia
- Equipamento: MiiCraft 125 Ultra
- Scanner: Medit i700
- Temperatura: Quente
- Produto de interesse: Cosmos Temp
- Score: 85 (SQL)
- Último contato: há 3 dias
- Histórico: Perguntou sobre protocolo de facetas com Cosmos Temp
```

**4b. Estratégias por perfil**

| Perfil | Estratégia da LIA |
|--------|-------------------|
| Protesista com impressora | Foco em resinas, protocolos, workflow completo |
| Ortodontista sem impressora | ROI, casos/mês, comparativo de investimento |
| Lab com impressora antiga | Upgrade, velocidade, novos materiais |
| Dentista generalista curioso | Educação, primeiros passos, custo-benefício |
| Lead frio/ebook | Conteúdo educativo, sem pressão comercial |
| Lead quente/proposta | Resolução de objeções, urgência sutil |

**4c. Enriquecer perfil durante conversa**

- Detectar menções a equipamentos, softwares, concorrentes via regex
- Atualizar `lia_attendances` em background (já implementado parcialmente)
- Novos campos a capturar: `software_cad`, `volume_mensal_pecas`, `principal_aplicacao`

### Arquivos a modificar
- `supabase/functions/dra-lia/index.ts` — construir bloco de perfil
- `supabase/functions/_shared/system-prompt.ts` — estratégias por perfil
- Migration: adicionar `software_cad`, `volume_mensal_pecas`, `principal_aplicacao` ao `lia_attendances`

---

## Ordem de Execução

### Fase 1 — Memória (impacto imediato, baixo esforço)
1. Injetar `resumo_historico_ia` no prompt de leads retornantes
2. Garantir sumarização salva no campo correto
3. Buscar últimas interações como contexto

### Fase 2 — Personalização (complementa Fase 1) ✅ IMPLEMENTADO
4. ✅ Construir bloco de perfil do lead no prompt (enriched com software_cad, volume, aplicação)
5. ✅ Adicionar estratégias por perfil ao system prompt (9 arquétipos: clinica_com/sem_impressora, lab_com/sem, lead_frio, lead_quente, cliente_ativo, estudante, novo)
6. ✅ Migration para novos campos de captura (software_cad, volume_mensal_pecas, principal_aplicacao)

### Fase 3 — Escalonamento (complementa Fase 1+2) ✅ IMPLEMENTADO
7. ✅ Régua de escalonamento no system prompt (3 tipos: vendedor, cs_suporte, especialista)
8. ✅ Detecção automática via regex (desconto, negociação, defeito, frustração)
9. ✅ Notificação ao vendedor via WaLeads + log em message_logs
10. ✅ CTA de escalonamento injetado automaticamente na resposta da LIA
11. ✅ Atualização de lia_attendances.ultima_etapa_comercial com tipo de escalonamento

### Fase 4 — Outreach Proativo (requer Fases anteriores)
10. Criar `smart-ops-proactive-outreach`
11. Migration para campos de controle de outreach
12. Integrar com WaLeads existente
13. Configurar cron job para execução diária

---

## Métricas de Sucesso

| Métrica | Atual | Meta |
|---------|-------|------|
| Taxa de resolução sem humano | ~60% | 85% |
| Leads que retornam | desconhecido | 40%+ |
| Tempo médio de resposta a lead quente | manual | < 5 min (automático) |
| Leads escalados com contexto | 0% | 100% |
| Outreach proativo com resposta | 0 | 20%+ taxa de resposta |

---

## Dependências

- WaLeads API key já configurada ✅
- Piperun sync funcionando ✅
- Sistema de sumarização existente ✅
- RAG com 8 fontes ✅
- Judge + Auto-learning ✅
- `lia_attendances` com dados ricos ✅
