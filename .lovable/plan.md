## Diagnóstico do caso `bellychristinne@gmail.com`

A nota tem 4 problemas que se somam:

1. **Leak de intent escapou** — declarou impressora=`não` e scanner=`não`, mas a Stack mostra `1 · Captura/Scanner` porque o sdr_field `SDR: Interesse em Scanner: Scanner Intraoral INO100` entrou como stack. O guard atual tokeniza com stopwords (`scanner`, `intraoral`, `3d`, `ino`) e o valor sobra com tokens curtos que não batem com `intent`.
2. **`[object object]` nas perguntas P** — `live.document_extracts[].key_specs` contém objetos, não strings; `String(ds)` quebra.
3. **Pergunta S inutilizável** — `"Hoje você já está rodando SDR: Interesse em Scanner: Scanner Intraoral INO100. Como esse fluxo está performando?"` dumpou o valor cru do sdr_field na pergunta.
4. **Tudo orbita equipamento** — o forte da Smart Dent são **resinas e consumíveis** (recorrência). A SPIN não pergunta nada sobre resina, lavagem, cura, perfis, consumo mensal.

## Mudanças

Arquivo: `supabase/functions/_shared/workflow-diagnosis.ts` (+ memória).

### 1. Intent-leak guard mais forte (bug #1)

No bloco de `intent-leak guard`:

- **Antes do tokenize**, marcar como leak qualquer entrada cujo `value` (não só `field`/`field_label`) bata com `INTEREST_RE` OU comece com `"SDR:"` / contenha `"interesse em"` / `"busca por"` / `"procurando"`. Esses valores **nunca** representam equipamento instalado.
- Manter o ramo atual (`hitIntent && isInterestField`) como fallback.
- Reduzir stopwords: tirar `scanner`, `impressora`, `intraoral`, `bancada`, `resina`, `software`, `3d`, `edge`, `mini` da lista — eles são justamente o sinal de overlap. Manter só conectivos.

### 2. Sanitizar `key_specs` (bug #2)

Em `seedSpinBriefing`, no loop de `live.document_extracts`:

```ts
const docSpecs = live.document_extracts
  .flatMap((d) => d.key_specs || [])
  .map((s) => typeof s === "string" ? s : (s?.label || s?.name || s?.spec || ""))
  .filter((s) => s && s.length > 2)
  .slice(0, 2);
```

Mesmo tratamento em qualquer lugar que joga `document_extracts` no prompt.

### 3. Pergunta S não pode usar `s.value` cru (bug #3)

Quando `targetNotOwned` for falso e cair no ramo `stackResumo`, gerar a partir de uma versão **sanitizada** do valor: se `value` casa `INTEREST_RE`/começa com `SDR:`, ignorar essa entrada para o resumo (já é leak); caso reste vazio, cair no ramo "ausente/terceirizada".

### 4. SPIN ancorada no fluxo digital 7×3 (pedido anterior)

Já detalhado e mantém: novo `WORKFLOW_PAIN_MAP` por etapa, geração de S/P/I/N iterando o fluxo, novo `diagnostico_fluxo` no briefing, prompt LLM exigindo prefixo `"Etapa <label>:"` em cada pergunta, renderização do diagnóstico etapa-a-etapa.

### 5. Lane obrigatória de **resinas e consumíveis** (pedido novo)

Nova constante `CONSUMABLES_BY_STAGE` (resinas + lavagem + cura + acabamento) com perguntas-padrão sobre **consumo, perfil de aplicação, protocolo e fornecedor atual**. Sempre que:

- a intent for impressora/scanner/CAD/curso, **OU**
- o stack contiver qualquer item de impressão (`etapa_3_impressao`),

adicionar **pelo menos 2 perguntas obrigatórias** sobre consumíveis na lista P:

- "Etapa Resinas/Consumíveis: qual resina você usa hoje e em quais indicações (modelo, provisório, guia, splint)? Quanto consome por mês?"
- "Etapa Pós-impressão: como você faz lavagem (qual álcool/solvente) e cura (qual dispositivo e tempo)? Tem protocolo validado pelo fabricante da resina?"

E **1 pergunta N de cross-sell de consumível**:

- "Se a gente fechar a etapa de `<etapa-alvo>` com `<produto>` + protocolo Smart Dent de resinas validadas, faz sentido alinharmos também o pacote inicial de consumíveis?"

Adicionar no `WORKFLOW_PAIN_MAP` da etapa 3/4/5 que `solucao_smartdent` inclua **resinas Smart Dent** explicitamente (não só hardware), porque é onde mora a recorrência.

Atualizar o prompt do LLM com regra dura:
> "Toda nota SPIN DEVE conter ao menos 1 pergunta sobre RESINAS (qual usa, consumo mensal, indicação) e 1 sobre PROTOCOLO (lavagem/cura). Consumíveis são o core de recorrência da Smart Dent — sem isso o briefing está incompleto."

### 6. Memória

Atualizar `mem/smart-ops/seller-note-workflow-diagnosis.md`:

- Regra do "SPIN ancorada no fluxo 7×3" (pedido anterior).
- **Regra de consumíveis**: toda SPIN com intent/stack de hardware exige perguntas de resina + protocolo + consumo mensal. Recorrência é prioridade.
- **Intent-leak por valor**: valores começando com `SDR:` ou casando `interesse em|busca por|procurando` nunca contam como stack.

## Validação

1. `bellychristinne@gmail.com`:
   - Stack vazia (scanner=não, impressora=não).
   - `diagnostico_fluxo`: `[1] alvo (BLZ INO 100 Plus)`, demais ausentes.
   - Sem `[object object]`. Pergunta S formato "Etapa Scanner: como você captura hoje — moldagem analógica, lab terceirizado?".
   - Pelo menos 1 pergunta sobre resina e 1 sobre protocolo, mesmo o alvo sendo scanner (impressão é etapa imediata adjacente).
2. `clakira05@hotmail.com` (RayShape EdgeMini): perguntas N citam resina Smart Dent + EdgeMini juntas.
3. `danilohen@gmail.com`: stack rico permanece intacto; perguntas de resina não duplicam o que já está declarado.

## Fora de escopo

- `resolveIntent`, mapping tables, live API permanecem como estão.
- UI admin não muda além da renderização da nota.
