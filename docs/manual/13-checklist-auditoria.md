# 13 — Checklist de Cobertura da Auditoria

| Requisito | Onde | Status |
|---|---|---|
| Mapa navegável completo | 02.1–02.4 | ✅ |
| Todas as rotas (65) | 02.2 | ✅ |
| Menus, grupos e permissões por role | 02.3–02.4 | ✅ |
| Capítulo por aba/seção (34 seções admin + social + públicas) | 03 | ✅ |
| Botão a botão: ação, tabelas, validações, erros, criticidade | 03.0–03.38 | ✅ (ações principais; ações triviais de CRUD agrupadas) |
| Campos e validações das telas-chave | 03 | ✅ |
| Inventário de banco (tabelas, views, funções, triggers, índices, policies) | 04.1 | ✅ |
| Domínios de dados e DER | 04.2, 12.2 | ✅ |
| Triggers e funções críticas | 04.5–04.6 | ✅ |
| Riscos estruturais e backup | 04.7–04.8 | ✅ |
| Todas as Edge Functions | `edge-functions-inventario.csv` (237) + 05 | ✅ |
| Integrações externas, auth e falhas típicas | 05.1–05.2 | ✅ |
| Crons (83 ativos) | 05.4 | ✅ |
| Camada Vercel / SEO proxy | 05.5 | ✅ |
| Regras de negócio (Regra de Ouro, identidade, taxonomia, 7×3, receita, LTV) | 06 | ✅ |
| Concorrência e locks | 06.12 | ✅ |
| Segurança: auth, RLS, LGPD, OWASP | 07 | ✅ |
| Performance com dados reais | 08 | ✅ |
| QA: jornadas e 20 casos de teste | 09 | ✅ |
| Status ativo/parcial/morto | 10 | ✅ |
| Placeholders e dívida técnica | 10.2–10.3 | ✅ |
| Plano de melhorias priorizado + roadmap | 11 | ✅ |
| Diagramas (arquitetura, DER, sequência, estados, decisão) | 12 | ✅ |

## Lacunas conhecidas desta documentação

1. **Campo a campo** de todas as 265 tabelas e das ~610 colunas de `lia_attendances` não foi transcrito; documentei os grupos semânticos e as colunas de negócio. Extração completa cabe num CSV gerado por introspecção, se desejado.
2. **Todos os botões de CRUD repetitivo** (Salvar/Cancelar/Excluir em ~30 telas) foram descritos por padrão, não linha por linha.
3. Não houve **teste de carga, pentest nem auditoria de acessibilidade automatizada** — as avaliações de segurança/performance/UX são baseadas em código, linter, `pg_stat_statements` e heurísticas.
4. Números de volumetria são um retrato de 2026-08-03; algumas estatísticas de tabelas vazias podem estar desatualizadas por falta de `ANALYZE` recente.