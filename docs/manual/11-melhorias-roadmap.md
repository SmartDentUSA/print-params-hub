# 11 — Plano de Melhorias e Roadmap

Escalas: Impacto/Valor 1–5 · Esforço P(equeno)/M(édio)/G(rande) · Risco de não fazer 1–5.

## 11.1 Backlog priorizado

| # | Item | Área | Impacto | Esforço | Risco se não fizer | Valor de negócio |
|---|---|---|---|---|---|---|
| 1 | Corrigir merge de identidade (só documento válido; B2B≠B2C) + limpar 122 merges errados e 158 self-merges | Dados | 5 | M | 5 | LTV e histórico confiáveis; evita falar com cliente errado |
| 2 | Substituir 158 policies `USING (true)` e habilitar RLS nas 5 tabelas | Segurança | 5 | G | 5 | evita vazamento de base de clientes |
| 3 | `SET search_path` nas 256 funções | Segurança | 4 | P | 4 | fecha vetor de hijack |
| 4 | Trocar `select('*')` + índices parciais em `lia_attendances` | Performance | 5 | M | 3 | telas 3–10× mais rápidas |
| 5 | Retenção de logs (90 dias) + mascaramento de PII | Custo/LGPD | 4 | P | 4 | −1,5 GB, conformidade |
| 6 | Exclusão/anonimização real de usuário e lead | LGPD | 4 | M | 5 | atende direito de eliminação |
| 7 | Testes Deno das 6 funções de regra de negócio | Qualidade | 4 | M | 4 | evita regressão em receita |
| 8 | Confirmação + dry-run em ações destrutivas (Full Sync, import, export) | UX/Risco | 4 | P | 4 | evita incidente operacional |
| 9 | Completar cobertura de SKU (28% → >90%) | Comercial | 4 | M | 3 | mix de produto e comissão corretos |
| 10 | Guardas de rota em `/painel-comercial`, `/social/*`, utilitários `/admin` | Segurança | 3 | P | 3 | |
| 11 | Reorganizar menu Smart Ops (24 itens → subgrupos + busca ⌘K) | UX | 4 | M | 2 | reduz tempo de tarefa |
| 12 | Vertical split de `lia_attendances` (payloads em satélite) | Arquitetura | 5 | G | 3 | destrava escala |
| 13 | Materializar `v_lead_timeline` | Performance | 3 | M | 2 | ficha do lead instantânea |
| 14 | Remover ~40 Edge Functions e 3 telas mortas | Manutenção | 3 | P | 3 | menos superfície de ataque |
| 15 | Decidir Realtime: reativar seletivamente ou remover o código | Manutenção | 3 | M | 2 | fim de comportamento fantasma |
| 16 | Unificar filas de WhatsApp em uma tabela | Arquitetura | 3 | M | 3 | fonte única de verdade |
| 17 | Implementar os 3 botões-placeholder ou removê-los | UX | 3 | M | 2 | fim de promessa quebrada |
| 18 | Alertas externos (WhatsApp/Slack) para eventos críticos de `system_health_logs` | Observabilidade | 4 | P | 4 | detecção em minutos, não em horas |
| 19 | MFA para admin + auditoria de export | Segurança | 4 | M | 4 | |
| 20 | Runbook de restauração e rollback testado | Continuidade | 4 | M | 5 | |
| 21 | Reescalonar janela de cron 02:00–04:30 | Performance | 2 | P | 2 | |
| 22 | Import dinâmico das libs de export/editor | Frontend | 3 | P | 1 | bundle menor |
| 23 | Virtualização de tabelas longas + skeletons | UX | 3 | M | 2 | |
| 24 | Acessibilidade: `aria-label` em ícones-botão, foco visível, contraste | UX/Legal | 3 | M | 2 | |
| 25 | Tokens semânticos de cor no lugar de classes hardcoded | UX | 2 | M | 1 | |
| 26 | Decompor componentes >1.000 linhas | Manutenção | 3 | G | 2 | |
| 27 | SCA/Dependabot + política de atualização das 81 deps | Segurança | 3 | P | 3 | |

## 11.2 Roadmap sugerido

**Fase 1 — Confiança (2–3 semanas)**: itens 1, 3, 5, 8, 18, 20.
**Fase 2 — Segurança e conformidade (3–4 semanas)**: itens 2, 6, 10, 19, 27.
**Fase 3 — Performance (2–3 semanas)**: itens 4, 13, 21, 22.
**Fase 4 — Qualidade e limpeza (3–4 semanas)**: itens 7, 14, 15, 16, 17.
**Fase 5 — Escala e experiência (contínuo)**: itens 9, 11, 12, 23, 24, 25, 26.

## 11.3 Quick wins (≤1 dia cada)

`SET search_path` em lote · expurgo de logs · confirmação nos botões de sync/import · `aria-label` nos ícones-botão · remoção das 3 telas mortas · desabilitar `piperun-api-test` (já feito) · reescalonar 3 crons noturnos · import dinâmico de `exceljs`/`jspdf`/`docx`.