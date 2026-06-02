## Problema

O dropdown lista todos os 120 produtos do Sistema A, mas o endpoint `knowledge-export-full` retorna mensagens prontas para muito poucos:

- `aftersales`: 3 produtos
- `cs`: 2 produtos
- `spin`: 0 produtos

Quando se seleciona um produto sem mensagens, aparece o toast "Nenhuma mensagem em aftersales para este produto." — está correto, mas a UX deixa o usuário tentando às cegas. Além disso, "SPIN selling" no bucket nunca tem conteúdo.

## Plano (somente UI no `PromoSeqInspector`)

1. **Carregar produtos com contagem de mensagens.**
   - No `useEffect` que busca produtos, salvar também `counts = { aftersales, cs }` por slug a partir do mesmo payload (já vem em `p.messages`). Sem fetch extra.

2. **Filtrar o dropdown de produtos pelo bucket selecionado.**
   - Mostrar só produtos onde `counts[node.bucket] > 0`.
   - Exibir contagem ao lado do nome: `Nome do produto · 7 msgs`.
   - Placeholder vazio: "Nenhum produto com mensagens neste bucket".

3. **Remover bucket `spin`** do select (não existe no endpoint). Manter só `aftersales` e `cs`. Atualizar `types.ts` (`PromoSeqNode.bucket`) e o default em `WaGroupFlowBuilder` (`bucket: "aftersales"`).

4. **Trocar bucket reseta `produto_slug`** quando o atual não tem mensagens no novo bucket — evita estado inválido.

5. **Auto-carregar mensagens** ao selecionar produto (já que temos o payload em cache na lista), tornando o botão "Carregar mensagens" opcional / fallback.

6. **Mensagem do estado vazio** mais clara: "Este bucket tem mensagens em apenas N produtos no Sistema A. Cadastre mais no painel do Sistema A se precisar de outros."

## Fora de escopo

- Alterações no `sequence-runner` (continua usando `bucket` aftersales/cs).
- Edição/criação de mensagens promo no Sistema A pelo painel.
- Mudanças no fluxo de Sequências Sociais (mesmo componente é reusado, herda o fix automaticamente).

## Arquivos a alterar

- `src/components/smartops/wa-groups/WaGroupFlowBuilder.tsx` — `PromoSeqInspector` + default node.
- `src/components/smartops/wa-groups/types.ts` — restringir `bucket` a `"aftersales" | "cs"`.