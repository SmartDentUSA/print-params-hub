

# Plano: Corrigir Rota de Suporte Tecnico (Rota 4)

## Problema

Quando o usuario seleciona o card "Preciso de uma Maozinha" (Rota 4/suporte), a mensagem enviada e "Preciso de suporte com Impressora 3D". Esta mensagem:

1. **Nao e reconhecida como suporte** — nenhum regex em `SUPPORT_KEYWORDS` captura "preciso de suporte com [equipamento]"
2. **`topic_context === "support"` e ignorado** — o backend nunca verifica esse valor para iniciar o fluxo de ticket. So "commercial" e "parameters" sao tratados
3. **O printer dialog captura a mensagem** — detecta "Impressora" e entra no fluxo de vendas (brand→model→resin)
4. **Seller handoff e acionado** — marca `temperatura_lead: "quente"`, classificando como oportunidade de venda
5. **Produto de interesse e detectado** — se o usuario menciona "MiiCraft" etc., o NLP salva como `produto_interesse`, reforçando a classificacao errada

O lead Renato entrou como "lead quente com interesse em MiiCraft" quando na verdade queria suporte tecnico.

## Correcoes

### Arquivo: `supabase/functions/dra-lia/index.ts`

**Correcao 1 — Ampliar `SUPPORT_KEYWORDS`** (~linha 243)
Adicionar padroes que capturam frases comuns do fluxo de suporte:
```
/(preciso|quero|necessito|gostaria).{0,15}(de )?(suporte|ajuda técnica|assistência)/i,
/(abrir|criar|gerar).{0,10}(chamado|ticket|ocorrência)/i,
/(chamar|acionar).{0,10}(o )?(suporte|técnico)/i,
/preciso de (uma )?m[ãa]ozinha/i,
```

**Correcao 2 — Tratar `topic_context === "support"` ANTES do printer dialog** (~linha 4730)
Adicionar verificacao explicita: se `topic_context === "support"`, forcar entrada no fluxo de ticket (bypass `isSupportQuestion`). Isso garante que a selecao do card sempre entre na rota correta, independente do texto da mensagem.

```typescript
// BEFORE line 4730 (isSupportQuestion check):
if (topic_context === "support" && !supportFlowStage) {
  // Force support flow — user selected the support card
  // (same logic as isSupportQuestion block, starts select_equipment)
}
```

**Correcao 3 — Skip printer dialog quando `topic_context === "support"`** (~linha 4802)
Adicionar `topic_context === "support"` na condicao de skip do printer dialog, junto com "commercial":
```typescript
const dialogState = (topic_context === "commercial" || topic_context === "support" || skipDialog)
  ? { state: "not_in_dialog" as const }
  : await detectPrinterDialogState(...);
```

**Correcao 4 — Skip seller handoff quando rota e suporte** (~linha 1904)
Quando `rota_inicial_lia === "support"`, nao marcar como `temperatura_lead: "quente"` nem `ultima_etapa_comercial: "contato_feito"`. O lead de suporte nao e oportunidade de venda.

**Correcao 5 — Skip produto_interesse detection quando rota e suporte**
Na funcao de NLP que detecta produtos (~linha 1393), verificar se `topic_context === "support"` e pular a deteccao de `produto_interesse` para nao classificar o equipamento com problema como interesse de compra.

## Resultado Esperado
- Card "Preciso de uma Maozinha" → entra direto no fluxo de ticket tecnico (selecionar equipamento → diagnostico → resumo → ticket criado → notificacao WhatsApp)
- Lead NAO e marcado como "quente" nem "oportunidade de venda"
- Equipamento mencionado no suporte NAO e salvo como `produto_interesse`
- O printer dialog (brand→model→resin) e completamente ignorado na rota de suporte

