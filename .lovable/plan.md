

## Adicionar Módulo de Estratégia de Marketing ao System Prompt do Copilot

### Resumo
Inserir o bloco completo "MÓDULO: ESTRATÉGIA DE MARKETING E FLUXOS COMERCIAIS" no final do `SYSTEM_PROMPT`, antes do fechamento do template literal (linha 1546).

### Mudança

**`supabase/functions/smart-ops-copilot/index.ts`** (linha 1546)

Antes do fechamento `` `; `` na linha 1546, inserir o bloco completo fornecido pelo usuário contendo:

- Contexto real da base (25.067 leads em negociação, funil estagnados ~19k)
- Tabela de upsell por stage com LTV médio
- Perfis de cliente por anchor_product
- Estrutura obrigatória de fluxo estratégico (segmento, mensagem, sequência WA, query, métricas)
- 6 fluxos pré-construídos com queries SQL prontas:
  1. Reativação de estagnados
  2. Upsell Scanner → Impressora (E1→E3)
  3. Upgrade de equipamento
  4. Recompra de insumos
  5. Leads B2B alto valor
  6. Nurture via conteúdo
- Lógica de segmentação em 4 camadas
- Regras de projeção de receita
- Métricas proativas com gatilhos automáticos

O bloco tem ~400 linhas de prompt. Será adicionado como seção final do system prompt, mantendo tudo que já existe intacto.

### Arquivo afetado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/smart-ops-copilot/index.ts` | ~400 linhas adicionadas ao SYSTEM_PROMPT antes do ``;`` na linha 1546 |

### Deploy
Após editar, deploy da edge function `smart-ops-copilot` e teste com "monta uma estratégia para impressora" para validar que o Copilot usa os fluxos pré-construídos.

