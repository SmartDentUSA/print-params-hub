## Objetivo

A SPIN deve seguir EXATAMENTE a rota do formulário `# - Formulário exocad I.A.` — um roteiro consultivo que perfila o lead em 9 pontos canônicos. O vendedor deve ser instruído a fazer essas perguntas na ordem, marcando o que já está declarado e o que falta descobrir.

## Roteiro canônico (extraído do form, ordem fixa)

| # | Etapa | Pergunta canônica | Coluna fonte no lead |
|---|---|---|---|
| 1 | Perfil | Área de atuação + especialidade | `area_atuacao`, `especialidade` |
| 2 | 1·Captura | Hoje você digitaliza suas moldagens? Qual scanner? | `equip_scanner`, `scanner_marca`, `tem_scanner`, `como_digitaliza`, `sdr_scanner_modelo` |
| 3 | 2·CAD | Qual software CAD você utiliza? | `software_cad`, `equip_cad` |
| 4 | 3·Impressão (hardware) | Qual impressora você utiliza no dia a dia? | `equip_impressora`, `impressora_modelo` |
| 5 | 3·Impressão · **Modelos** | Imprime modelos? Com qual resina? | `imprime_modelos` |
| 6 | 3·Impressão · **Placas miorrelaxantes** | Imprime placas? Com qual resina? | `imprime_placas` |
| 7 | 3·Impressão · **Resinas longa duração / elementos** | Imprime elementos de longa duração? Com qual resina? | `imprime_resinas_ld` |
| 8 | 3·Impressão · **Guias cirúrgicas** | Imprime guias? Com qual resina? | `imprime_guias` |
| 9 | Recorrência | Consumo mensal de resina + fornecedor atual | `sdr_resina_atual`, `resina_consumo_mensal_estimado`, `sdr_usa_resina_smartdent` |

Cada linha vira um item do roteiro com status:
- **✅ declarado** → mostra o valor (vendedor confirma e aprofunda)
- **❓ a descobrir** → vendedor DEVE fazer a pergunta exata

Valores `"não"`, `"não imprimo"`, `"ainda não digitalizo"`, vazio/`—` contam como **`a descobrir` com hipótese "ainda não faz internamente"**, e viram automaticamente gancho de ofensiva (substituir terceirização / iniciar fluxo).

## Mudanças

Arquivo principal: `supabase/functions/_shared/workflow-diagnosis.ts`.

### 1. Novo helper `buildLeadProfilingRoteiro(lead)`

Retorna `Array<RoteiroItem>` com os 9 itens fixos na ordem do form. Cada item:

```ts
{ ordem, etapa_label, titulo, pergunta_canonica, status: 'declarado'|'a_descobrir'|'gap_ofensivo',
  valor_declarado?: string, hipotese?: string, gancho_smartdent?: string }
```

Regra `gap_ofensivo`: quando o valor declarado é negação (regex `^(não|nao|ainda não|n\/a|nenhum|—)`), tratar como gap com hipótese `"depende de terceiros / não internalizou"` e `gancho_smartdent` apontando a resina/equipamento Smart Dent da etapa (lookup leve em constante).

### 2. `SpinBriefing` ganha `roteiro_perfilamento: RoteiroItem[]`

Populado pelo seed. Substitui a lane "consumíveis" anterior (que era genérica) por essa estrutura canônica — mais rica e ancorada no form real.

### 3. `seedSpinBriefing` reescrito para a ordem do roteiro

- `perguntas_spin.situacao`: passa a ser **TODOS** os itens `a_descobrir` do roteiro, na ordem, prefixados com `Etapa <X>:` e usando a pergunta canônica do form. (Antes era 1 pergunta; agora é a sequência consultiva.)
- `perguntas_spin.problema`: 1-2 perguntas derivadas dos `gap_ofensivo` mais relevantes ("você imprime placas com resina importada — qual o custo/mês e a previsibilidade?").
- `perguntas_spin.implicacao` e `necessidade`: mantêm a lógica atual (peças/mês, hora-cadeira, fechamento com produto-alvo + pacote de resinas).
- Mantém intent-leak guard + bugfixes anteriores.

### 4. Renderers

- `renderDiagnosisHTML`: novo bloco **🧩 ROTEIRO DE PERFILAMENTO (siga nesta ordem)** ANTES de "PERGUNTAS SPIN". Cada linha: `<n>. <Etapa> — <título>: ✅ <valor>` ou `<n>. <Etapa> — <título>: ❓ <pergunta canônica>` (ou `⚠️ gap: <hipótese>`).
- `renderDiagnosisWhatsApp`: versão compacta — só lista os 3 primeiros `a_descobrir`/`gap_ofensivo`.
- `renderDiagnosisForPrompt`: linha `Roteiro: <n itens declarados / m a descobrir / k gaps>` para o cognitive prompt.

### 5. Prompt do LLM (`enrichSpinWithLLM`)

Injeta o roteiro completo como bloco `ROTEIRO DE PERFILAMENTO (rota fixa, não reordene)`. Regras duras adicionais:

- **Proibido** pular ou reordenar itens do roteiro.
- LLM só pode REFINAR o tom de cada pergunta (manter a essência); a quantidade e ordem de perguntas de SITUAÇÃO **deve bater** com a quantidade de itens `a_descobrir`+`gap_ofensivo`.
- Para itens `✅ declarado`, gerar 0 perguntas — apenas reconhecimento ("ok, vi que você já roda Medit i700 + exocad…").

### 6. Memória

Atualizar `mem/smart-ops/seller-note-workflow-diagnosis.md` com:
- Existência do **Roteiro Canônico de Perfilamento** (9 pontos da exocad I.A.) como espinha dorsal da SPIN.
- Regra: perguntas de SITUAÇÃO derivam 1-para-1 dos itens `a_descobrir`/`gap_ofensivo`; ordem do form é imutável.
- Negações no formulário viram `gap_ofensivo` (ofensiva comercial), não silêncio.

## Validação

1. `bellychristinne@gmail.com` (scanner=não, impressora=não, alvo BLZ INO 100 Plus): roteiro deve mostrar item 2 como ❓ (pergunta de scanner), itens 3-8 como ❓/gap, e 4 perguntas de SITUAÇÃO na ordem do form.
2. `clakira05@hotmail.com` (alvo RayShape EdgeMini, sem stack): roteiro com itens 4-8 todos ❓; pergunta N nomeia EdgeMini + pacote de resinas.
3. `danilohen@gmail.com` (stack rico): a maioria dos itens vira ✅ com valor; perguntas de SITUAÇÃO só nos pontos realmente em aberto + 1-2 de aprofundamento nos gaps.

## Fora de escopo

- Não mexer no `resolveIntent`, mapping editor, ou estrutura do formulário em si.
- Não criar tabela nova — o roteiro é derivado em tempo de execução das colunas já existentes do lead.
