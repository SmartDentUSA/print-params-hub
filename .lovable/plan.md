# Corrigir botão "🚀 Gerar por IA (Otimizado)"

## Diagnóstico

Logs da edge function `ai-orchestrate-content` mostram:
```
❌ Nenhuma fonte de conteúdo fornecida:
{ rawText: 0, pdfTranscription: 0, videoTranscription: 0, relatedPdfs: 0 }
```

No print, a fonte "📄 Upload de PDF para Transcrição" está marcada como **✓ Ativa**, mas nenhum PDF foi transcrito (`orchestratorExtractedData.pdfTranscription` vazio). Ao clicar em **🚀 Gerar por IA (Otimizado - 60% mais rápido)**, o handler `handleGenerateCompleteArticle` (`src/components/AdminKnowledge.tsx`, linha 522) só verifica se há *alguma* fonte marcada (`hasAnySources`) — não verifica se as fontes marcadas têm conteúdo. Por isso o payload vazio chega ao servidor e a função retorna erro 400.

O outro handler (`handleGenerate` por volta da linha 338) já tem essa validação (`emptyActiveSources`, linhas 358–381). O caminho "Otimizado" simplesmente não foi atualizado.

## Plano

**1. `src/components/AdminKnowledge.tsx` — `handleGenerateCompleteArticle` (≈ linha 525)**

Adicionar, logo após o check `hasAnySources`, a mesma validação de fontes vazias usada em `handleGenerate`:

- Se `pdfTranscription` ativa e `orchestratorExtractedData.pdfTranscription` vazio → bloquear.
- Idem para `rawText`, `videoTranscription`, `relatedPdfs`.
- Mostrar toast destrutivo listando as fontes vazias e abortar antes de `setIsGenerating(true)`.

**2. Extrair em um helper local** (`validateOrchestratorSources()`) dentro do componente para reutilizar nos dois handlers e evitar divergência futura.

**3. Verificação**

- Marcar "Upload de PDF" sem enviar arquivo → clicar "Gerar por IA (Otimizado)" → deve aparecer toast "Fontes vazias detectadas" e nenhuma chamada deve ir para `ai-orchestrate-content`.
- Transcrever um PDF e clicar de novo → fluxo normal de geração.

## Fora do escopo

- Não alterar a edge function `ai-orchestrate-content` (a mensagem de erro do servidor está correta; só queremos não chegar até ela com payload vazio).
- Sem mudanças visuais nem em outros caminhos do editor.
