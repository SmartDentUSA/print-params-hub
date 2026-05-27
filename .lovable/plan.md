## Caso Mark Antew: o que aconteceu

O lead chegou pelo Meta form **# - GlazeON- Smart Dent**, que só pergunta `tem_scanner` / `tem_impressora` (sim/não) e `como_digitaliza`. Ele respondeu **"não" / "não" / "Ainda não digitalizo"**. A nota do PipeRun refletiu corretamente esse payload — não houve alucinação, mas também não houve enriquecimento. Não há `3shape`/`flashforge` em lugar algum do registro deste lead (verificado em `lia_attendances`, `form_data`, identidade por email+phone).

Se de fato esse profissional já respondeu marca de scanner/impressora em algum outro canal (WhatsApp com LIA, outro form, outra unidade da empresa), esse dado não foi associado ao lead. Os 4 gaps abaixo explicam por quê.

## 4 gaps reais no pipeline de briefing

### Gap 1 — `generateHistoricoOportunidade` (lia-assign:1322-1386) não recebe colunas-marca
O prompt envia ao DeepSeek:
```
Impressora: ${lead.tem_impressora} ${lead.impressora_modelo}
Scanner:    ${lead.tem_scanner}
```
Mas omite `scanner_marca`, `equip_scanner`, `equip_impressora`, `equip_scanner_bancada`, `equip_pos_impressao`, `equip_cad`, `software_cad`, `equip_fresadora`, `equip_notebook`. Esses campos são populados por **outros** formulários e por backfill de deals — quando preenchidos, o LLM não os enxerga.

### Gap 2 — Sem cross-lookup por email/telefone (enrichment cego)
O briefing usa **apenas** colunas top-level do lead canônico atual + `dealsCtx` (deals do PipeRun ligados ao `piperun_id` deste lead). Não consulta:
- `omie_clientes` / `omie_pedidos` por CNPJ/CPF (LTV ERP)
- `lia_attendances` de outras unidades (mesmo email/phone, antes do merge)
- `lead_form_responses` / `smartops_form_field_responses` (respostas detalhadas de SDR Captação)
- `agent_interactions` / `messages` (perguntas livres feitas à LIA em outros leads)

Resultado: se Mark Antew (ou um homônimo do mesmo phone) já tinha respondido marca em outro form/chat, o briefing ignora.

### Gap 3 — `cognitive_analysis` exige ≥5 mensagens de chat
`cognitive-lead-analysis/index.ts:220` retorna `skip: insufficient_messages` quando `totalMsgs < 5`. Lead novo de formulário **nunca** tem 5 msgs com a LIA na hora da criação → bloco "🧠 Análise Cognitiva" sai todo **N/A / 0%** na nota inicial. Isso é o que o usuário viu ("Confiança: 0%, Estágio: N/A, Urgência: N/A, Perfil: N/A, Motivação: N/A").

### Gap 4 — Status `cliente Smart` não é destacado no prompt
O prompt envia `lojaintegrada_cliente_id` e `astron_user_id` mas **não** envia:
- `status_omie` / `omie_codigo_cliente` / `omie_billing_total`
- `total_deals_won` (todas as compras históricas, não só os recentes)
- `rfm_segment` (VIP/Premium/Active)
- `is_existing_customer` (flag derivada)

Para um cliente Smart de longa data com novo lead entrante, o vendedor recebe "Sem compras anteriores no e-commerce" — tecnicamente verdadeiro (só fala de e-commerce), mas omite o ERP/CRM histórico.

## O que mudar (em build mode)

### Mudança A — Enriquecer prompt do `generateHistoricoOportunidade`
Em `supabase/functions/smart-ops-lia-assign/index.ts:1357-1386`:

1. Adicionar bloco "Equipamentos declarados":
   ```
   Equipamentos declarados:
   - Scanner: tem=${tem_scanner} | marca=${scanner_marca || equip_scanner || como_digitaliza}
   - Impressora: tem=${tem_impressora} | modelo=${impressora_modelo || equip_impressora}
   - Scanner bancada: ${equip_scanner_bancada}
   - Pós-impressão: ${equip_pos_impressao}
   - CAD/Software: ${equip_cad} / ${software_cad}
   - Fresadora: ${equip_fresadora} | Notebook: ${equip_notebook}
   ```
2. Adicionar bloco "Status de cliente":
   ```
   Cliente Smart Dent: ${status_oportunidade==='ganha' ? 'SIM' : 'NÃO'}
   ERP Omie: ${omie_codigo_cliente || 'sem cadastro'} | Faturado: R$${omie_billing_total || 0}
   Total deals históricos: ${total_deals_all} (${ganhos} ganhos / ${perdidos} perdidos)
   RFM: ${rfm_segment || 'N/A'}
   ```
3. Expandir `SELECT` em `fetchDealsContext` (`_shared/waleads-messaging.ts`) para incluir essas colunas, ou ler diretamente do `lead` no caller.

### Mudança B — Cross-lookup determinístico antes do prompt
Nova helper `enrichLeadFromIdentity(supabase, lead)` chamada antes de `generateHistoricoOportunidade`:

1. Buscar `lia_attendances` `WHERE merged_into IS NULL AND id != lead.id AND (email = lead.email OR telefone_normalized = lead.telefone_normalized)` — pegar `scanner_marca`, `impressora_modelo`, `equip_*` mais recentes que não-null. Usar `COALESCE` para preencher campos vazios.
2. Buscar `omie_clientes` por `empresa_cnpj` / `pessoa_cpf` → injetar `omie_billing_total`, `omie_ultima_compra`.
3. Buscar `smartops_form_field_responses` `WHERE lead_id = lead.id OR lead_id IN (canonical_siblings)` para puxar respostas SDR Qualificação detalhadas.
4. Repassar todos os campos enriquecidos ao prompt (sem persistir no `lia_attendances` — só usar in-memory pra evitar conflito com Person Origin Frozen).

### Mudança C — Bloco "Análise Cognitiva" fallback determinístico
Em `buildSellerNotification` (`lia-assign:1085-1095`), quando `cognitive_analysis` é null, em vez de mostrar `N/A` / `0%`, calcular fallback a partir de:
- `urgency_level` derivado de `produto_interesse` + `area_atuacao` (alta se produto premium, média padrão)
- `lead_stage_detected` = "descoberta" para lead novo, "reativação" se já é cliente ganho, "reengajamento" se tem deal perdido
- `psychological_profile` = "racional/cético" como default neutro
- `recommended_approach` = template baseado em `produto_interesse` + presença/ausência de equipamentos

Ocultar o bloco inteiro **ou** substituir por bloco "📋 Perfil Inicial (sem chat ainda)" deixando claro ao vendedor que essa análise virá depois das primeiras 5 msgs com a LIA.

### Mudança D — Health log de auditoria
Após gerar a nota, logar em `system_health_logs`:
```
error_type: 'briefing_quality_audit'
details: { has_cognitive, equipment_fields_populated, identity_siblings_found,
           omie_match, total_form_responses, prompt_chars }
```
Pra termos métrica objetiva de % de briefings "ricos" vs "vazios" e poder iterar.

## Fora de escopo
- Mudar o threshold de 5 msgs do `cognitive-lead-analysis` (afeta políticas anti-spam de Análise Cognitiva mais ampla).
- Reescrever o formulário GlazeON pra perguntar marca (decisão de produto/marketing, não engenharia).
- Backfill retroativo das notas do PipeRun já publicadas (notas viram histórico imutável; só novos leads passarão a ter briefing enriquecido).
- Alterar `Person Origin Frozen` ou regra de merge.

## Validação após implementação
1. Criar lead de teste com email+phone iguais a um lead existente que tenha `scanner_marca` preenchido → conferir que o novo briefing menciona a marca via cross-lookup.
2. Criar lead com email de cliente Omie existente (CNPJ casável) → conferir que "Cliente Smart Dent: SIM" aparece na OPORTUNIDADE.
3. Conferir log `briefing_quality_audit` mostrando `equipment_fields_populated > 0` em ≥80% dos novos leads dos últimos 7 dias após o deploy.
4. Re-validar caso Mark Antew: se houver outro lead canônico com mesmo phone/email respondendo marca, o briefing dele agora deve refletir.
