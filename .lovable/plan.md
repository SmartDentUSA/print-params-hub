

## Problema: Dados do Formulário Não Chegam ao Card do Lead

### Diagnóstico

O formulário **"# - Formulário exocad I.A."** foi preenchido pelo Thiago às 16:42 UTC de hoje. Os dados **foram capturados** pelo `ingest-lead`, mas parcialmente:

**Campos COM `db_column` → capturados ✅:**
- `nome`, `email`, `telefone_raw`, `area_atuacao`, `especialidade`, `equip_scanner`, `impressora_modelo`

**Campos SEM `db_column` (só `custom_field_name`) → perdidos no `raw_payload.custom_fields` ❌:**
- `software_CAD_utilzado_atualmente` → deveria ir para `software_cad`
- `atualmente_imprimi_modelos_com_a_resina` → sem coluna DB mapeada
- `atualmente_imprimi_placas_miorrelaxantes_com_a_resina` → sem coluna DB mapeada
- `atualmente_imprimi_elementos_dcom_resinae_longa_duracao_com_resina` → sem coluna DB mapeada
- `atualmente_imprimi_guias_cirurgicas_com_resina` → sem coluna DB mapeada

**Campos que NÃO atualizaram (smart merge bloqueou) ⚠️:**
- `impressora_modelo`: form enviou "RAYSHAPE" mas o DB já tinha "BLZ INO200" — o merge default é enrichment-only (só preenche se vazio)

### Causa Raiz

1. **Form fields sem `db_column`**: 5 dos 12 campos do formulário têm apenas `custom_field_name`, então vão para `raw_payload.custom_fields` mas **nunca são extraídos para as colunas reais do lead**
2. **`ingest-lead` não processa `custom_fields`**: A função monta o payload a partir de keys top-level; ignora completamente o objeto `custom_fields` aninhado
3. **Smart Merge bloqueia atualizações**: Campos como `impressora_modelo` e `software_cad` são "enrichment-only" — se já preenchidos, o form não os atualiza. Para formulários, o dado mais recente deveria ganhar

### Correções

#### 1. Atualizar configuração dos campos do formulário (SQL)
- Definir `db_column` para o campo de software CAD: `software_CAD_utilzado_atualmente` → `db_column = 'software_cad'`

#### 2. Melhorar `smart-ops-ingest-lead/index.ts`
- Após montar o payload, verificar se existe `raw_payload.custom_fields` e mapear campos conhecidos para colunas do lead:
  - `software_CAD*` → `software_cad`
  - `*imprimi_modelos*` → `principal_aplicacao` (append "modelos")
  - `*imprimi_placas*` → detectar e enriquecer `principal_aplicacao`
  - `*imprimi_guias*` → detectar e enriquecer `principal_aplicacao`
  - Guardar respostas completas no `raw_payload` para contexto da LIA/Copilot

#### 3. Adicionar campos de equipamento ao `ALWAYS_UPDATE` em `lead-enrichment.ts`
- Quando a fonte é `formulario`/`form`, campos como `impressora_modelo`, `software_cad`, `como_digitaliza`, `equip_scanner` devem ser atualizados (o dado mais recente do form vence)
- Adicionar ao set: `impressora_modelo`, `software_cad`, `como_digitaliza`, `equip_scanner`, `area_atuacao`, `especialidade`

#### 4. Reprocessar o lead do Thiago
- Após o deploy, re-invocar `ingest-lead` com o `latest_payload` que já está salvo no `raw_payload` para preencher os campos faltantes

### Arquivos
1. **SQL migration**: Atualizar `db_column` do campo de software CAD no formulário
2. **`supabase/functions/smart-ops-ingest-lead/index.ts`**: Extrair e mapear `custom_fields` para colunas do lead
3. **`supabase/functions/_shared/lead-enrichment.ts`**: Adicionar campos de equipamento/perfil ao `ALWAYS_UPDATE`

