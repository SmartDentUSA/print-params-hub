## Alinhar o editor de email ao editor de landing page

O editor de LP tem uma **lista fixa e semântica** de seções (Hero, Como funciona, Oferta, Condições, Módulos, Uso, Implantação, O que a Smart Dent entrega, Comparativo, FAQ, CTA final, Rodapé) — definida em `LandingPageBuilderModal.tsx` linha 539-553 — cada uma editável e ligável/desligável individualmente. Zero heurística.

O editor de email hoje **tenta adivinhar** as seções via DOM/regex depois do HTML gerado. Falha: pega 25 FAQs em vez do bloco "FAQ".

## Fix: gerar o HTML já anotado com marcadores de seção

### 1. `supabase/functions/smart-ops-generate-email-ai/index.ts` (função `renderEmail`)

Adicionar helper local:
```ts
const wrapSec = (key: string, label: string, tr: string) =>
  tr ? `<!--SD_SEC_START key="${key}" label="${label}"-->${tr}<!--SD_SEC_END-->` : "";
```

Envolver cada `<tr>…</tr>` de bloco (usar comentários HTML, pois `<section>` quebra `<table>`), usando **exatamente** os mesmos rótulos do LP builder:

| key             | label                        |
| --------------- | ---------------------------- |
| hero            | Hero                         |
| positioning     | Oferta / Posicionamento      |
| how-it-works    | Como funciona                |
| price           | Oferta / Preço               |
| conditions      | Condições                    |
| modules         | Módulos                      |
| regional-rules  | Uso da licença               |
| implementation  | Implantação                  |
| benefits        | O que a Smart Dent entrega   |
| testimonials    | Depoimentos                  |
| faq             | FAQ                          |
| final-cta       | CTA final                    |
| footer          | Rodapé                       |

O bloco Hero (linhas 735-752) e o rodapé (766-771) também são envolvidos. Cabeçalho (logo/reseller badge) fica **fora** dos marcadores (não é toggleável, como no LP).

### 2. `src/components/smartops/emailSections.ts`

- Nova função `parseMarkerSections(html)` que varre pares `<!--SD_SEC_START key="…" label="…"-->…<!--SD_SEC_END-->` e retorna um `EmailSection[]` com `id: "{key}-{i}"`, `key`, `label` do próprio marcador, `html: match completo (incluindo marcadores)`, `removable: true`, `auto: false`.
- Em `parseSections`, **antes** de tentar `<section data-section=…>` e antes do `parseAuto`, chamar `parseMarkerSections`; se encontrar ≥ 1, retornar essa lista.
- Nova `serializeMarkerSections(originalHtml, sections)` que remove os pares desligados via regex `<!--SD_SEC_START key="{key}"…-->[\s\S]*?<!--SD_SEC_END-->` — preservando a ordem original do HTML e o resto intocado.
- Em `serializeSections`, se o HTML contiver `SD_SEC_START`, delegar para `serializeMarkerSections`.
- Remover o aviso "Rótulos são aproximações" quando as seções vierem de marcadores (não são automáticas).

### 3. Comportamento resultante

- Emails **novos** gerados por `smart-ops-generate-email-ai` já vêm com os 13 blocos rotulados exatamente como no LP builder.
- Emails **antigos** (sem marcadores) continuam caindo no heurístico atual — retrocompatível.
- Desligar/ligar reflete no preview Visual e no envio (já está funcionando via `effectiveHtml`).

## Fora de escopo

- Alterar o editor de LP.
- Adicionar reorder/rename manual de seções (LP também não tem).
- Migrar emails antigos.
- Alterar `smart-ops-generate-email` (variante sem AI) — se existir, cai no fallback antigo.

## Validação

- Regerar um email → aba Seções mostra exatamente: Hero, Como funciona, Oferta / Preço, Condições, Módulos, Uso da licença, Implantação, O que a Smart Dent entrega, Depoimentos (se houver), FAQ, CTA final, Rodapé — mesmos rótulos do LP.
- Desligar "FAQ" → o bloco inteiro (com todos os 25 QAs) some do preview Visual e do email de teste.
- Reativar → volta.