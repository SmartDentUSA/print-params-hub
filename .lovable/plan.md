## Diagnóstico
A resposta do Copilot está **errada** — os dados existem. Consulta direta ao banco (canônicos, `merged_into IS NULL`):

| Campo | Leads preenchidos |
|---|---|
| `equip_scanner` | **613** |
| `equip_impressora` | 316 |
| `impressora_modelo` | 551 |
| `software_cad` | 48 |

**Top scanners (raw, top 15):**

| Marca / Modelo | Qtd |
|---|---|
| Medit i600 (`i600` + `medit i600` + `Scanner Intraoral i600`) | **266** |
| Medit i700 (`i700` + `medit i700 w`) | **38** |
| 3Shape Trios | 33 |
| Dentsply Sirona Cerec | 28 |
| BLZ INO 200 (SmartDent) | 28 |
| Straumann Virtuo Vivo | 17 |
| Align iTero | 16 |
| Medit (genérico) | 12 |
| Carestream CS 3600/3700 | 18 |
| Scanner Intraoral i500 (Medit) | 10 |
| Straumann Sirius/genérico | 10 |
| Dexis | 4 |

**Lixo capturado pelo backfill** (precisa filtrar): descrições de cursos ("Imersão 3 dias…"), HTML colado de páginas (`<span class="wdyuqq…>`), acessórios (`cabo medit i600`, `jogo de pontas`, `helios 500 scanner` que é insumo), e descrições de produtos químicos. ~80 linhas afetadas.

## Plano (3 passos enxutos)

### 1. RPC `query_scanner_brand_distribution` (fonte de verdade limpa)
Cria uma função SQL que:
- Filtra `merged_into IS NULL` (Core rule).
- Aplica regex de **rejeição** para HTML (`<span|<p|wdyuqq|text-decoration`), cursos (`imersão|curso|treinamento`), acessórios (`cabo|kit|jogo|ponta|insumo|resina|fresa|teflon|fep`), e descrições químicas (`ponto de fulgor|densidade|corrosão`).
- Aplica **normalização de marca** com `CASE` agrupando variações:
  - Medit (i500/i600/i700/i900/T310) → "Medit {modelo}"
  - 3Shape Trios → "3Shape Trios"
  - SmartDent BLZ INO100/INO200/LS100 → "SmartDent BLZ {modelo}"
  - iTero → "Align iTero"
  - Carestream CS 3600/3700 → "Carestream CS{modelo}"
  - Sirona/Cerec → "Dentsply Sirona Cerec"
  - Straumann Virtuo Vivo / Sirius → "Straumann {modelo}"
  - Demais → coluna `outros` agregada
- Retorna `(brand text, model text, lead_count int)` ordenado.
- Análoga para impressora 3D.

### 2. Atualizar Copilot
- Adicionar à toolset do Copilot duas funções: `query_scanner_brand_distribution()` e `query_printer_brand_distribution()`.
- Atualizar prompt do Copilot para: **antes de dizer "dados não disponíveis", consultar SEMPRE essas RPCs** quando a pergunta envolver "marca/modelo de scanner/impressora".
- Adicionar regra de memória: "equip_scanner/equip_impressora/impressora_modelo ESTÃO populados via backfill Piperun deal_items — nunca responder que estão vazios; usar `query_*_brand_distribution`."

### 3. Limpeza pontual dos 80 registros com lixo
Migration que zera `equip_scanner` quando o valor casa com regex de rejeição (HTML, curso, acessório, descrição química). Mantém o histórico em `raw_payload` se necessário.

## Fora de escopo
- Não vou alterar formulários nem fluxo da Dra. LIA agora (sugestões do Copilot eram boas, mas resolvem outro problema; a base atual já tem 613 scanners mapeados).
- Não vou criar campos novos (`scanner_marca`, `scanner_modelo`) — `equip_scanner` + normalização SQL bastam, evita duplicidade.

Posso seguir com os 3 passos?