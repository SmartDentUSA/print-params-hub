

# Exibir "Última conversão" na sub-row de Deals

## Mudança

**Arquivo**: `src/components/smartops/LeadDetailPanel.tsx` (linhas 1003-1011)

Adicionar o campo `origem` do snapshot na sub-row existente, com o label **"Última conversão"** em vez de "Origem".

A condição da sub-row passa de `(d.person_id || d.company_id)` para `(d.person_id || d.company_id || d.origem)`.

Resultado visual:
```
📣 Última conversão: Formulário 01 - TikTok · 👤 Pessoa: #44194603 · 🏢 Org: #12345
```

Nenhuma mudança no backend.

