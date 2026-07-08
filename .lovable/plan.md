## Plano: fazer o gerador de conteúdo voltar a gerar e salvar

1. **Corrigir a fonte única do botão “Gerar por IA”**
   - Hoje o botão sempre valida `orchestratorActiveSources`, mesmo quando o modo orquestrador está desligado.
   - Ajustar para que, no modo rápido, ele use o texto/PDF de `rawTextInput` como fonte real.

2. **Sincronizar PDF transcrito e texto colado com o payload da IA**
   - Quando o usuário usa PDF ou cola texto no modo rápido, montar automaticamente `sources.rawText` para o `ai-orchestrate-content`.
   - Evitar o erro “Nenhuma fonte selecionada” ou “fontes vazias” quando existe texto na tela.

3. **Tornar “Inserir HTML + FAQs” também um salvamento real**
   - Para conteúdo novo, o botão deve inserir o HTML gerado no formulário e chamar o fluxo completo de salvar/criar conteúdo, sem depender de um segundo clique manual.
   - Para conteúdo existente, manter atualização direta, mas também preservar metadados/FAQs gerados.

4. **Evitar salvamento vazio ou stale state**
   - Ajustar o fluxo para salvar usando o HTML gerado diretamente, não dependendo de `setFormData` assíncrono antes do save.
   - Garantir que `content_html` e `faqs` cheguem corretamente em `knowledge_contents`.

5. **Mensagens claras para falhas de IA**
   - Melhorar os toasts quando a edge function retornar timeout, créditos, rate limit ou resposta inválida.
   - Mostrar ao usuário o que corrigir: adicionar texto/PDF, reduzir fonte grande, tentar novamente, ou verificar créditos.

6. **Validação rápida**
   - Testar o fluxo mínimo: colar texto → Gerar por IA → Inserir/Salvar → confirmar que o conteúdo fica persistido.
   - Testar seleção de PDF já existente como fonte do orquestrador, verificando feedback visual e geração.