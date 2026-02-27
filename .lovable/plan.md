

## Diagnóstico: Formatação de Telefone Inconsistente em Múltiplas Edge Functions

### Problema Identificado

Encontrei **3 problemas concretos** após auditar todo o código:

1. **`smart-ops-cs-processor`** (automações): Usa `lead.telefone_normalized` direto no `chat` SEM nenhuma sanitização. Se o campo no banco tem `+5571992182843` (como encontrei em vários leads), envia com `+` e o WaLeads rejeita silenciosamente (retorna 201 mas não entrega).

2. **Dados inconsistentes no banco**: O campo `telefone_normalized` na tabela `lia_attendances` tem formatos misturados:
   - `5519992612348` (sem +)
   - `+5571992182843` (com +)
   - `999990000` (sem código de país)

3. **`dra-lia-whatsapp`**: Faz `phoneDigits.replace(/^\+/, "")` mas `phoneDigits` já veio de `.replace(/\D/g, "")` que remove tudo não-numérico — ou seja, o `+` já foi removido antes. Funciona, mas é confuso.

### Plano de Correção

#### 1. Criar helper compartilhado `formatPhoneForWaLeads` em `_shared/sellflux-field-map.ts`
- Remover todos caracteres não-numéricos
- Garantir que o número tenha o código do país `55` se tiver ≥10 dígitos sem ele
- Retornar apenas dígitos, sem `+`

#### 2. Corrigir `smart-ops-cs-processor/index.ts` (linha 171)
- Aplicar o novo helper ao `chatPhone` antes de enviar

#### 3. Corrigir `smart-ops-send-waleads/index.ts` (linha 114)
- Substituir `phone.replace(/^\+/, '')` pelo helper compartilhado

#### 4. Corrigir `dra-lia-whatsapp/index.ts` (linhas 354, 383)
- Substituir a lógica duplicada pelo helper compartilhado

#### 5. Normalizar dados existentes no banco
- Atualizar `telefone_normalized` em `lia_attendances` para remover `+` de todos os registros que o contenham

