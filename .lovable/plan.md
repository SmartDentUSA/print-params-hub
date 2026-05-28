## Problema observado

No diagnóstico de `clakira05@hotmail.com`:

- Formulário: `# - Impresoras - Smart Dent` / Campanha `RayShape Edge Mini`
- Equipamentos declarados: **Impressora: não, Scanner: não**
- Mesmo assim a nota afirma: "Cláudio é um implantodontista que **já possui a RayShape EdgeMini**" e mostra `Stack: 3 · Impressão 3D + 6 · Cursos`.

Causa: o pipeline está tratando o **produto-alvo do formulário** (intenção de compra) como se fosse parte do **stack instalado** do lead. Hoje:

- `resolveIntent` lê `form_name` / `produto_interesse` corretamente como intenção.
- Mas `seedSpinBriefing` mistura `stack_atual + intent` em uma única frase ("estrutura em X. interesse em Y"), e o LLM, vendo a intenção como contexto, transforma em "já possui".
- Pior: respostas de formulário do tipo "qual impressora você busca?" estão sendo capturadas como `sdr_field` da etapa 3, populando `stack_atual` com o produto-alvo — então até a heurística passa a achar que o lead tem a RayShape.

Resultado: SPIN parte de premissa falsa, dores e perguntas viram irrelevantes ("como gerencia envio de arquivos para sua EdgeMini hoje?" — ele nem comprou).

## Objetivo

Separar de forma rígida **STACK INSTALADO** (o que o lead já tem) de **ALVO DE COMPRA** (o que ele quer adquirir, vindo do formulário/campanha) em toda a nota SPIN, e nunca deixar o LLM afirmar posse do produto-alvo.

## Mudanças

Arquivo único: `supabase/functions/_shared/workflow-diagnosis.ts` (+ atualização em `mem/smart-ops/seller-note-workflow-diagnosis.md`).

### 1. Guard de "intent-leak" no stack

Em `diagnoseLead`, depois de calcular `intent`:

- Se `intent.target_stage` e `intent.target_cell` existem, varrer `stack` e remover entradas cujo `value` normalizado bata com `intent.matched_product_label` ou com `intent.produto` (substring match em ambos os sentidos) E cujo `field` venha de campo semanticamente de "interesse" — tratar como leak: padrão regex no `field`/`field_label` (`interesse|busca|deseja|quer|procura|alvo|gostaria`). Isso protege casos em que o mesmo formulário pergunta tanto "qual você usa" quanto "qual você quer".
- Adicionalmente, se `equip_printer_model`/`equip_scanner_model` (ou equivalentes do mapping) vierem com valor `não/nao/n/a`, marcar a célula correspondente como **explicitamente vazia** num novo `Set<string> declaredEmpty` — e remover do `stack` qualquer entrada da mesma célula proveniente de campo não-equipamento.

### 2. Novo campo no diagnóstico

Adicionar em `WorkflowDiagnosis`:

```ts
declared_empty_cells: string[]; // ex: ["etapa_3_impressao::impressora_3d", "etapa_1_scanner::scanner_intraoral"]
```

Popular a partir do `declaredEmpty` acima. Usado pelo seed e pelo prompt do LLM.

### 3. Reescrita da `situacao` no seed

Em `seedSpinBriefing`, separar três blocos:

- `stackTxt` = stack real (após filtros)
- `gapTxt` = quando `declared_empty_cells` inclui a célula-alvo: "ainda sem `<etapa>` instalado"
- `goalTxt` = `intent` sempre rotulado como **"busca adquirir"** / **"avaliando comprar"**, nunca "interesse em" solto

Frase final:

- Se `declared_empty_cells` contém a célula da intent → "`<role>` sem `<etapa-alvo>` instalado, avaliando adquirir `<produto-alvo>`. Stack atual: `<stackTxt|—>`."
- Senão se há stack → "`<role>` com `<stackTxt>`, avaliando adquirir `<produto-alvo>`."
- Senão → "`<role>` sem stack declarada, avaliando adquirir `<produto-alvo>`."

### 4. Dores e implicações reorientadas quando lead NÃO tem o alvo

Quando `intent.target_stage` está em `declared_empty_cells` (ou stack vazio na célula-alvo):

- Adicionar dor padronizada: `"Sem <etapa-alvo> próprio, depende de terceiros / não executa esse passo do fluxo"` com evidência `"declarou não possuir <equipamento>"`.
- Implicação: `"Custo de terceirização e perda de margem por peça enquanto não internaliza <etapa>"`.
- Remover dores tipo "subutilização do <produto-alvo>" / "EdgeMini parada" que pressupõem posse.

### 5. Perguntas SPIN reorientadas

Quando alvo não está instalado:

- `situacaoQ`: "Hoje, como você resolve `<etapa-alvo>` — terceiriza, manda para laboratório ou não faz?"
- `problemaQ` extra (primeiro da lista): "O que te levou a olhar especificamente para `<produto-alvo>` agora?"
- Manter `always_require` e `required_products` como perguntas adicionais.
- Remover qualquer pergunta que assuma posse ("como tem gerenciado o envio para sua `<produto-alvo>`?").

### 6. Prompt do LLM (`enrichSpinWithLLM`)

Acrescentar no bloco `DADOS DO LEAD`:

```
- Células declaradas SEM equipamento: <lista de declared_empty_cells em PT-BR ou "nenhuma">
- Status do produto-alvo: <"AINDA NÃO POSSUI — busca adquirir"> | <"já possui (consta no stack)">
```

E em `REGRAS DURAS` adicionar:

- "**NUNCA** afirme ou implique que o lead já possui o produto-alvo se ele consta como AINDA NÃO POSSUI. Use sempre verbos como 'avalia adquirir', 'busca comprar', 'está pesquisando'."
- "Quando o produto-alvo ainda não foi adquirido: perguntas de SITUAÇÃO devem mapear COMO ele resolve hoje (terceirização, ausência do passo); perguntas de PROBLEMA devem investigar gatilho de compra, alternativas avaliadas e critério de decisão."
- "Stack atual no prompt é a ÚNICA fonte do que o lead JÁ TEM. Produto-alvo nunca é stack."

### 7. Memória

Atualizar `mem/smart-ops/seller-note-workflow-diagnosis.md` com a regra:

> **Intent-vs-Stack Separation**: produto vindo de `form_name`/`produto_interesse`/campanha é SEMPRE alvo de compra. `declared_empty_cells` marca células onde o lead respondeu explicitamente "não" em equipamento. SPIN nunca pode afirmar posse de produto-alvo quando célula está em `declared_empty_cells` ou ausente do stack.

## Validação

1. Re-rodar diagnóstico para `clakira05@hotmail.com`:
   - `declared_empty_cells` deve conter `etapa_3_impressao::*` e `etapa_1_scanner::*`.
   - `situacao` deve dizer "avaliando adquirir RayShape EdgeMini" sem "já possui".
   - Stack não pode incluir "RayShape" / "EdgeMini".
   - Pergunta `S` deve ser sobre como ele resolve impressão hoje (terceiriza?), não "como gerencia envio para sua EdgeMini".
2. Re-rodar `bonfanteatendimento@gmail.com` (GlazeON) — comportamento de specs/anti-alucinação preservado.
3. Re-rodar `danilohen@gmail.com` (stack rico, sem leak) — sem regressão; stack continua aparecendo intacto.

## Fora de escopo

- Não mexer em `resolveIntent`, mapping tables, ou Sistema A live (já corretos).
- Não mexer no frontend admin/UI — apenas o conteúdo do diagnóstico muda.
