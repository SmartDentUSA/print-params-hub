
# Upload de DOCX e PDF direto no Alimentador de Cérebro da L.I.A.

## O problema

O fluxo atual exige que o admin copie e cole texto manualmente no formulário "Bloco Único". Para documentos como o DOCX de transcrições de reuniões (que contém 10-15 blocos de conhecimento), isso é impraticável. O sistema já tem `extract-pdf-text` para PDFs, mas nenhum suporte a DOCX.

## Solução: aba "Upload de Documento" no Cérebro da L.I.A.

Adicionar uma terceira seção dentro da aba "Cérebro da L.I.A." do `AdminApostilaImporter.tsx`: **"Upload de Documento"**. O fluxo será:

```text
[1] Admin faz upload do DOCX ou PDF
[2] Sistema extrai o texto (DOCX: FileReader API no browser | PDF: edge function extract-pdf-text)
[3] Admin vê o texto extraído em preview editável
[4] Admin define: título, categoria, fonte
[5] Admin escolhe: indexar como 1 bloco único OU deixar a IA sugerir múltiplos blocos
[6] Clica "Indexar na L.I.A." → chama ingest-knowledge-text
```

## Extração de texto por tipo de arquivo

### DOCX — extração no browser (sem edge function)
O formato DOCX é um ZIP com XMLs internos. Usando a biblioteca `JSZip` + parser de XML nativo do browser, é possível extrair o texto de `word/document.xml` 100% no frontend, sem precisar de backend.

Fluxo:
```typescript
// 1. Ler arquivo como ArrayBuffer
// 2. Abrir como ZIP com JSZip
// 3. Extrair word/document.xml
// 4. Parsear XML e pegar texto dos <w:t> tags
// 5. Retornar texto limpo
```

Isso funciona para a maioria dos DOCX simples (sem imagens embeddadas complexas). O DOCX de transcrições é exatamente esse caso.

### PDF — usar edge function `extract-pdf-text` existente
Já funciona: converte para base64 e envia para `extract-pdf-text`, que usa Gemini Vision para extrair o texto.

## O que muda — apenas `AdminApostilaImporter.tsx`

Zero novas edge functions. Zero migrações. Apenas mudança no componente frontend.

### Nova seção "Upload de Documento" dentro da aba Cérebro da L.I.A.

**Interface:**

1. **Área de drop/upload** — aceita `.docx` e `.pdf`
   - Ícone de upload, texto "Arraste um DOCX ou PDF aqui"
   - Badge mostrando tipo detectado (DOCX / PDF)

2. **Processamento automático ao selecionar arquivo:**
   - DOCX: extração instantânea no browser via JSZip + XML parser
   - PDF: spinner enquanto chama `extract-pdf-text` via `supabase.functions.invoke`
   - Mostra toast de progresso

3. **Preview do texto extraído:**
   - Textarea editável (o admin pode revisar e cortar partes irrelevantes)
   - Contador de caracteres
   - Aviso: "O texto será dividido automaticamente em chunks de 900 chars"

4. **Campos de metadados:**
   - `Título` — pré-preenchido com o nome do arquivo (editável)
   - `Categoria` — Select (SDR / Comercial / etc.)
   - `Fonte` — pré-preenchido com o nome do arquivo (editável)

5. **Botão "Indexar na L.I.A."** → adiciona ao queue existente e indexa via `ingest-knowledge-text`

6. **Resultado:** badges com `N chunks gerados` igual ao fluxo de bloco único

### Dependência: JSZip

JSZip é uma biblioteca leve (47KB gzip) para ler ZIPs no browser. É o padrão para ler DOCX no frontend sem servidor.

Verificar se já está instalada:

```bash
# Se não estiver:
npm install jszip
```

A alternativa sem dependência externa é usar a API `DecompressionStream` do browser, mas JSZip é mais simples e amplamente suportada.

## Arquivos modificados

| Arquivo | Ação | Risco |
|---|---|---|
| `src/components/AdminApostilaImporter.tsx` | Adicionar seção "Upload de Documento" com lógica DOCX+PDF | Baixo — adição em nova seção, nada existente alterado |
| `package.json` / `package-lock.json` | Adicionar dependência `jszip` | Mínimo |

## O que NÃO muda

- Edge function `ingest-knowledge-text` — inalterada
- Edge function `extract-pdf-text` — usada como está
- Migration SQL — inalterada
- `AdminDraLIAStats` — inalterado
- Fluxo "Bloco Único" e "Importação JSON" — inalterados

## Resultado prático para o DOCX de transcrições

Ao fazer upload do `Transcrições_das_reuniões_1.docx`:
1. Texto extraído instantaneamente no browser (~5 segundos)
2. Admin revisa, define categoria `sdr` e fonte `"Transcrições Reuniões Comerciais"`
3. Clica "Indexar" — o sistema divide automaticamente em ~12 chunks e gera embeddings
4. Dra. L.I.A. passa a conhecer: dores reais dos leads, discurso ideal, objeções com respostas, dados da pesquisa com 4.000 dentistas
