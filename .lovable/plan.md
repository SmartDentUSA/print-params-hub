Adicionar um campo de busca no painel de formulários SmartOps para filtrar a lista existente (agora em layout de lista), sem alterar a estrutura de dados.

## O que será feito

1. **Novo estado de busca** em `SmartOpsFormBuilder.tsx`:
   - `searchQuery` (string) vinculado a um `<Input>` posicionado entre o botão “Novo formulário” e o filtro de período.
   - Ícones `Search` e `X` para indicar busca e limpar o campo rapidamente.

2. **Função de normalização** local:
   - Remove acentos (`NFD` + regex de diacríticos) e converte para minúsculas.
   - Aplica o mesmo tratamento ao termo digitado e aos campos do formulário, tornando a busca tolerante a acentos e caixa.

3. **Filtro sobre os dados já carregados** (`forms`):
   - Campos considerados: `form.name`, `form.slug` e o rótulo da finalidade (`PURPOSE_CONFIG[form.form_purpose].label`).
   - Mantém o agrupamento por finalidade: dentro de cada grupo existente (`PURPOSE_CONFIG`), filtra apenas os formulários que batem com o termo. Grupos que ficarem vazios após o filtro são ocultados.

4. **Estado vazio aprimorado**:
   - Se houver busca e nenhum formulário corresponder, mostrar mensagem “Nenhum formulário encontrado para ‘{termo}’.” com botão para limpar a busca.

5. **Preservação do comportamento atual**:
   - Filtro de período (24h/7d/30d/90d/Tudo), métricas, links curtos, ações e modal de landing page continuam funcionando normalmente.
   - Nenhuma alteração no banco de dados, edge functions ou tipos Supabase.

## Arquivos afetados

- `src/components/SmartOpsFormBuilder.tsx` — adiciona estado, input de busca, helper de normalização e lógica de filtro no render dos grupos.
- `src/components/smartops/FormMetricsRow.tsx` — sem alterações (apenas reutilizado).

## Critérios de aceitação

- Campo de busca visível no topo do painel de formulários.
- Digitar “exocad”, “/f/exocad”, “captação” ou “Captação” encontra os formulários correspondentes.
- A lista continua agrupada por finalidade; grupos sem correspondências desaparecem.
- Busca vazia exibe todos os formulários.
- Limpar a busca restaura a lista completa.
- Typecheck e build passam sem regressões.