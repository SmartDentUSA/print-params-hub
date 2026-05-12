## Objetivo

Após criar/atualizar a Pessoa no PipeRun (`updatePersonFields` em `_shared/piperun-hierarchy.ts`), enviar 4 custom fields adicionais com a resposta dos formulários:

| Campo PipeRun | ID | Tipo | Fonte CDP |
|---|---|---|---|
| Mapeamento Scanner formulário | `772727` | Texto | `scanner_modelo` → fallback resposta crua de `form_data` (chaves: `tem_scanner`, `scanner`, `marca_scanner`, `modelo_scanner`) |
| Mapeamento Impressora formulário | `772728` | Texto | `impressora_modelo` → fallback resposta crua de `form_data` (chaves: `tem_impressora`, `impressora`, `marca_impressora`, `modelo_impressora`) |
| ÁREA DE ATUAÇÃO | `673900` | Única escolha | `area_atuacao` (normalizado UPPER) — valor precisa bater com enum |
| Especialidade principal | `445631` | Múltipla escolha | `especialidade` (UPPER, array) — valor precisa bater com enum |

Os 2 primeiros são texto livre → enviam exatamente a resposta crua do formulário (com fallback `tem_X = "Sim/Não" + modelo`).
Os 2 últimos são enums no PipeRun — precisam ser normalizados para os valores aceitos:

```text
ÁREA DE ATUAÇÃO (673900):
  RADIOLOGIA ODONTOLÓGICA | CLÍNICA OU CONSULTÓRIO | LABORATÓRIO DE PRÓTESE |
  PLANNING CENTER | EMPRESA DE ALINHADORES | GESTOR DE REDE DE CLÍNICAS |
  GESTOR DE FRANQUIAS | CENTRAL DE IMPRESSÕES | EDUCAÇÃO | SEM INFOMAÇÃO

Especialidade principal (445631):
  CLÍNICO GERAL | DENTÍSTICA | IMPLANTODONTISTA | PROTESISTA | ODONTOPEDIATRIA |
  ORTODONTISTA | PERIODONTISTA | RADIOLOGISTA | ESTOMATOLOGISTA |
  CIRURGIA BUCO MAXILO FACIAL | TÉCNICO EM RADIOLOGIA |
  TÉCNICO EM PRÓTESE ODONTOLÓGICA | OUTRA
```

Se o valor do CDP não bater com o enum (após normalização tira-acento+UPPER+match fuzzy), envia o texto cru no observation e loga `piperun_person_enum_unmatched` em `system_health_logs` em vez de quebrar o PUT.

## Implementação

### 1. `supabase/functions/_shared/piperun-field-map.ts`
Adicionar constantes:
```ts
export const PESSOA_CUSTOM_FIELD_IDS = {
  SCANNER_FORM: 772727,
  IMPRESSORA_FORM: 772728,
  AREA_ATUACAO: 673900,
  ESPECIALIDADE: 445631,
} as const;

export const PIPERUN_AREA_ATUACAO_ENUM = [...];
export const PIPERUN_ESPECIALIDADE_ENUM = [...];
```
+ helper `matchEnum(value, enumList)` (normaliza acento/caixa, retorna canônico ou null).

### 2. `supabase/functions/_shared/piperun-hierarchy.ts → updatePersonFields`
Construir `personCustomFields` a partir do `lead`:

- **Scanner (772727)**: prioridade `scanner_modelo` → `tem_scanner + " — " + scanner_modelo` → varredura recursiva em `form_data` por chaves sinônimas (mesma lógica do `mapAttendanceToDealCustomFields`).
- **Impressora (772728)**: idem com `impressora_modelo` / `tem_impressora`.
- **Área (673900)**: `matchEnum(lead.area_atuacao, PIPERUN_AREA_ATUACAO_ENUM)`.
- **Especialidade (445631)**: `matchEnum(lead.especialidade, PIPERUN_ESPECIALIDADE_ENUM)`. Como é múltipla escolha, enviar como array `[valor]`.

Se houver custom fields montados, anexar ao payload do PUT como hash:
```ts
updatePayload.custom_fields = { "772727": "...", "772728": "...", "673900": "...", "445631": ["..."] }
```
(Formato hash já é o aceito pelo PipeRun — mesmo padrão usado em `customFieldsToHashMap` para Deals.)

Retry minimal (`{name, emails, phones}`) já existente preservado: se o PUT completo falhar 422, loga `piperun_person_customfield_rejected` com a chave problemática e reenvia sem custom_fields.

### 3. Backfill
Estender `piperun-person-contact-backfill/index.ts` para também publicar esses 4 custom fields na pessoa (mesmo helper). Permite reprocessar leads recentes (incluindo `l.franca11@gmail.com`) sem recriar Deal.

### 4. Memória
Atualizar `mem/integration/piperun-person-contact-enrichment.md` com os 4 IDs de Pessoa e a regra de matching de enum.

## Arquivos alterados

- `supabase/functions/_shared/piperun-field-map.ts` — IDs + enums + matcher
- `supabase/functions/_shared/piperun-hierarchy.ts` — `updatePersonFields` injeta custom_fields
- `supabase/functions/piperun-person-contact-backfill/index.ts` — replica no backfill
- `mem/integration/piperun-person-contact-enrichment.md` — documentar IDs

## Validação

1. Reprocessar `l.franca11@gmail.com` via backfill.
2. Conferir card da Pessoa no PipeRun: 4 campos preenchidos.
3. Validar logs `piperun_person_resync_ok`; sem `piperun_person_customfield_rejected`.
4. Testar lead novo de formulário → confirmar populado no primeiro PUT.

## Fora de escopo

- Custom fields 546566/546567 (Tem impressora/Tem scanner — Única escolha SIM/NÃO): podem entrar num passo 2 se necessário.
- Sincronização reversa (PipeRun → CDP).
- Mexer em custom fields de Deal/Empresa.
