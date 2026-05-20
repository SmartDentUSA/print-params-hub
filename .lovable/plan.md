## Objetivo
No modal de Agendamento de Treinamento, trocar os campos texto livre **Área de Atuação** e **Especialidade** por **dropdowns** padronizados com as mesmas opções dos formulários de interesse / SDR CRM. Aplicar tanto no participante principal quanto nos acompanhantes. Se a ficha do lead já trouxer um valor (mesmo fora da lista), exibi-lo selecionado.

## Opções (constantes compartilhadas)

**AREA_ATUACAO_OPTIONS**
- Clínica ou Consultório
- Laboratório de Prótese
- Radiologia Odontológica
- Planning Center
- Empresa de Alinhadores
- Gestor de Rede de Clínicas
- Gestor de Franquias
- Central de Impressões
- Educação

**ESPECIALIDADE_OPTIONS** (deduplicadas)
- Clínico Geral
- Dentística
- Implantodontista
- Protesista
- Ortodontista
- Odontopediatria
- Periodontista
- Radiologista
- Cirurgia Buco Maxilo Facial
- Técnico em Radiologia
- Técnico em Prótese Odontológica
- Endodontista
- Outros

> Removidas as duplicatas presentes no enunciado (Dentística, Ortodontista, Periodontista apareciam duas vezes).

## Arquivos a alterar

1. **Novo:** `src/lib/dentalTaxonomy.ts`
   - Exporta `AREA_ATUACAO_OPTIONS` e `ESPECIALIDADE_OPTIONS` (label + value já normalizado em UPPERCASE para casar com os valores existentes no banco vindos do SDR/forms).
   - Helper `findOption(options, raw)` que faz match case-insensitive / com/sem acento, devolvendo a opção canônica ou `null`.

2. **`src/components/smartops/EnrollmentModal.tsx`**
   - Substituir os 2 `<Input>` de `especialidade` e `area_atuacao` no card do participante por `<Select>` (shadcn) usando as constantes.
   - No mapa de acompanhantes, trocar o `<Input>` de `especialidade` (linha ~669) por `<Select>`.
   - Preservar valor pré-existente: se `formData.especialidade` / `area_atuacao` não bater com nenhuma opção, renderizar a opção atual como item adicional no topo (rotulada com `(atual)`) para não perder o dado salvo na ficha do lead.
   - Manter o ícone `Check` verde quando o valor veio prefilled (`prefilledFields.has(...)`).
   - O autopreenchimento existente (vindo de `result.especialidade` / `result.area_atuacao` no `handleLeadSelect`) continua funcionando — apenas garantir normalização leve via `findOption` antes de setar no state, caindo para o valor cru se não houver match.

3. **Acompanhantes — Área de Atuação**
   - Hoje os acompanhantes só têm campo `especialidade`. Se quiser, posso adicionar também `area_atuacao` por acompanhante — não estava no schema atual. **Pergunta implícita:** manter só especialidade nos acompanhantes (como hoje) ou incluir área também? Plano atual: **somente especialidade** nos acompanhantes (mínima mudança), já que o pedido fala em padronizar dropdown da especialidade lá.

## Fora de escopo
- Migração de dados existentes em `lia_attendances.area_atuacao` / `especialidade` (mantém valores legados; o Select os mostra como "(atual)").
- Edge function `smartops-gerar-doc-turma` — não precisa mudar, continua lendo as mesmas colunas.
- Outros lugares do app que usam esses campos.

## Validação
- Abrir modal de agendamento sem lead → dropdowns vazios funcionam.
- Selecionar lead com `especialidade = "ORTODONTISTA"` → vem pré-selecionado com check verde.
- Selecionar lead com valor legado fora da lista (ex.: `"Cirurgião"`) → aparece como opção "(atual) Cirurgião" selecionada, sem perda de dado.
- Adicionar acompanhante e escolher especialidade → salva corretamente em `smartops_enrollment_companions.especialidade`.
