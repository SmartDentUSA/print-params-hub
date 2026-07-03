## Corrigir scroll do editor de Landing Page

### Diagnóstico

O modal usa CSS Grid para dividir sidebar/preview:

```tsx
<div className="h-full min-h-0 grid grid-cols-1 xl:grid-cols-[420px_1fr]">
```

Sem `grid-template-rows` explícito, a linha implícita vira `auto` e cresce até o tamanho do conteúdo (o template tem `min-h-screen`). Resultado:

- Filhos com `h-full` não recebem uma altura contida (a linha do grid é maior que o `TabsContent`), então nem a sidebar nem o preview conseguem paginar via `overflow-y-auto` — o clip acontece no `TabsContent` (`overflow-hidden`) e cortamos o conteúdo abaixo.
- Isso também esconde as sections do editor abaixo da dobra (incluindo o bloco "Condições" com os campos dos 3 cards). Por isso o usuário não vê os campos de edição das ofertas.

O mesmo padrão está no `GenerateLayout` (abas "Gerar por IA" e "Briefing"), afetando o scroll do preview nessas abas.

### Correção

Em `src/components/smartops/LandingPageBuilderModal.tsx`, forçar altura contida na linha do grid dos dois layouts:

1. Split da aba `edit` (linha 310):
   - Trocar `grid grid-cols-1 xl:grid-cols-[420px_1fr]` por `grid grid-cols-1 xl:grid-cols-[420px_1fr] grid-rows-[1fr] h-full min-h-0`
   - Adicionar `overflow-hidden` no wrapper para garantir que o filho scrollável (`overflow-y-auto`) delimite dentro dele.

2. `GenerateLayout` (linha 342): mesma alteração, com `grid-rows-[1fr]` e reforço de `min-h-0 overflow-hidden` na sidebar.

3. `LivePreview` (linha 369): garantir que a raiz seja `h-full min-h-0 flex flex-col overflow-hidden` (já está) e que o div interno de scroll (`overflow-y-auto`) tenha `flex-1 min-h-0` sem `h-full` (o `h-full` combinado com `flex-1` em contêiner flexível causa cálculo redundante em alguns navegadores).

4. Sidebar do editor (linha 311): trocar `min-h-0 border-r overflow-y-auto p-5 space-y-6 bg-muted/20` por `h-full min-h-0 border-r overflow-y-auto p-5 space-y-6 bg-muted/20` (garante que ocupe a linha do grid corrigida).

### Validação

- Abrir modal em `/admin`, gerar/regenerar uma LP, ir na aba "Editar & publicar". A sidebar precisa rolar até chegar na Section "Condições" com os 3 cards (Condição 1/2/3) e o preview precisa rolar independentemente.
- Nas abas "Gerar por IA" e "Briefing", o preview precisa rolar até o rodapé da LP.
- Rodar `bunx tsgo` para checar tipos.

### Fora do escopo

- Não altero conteúdo, geração por IA, publicação ou o template da LP.
- Não mudo os campos da seção Condições — eles já existem no editor; a correção só é necessária para que fiquem visíveis via scroll.
