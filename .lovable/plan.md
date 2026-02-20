
## Adicionar aba "Alimentador" no painel Dra. L.I.A.

### O que precisa mudar

O componente `AdminDraLIAStats.tsx` já possui uma estrutura de abas (`Tabs`) com 4 abas:
- Visão Geral
- Qualidade
- Indexação RAG
- Auto-Heal

O componente `AdminApostilaImporter.tsx` foi implementado na sessão anterior com todo o conteúdo do Alimentador de Cérebro da L.I.A. (Apostila JSON + Cérebro da L.I.A. + Diagnóstico).

O objetivo é adicionar uma 5ª aba chamada **"Alimentador"** dentro do painel da Dra. L.I.A., que renderiza o `AdminApostilaImporter` diretamente.

### Mudanças técnicas — apenas 1 arquivo

**`src/components/AdminDraLIAStats.tsx`**

1. **Import:** Adicionar `import { AdminApostilaImporter } from "@/components/AdminApostilaImporter"` no topo do arquivo.

2. **Import de ícone:** Adicionar `Brain` aos imports do lucide-react (já está importado na linha 46 — nenhuma mudança necessária).

3. **TabsList (linha ~720):** Adicionar o `TabsTrigger` da nova aba após o trigger do `Auto-Heal`:
```tsx
<TabsTrigger value="alimentador" className="flex-1 sm:flex-none gap-1">
  <Brain className="w-4 h-4" />
  Alimentador
</TabsTrigger>
```

4. **TabsContent (após linha 1573):** Adicionar o conteúdo da nova aba logo antes do fechamento do `</Tabs>`:
```tsx
<TabsContent value="alimentador" className="mt-6">
  <AdminApostilaImporter />
</TabsContent>
```

### Nenhuma alteração no `AdminViewSecure`

O `AdminApostilaImporter` continua sendo renderizado na aba "Documentos" do admin via `AdminApostilaImporter` diretamente. A nova aba é uma segunda instância dentro do painel da L.I.A. — funcionalmente idêntica, apenas acessível a partir das Estatísticas.

Se quiser, podemos opcionalmente remover o `AdminApostilaImporter` da aba "Docs Sistema" do `AdminViewSecure` para centralizar tudo aqui — mas isso é opcional e não está no escopo desta mudança.

### Impacto

- 2 linhas adicionadas no `TabsList`
- 3 linhas adicionadas antes do fechamento do `</Tabs>`
- 1 import adicionado no topo
- Zero risco — adição pura, nenhum comportamento existente alterado
