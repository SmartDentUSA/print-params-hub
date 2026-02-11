

## Botao "Formatar com IA" no campo de Instrucoes de Processamento

### Objetivo

Adicionar um botao ao lado do campo "Instrucoes de Pre e Pos Processamento" no AdminModal que envia o texto bruto para uma edge function, que usa IA para estrutura-lo automaticamente no formato Markdown esperado pelo parser do ParameterTable.

### Como funciona

1. O usuario cola texto livre no campo (ex: instrucoes de um PDF, email, ou anotacao)
2. Clica no botao "Formatar com IA"
3. A IA analisa o texto e retorna o mesmo conteudo formatado com `##`, `###`, bullets `•`, sub-bullets indentados e notas `>`
4. O campo e atualizado com o texto formatado

### Alteracoes

**1. Nova Edge Function: `supabase/functions/format-processing-instructions/index.ts`**

- Recebe o texto bruto via POST
- Envia para o Lovable AI Gateway (google/gemini-3-flash-preview) com um system prompt especifico
- O system prompt instrui a IA a:
  - Identificar secoes de pre-processamento, pos-processamento e outras (pos-cura, tratamento termico, etc.)
  - Formatar com `##` para secoes principais (sem espaco apos ## e aceito, mas gerar com espaco)
  - Formatar com `###` para subsecoes
  - Usar `•` para bullets e indentacao de 2 espacos para sub-bullets
  - Usar `>` para notas/alertas importantes
  - NAO inventar conteudo - apenas reestruturar o que foi fornecido
  - Preservar todos os valores numericos (temperaturas, tempos, pressoes) exatamente como estao
- Retorna o texto formatado

**2. Modificar: `src/components/AdminModal.tsx`**

- Adicionar botao "Formatar com IA" abaixo do Textarea (linha ~1306)
- Ao clicar, chama a edge function com o conteudo atual do campo
- Mostra estado de loading durante o processamento
- Substitui o conteudo do campo pelo texto formatado retornado
- Toast de sucesso ou erro

### System Prompt da IA (resumo)

```
Voce e um formatador de instrucoes tecnicas de processamento de resinas 3D.

ENTRADA: Texto bruto com instrucoes de processamento.
SAIDA: O MESMO conteudo reorganizado em Markdown estruturado.

REGRAS:
- Use ## para secoes principais (PRE-PROCESSAMENTO, POS-PROCESSAMENTO, Pos-cura UV, Tratamento termico, etc.)
- Use ### para subsecoes (ex: "Lavagem e limpeza", "Secagem")
- Use • para cada instrucao/passo
- Use 2 espacos + • para sub-itens
- Use > para notas/alertas/avisos importantes
- NAO invente conteudo. Apenas reorganize.
- Preserve TODOS os numeros, unidades, temperaturas e tempos exatamente.
- Se o texto ja contiver marcadores ##, reorganize-os corretamente.
```

### Resultado esperado

O usuario pode colar qualquer texto (como o exemplo com NanoClean Pod, Elegoo Mercury, etc.) e obter automaticamente o formato Markdown que o parser do ParameterTable entende, sem precisar formatar manualmente.

