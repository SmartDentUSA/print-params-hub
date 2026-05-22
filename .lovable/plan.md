## Objetivo

**Zero alucinações no Copilot.** Toda resposta deve ser rastreável a um valor que veio de uma tool. Se a tool não trouxe, o Copilot diz "não tenho esse dado" — nunca inventa, nunca extrapola, nunca interpola.

## Causa raiz das alucinações atuais

1. **Granularidade insuficiente nas tools** — `query_product_owners` devolve só agregados (1ª/última compra, total). Quando o usuário pede ciclos detalhados, o LLM preenche com números fictícios.
2. **System prompt permissivo** — proíbe inventar "nomes e datas" mas não proíbe inventar ciclos, dias entre compras, listas de N transações, percentuais, tendências, projeções.
3. **Sem contrato de renderização** — o LLM monta tabelas livremente; nada o obriga a só renderizar campos que existem no JSON da tool.
4. **Sem auditoria** — não há log de "este número veio desta tool", então alucinações passam silenciosas.

## Plano

### 1. Política global anti-alucinação no system prompt

Adicionar bloco **`# REGRA DE OURO — ZERO ALUCINAÇÃO`** no topo do system prompt do `smart-ops-copilot`:

- Toda métrica, número, data, nome, valor, ranking, percentual, status, tendência, projeção, ciclo, média, mediana → **DEVE** ter origem direta em um campo de retorno de tool desta conversa.
- **PROIBIDO** calcular de cabeça, estimar, extrapolar, "preencher lacunas", projetar para o futuro, inferir ciclos a partir de 2 pontos, somar/dividir mentalmente quando há ferramenta que faz isso.
- **PROIBIDO** inventar registros adicionais para "completar" uma lista (ex.: se a tool devolveu 3 compras, NÃO renderizar 24).
- **PROIBIDO** termos vagos que mascarem invenção: "aproximadamente", "em média X dias" (a menos que venha calculado da tool), "geralmente", "tendência indica".
- Se a informação pedida não estiver em nenhum retorno de tool → resposta obrigatória: **"Não tenho esse dado no sistema. O que posso confirmar é: [campos reais]."**
- Antes de cada número/data/nome → mentalmente identificar a tool de origem. Se não conseguir → não escrever.

### 2. Contrato de renderização (output schema)

Instruir o LLM a tratar o JSON retornado pela tool como **fonte única de verdade**:

- Renderizar tabelas/listas apenas a partir de arrays explícitos do retorno.
- Nº de linhas da tabela = `array.length`. Sem exceções.
- Colunas = subconjunto das chaves do objeto. Nenhuma coluna calculada que não venha da tool.
- Cálculos derivados (soma, média, diff de datas) só se a própria tool já trouxer pré-calculado em um campo `derived_*`.

### 3. Server-side pre-compute (mover cálculo das tools, não do LLM)

Para qualquer agregação que o usuário costuma pedir, o cálculo é feito em SQL/TS dentro do executor, não pelo LLM:

- **`fn_product_owners`** → adicionar opcionalmente `historico_resumo` por cliente: array com até N deals reais (data, valor, itens) já ordenado, mais campo `ciclo_medio_dias` calculado server-side (`null` se < 2 deals). LLM nunca calcula ciclo.
- **Nova `fn_owner_purchase_history(_lead_id)`** → devolve histórico completo cronológico real + `ciclos_dias[]` (diffs reais entre `won_at` consecutivos) + `ciclo_medio_dias`, `ciclo_mediano_dias`. Tudo do banco, zero inferência.
- **`query_deal_history`, `query_sales_summary`, `query_leads_advanced`** → revisar para garantir que somatórios, médias e contagens venham do SQL, não do LLM agregando linhas.

### 4. Tool dispatcher com fallback explícito

No dispatcher (`toolExecutors`):

- Toda tool retorna obrigatoriamente os campos `_source`, `_query_executed`, `_row_count`, `_truncated` (boolean), `_disclaimer` (string vazia ou aviso).
- Se `_row_count === 0` → o retorno inclui `_empty_message` que o LLM **deve** repetir literalmente, sem complementar com "mas geralmente…".

### 5. Reforço por tool no schema (`description` de cada function)

Reescrever a `description` de TODAS as tools do schema com o sufixo padronizado:

> "Renderize EXATAMENTE os campos retornados. Não invente registros, não extrapole valores, não calcule ciclos/médias/projeções fora dos campos `derived_*`. Se vier vazio, repita o `_empty_message`."

### 6. Guard-rail de saída (post-processing leve)

No executor da rota de chat, antes de devolver a resposta do LLM ao usuário:

- Logar em `system_health_logs` (event `copilot_response_audit`) o par `{tools_chamadas, campos_retornados, resposta_final_chars}` para auditoria posterior de alucinação.
- (Opcional fase 2) Heurística simples: se a resposta contém tabela com > N linhas e nenhuma tool retornou array com esse tamanho → flag `suspected_hallucination=true` no log. Não bloqueia, apenas marca.

### 7. Persona update

Alterar a definição da persona do Copilot:
- De "Senior Commercial Manager — Never ask, always execute" 
- Para "Senior Commercial Manager — **Never invent**, always execute com base em dados reais. Prefere dizer 'não tenho esse dado' a fabricar."

Manter a mentalidade executiva, mas honestidade absoluta sobre o que existe ou não no sistema.

### 8. Memórias

- Atualizar **`mem://Core`** adicionando: *"Copilot Zero-Hallucination: toda métrica deve vir de uma tool. Proibido extrapolar, inventar registros ou calcular ciclos sem campo `derived_*` da tool."*
- Criar **`mem://smart-ops/copilot-zero-hallucination-policy`** com a política completa, lista de tools auditadas e contrato de renderização.
- Atualizar **`mem://smart-ops/copilot-product-owners-tool`** com a divisão agregado (`fn_product_owners`) vs. detalhado (`fn_owner_purchase_history`) e proibição explícita de ciclos inventados.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — cria `fn_owner_purchase_history`, atualiza `fn_product_owners` com `historico_resumo` + `ciclo_medio_dias`.
- `supabase/functions/smart-ops-copilot/index.ts` — bloco REGRA DE OURO no system prompt; reescrita das `description` das tools; novo executor + schema da tool de histórico; campos `_source/_row_count/_empty_message` em todos os executors; log de auditoria; persona atualizada.
- `mem/index.md`, `mem/smart-ops/copilot-zero-hallucination-policy.md`, `mem/smart-ops/copilot-product-owners-tool.md`.

## Não muda

- Bloqueio Omie permanece.
- Frontend do Copilot não muda.
- Tools que já são honestas (`get_lead_card`, `query_sales_summary`) ganham apenas os campos meta `_source/_row_count`, sem mudar lógica.

## Resultado esperado

Ao pedir "relatório com ciclo de cada compra dos donos do Edge Mini":
1. Copilot chama `query_product_owners` → tabela agregada honesta.
2. Para detalhar ciclos, chama `query_owner_purchase_history` por cliente.
3. Se cliente tem 1 deal: tabela mostra 1 linha + nota "sem ciclo (apenas 1 compra)". **Nunca** inventa 23 compras adicionais.
4. Se usuário insistir em projeções futuras: "Não tenho previsão estatística no sistema. Posso mostrar histórico real."