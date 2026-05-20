## Objetivo
Adotar o PDF `CRACHA_TREINAMENTO_2-2.pdf` como **layout e fundo oficial** dos crachás gerados pela edge function `smartops-gerar-crachas-turma`. Hoje a função desenha o logo programaticamente; passaremos a embutir o PDF original como fundo e apenas sobrepor os dados dinâmicos (Nome, Especialidade, Cidade/UF) nas posições corretas.

## Estrutura do template (A4 retrato)
- 2 crachás por página, divididos por linha horizontal no meio.
- Cada crachá é dobrável (fold no meio): metade superior rotacionada 180° (logo no canto superior esquerdo invertido), metade inferior na orientação normal (logo no canto inferior direito).
- Áreas de texto: centro de cada metade, onde hoje há espaço em branco.

## Mudanças

### 1. Armazenar o template
- Copiar `user-uploads://CRACHA_TREINAMENTO_2-2.pdf` para `supabase/functions/smartops-gerar-crachas-turma/template-cracha.pdf`.
- A edge function carrega o arquivo via `Deno.readFile(new URL('./template-cracha.pdf', import.meta.url))`.

### 2. Reescrever `supabase/functions/smartops-gerar-crachas-turma/index.ts`
- Remover o desenho manual do logo "Smart Dent".
- Para cada par de participantes:
  1. Carregar o template com `PDFDocument.load(templateBytes)`.
  2. Copiar a página do template para o documento de saída (`copyPages`).
  3. Sobrepor os textos dinâmicos com `page.drawText`:
     - **Metade inferior (normal)**: Nome (grande, ~28pt), Especialidade (~14pt), Cidade/UF (~12pt) centralizados horizontalmente, posicionados ~meio da metade inferior.
     - **Metade superior (rotacionada 180°)**: mesmos campos do **segundo** participante, desenhados com `rotate: degrees(180)` e coordenadas espelhadas, para ficarem legíveis quando o crachá for dobrado.
  4. Se houver número ímpar de participantes, a metade superior da última página fica sem dados (apenas template).
- Manter fonte `StandardFonts.HelveticaBold` para Nome e `Helvetica` para os demais.
- Manter agregação de dados atual (enrollments + companions + enriquecimento via `lia_attendances`).

### 3. Frontend
- Nenhuma alteração. `GerarCrachasButton` continua chamando a mesma função.

## Validação
- Após deploy, baixar o PDF gerado para uma turma de teste e conferir visualmente:
  - Fundo idêntico ao template (logos nas posições corretas).
  - Nome/especialidade/cidade legíveis quando dobrado.
  - Rotação 180° correta na metade superior.

## Arquivos
- **Criado**: `supabase/functions/smartops-gerar-crachas-turma/template-cracha.pdf`
- **Editado**: `supabase/functions/smartops-gerar-crachas-turma/index.ts`
