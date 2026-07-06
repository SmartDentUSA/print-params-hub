## Formulários em lista (em vez de cards)

Trocar o grid de `FormMetricsCard` no `SmartOpsFormBuilder` por uma **tabela/lista compacta** por grupo de finalidade, preservando toda a informação atual + linhas dos links curtos.

### Estrutura da linha

Uma linha por form, com colunas:

| Col | Conteúdo |
|-----|----------|
| Ativo | Switch (toggleActive) |
| Nome | `form.name` + badge de finalidade + `/f/{slug}` em muted; abaixo, chips `s.smartdent.com.br/{code}` (Form e LP quando existir) com contador de cliques e botão copiar |
| Visitantes | `visitors` + `unique_visitors` únicos + sparkline mini |
| Leads | `leads` + `% preench.` |
| Conversão | `%` + `deals_won` ganhas |
| Curto | botão "Gerar link curto" (form) e, se `hasLandingPage`, botão da LP — quando já existe, mostra o code + ícone copiar + cliques |
| Ações | ícones: Config, Landing page, Campos, Duplicar, Copiar link, Copiar embed, Excluir (mesmos handlers atuais) |

Colunas responsivas: em telas pequenas, colapsa Visitantes/Leads/Conversão em uma linha secundária abaixo do nome (padrão de "sub-row").

### Implementação

Novo componente `src/components/smartops/FormMetricsRow.tsx` que recebe **os mesmos props** do `FormMetricsCard` atual (mais nenhum), e renderiza uma linha `<tr>` ou `<div>` com grid CSS.

No `SmartOpsFormBuilder.tsx`:
- Substitui `<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">…FormMetricsCard…` por uma tabela por grupo:
  - Header sticky com os títulos das colunas.
  - Uma `FormMetricsRow` por form.
- Mantém tudo mais (filtros de período, botão criar, edição, LP modal) intacto.

### O que NÃO muda
- `FormMetricsCard.tsx` fica no repo (não deleta) — pode ser reutilizado depois; simplesmente deixa de ser importado.
- Nenhuma lógica de dados, RPC, short links, métricas ou permissões.
- Handlers (`toggleActive`, `openEditMeta`, `handleGenerateShortLink`, etc.) reaproveitados.

### Arquivos afetados
- Novo: `src/components/smartops/FormMetricsRow.tsx`
- Editado: `src/components/SmartOpsFormBuilder.tsx` — swap do grid por tabela + import da row.
