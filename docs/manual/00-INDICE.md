# Manual Técnico — SmartDent Revenue Intelligence OS

Documentação de engenharia reversa completa. Base: código do repositório e introspecção do banco de produção (projeto Supabase `okeogjgqijbfkudfjadz`), coletados em 2026-08-03.

## Como usar este manual

| Perfil | Comece por |
|---|---|
| Novo desenvolvedor | 01 → 02 → 05 → 06 |
| UX / Product | 02 → 03 → 09 (jornadas) → 11 |
| QA | 03 → 10 → 09 |
| Arquiteto / DevOps | 01 → 04 → 05 → 08 |
| Segurança | 07 → 04 |
| Analista de negócio / Suporte | 02 → 03 → 06 |

## Índice

| # | Capítulo | Conteúdo |
|---|---|---|
| 01 | [Arquitetura e Visão Geral](01-arquitetura.md) | Stack, topologia, ambientes, deploy, resumo executivo |
| 02 | [Mapa de Navegação e UX](02-mapa-navegacao-ux.md) | Rotas, menus, grupos, permissões, análise UX por tela |
| 03 | [Catálogo de Abas, Ferramentas e Botões](03-abas-ferramentas-botoes.md) | Capítulo por aba: objetivo, fluxo, botões, campos, erros |
| 04 | [Banco de Dados](04-banco-de-dados.md) | Inventário, domínios, DER, triggers, funções, views, riscos |
| 05 | [Integrações, APIs e Edge Functions](05-integracoes-apis.md) | 238 functions, webhooks, crons, provedores externos |
| 06 | [Regras de Negócio](06-regras-de-negocio.md) | Golden Rule, identidade, taxonomia, LTV, workflow 7×3 |
| 07 | [Segurança](07-seguranca.md) | Auth, RLS, LGPD, OWASP, achados e recomendações |
| 08 | [Performance](08-performance.md) | Queries lentas reais, índices, frontend, cache |
| 09 | [QA e Jornadas do Usuário](09-qa-e-jornadas.md) | Casos de teste, critérios de aceite, jornadas |
| 10 | [Status das Funcionalidades](10-status-funcionalidades.md) | Ativo / parcial / morto / legado, matriz de funcionalidades |
| 11 | [Plano de Melhorias e Roadmap](11-melhorias-roadmap.md) | Priorização por impacto/esforço/risco/valor |
| 12 | [Diagramas](12-diagramas.md) | Mermaid: arquitetura, DER, fluxos, sequência, estados |
| — | [Checklist de Auditoria](13-checklist-auditoria.md) | Cobertura item a item |
| — | [Inventário de Edge Functions (CSV)](edge-functions-inventario.csv) | 237 funções × 11 colunas |

## Convenções e limites desta documentação

- Toda afirmação de estado ("ativo", "morto", "vazio") vem de leitura de código, `pg_catalog`/`cron.job` ou contagem real de linhas. Onde a evidência é indireta, o texto diz explicitamente **(inferido)**.
- Referências de código usam `caminho/arquivo.ts:linha`.
- O sistema é chamado internamente de **Sistema B** (backend operacional/CRM); **Sistema A** é o catálogo público de produtos consumido por API.
- Não foi executado nenhum teste de carga, pentest ou instrumentação de runtime; as seções de performance e segurança baseiam-se em `pg_stat_statements`, linter do Supabase e leitura de código.
- [17 — Mapeamento Funcional Completo (Enterprise)](./17-mapeamento-funcional-completo.md) — especificação de todos os módulos do menu: objetivo, componentes, how-to, dados/integrações
