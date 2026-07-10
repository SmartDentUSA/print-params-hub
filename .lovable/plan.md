
## Diagnóstico dos dois leads que você mandou

Confirmei no CDP — ambos existem e foram enriquecidos hoje, mas nenhum foi reativado para Vendas:

| Lead | Canonical ID | Deal PipeRun | Funil atual | Última atualização |
|---|---|---|---|---|
| **Marcelo Correa** (`mcnetto245@gmail.com`, +55 32 98812-4435) | `deb697f5…6056c` | **null** (nunca teve deal) | 72938 · Etapa 00 – Novos | 10/07 12:50 |
| **Renan Balsanelli Moreira** (`renanbmoreira@icloud.com` novo / `renanbm_007@hotmail.com` canônico, +55 47 98417-6717) | `cfaba858…913d52` | 46234182 | 72938 · Apresentação/Visita – Estag | 10/07 12:10 |

Ambos entraram pelo Meta Lead Ads hoje. Nos `system_health_logs` o único evento associado é `lead_enrichment_merge` — não há `estagnados_reactivation_triggered`, nem `hard_dedupe_universal`, nem chamada ao `lia-assign`.

## Causa raiz (novo bug, diferente do anterior)

O `smart-ops-ingest-lead` tem **duas rotas de deduplicação** e o escape hatch de Estagnados só foi implementado em uma delas:

1. **Rota A — early dedupe** (linhas 189–735): dispara quando o `platform_lead_id` bate na tabela de "hard/family dedupe universal". Marca `deferredRedeliveryCanonicalId` e cai no bloco 530–735, onde o escape hatch existe (linha 641).
2. **Rota B — enrichment merge** (linhas ~1200–1420): dispara quando o lead é encontrado por identity match (email/telefone) mais tarde no fluxo. Registra `lead_enrichment_merge` no health log, atualiza campos, no máximo posta um note via `smart-ops-deal-form-note`. **NÃO tem escape hatch para Estagnados** e **nunca invoca `lia-assign`**.

Marcelo e Renan caíram na Rota B hoje. Renan porque o email novo (`renanbmoreira@icloud.com`) difere do canônico (`renanbm_007@hotmail.com`) e o match foi por telefone → identity match, não hard-dedupe. Marcelo porque provavelmente o `platform_lead_id` novo (`120243772941110470`) não bateu na dedupe universal e o match foi por email/telefone.

Resultado: leads em Estagnados que preenchem novo lead ad passam pela Rota B, ficam enriquecidos no CDP mas o deal no PipeRun **permanece parado em Estagnados**.

## O que fazer

### Fix único no `smart-ops-ingest-lead/index.ts`

Após o bloco de update do enrichment merge (após linha 1372, dentro da rota B), adicionar espelho do escape hatch da Rota A:

```
Se existingLead.piperun_pipeline_id === 72938 (Estagnados)
   E formName está presente
   E conversionKey foi calculado (indica nova submissão real)
Então:
   - inserir system_health_logs { error_type: 'estagnados_reactivation_triggered' }
   - invocar smart-ops-lia-assign com:
        lead_id: existingLead.id
        trigger: "sdr_captacao_reativacao"
        new_conversion_confirmed: true
        conversion_key
        form_name
        source
        force: true
   - fora desse if, mantém o fluxo atual (deal-form-note, intelligence score etc.)
```

O `lia-assign` já tem toda a lógica necessária (branch `estagnDeal && force_new_deal !== true`, linhas 3386–3510): fecha o deal de Estagnados como "Perdido — Novo interesse", cria novo em Vendas com round-robin fresh, respeita Golden Rule (não toca Vendas 18784 nem CS 83896/102893/104500).

### Caso especial do Marcelo (piperun_id = null)

Marcelo está com `piperun_stage_name = 'Etapa 00 – Novos'` mas `piperun_id = null` — sinal de que **nunca teve deal criado no PipeRun** e o stage está no CDP por herança de um sync antigo. Para ele, o `lia-assign` já vai criar o Person + Deal do zero em Vendas (round-robin), porque não há deal Estagnados para fechar. O mesmo fix cobre este caso.

### Reprocessamento manual dos 2 leads após o deploy

Depois do deploy, invocar `smart-ops-lia-assign` diretamente para os 2 lead_ids com o payload acima, sem esperar nova submissão. Isso resolve os dois casos que você mandou.

### Auditoria pós-fix

Consultar `system_health_logs.error_type = 'estagnados_reactivation_triggered'` nas 24h seguintes; esperado sair de 0 para dezenas/dia conforme volume de re-entrega Meta em leads Estagnados.

## Garantias mantidas

- Vendas (18784) e CS (83896/102893/104500) permanecem intocáveis — Golden Rule dentro do `lia-assign` re-consulta o PipeRun antes de qualquer ação.
- Leads fora de Estagnados continuam com o comportamento atual (enrichment CDP + note opcional).
- Sem mexer no schema, no ingest de leads novos ou no sync do PipeRun.

## Arquivos que serão alterados

- `supabase/functions/smart-ops-ingest-lead/index.ts` — adicionar bloco de reativação após linha 1372.
- `mem/architecture/estagnados-redelivery-reactivation.md` — atualizar para documentar que a régua vale para as duas rotas de dedupe (early e enrichment-merge).
