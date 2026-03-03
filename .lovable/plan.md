

## Plano: Reformatar Notificação do Vendedor com Template Estruturado + Rodar Fluxo

### Problema

A notificação ao vendedor usa IA generativa (Gemini) que produz texto livre. O formato desejado é um template **estruturado e determinístico** com campos fixos, incluindo link do PipeRun, análise cognitiva completa e histórico detalhado. A IA deve gerar apenas os campos de texto livre (HISTÓRICO e OPORTUNIDADE), não a estrutura inteira.

### Formato Desejado (Template)

```text
🤖 *Novo Lead atribuído - Dra. L.I.A.*

👤 Lead: {nome}
📧 Email: {email}
📱 Tel: {telefone_normalized}
🦷 Área de atuação: {area_atuacao || "N/A"}
🦷 Especialidade: {especialidade || "N/A"}
🎯 Interesse: {produto_interesse || "N/A"}
🌡️ Temp: {temperatura_lead || urgency_level}
🔗 PipeRun: {piperun_link}
💬 Última pergunta do lead: {última mensagem}
🏷️ Contexto: {rota_inicial_lia}
📍 Etapa CRM: {ultima_etapa_comercial}

**HISTÓRICO:** {AI-generated: primeiro contato, compras e-commerce, cursos, vendedores anteriores}
**OPORTUNIDADE:** {AI-generated: software, equipamentos, urgência, motivação, risco objeção}

🧠 *Análise Cognitiva:*
Confiança: {confidence_score_analysis}%
Estágio: {lead_stage_detected}
Urgência: {urgency_emoji} {urgency_level}
Timeline: {interest_timeline}
Perfil: {psychological_profile}
Motivação: {primary_motivation}
Risco objeção: {objection_risk}
Abordagem: {recommended_approach}
```

### Mudanças no `smart-ops-lia-assign/index.ts`

#### 1. Substituir `generateAISellerBriefing` por `buildSellerNotification`

Nova função que monta o template fixo e usa IA **apenas** para gerar 2 campos textuais:
- **HISTÓRICO** (2-3 linhas): compilado pela IA a partir de `data_primeiro_contato`, `lojaintegrada_*`, `astron_*`, `proprietario_lead_crm`
- **OPORTUNIDADE** (2-3 linhas): compilado pela IA a partir de `software_cad`, `tem_impressora`, `tem_scanner`, cognitive fields

A IA recebe os dados brutos e retorna JSON `{ historico: "...", oportunidade: "..." }` em vez de texto livre.

#### 2. Buscar última mensagem do lead

Consultar `agent_interactions` pelo `session_id` do lead (via bridge de email para `leads.id`) para pegar a última `user_message`.

#### 3. `buildStaticBriefing` como fallback

Se a IA falhar, usar dados brutos inline sem texto gerado.

#### 4. Rodar fluxo para `thiago.nicoletti@smartdent.com.br`

Após deploy, chamar `smart-ops-lia-assign` com `email: thiago.nicoletti@smartdent.com.br` e verificar:
- Deal 42417219: `company_id` preenchido
- Mensagem ao lead: greeting AI
- Notificação à Patrica: formato estruturado com todos os campos

### Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/smart-ops-lia-assign/index.ts` | Substituir `generateAISellerBriefing` + `buildStaticBriefing` por `buildSellerNotification` com template fixo + IA parcial para HISTÓRICO/OPORTUNIDADE |

