## Dois problemas na aba "Seções" do Passo 2

### 1. Rótulos não batem com o conteúdo real do email

Hoje `labelFor` em `emailSections.ts` classifica cada bloco por heurística de categoria (`"Preço / Oferta"`, `"Benefícios"`, `"Bloco N"`). O usuário quer ver os títulos **reais** do email (ex.: `Exocad oficial e completo com treinamento e I.A. todo mês.`, `PRÉ-LANÇAMENTO`, `DentalCAD Ultimate Lab Bundle`).

**Fix (`src/components/smartops/emailSections.ts` → `labelFor`):**
- Nova ordem de prioridade:
  1. Texto do primeiro `<h1>/<h2>/<h3>` do bloco (trim, colapsa espaços, corta a 60 chars).
  2. Texto do primeiro `<strong>`/`<b>` significativo (≥ 4 chars).
  3. Primeira linha de texto significativa (`textContent`, primeiros 60 chars, ignorando `©`/rodapé boilerplate).
  4. Fallbacks atuais (Rodapé, Prova social, CTA) só se nada acima existir.
  5. Último recurso: `Bloco N`.
- Todas as strings finais passam por `.replace(/\s+/g," ").trim()` e `slice(0,60)` (+ `…` se cortou).

### 2. Desmarcar a seção não remove do email/preview

Depois da última mudança, o preview da aba **Visual** virou `<iframe srcDoc={html}>` (HTML cru), ignorando as seções desligadas. O `effectiveHtml` (que já aplica `serializeSections`) segue sendo usado no envio/teste, mas o preview visual mostra o HTML sem filtro — dando a impressão de que "não sai".

**Fix (`src/components/smartops/EmailCampaignWizard.tsx`):**
- Trocar `srcDoc={html}` por `srcDoc={effectiveHtml || html}` no iframe da aba Visual.
- Nenhuma outra mudança de lógica: `serializeSections` já remove blocos desligados no ramo `auto` (linhas 186-194 de `emailSections.ts`), e o `effectiveHtml` já é o que vai para `test_email` / envio real.

### Fora de escopo

- Aba HTML (segue mostrando o HTML original, fonte de verdade da edição).
- Aba Preview lateral (já usa `previewHtml = effectiveHtml`).
- Passo 1 e Passo 3.
- Ordenar/renomear seções manualmente.

### Validação

`/admin?sub=criar&tab=campanhas` → Passo 2 → aba **Seções**:
- Cada linha mostra o título real do bloco (ex.: `Exocad oficial e completo…`, `DentalCAD Ultimate Lab Bundle`, `Revendedor Oficial exocad`).
- Desmarcar qualquer switch faz o bloco sumir imediatamente do preview na aba Visual e do email de teste.
- Reativar traz de volta.