## Adicionar telefone no card da Lista de Leads

**Arquivo**: `src/components/SmartOpsLeadsList.tsx` (componente `LeadRow`, ~linha 354)

A linha do email (`intel-lr-email`) será modificada para mostrar o telefone logo abaixo, quando presente. Sem CSS novo — usa o mesmo estilo `intel-lr-email` para herdar cor/tamanho.

```tsx
<div className="intel-lr-info">
  <div className="intel-lr-name">{lead.nome}</div>
  <div className="intel-lr-email">
    {lead.email && !lead.email.includes("placeholder") ? lead.email : (lead.empresa_nome || lead.area_atuacao || "—")}
  </div>
  {lead.telefone_normalized && (
    <div className="intel-lr-email">📱 {lead.telefone_normalized}</div>
  )}
</div>
```

`telefone_normalized` já está incluído no `select` (linha 560), então não precisa mexer em backend nem query. Apenas frontend.
