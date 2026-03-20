

# Fix: "📣 Última conversão" visível para todos os leads

## Problema

O rótulo `📣 Última conversão` só aparece na linha da tabela de Deals (linha 1079) quando `d.origem` tem valor. Leads com deals mas sem `origem` preenchido no deal não exibem nada. E leads sem deals não entram nesse bloco.

## Correção

Adicionar a origem do lead na **meta row** do hero (linha 276-285), usando cascata de campos do lead:

```typescript
const meta = [
  ld.cidade && ld.uf && `🏙️ ${ld.cidade}, ${ld.uf}`,
  ld.data_primeiro_contato && `📅 Primeiro: ${formatDate(ld.data_primeiro_contato)}`,
  ld.updated_at && `🔄 Último: ${formatDate(ld.updated_at)}`,
  ld.total_deals && `💼 ${ld.total_deals} deal${ld.total_deals !== 1 ? "s" : ""}`,
  // NOVO: origem sempre visível no hero
  (() => {
    const src = ld.origem || ld.source_reference || ld.original_source || ld.piperun_origin_name;
    return src && src !== "unknown" ? `📣 ${src}` : null;
  })(),
  person?.nome && `👤 ${person.nome}`,
  ld.area_atuacao,
  ld.especialidade && `🦷 ${ld.especialidade}`,
  ld.piperun_stage_name && `📍 ${ld.piperun_stage_name}`,
].filter(Boolean) as string[];
```

## Escopo

- 1 bloco de ~4 linhas adicionado na meta row
- Apenas `LeadDetailPanel.tsx`
- Zero alteração no card, timeline, ingest-lead ou integrações
- A exibição dentro da tabela de Deals permanece inalterada

