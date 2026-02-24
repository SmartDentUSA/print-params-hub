

# Smart Ops - Plano Completo e Refinado

## Resumo

Sistema middleware invisivel e 100% automatico que orquestra leads da Smart Dent. Vendedores/CS/Suporte continuam usando Piperun + WhatsApp. Apenas o admin (Danilo) acessa o painel como nova aba "Smart Ops" no `/admin`.

---

## ETAPA 1: Secrets (antes de tudo)

Solicitar e configurar 2 secrets no Supabase:
- `PIPERUN_API_KEY` - Token da API REST do Piperun
- `MANYCHAT_API_KEY` - Token da API do ManyChat

---

## ETAPA 2: Migration SQL (4 tabelas + RLS + indices)

### Tabela `lia_attendances` (hub central)

Todos os campos especificados:
- Dados pessoais: `nome`, `email` (UNIQUE), `telefone_raw`, `telefone_normalized`
- Formulario: `area_atuacao`, `especialidade`, `como_digitaliza`, `tem_impressora`, `impressora_modelo`, `resina_interesse`, `produto_interesse`
- Campanha/UTM: `origem_campanha`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `ip_origem`, `pais_origem`
- CRM: `lead_status`, `score`, `piperun_id` (UNIQUE nullable), `funil_entrada_crm`, `proprietario_lead_crm`, `status_atual_lead_crm`
- IA/LIA: `rota_inicial_lia`, `resumo_historico_ia`, `reuniao_agendada`
- Recorrencia (8 ativos): `ativo_scan`, `data_ultima_compra_scan`, `ativo_notebook`, `data_ultima_compra_notebook`, `ativo_cad`, `data_ultima_compra_cad`, `ativo_cad_ia`, `data_ultima_compra_cad_ia`, `ativo_smart_slice`, `data_ultima_compra_smart_slice`, `ativo_print`, `data_ultima_compra_print`, `ativo_cura`, `data_ultima_compra_cura`, `ativo_insumos`, `data_ultima_compra_insumos`
- CS: `id_cliente_smart`, `data_contrato`, `cs_treinamento`
- Meta: `source`, `form_name`, `raw_payload` (JSONB), `data_primeiro_contato`
- Indices em: `email`, `piperun_id`, `lead_status`, `source`
- Trigger `updated_at` automatico

### Tabela `team_members`

- `role` TEXT com CHECK (`vendedor`, `cs`, `suporte`)
- `nome_completo`, `email` (UNIQUE), `whatsapp_number`, `ativo`
- Indice em `role`, `ativo`

### Tabela `message_logs`

- FK `lead_id` -> `lia_attendances(id)`
- FK `team_member_id` -> `team_members(id)`
- `whatsapp_number`, `data_envio`, `tipo`, `mensagem_preview`, `status`, `error_details`
- Indice em `lead_id`, `data_envio`

### Tabela `cs_automation_rules`

- `produto_interesse`, `trigger_event`, `delay_days`, `tipo` (text/audio/video), `template_manychat`, `ativo`
- Sem FK, tabela de configuracao simples

### RLS (todas as tabelas)

Politica unica em cada tabela usando a funcao `is_admin(auth.uid())` ja existente no banco:

```text
ALTER TABLE lia_attendances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only" ON lia_attendances FOR ALL USING (is_admin(auth.uid()));
-- Repetir para team_members, message_logs, cs_automation_rules
```

Nota: a funcao `is_admin()` ja existe e verifica na tabela `user_roles`. Nenhum acesso publico.

---

## ETAPA 3: Seed de Dados (via insert tool, nao migration)

### team_members (12 membros)

```text
INSERT INTO team_members (role, nome_completo, email, whatsapp_number, ativo) VALUES
('vendedor', 'Paulo Comercial', 'paulo@smartdent.com.br', '+5569993831794', true),
('vendedor', 'Vendedor 02', 'vendedor02@smartdent.com.br', '+5500000000002', true),
('vendedor', 'Vendedor 03', 'vendedor03@smartdent.com.br', '+5500000000003', true),
('vendedor', 'Vendedor 04', 'vendedor04@smartdent.com.br', '+5500000000004', true),
('vendedor', 'Vendedor 05', 'vendedor05@smartdent.com.br', '+5500000000005', true),
('vendedor', 'Vendedor 06', 'vendedor06@smartdent.com.br', '+5500000000006', true),
('vendedor', 'Vendedor 07', 'vendedor07@smartdent.com.br', '+5500000000007', true),
('vendedor', 'Vendedor 08', 'vendedor08@smartdent.com.br', '+5500000000008', true),
('vendedor', 'Vendedor 09', 'vendedor09@smartdent.com.br', '+5500000000009', true),
('vendedor', 'Vendedor 10', 'vendedor10@smartdent.com.br', '+5500000000010', true),
('cs', 'CS Principal', 'cs@smartdent.com.br', '+5500000000011', true),
('suporte', 'Suporte Tecnico', 'suporte@smartdent.com.br', '+5500000000012', true);
```

### cs_automation_rules (regras iniciais)

```text
INSERT INTO cs_automation_rules (produto_interesse, trigger_event, delay_days, tipo, template_manychat, ativo) VALUES
('Vitality', 'ganho', 3, 'audio', 'vitality_boas_vindas', true),
('Vitality', 'ganho', 7, 'video', 'vitality_tutorial', true),
('Vitality', 'ganho', 30, 'text', 'vitality_upsell', true),
('EdgeMini', 'ganho', 3, 'text', 'edgemini_boas_vindas', true),
('EdgeMini', 'ganho', 14, 'video', 'edgemini_dicas', true),
('IoConnect', 'ganho', 3, 'audio', 'ioconnect_onboarding', true),
('IoConnect', 'ganho', 30, 'text', 'ioconnect_upsell', true);
```

---

## ETAPA 4: Edge Functions (4 funcoes)

### 4.1 `smart-ops-ingest-lead`
- `verify_jwt = false` (recebe webhooks externos)
- Recebe POST com JSON do formulario
- Mapeamento explicito de campos:
  - `nome` <- `full_name` | `Name` | `First name + Last name`
  - `telefone_raw` <- `phone_number` | `Mobile phone`
  - `area_atuacao` <- campo "SELECIONE SUA AREA DE ATUACAO"
  - `como_digitaliza` <- campo "COMO DIGITALIZA SUAS MOLDAGENS"
  - `tem_impressora` <- campo "UTILIZA IMPRESSOES 3D"
  - `produto_interesse` <- detectado por `form_name` (ex: contém "VITALITY" -> "Vitality")
- Normaliza telefone para E.164 (`+55...`)
- Upsert em `lia_attendances` com `raw_payload` sempre preenchido
- Cria deal no Piperun via `POST https://api.pipe.run/v1/deals` com headers `Token: {PIPERUN_API_KEY}`
- Atualiza `piperun_id` no registro
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS

### 4.2 `smart-ops-piperun-webhook`
- `verify_jwt = false`
- Recebe POST do Piperun (evento de atribuicao/movimentacao)
- Atualiza `proprietario_lead_crm`, `status_atual_lead_crm` em `lia_attendances`
- Busca `whatsapp_number` do vendedor atribuido em `team_members`
- Chama ManyChat Send Flow Content API: `POST https://api.manychat.com/fb/sending/sendFlow` com header `Authorization: Bearer {MANYCHAT_API_KEY}`
- Loga em `message_logs` com status e preview

### 4.3 `smart-ops-cs-processor`
- `verify_jwt = false`
- Chamada por pg_cron (08:00 e 17:30 BRT)
- Le `cs_automation_rules` WHERE `ativo = true`
- Para cada regra: busca leads em `lia_attendances` WHERE `status_atual_lead_crm = trigger_event` AND `data_contrato + delay_days <= NOW()` AND nao existe log em `message_logs` para esse lead+regra
- Busca membro CS em `team_members` WHERE `role = 'cs'`
- Envia via ManyChat API
- Insere log em `message_logs`

### 4.4 `smart-ops-sync-piperun`
- `verify_jwt = false`
- Chamada por pg_cron a cada 30 min
- Busca deals atualizados no Piperun via `GET https://api.pipe.run/v1/deals?updated_since=...`
- Atualiza `status_atual_lead_crm`, `proprietario_lead_crm` em `lia_attendances`

### Config (supabase/config.toml)

```text
[functions.smart-ops-ingest-lead]
verify_jwt = false

[functions.smart-ops-piperun-webhook]
verify_jwt = false

[functions.smart-ops-cs-processor]
verify_jwt = false

[functions.smart-ops-sync-piperun]
verify_jwt = false
```

---

## ETAPA 5: pg_cron Jobs (via insert tool)

Habilitar extensoes `pg_cron` e `pg_net` (se nao habilitadas), depois:

```text
-- CS Processor: 08:00 e 17:30 BRT (11:00 e 20:30 UTC)
SELECT cron.schedule(
  'smart-ops-cs-processor',
  '0 11,20 * * *',
  $$SELECT net.http_post(
    url:='https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-cs-processor',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;$$
);

-- Sync Piperun: a cada 30 min
SELECT cron.schedule(
  'smart-ops-sync-piperun',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url:='https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-sync-piperun',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;$$
);
```

---

## ETAPA 6: Painel Admin (6 componentes React)

Nova aba "Smart Ops" no `AdminViewSecure.tsx` (icone Zap, visivel apenas para admin).

### 6.1 `SmartOpsTab.tsx` - Container principal
- Sub-tabs internas: Bowtie | Kanban | Equipe | Reguas CS | Logs | Relatorios
- Botao de refresh global

### 6.2 `SmartOpsBowtie.tsx` - Funil Ampulheta
- Layout CSS Grid horizontal: lado esquerdo (vermelho) -> gargalo -> lado direito (roxo)
- **Aquisicao (vermelho):**
  - MQL: `COUNT(*) WHERE lead_status = 'novo' AND created_at > 30 dias`
  - SQL: `COUNT(*) WHERE resumo_historico_ia IS NOT NULL AND created_at > 30 dias`
  - Vendas: `COUNT(*) WHERE status_atual_lead_crm = 'Ganha' AND created_at > 30 dias`
- **Expansao (roxo):**
  - CS-Contratos (Live): `COUNT(*) WHERE data_contrato > 30 dias`
  - CS-Onboarding (MRR): `COUNT(*) WHERE cs_treinamento = 'concluido' AND pelo menos 1 ativo`
  - CS-Ongoing (LTV): `COUNT(*) WHERE ativos >= 2 AND data_ultima_compra_insumos > 90 dias`
- % de conversao entre etapas adjacentes
- Badges de saude: verde (>meta), laranja (50-100% meta), vermelho (<50% meta)
- Metas configuradas como constantes no componente

### 6.3 `SmartOpsKanban.tsx` - Kanban Global
- 3 colunas: Novo | Em Contato | Qualificado
- Cards: nome, email, telefone formatado, produto_interesse, proprietario_lead_crm, source, data_primeiro_contato
- Badge vermelho se lead com `lead_status = 'novo'` e `created_at < NOW() - 15 min`
- Drag-and-drop via HTML5 nativo (onDragStart, onDrop)
- Ao soltar: atualiza `lead_status` em `lia_attendances`

### 6.4 `SmartOpsTeam.tsx` - Configuracao da Equipe
- Tabela de `team_members` com colunas: Nome, Email, WhatsApp, Role, Ativo
- Dialog para adicionar/editar membro
- Toggle ativo/inativo inline
- Validacao: whatsapp_number obrigatorio, formato +55...

### 6.5 `SmartOpsCSRules.tsx` - Reguas CS
- Tabela editavel de `cs_automation_rules`
- Colunas: Produto, Trigger, Delay (dias), Tipo, Template ManyChat, Ativo
- Dialog para adicionar/editar regra
- Toggle ativo inline

### 6.6 `SmartOpsLogs.tsx` - Logs de Envios
- Tabela de `message_logs` com paginacao
- Filtros: data (range), tipo, status, busca por lead/membro
- Colunas: Data, Lead, Membro, Tipo, Preview, Status, Erro

### 6.7 `SmartOpsReports.tsx` - Relatorios de Recorrencia
- Cards resumo:
  - Total clientes ativos (tem `data_contrato` preenchida)
  - Churn potencial (ultima compra de qualquer ativo > 90 dias)
  - Gap de ativos (ex: `ativo_cad_ia = true` mas `ativo_smart_slice = false` ou ultima compra > 90 dias)
- Tabela detalhada com clientes e status de cada ativo
- Botao "Exportar CSV" (gera download client-side)

### Integracao no AdminViewSecure.tsx

- Importar `SmartOpsTab`
- Adicionar TabsTrigger "Smart Ops" com icone Zap (apenas `isAdmin`)
- Ajustar grid para `grid-cols-11`
- Adicionar TabsContent renderizando `<SmartOpsTab />`

---

## Sequencia de Execucao

1. Solicitar secrets `PIPERUN_API_KEY` e `MANYCHAT_API_KEY`
2. Migration SQL: criar 4 tabelas + RLS + indices + trigger updated_at
3. Seed: inserir team_members e cs_automation_rules via insert tool
4. Criar 4 edge functions + atualizar config.toml
5. Criar 7 componentes React do painel
6. Integrar aba no AdminViewSecure.tsx
7. Configurar pg_cron jobs via insert tool
8. Deploy e teste end-to-end

