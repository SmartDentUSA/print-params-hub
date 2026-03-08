

# Unificar Dialog de Detalhes — Aba Leads igual ao Público/Lista

## Problema
A aba **Leads** (`SmartOpsLeadsList.tsx`) usa um dialog próprio com ~60 campos em `EditableDetailSection`, sem numeração e ocultando vazios. A aba **Público/Lista** (`SmartOpsAudienceBuilder.tsx`) tem o dialog completo com Accordion, ~200 campos numerados e vazios visíveis.

## Solução

Substituir o conteúdo do `LeadDetailDialog` em `SmartOpsLeadsList.tsx` para usar o mesmo layout Accordion com `FieldGrid` numerado. Manter os botões Editar/Salvar (modo edição continua usando `EditableDetailSection` como fallback).

### Alterações em `src/components/SmartOpsLeadsList.tsx`:

1. **Importar** `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` e `ScrollArea`
2. **Adicionar** as funções `FieldGrid` e `JsonBlock` (mesma lógica do AudienceBuilder)
3. **Substituir** o corpo do dialog (linhas 530-717) por:
   - Quando `editing === false`: renderizar as 15 seções Accordion com todos os campos numerados (idêntico ao AudienceBuilder)
   - Quando `editing === true`: manter as `EditableDetailSection` existentes para edição inline
4. **Expandir** dialog para `max-w-4xl` e usar `ScrollArea`

### Resultado
- Clicando num lead na aba Leads → mesmo card completo numerado do Público/Lista
- Botão "Editar" alterna para o modo de edição inline existente
- Zero duplicação de lógica de campo entre as duas abas

