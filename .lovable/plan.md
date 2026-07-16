## Objetivo
Garantir que qualquer alteração no texto de pré/pós-processamento gere um card baseado no texto atual, mesmo quando já existe um card antigo ou ele foi removido pela lixeira.

## Implementação
1. **Invalidar o conteúdo derivado ao editar o texto**
   - Ao mudar `processing_instructions`, limpar no estado local os planos traduzidos e referências de cards gerados anteriormente.
   - Manter a pré-visualização PT sempre ligada ao texto atual.

2. **Não reutilizar planos antigos do banco**
   - Em `ResinCardStudio`, usar `info_card_plan_en/es` somente quando o texto atual ainda for igual ao texto hidratado do banco.
   - Se o texto foi alterado, forçar uma nova tradução/geração em vez de reutilizar o plano anterior.

3. **Invalidar caches persistidos ao salvar**
   - Quando `processing_instructions` realmente mudar, salvar também `info_card_plan_pt/en/es = null`, `info_card_url_pt/en/es = null` e retirar o status de pronto.
   - Assim, o sistema não continuará exibindo uma imagem estática criada com instruções antigas.

4. **Corrigir a lixeira**
   - Ao excluir um card por idioma, limpar tanto a URL quanto o plano daquele idioma no banco e no estado local.
   - A próxima geração será reconstruída integralmente a partir do texto vigente.

5. **Validar o fluxo**
   - Abrir uma resina com card existente, alterar uma frase, conferir a prévia, excluir o card antigo e gerar novamente.
   - Confirmar que a nova imagem contém a frase alterada e que o card antigo não reaparece.