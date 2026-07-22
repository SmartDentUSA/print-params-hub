
## Objetivo
Na aba "Catálogo" de `/base-conhecimento`, o filtro de categoria deve iniciar em **Resinas** com sub-seleção **Todas** por padrão.

## Passos

1. **Localizar o componente da aba Catálogo**
   - Buscar por `tab=catalogo`, `BaseConhecimento`, `Catalogo`, `KnowledgeBase` em `src/`.
   - Identificar onde o filtro de categoria/subcategoria é controlado (`useState`, `useSearchParams` ou contexto).

2. **Ajustar o estado inicial**
   - Trocar o default para representar `categoria = "Resinas"` e `subcategoria = "Todas"`, mantendo exatamente a mesma estrutura de dado já usada pelo filtro (string, objeto ou enum — sem refatorar o modelo).
   - Se o valor for lido de `useSearchParams`, aplicar o default só quando o param estiver ausente (não sobrescrever seleção do usuário via URL).

3. **Ordem da lista (se necessário)**
   - Se "Resinas" não aparece como primeiro item do dropdown, reordenar o array de categorias para colocá-la em primeiro. Se já aparece, não mexer.

4. **Garantias**
   - O usuário continua podendo trocar para qualquer outra categoria normalmente.
   - Nenhuma mudança em lógica de fetch/negócio — apenas valor inicial (e opcionalmente ordem de exibição).

## Detalhes técnicos
- Alteração restrita ao componente da aba Catálogo (frontend/presentation).
- Sem migrations, sem edge functions, sem mudanças em dados.
- Verificação: abrir `/base-conhecimento?tab=catalogo` sem query params e confirmar via screenshot que "Resinas — Todas" está selecionado e a lista mostra resinas.
