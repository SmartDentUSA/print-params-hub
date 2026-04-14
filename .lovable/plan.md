

## Plano: Alinhar footer do Support Resources com o resto do site

### Problema
A página `/support-resources` usa o componente `<Footer />` completo (com grid de 4 colunas, redes sociais, contato, etc.), enquanto a Base de Conhecimento usa um footer simples e minimalista com apenas o copyright. Isso causa inconsistência visual.

### Solução
Substituir o `<Footer />` importado por um footer inline idêntico ao da KnowledgeBase, e adicionar a seção "Precisa de Ajuda?" com botão WhatsApp antes do footer — exatamente como faz a KnowledgeBase.

### Implementação em `src/pages/SupportResources.tsx`

1. **Remover** o import de `<Footer>` e o `<Footer />` no JSX
2. **Adicionar antes do fechamento de `</main>`**:
   - Seção "Precisa de Ajuda?" com botão WhatsApp (mesmo estilo da KnowledgeBase)
3. **Após `</main>`**, adicionar footer inline:
   ```html
   <footer className="border-t border-border bg-gradient-surface mt-16">
     <div className="container mx-auto px-4 py-8">
       <div className="text-center text-muted-foreground">
         <p>© 2024 Smart Dent...</p>
       </div>
     </div>
   </footer>
   ```

### Arquivo afetado
- `src/pages/SupportResources.tsx`

