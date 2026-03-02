

## Plano: Mensagens Inteligentes por Origem (LIA vs Formulário) + Resumo IA para Vendedor

### Contexto Atual

O `triggerOutboundAutomation` no `lia-assign` depende de regras `NOVO_LEAD` na `cs_automation_rules` — que **não existem** (tabela vazia para esse trigger). Além disso, não diferencia a origem do lead (LIA chat vs formulário), e não envia resumo ao vendedor.

O handoff do `dra-lia/index.ts` já tem: (1) AI greeting vendedor→lead via Gemini, (2) notificação ao vendedor com dados do lead. Mas o `lia-assign` não replica essa lógica.

### Nova Arquitetura de Mensagens no `lia-assign`

O body do `lia-assign` já recebe `source` implícito via `lead.source`. Usaremos isso para bifurcar:

```text
Após PipeRun sync (seção 7):

1. Buscar team_member com waleads_api_key
2. IF source = "dra-lia" ou "whatsapp_lia" ou "handoff_lia":
   → Gerar mensagem AI (Gemini) vendedor→lead com resumo da conversa
   → NÃO usar cs_automation_rules
3. ELSE (form, facebook_ads, piperun, etc):
   → Usar regra NOVO_LEAD da cs_automation_rules (template)
   → Se não existir regra, não enviar mensagem ao lead
4. EM AMBOS OS CASOS:
   → Gerar resumo IA completo do lead para o vendedor
   → Enviar ao WhatsApp DO vendedor (seller notification)
```

### Mudanças Técnicas no `smart-ops-lia-assign/index.ts`

#### 1. Nova função `generateAILeadGreeting` (~30 linhas)

Usa Gemini Flash (via Lovable gateway) para gerar saudação personalizada vendedor→lead, similar ao handoff do `dra-lia`:
- Input: nome do vendedor, nome do lead, `resumo_historico_ia`, `produto_interesse`, última pergunta
- Output: mensagem curta 3-4 linhas
- Timeout: 4s, fallback para template estático

#### 2. Nova função `generateAISellerBriefing` (~50 linhas)

Gera resumo rico para o vendedor usando Gemini, consolidando TODOS os campos do lead:
- Dados básicos: nome, email, telefone, cidade/UF, especialidade, área
- Histórico comercial: `status_oportunidade`, `data_primeiro_contato`, `proprietario_lead_crm` anterior, `funil_entrada_crm`, `ultima_etapa_comercial`
- E-commerce: `lojaintegrada_cliente_id`, `lojaintegrada_ultimo_pedido_data`, `lojaintegrada_ultimo_pedido_valor`, `lojaintegrada_itens_json`
- Cursos: `astron_user_id`, `astron_courses_total`, `astron_courses_completed`, `astron_last_login_at`, `astron_plans_active`
- Análise cognitiva: `cognitive_analysis` (stage, urgency, motivation, objection risk)
- Equipamentos: `tem_impressora`, `impressora_modelo`, `tem_scanner`, `software_cad`
- Produtos ativos: `ativo_print`, `ativo_scan`, `ativo_cad`, `ativo_cura`, `ativo_insumos`
- Resumo conversa LIA: `resumo_historico_ia`, `historico_resumos`

Output: texto estruturado ~300 palavras com seções (Perfil, Histórico, Oportunidades, Recomendação)

#### 3. Reescrever `triggerOutboundAutomation` → bifurcar por source

```typescript
async function triggerOutboundMessages(
  supabase, supabaseUrl, serviceKey, 
  lead, teamMemberId, teamMemberName
) {
  const phone = lead.telefone_normalized || lead.telefone_raw;
  if (!teamMemberId || teamMemberId === "fallback-admin" || !phone) return;

  const { data: member } = await supabase
    .from("team_members")
    .select("id, nome_completo, waleads_api_key, whatsapp_number")
    .eq("id", teamMemberId).single();
  if (!member?.waleads_api_key) return;

  const isLiaSource = ["dra-lia","whatsapp_lia","handoff_lia"].includes(lead.source);

  // ── A. Mensagem vendedor → lead ──
  if (isLiaSource) {
    // AI-generated greeting (resumo da conversa)
    const aiGreeting = await generateAILeadGreeting(lead, member.nome_completo);
    await sendWaLeads(supabaseUrl, serviceKey, member.id, phone, aiGreeting, lead.id);
  } else {
    // Template from cs_automation_rules
    await sendTemplateMessage(supabase, supabaseUrl, serviceKey, lead, member);
  }

  // ── B. Resumo IA → vendedor (SEMPRE) ──
  const briefing = await generateAISellerBriefing(lead);
  if (member.whatsapp_number) {
    await sendWaLeads(supabaseUrl, serviceKey, member.id, member.whatsapp_number, briefing, lead.id);
  }
}
```

#### 4. Secrets necessários

`LOVABLE_API_KEY` — já existe nos secrets do projeto. Será usado para chamar `https://ai.gateway.lovable.dev/v1/chat/completions` com Gemini Flash.

### Fluxo para thiago.nicoletti@smartdent.com.br

```text
1. source = "dra-lia" → isLiaSource = true
2. Mensagem AI vendedor→lead: Gemini gera saudação personalizada
   da Patrica para Thiago com contexto da conversa sobre Resinas
3. Resumo AI → Patrica: briefing completo com:
   - "Primeiro contato: 02/Mar/2026"
   - "Já tem deal PipeRun #33706074"
   - "Sem compras e-commerce (lojaintegrada_cliente_id: null)"
   - "Sem cadastro cursos (astron_user_id: null)"  
   - "Análise cognitiva: SAL_comparador, urgência média"
   - "Interesse: Resinas, perfil técnico detalhista"
```

### Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/smart-ops-lia-assign/index.ts` | Novas funções `generateAILeadGreeting`, `generateAISellerBriefing`, reescrita de `triggerOutboundAutomation` com bifurcação por source |

