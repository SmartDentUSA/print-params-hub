# Nova aba: Normalizar Campos (Reativações & Fluxo)

## Objetivo
Higienizar em massa qualquer campo de qualificação em `lia_attendances`, mesclando valores legados/variações no **canônico oficial — que é a mesma lista `options` cadastrada nos formulários do sistema** (`smartops_form_fields`). Nada de canônico paralelo.

## Fonte da verdade: os próprios formulários
Cada campo mesclável reusa exatamente as `options` cadastradas em `smartops_form_fields` para aquele `db_column`. Quando há mais de uma variação de rótulo/pergunta no banco (auditadas agora), a plano abaixo define qual lista prevalece.

### Lista atual de campos com opções nos formulários (extraída de `smartops_form_fields`)

**1. `area_atuacao`** (9 valores — 100% consistente entre formulários)
```
CLÍNICA OU CONSULTÓRIO
LABORATÓRIO DE PRÓTESE
RADIOLOGIA ODONTOLÓGICA
PLANNING CENTER
EMPRESA DE ALINHADORES
GESTOR DE REDE DE CLÍNICAS
GESTOR DE FRANQUIAS
CENTRAL DE IMPRESSÕES
EDUCAÇÃO
```

**2. `especialidade`** (13 valores)
```
CLÍNICO GERAL, DENTÍSTICA, IMPLANTODONTISTA, PROTESISTA, ORTODONTISTA,
ODONTOPEDIATRIA, PERIODONTISTA, ENDODONTISTA, RADIOLOGISTA,
CIRURGIA BUCO MAXILO FACIAL, TÉCNICO EM RADIOLOGIA,
TÉCNICO EM PRÓTESE ODONTOLÓGICA, OUTROS
```

**3. `equip_scanner`** (modelo/marca do scanner intraoral — lista longa, tratada como canônico oficial):
`Não ainda não digitalizo` + os 36 modelos Medit/BLZ/Sirona/iTero/Shining/Straumann/Dexis/3DISC/Planmeca/Helios/Panda/Aidite/Eagle/Runyes + `Outros`.

**4. `scanner_modelo`** (scanner de bancada): `MEDIT T-SERIES, 3SHAPE E-SERIES, SHINING, ACCURA, DENTAL WINGS, IDENTICA, OUTRO`. Uma segunda variante lista modelos intraorais (`MEDIT i700 …`) — vamos consolidar como **canônico único = lista de bancada**, e mover intraoral pra `equip_scanner`.

**5. `impressora_modelo`** (marca de impressora 3D)
```
Ainda não imprimo nada, RAYSHAPE, PHROZEN, ANYCUBIC, FLASHFORGE, WANHAO,
MIICRAFT, MOONRAY, SPRINTRAY, STRAUMAN, FORMLABS, STRATASYS, ELEGOO,
ENVISIONTEC, 3DSYSTEM, PIONEXT, CREALITY, ACKURETTA, PHOTOCENTRIC,
KULZER, WILCOS, OUTRAS
```
(uma variação usa `ASIGA / NÃO TENHO` — vamos absorver `ASIGA` na lista canônica e mapear `NÃO TENHO → Ainda não imprimo nada`).

**6. `tem_scanner`** (5 valores, adotando a variante estendida do formulário)
```
AINDA NÃO DIGITALIZO AS MOLDAGENS
SIM, COM SCANNER INTRAORAL PRÓPRIO
SIM, COM SCANNER INTRAORAL ALUGADO
SIM, COM SCANNER INTRAORAL DA RADIOLOGIA PARCERIA
SIM, COM SCANNER INTRAORAL DA LABORATORIO PARCEIRO
SIM, COM SCANNER DE BANCADA
```

**7. `imprime_guias`** e **`imprime_resinas_ld`** (mesma lista de 8)
```
Não, não imprimo
Sim, com resina Smart Dent
Sim, com resina Yller
Sim, com resina Makertech
Sim, com resina OdontoMega
Sim, com resina FGM
Sim, com outras marcas nacionais
Sim, com resinas importadas
```

**8. `sdr_software_cad_interesse`**
```
exocad Dental CAD, Medit Clic App, BLZ Dental CAD, Outros
```

### Campos SEM opções no formulário → canônico vindo de outra fonte
Alguns campos que você citou não são `select` em `smartops_form_fields` (são texto livre, boolean ou vêm de sistema externo). Para eles a lista canônica é derivada assim:

| Campo | Fonte do canônico |
|---|---|
| `produto_interesse`, `produto_interesse_auto` | valores distintos em `products_catalog.title` + `mapFormToProduct` (`_shared/zernio-field-normalizer.ts`) |
| `funil_crm` / `etapa_crm` / `status_piperun` | `piperun-list-pipelines` (pipelines/stages ao vivo) |
| `proprietario_lead_crm` | `team_members` ativos com `piperun_owner_id` |
| `temperatura`, `real_status`, `prazo_compra`, `tipo_local`, `sdr_completo` | enums já usados no `LeadDetailPanel` (reusar constantes existentes) |
| `uf` | 27 UFs BR (constante) |
| `tem_impressora`, `tem_cad`, `tem_fresadora`, `imprime_modelos`, `imprime_placas` | boolean `SIM / NÃO` |
| `marca_scanner` | mesma lista de marcas de `equip_scanner` (deduzida) |
| `marca_impressora` | mesma lista de marcas de `impressora_modelo` |
| `origem_primeiro_contato` / `form_name` / `utm_campaign` / `cidade` | **NÃO merge automático** — só listar distintos, admin escolhe manualmente pra evitar apagar UTM real |

## UX da aba (`Normalizar Campos`)

Nova tab no `SmartOpsReactivationHub` (`src/components/SmartOpsReactivationHub.tsx`), depois de "Configurações".

Layout:
1. **Dropdown "Campo"** — agrupado como no filtro do painel de leads (Identidade & CRM / Origem & Aquisição / Workflow Digital). Mostra em cada item a origem do canônico (ex.: `área_atuacao · canônico do formulário`).
2. **Tabela de valores atuais** (lida ao vivo de `lia_attendances` com `merged_into IS NULL`):

| Valor atual no banco | Ocorrências | Canônico do sistema | Ação |
|---|---|---|---|
| `clínica_ou_consultório` | 47 | `CLÍNICA OU CONSULTÓRIO ▾` | ☐ selecionar |
| `["IMPLANTODONTISTA"]` | 12 | `IMPLANTODONTISTA ▾` | ☐ |
| `Cargo não informado` | 862 | `— limpar (NULL)` | ☐ |
| `LABORATÓRIO DE PRÓTESE` | 1.204 | (já canônico) | — |

O dropdown de canônico é **populado dinamicamente**: para os 8 campos acima, `SELECT options FROM smartops_form_fields WHERE db_column = X` (fallback pra `_shared/zernio-field-normalizer.ts` quando o formulário ainda não tem esse campo).

3. **Botão "Sugerir automaticamente"** — pré-preenche via slug-match (mesma normalização do `zernio-field-normalizer.ts`).
4. **Barra de ação em lote**: `Atualizar base (N mesclagens marcadas)` → diálogo de confirmação → executa. Feedback com contagem de linhas afetadas por mapping.

## Backend (edge function nova)

`supabase/functions/smart-ops-field-normalize/index.ts`:

- `mode: "list_options"` — retorna canônico oficial: SELECT `options` no `smartops_form_fields` para o `db_column`, deduplicando entre variações de rótulo (união quando divergem, com a lista majoritária como default). Fallback pro normalizer compartilhado.
- `mode: "list_values"` — `SELECT <field>, COUNT(*) FROM lia_attendances WHERE merged_into IS NULL GROUP BY <field>`. Whitelist de colunas hardcoded.
- `mode: "merge"` — recebe `[{from, to}]`, roda `UPDATE lia_attendances SET <field>=to WHERE <field>=from AND merged_into IS NULL`. Log em `system_health_logs`.

## Guardrails
- Whitelist rígida de colunas (`id`, `email`, `phone`, `piperun_id`, `merged_into`, timestamps ficam **fora**).
- Sempre filtra `merged_into IS NULL` (regra Core).
- Não toca PipeRun/Sellflux/Omie — é higiene de CDP. O canônico já casa com o form, então futuras submissões chegam limpas; correção retroativa no CRM continua sendo trabalho dos syncs.
- Campos `origem_primeiro_contato`, `form_name`, `utm_*`, `cidade` são "read-only merge" — só listagem, sem sugestão automática (evita apagar UTM válido).
- Só admin (mesmo gate do hub).

## Arquivos
Criar:
- `src/components/smartops/reactivation/FieldNormalizer.tsx`
- `src/hooks/reactivation/useFieldNormalizer.ts`
- `supabase/functions/smart-ops-field-normalize/index.ts`

Editar:
- `src/components/SmartOpsReactivationHub.tsx` (nova tab + copy)

## Fora de escopo
- Editar valores no PipeRun/Sellflux.
- Edição por lead (fica no LeadDetailPanel).
- Alterar `_shared/zernio-field-normalizer.ts` — se surgir um valor canônico novo, o caminho é editar o formulário em `smartops_form_fields` (fonte da verdade) e a UI reflete automaticamente.
