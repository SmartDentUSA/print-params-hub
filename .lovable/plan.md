# Normalização inteligente de campos Meta Lead Ads

Meta manda field names com acentos + `_` e values com `_` no lugar de espaços (`área_de_atuação: clínica_ou_consultório`, `como_digitaliza_suas_moldagens?: medit_`, `tem_impressora?: não,_ainda_não_tenho`). Hoje `smart-ops-ingest-lead` e `smart-ops-meta-lead-webhook` gravam esses valores crus — só casam se a chave for `area_atuacao` sem acento. Resultado: `especialidade` 0%, `tem_scanner`/`tem_impressora` 12,5%.

Vamos consertar em três frentes: (1) leitura tolerante das chaves Meta, (2) canonicalização determinística dos valores em 4 dicionários, (3) backfill histórico.

## 1. Leitura tolerante (key normalization)

Novo helper `_shared/meta-field-utils.ts` com `pickMetaField(fmap, ...aliases)` que:

- Normaliza chave: NFD → strip diacríticos → lower → troca `_` e `-` por espaço → colapsa espaços → tira `?`/`:`.
- Faz o mesmo com os aliases antes de comparar.
- Retorna `raw` já com underscores→espaço (para o value casar nos dicionários abaixo).

Aliases usados no webhook + ingest-lead + backfill:

- **area_atuacao**: `area de atuacao`, `area atuacao`, `area`, `atuacao`, `segmento`, `atua como`, `qual sua area de atuacao`, `qual area`.
- **especialidade**: `especialidade`, `specialty`, `especialidade odontologica`, `qual sua especialidade`.
- **como_digitaliza** (scanner): `como digitaliza`, `como digitaliza suas moldagens`, `scanner`, `scanner intraoral`, `qual scanner`, `qual seu scanner`, `possui scanner`, `tem scanner`.
- **tem_impressora**: `tem impressora`, `possui impressora`, `impressora`, `impressora 3d`, `qual impressora`, `impressoes 3d`, `qual sua impressora`.

## 2. Canonicalização determinística (4 dicionários)

Estender `_shared/dental-taxonomy.ts` + espelhar em `src/lib/dentalTaxonomy.ts`:

### 2a. Área de atuação (enum fechado, 9)
CLÍNICA OU CONSULTÓRIO · LABORATÓRIO DE PRÓTESE · RADIOLOGIA ODONTOLÓGICA · PLANNING CENTER · EMPRESA DE ALINHADORES · GESTOR DE REDE DE CLÍNICAS · GESTOR DE FRANQUIAS · CENTRAL DE IMPRESSÕES · EDUCAÇÃO.

Fuzzy: "clinica", "consultorio", "clinica odontologica" → CLÍNICA OU CONSULTÓRIO · "lab", "laboratorio", "protetico" → LABORATÓRIO DE PRÓTESE · "radiologia", "raio x" → RADIOLOGIA ODONTOLÓGICA · "planning" → PLANNING CENTER · "alinhador(es)" → EMPRESA DE ALINHADORES · "rede de clinicas" → GESTOR DE REDE · "franquia(s)" → GESTOR DE FRANQUIAS · "central de impressao/oes" → CENTRAL DE IMPRESSÕES · "educacao", "professor", "docente", "universidade" → EDUCAÇÃO. Sem match → `null`.

### 2b. Especialidade (enum fechado, 13, com OUTROS)
CLÍNICO GERAL · DENTÍSTICA · IMPLANTODONTISTA · PROTESISTA · ORTODONTISTA · ODONTOPEDIATRIA · PERIODONTISTA · ENDODONTISTA · RADIOLOGISTA · CIRURGIA BUCO MAXILO FACIAL · TÉCNICO EM RADIOLOGIA · TÉCNICO EM PRÓTESE ODONTOLÓGICA · OUTROS.

Fuzzy: "clinico"/"generalista"→CLÍNICO GERAL · "dentistica"→DENTÍSTICA · "implanto(dontia)"→IMPLANTODONTISTA · "protesista"/"protese"/"protetico"→PROTESISTA · "ortodontia"/"ortodontista"→ORTODONTISTA · "odontopediatra(ia)"→ODONTOPEDIATRIA · "periodontia"→PERIODONTISTA · "endo(dontia)"→ENDODONTISTA · "radiologista"/"radiologia"→RADIOLOGISTA · "buco"/"cbmf"/"cirurgia oral"→CIRURGIA BUCO MAXILO FACIAL · "tec(nico) radiologia"→TÉCNICO EM RADIOLOGIA · "tpd"/"tec(nico) protese"→TÉCNICO EM PRÓTESE ODONTOLÓGICA. Sem match → OUTROS.

### 2c. Scanner / `como_digitaliza` (enum aberto — dicionário novo)
Novo `SCANNER_OPTIONS` com a lista completa que você mandou (Medit i500/i600/i700/i700 Wireless/i900, BLZ INO200/INO100 Plus/Leap 500, Sirona Omnicam/Omnicam AF/Primescan, iTero E1/E2/5D/5D Plus/Lumina, Aoralscan 2/3/3 Wireless/Elite/Elite Wireless, Straumann Virtuo Vivo/Sirius/SIRIOS X3, Carestream CS 3600/3700/3800, 3DISC Heron, Planmeca Emerald/Emerald S, Helios 500, Panda P3/P2, Aidite Rapid 5, Eagle IOS, Runyes IOS 3.0) + valor especial `NÃO DIGITALIZO` + `OUTROS`.

Regra de match:
1. Se resposta bater com `nao ainda nao digitalizo`/`nao`/`ainda nao`/vazio → `NÃO DIGITALIZO`, `tem_scanner=false`.
2. Senão, procurar por marca+modelo: `medit`+dígito → "Medit i{N}"; `itero`+termo → "Align iTero {…}"; `aoralscan`+termo → "Shining 3D Aoralscan {…}"; `omnicam`/`primescan` → Sirona; `cs\s?3[678]00` → Carestream CS 3x00; `ino200|ino100|leap` → BLZ; `virtuo|sirius|sirios` → Straumann; `emerald` → Planmeca; `helios` → Helios 500; `panda\s?p[23]` → Panda; `rapid\s?5` → Aidite; `eagle` → Eagle IOS; `runyes` → Runyes IOS 3.0; `heron` → 3DISC Heron IOS.
3. `medit_` só (sem dígito) → "Medit i500" **não** — assumir "Medit" genérico? Não: sem modelo específico, gravar em `scanner_marca="Medit"` e `como_digitaliza="Medit"` (rótulo pai). Se não encontrar em nenhuma marca conhecida → `OUTROS` + preserva raw em `scanner_marca_raw`.
4. Setar `tem_scanner=true` quando qualquer marca/modelo bateu.

Campos gravados: `como_digitaliza` (canônico), `scanner_marca` (fabricante), `tem_scanner` (bool).

### 2d. Impressora / `tem_impressora` (enum de marcas, aberto)
Novo `PRINTER_BRAND_OPTIONS`: RAYSHAPE · PHROZEN · ANYCUBIC · FLASHFORGE · WANHAO · MIICRAFT · MOONRAY · SPRINTRAY · STRAUMANN · FORMLABS · STRATASYS · ELEGOO · ENVISIONTEC · 3DSYSTEMS · PIONEXT · CREALITY · ACKURETTA · PHOTOCENTRIC · KULZER · WILCOS · OUTRAS · `NÃO TENHO`.

Regra:
1. `nao ainda nao tenho`/`nao`/`ainda nao`/vazio → `NÃO TENHO`, `tem_impressora=false`.
2. Match por token contra a lista (normalizado); primeiro hit vence. `straumann`/`straumman`/`straumman` cai em STRAUMANN.
3. Sem match → `OUTRAS`; raw preservado em `impressora_modelo` para inspeção manual.
4. `tem_impressora=true` sempre que houver marca.

Campos gravados: `impressora_marca` (novo? verificar — se não existir, grava em `impressora_modelo`), `tem_impressora` (bool), preserva raw.

## 3. Aplicação nos pontos de escrita

- `supabase/functions/_shared/dental-taxonomy.ts`: adicionar `SCANNER_OPTIONS`, `PRINTER_BRAND_OPTIONS`, `canonicalizeArea`, `canonicalizeSpecialty`, `canonicalizeScanner(raw) → {value, brand, has}`, `canonicalizePrinter(raw) → {brand, has, raw}`.
- `supabase/functions/_shared/meta-field-utils.ts` (novo): `normalizeMetaKey`, `pickMetaField`, `unslugValue` (troca `_` por espaço).
- `smart-ops-meta-lead-webhook/index.ts`: usar `pickMetaField` no `fields` (linhas ~181-200) para achar `area_atuacao`/`especialidade`/`tem_scanner`/`tem_impressora`; aplicar as 4 canonicalizações antes do POST para ingest-lead. Popular `como_digitaliza` explicitamente.
- `smart-ops-ingest-lead/index.ts` linhas 488-489, 560/888/1008 + bloco que grava `tem_scanner`/`tem_impressora`/`como_digitaliza`/`scanner_marca`/`impressora_modelo`: canonicalizar antes do `coalesce`.
- `meta-lead-ads-backfill/index.ts` linhas 225-226/237/327-328: mesma canonicalização + adicionar leitura de `como_digitaliza_suas_moldagens` via `pickMetaField`.
- `smart-ops-sellflux-webhook/index.ts` (155/159) e `smart-ops-sellflux-sync/index.ts` (79): canonicalizar área/especialidade antes do upsert.

Nenhuma mudança no `raw_payload` nem em `lead_form_submissions.form_data` — resposta original permanece para auditoria.

## 4. Backfill histórico (via supabase--insert)

Uma migration de dados (idempotente) rodando na ordem:

1. `UPDATE lia_attendances SET area_atuacao = <canonical>` por CASE regex; só onde `merged_into IS NULL` e valor difere.
2. `UPDATE lia_attendances SET especialidade = <canonical>` idem; sem match → OUTROS.
3. `UPDATE lia_attendances SET como_digitaliza=<canonical>, scanner_marca=<brand>, tem_scanner=<bool>` por CASE nos padrões acima.
4. `UPDATE lia_attendances SET impressora_modelo=<brand>, tem_impressora=<bool>` idem.
5. Log em `system_health_logs` (source `taxonomy_backfill_2026_07_21`) com contagens por bucket.

## 5. Re-sync PipeRun Person (opcional, aprovação separada)

`smart-ops-lia-assign` já envia CFs 673900/445631 via `buildPersonFormCustomFields`. Depois do backfill, disparo `piperun-person-contact-backfill` filtrando `updated_at > now() - interval '10 min' AND piperun_id IS NOT NULL` para propagar os valores canônicos aos CRM Persons alterados. Só executo se você autorizar — não faz parte do plano base.

## Detalhes técnicos

- Normalização puramente rule-based (sem LLM), determinística, idempotente.
- Regex construída com `\b` e permite plural/gênero. Sem falso-positivo cruzado (ex.: "radiologia" na área ≠ especialidade — testado por ordem de match dentro de cada dicionário).
- `pickMetaField` roda em O(k) com k = número de aliases; keys pré-normalizadas.
- Zero mudança de schema. Se `impressora_marca` não existir na `lia_attendances`, gravo a marca em `impressora_modelo` (que hoje já recebe modelo/marca livre).

## Não alterar

- Front `TaxonomySelect` (já lida com legado).
- Contrato de `smart-ops-ingest-lead` (mesmos campos, só valores mais limpos).
- Golden Rule, CommercialIntentGuard, merge policies.
- `raw_payload` / `form_data` — auditoria preservada.

## Entregáveis

1. `_shared/dental-taxonomy.ts` + `_shared/meta-field-utils.ts` + `src/lib/dentalTaxonomy.ts` atualizados.
2. 5 edge functions ajustadas (webhook, ingest-lead, backfill, sellflux-webhook, sellflux-sync).
3. Backfill SQL com contagens em `system_health_logs`.
4. Amostragem: 20 leads recentes pós-deploy mostrando 4 campos canônicos preenchidos.
