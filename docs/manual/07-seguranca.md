# 07 — Segurança

## 7.1 Modelo de autenticação e autorização

| Camada | Mecanismo |
|---|---|
| Frontend | Supabase Auth (e-mail/senha), JWT em `localStorage`, `persistSession + autoRefreshToken` (`client.ts:12-18`) |
| Autorização de UI | `user_roles` (`admin`, `author`, `distribuidor`, `user`) lida em `AdminViewSecure.tsx:166-177` |
| Autorização de dados | 435 policies RLS em 260 tabelas + funções `SECURITY DEFINER` |
| Edge Functions | 1 função com `verify_jwt = true` (`create-user`); as demais validam segredo próprio, `service_role` interno, ou nada |
| Painel de TV | RPCs `SECURITY DEFINER` que expõem apenas agregados de `painel_comercial_cache` |

## 7.2 Achados do linter (526 avisos) — priorizados

| # | Achado | Qtde | Severidade | Recomendação |
|---|---|---|---|---|
| 1 | Policies com condição `USING (true)` | 158 | **Crítica** | reescrever por `auth.uid()`/role; começar pelas tabelas com dado pessoal (`lia_attendances`, `whatsapp_inbox`, `campaign_recipients`, `smartops_form_field_responses`) |
| 2 | Tabelas sem RLS habilitado | 5 | **Crítica** | habilitar RLS e criar policy explícita |
| 3 | Funções sem `search_path` fixo | 256 | Alta | `SET search_path = public, pg_temp` em todas |
| 4 | Funções `SECURITY DEFINER` | 161 | Alta | auditar cada uma; garantir filtro interno de tenancy/role |
| 5 | Edge Functions públicas sem segredo | dezenas (`verify_jwt=false` sem validação visível) | Alta | exigir `Authorization` de service role ou HMAC por função interna |
| 6 | Rotas sensíveis sem guarda (`/painel-comercial`, `/social/*`, `/admin/form-flow/:id`, `/smartops/wa-flow-visualizer`) | 4 | Média | envolver em componente de rota protegida |
| 7 | Views sem `security_invoker` | a auditar | Média | garantir que views não vazem por RLS do dono |

## 7.3 Dados pessoais e LGPD

Categorias tratadas: nome, telefone, e-mail, CPF, CNPJ, endereço, cargo, especialidade, histórico de compras, conteúdo de conversas de WhatsApp, gravações/transcrições de reunião, respostas de NPS.

| Obrigação LGPD | Situação | Ação necessária |
|---|---|---|
| Base legal e finalidade | não documentada no sistema | registrar política e finalidade por tabela |
| Direito de acesso | possível via export | formalizar procedimento |
| **Direito de eliminação** | ❌ botão "Excluir usuário" é placeholder (`AdminUsers.tsx:157-169`); não há rotina de anonimização de lead | implementar `anonymize_lead(lead_id)` com cascata |
| Minimização | ❌ `lia_attendances` com 610 colunas e `raw_payload` completo de Meta/CRM | revisar retenção de payloads brutos |
| Retenção | ❌ `system_health_logs` 2,6 M linhas sem expurgo; logs contêm telefone/e-mail | política de 90 dias + mascaramento |
| Trilha de auditoria | parcial (`lead_enrichment_audit`, `lead_state_events`, `system_health_logs`) | consolidar quem acessou/exportou dado pessoal |
| Transferência internacional | Supabase/Vercel/Meta/Google/OpenAI etc. | mapear no RIPD |
| Export irrestrito | "Exportar Tudo" baixa base completa com JWT de qualquer admin | log de export + confirmação + justificativa |

## 7.4 OWASP Top 10 — avaliação

| Risco | Avaliação | Evidência / mitigação |
|---|---|---|
| A01 Broken Access Control | **Alto** | 158 policies `true`; rotas sem guarda; funções públicas |
| A02 Cryptographic Failures | Baixo | HTTPS ponta a ponta; segredos em env; anon key exposta é por design |
| A03 Injection | Baixo-Médio | PostgREST/params parametrizados; risco residual em funções com SQL dinâmico e `search_path` mutável |
| A04 Insecure Design | Médio | ações destrutivas sem confirmação/rollback (Full Sync, import, merge) |
| A05 Security Misconfiguration | **Alto** | `verify_jwt=false` como padrão global; RLS permissivo |
| A06 Vulnerable Components | Médio | 81 deps npm; sem SCA/Dependabot no repo |
| A07 Auth Failures | Médio | sem MFA para admin; sem política de senha visível; sem timeout de sessão |
| A08 Data/Software Integrity | Médio | deploy sem assinatura/aprovação formal de migração fora da ferramenta |
| A09 Logging & Monitoring | Médio | log abundante, mas sem alerta externo e com PII em claro |
| A10 SSRF | Baixo-Médio | funções que fazem fetch de URL informada (Firecrawl, imagens) devem validar host |

## 7.5 Recomendações imediatas (ordem de execução)

1. Habilitar RLS nas 5 tabelas descobertas e substituir as 158 policies `true` por policies por role (lote por domínio, com testes).
2. Adicionar `SET search_path` às 256 funções (migração mecânica, baixo risco).
3. Implementar `anonymize_lead()` + rotina real de exclusão de usuário (LGPD + remoção do placeholder).
4. Política de retenção: `system_health_logs` 90 dias, `lead_state_events` 180 dias, mascarar telefone/e-mail em log.
5. Guardas de rota para `/painel-comercial`, `/social/*` e utilitários `/admin/*` standalone.
6. Exigir MFA para role `admin` e registrar toda exportação em tabela de auditoria.
7. Revisar as ~40 Edge Functions candidatas a mortas e **remover** as públicas sem uso (superfície de ataque).