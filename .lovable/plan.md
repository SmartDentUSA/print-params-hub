## Objetivo
Na modal de **Specs técnicos** dos cards de resina (Base de Conhecimento → Catálogo), substituir as chaves snake_case por rótulos legíveis e formatar booleans/arrays — com **suporte aos 3 idiomas** (PT / EN / ES) trocando ao vivo quando o usuário muda a língua via seletor.

Escopo: **somente** `src/components/knowledge/KbTabCatalogo.tsx` (helper `normalizeSpecs` + modal `specsModal`). Nenhuma outra alteração.

## Mudanças

### 1. Dicionário de labels por idioma (no topo do arquivo, antes de `normalizeSpecs`)

```ts
type SpecLang = 'pt' | 'en' | 'es';

const SPEC_LABELS: Record<SpecLang, Record<string, string>> = {
  pt: {
    tipo: "Tipo",
    carga_por_peso: "Carga por Peso",
    carga_por_volume: "Carga por Volume",
    resistencia_flexural_mpa: "Resistência Flexural (MPa)",
    resistencia_flexural_source: "Fonte / Certificação",
    modulo_flexural_gpa: "Módulo Flexural (GPa)",
    dureza_shore_d: "Dureza Shore D",
    sorcao_agua: "Sorção de Água",
    radiopacidade: "Radiopacidade",
    carga_inorganica: "Carga Inorgânica",
    compatibilidade_camada: "Compatibilidade de Camada",
    luz_uv_cura: "Luz UV para Cura",
    resin_class: "Classe da Resina",
    fda_510k: "Certificação FDA 510(k)",
    wavelength_nm: "Comprimento de Onda (nm)",
    ceramic_dominant: "Dominância Cerâmica",
    vickers_hardness: "Dureza Vickers",
    inorganic_load_pct: "Carga Inorgânica (%)",
    flexural_strength_mpa: "Resistência à Flexão (MPa)",
    flexural_strength_source: "Fonte / Certificação",
    aplicacoes_definitivas: "Aplicações Definitivas",
    comprovacao_clinica: "Comprovação Clínica",
    resina_permanente: "Resina Permanente",
  },
  en: {
    tipo: "Type",
    carga_por_peso: "Filler by Weight",
    carga_por_volume: "Filler by Volume",
    resistencia_flexural_mpa: "Flexural Strength (MPa)",
    resistencia_flexural_source: "Source / Certification",
    modulo_flexural_gpa: "Flexural Modulus (GPa)",
    dureza_shore_d: "Shore D Hardness",
    sorcao_agua: "Water Sorption",
    radiopacidade: "Radiopacity",
    carga_inorganica: "Inorganic Filler",
    compatibilidade_camada: "Layer Compatibility",
    luz_uv_cura: "UV Curing Light",
    resin_class: "Resin Class",
    fda_510k: "FDA 510(k) Clearance",
    wavelength_nm: "Wavelength (nm)",
    ceramic_dominant: "Ceramic Dominant",
    vickers_hardness: "Vickers Hardness",
    inorganic_load_pct: "Inorganic Filler (%)",
    flexural_strength_mpa: "Flexural Strength (MPa)",
    flexural_strength_source: "Source / Certification",
    aplicacoes_definitivas: "Definitive Applications",
    comprovacao_clinica: "Clinical Evidence",
    resina_permanente: "Permanent Resin",
  },
  es: {
    tipo: "Tipo",
    carga_por_peso: "Carga por Peso",
    carga_por_volume: "Carga por Volumen",
    resistencia_flexural_mpa: "Resistencia a la Flexión (MPa)",
    resistencia_flexural_source: "Fuente / Certificación",
    modulo_flexural_gpa: "Módulo Flexural (GPa)",
    dureza_shore_d: "Dureza Shore D",
    sorcao_agua: "Sorción de Agua",
    radiopacidade: "Radiopacidad",
    carga_inorganica: "Carga Inorgánica",
    compatibilidade_camada: "Compatibilidad de Capa",
    luz_uv_cura: "Luz UV para Curado",
    resin_class: "Clase de Resina",
    fda_510k: "Certificación FDA 510(k)",
    wavelength_nm: "Longitud de Onda (nm)",
    ceramic_dominant: "Dominancia Cerámica",
    vickers_hardness: "Dureza Vickers",
    inorganic_load_pct: "Carga Inorgánica (%)",
    flexural_strength_mpa: "Resistencia a la Flexión (MPa)",
    flexural_strength_source: "Fuente / Certificación",
    aplicacoes_definitivas: "Aplicaciones Definitivas",
    comprovacao_clinica: "Comprobación Clínica",
    resina_permanente: "Resina Permanente",
  },
};

const BOOL_LABELS: Record<SpecLang, { yes: string; no: string }> = {
  pt: { yes: "Sim", no: "Não" },
  en: { yes: "Yes", no: "No" },
  es: { yes: "Sí",  no: "No" },
};

const prettifyKey = (k: string) =>
  k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const translateSpecLabel = (raw: string, lang: SpecLang) => {
  const norm = raw.trim().toLowerCase();
  if (SPEC_LABELS[lang][norm]) return SPEC_LABELS[lang][norm];
  // Strings já legíveis (com espaços/acentos/maiúsculas internas) passam intactas.
  // Só capitaliza quando vier puro snake_case.
  if (/^[a-z0-9_]+$/.test(raw)) return prettifyKey(raw);
  return raw;
};
```

### 2. `normalizeSpecs` passa a receber o idioma

Assinatura: `normalizeSpecs(raw: any, lang: SpecLang): SpecRow[]`.

Estender `SpecRow`:

```ts
interface SpecRow { label: string; value: string; items?: string[] }
```

Regras de formatação de valor (substituir `pushPair`):

- `null` / `undefined` / `""` → **skip** (linha não renderizada).
- `boolean` → `BOOL_LABELS[lang].yes` ou `.no`.
- `Array` → guardar em `items: string[]` (cada item para string, nulos descartados; array vazio → skip).
- `number` → `String(value)`.
- `object` (não array) → `JSON.stringify` (mantém comportamento atual).
- Label transformado por `translateSpecLabel(label, lang)`.
- Deduplicação atual preservada.

### 3. Recalcular specs quando o idioma muda

No componente, já existe `const { t, language } = useLanguage();` (ou similar). Garantir que a chamada a `normalizeSpecs` use `language as SpecLang` e que `specs` seja recomputado quando `language` mudar (já acontece porque o render reexecuta a cada mudança de contexto; nenhum `useMemo` extra necessário).

Também atualizar o estado `specsModal` para ser recalculado: quando o usuário troca de idioma com a modal aberta, recomputar `specsModal.specs` derivando do novo `language`. Implementação simples: usar `useEffect` que, ao mudar `language` enquanto `specsModal` está aberto, re-normaliza os specs da resina/produto correntes (manter o `name` e refazer o `normalizeSpecs` com o mesmo `raw` original — guardar `raw` no estado da modal: `{ name, raw }` em vez de `{ name, specs }`, e derivar `specs` no render via `useMemo([raw, language])`).

### 4. Modal: render de listas

No `<td>` do valor:

- Se `row.items` existir → `<ul style="list-style: disc; padding-left: 18px; margin: 0">` com um `<li>` por item.
- Caso contrário → `row.value` como hoje.

## Não fazer
- Não alterar `KbResinSheetDialog`, `KbResinDocsDialog`, `ProductPage`, edge functions, schema do banco, nem o fluxo de tradução automática via `useCardTranslations` (este mapeamento é local/determinístico, independente do gateway de IA).
- Não traduzir os **valores** textuais (ex.: itens de `aplicacoes_definitivas`) — eles vêm do banco e já são alvo do tradutor automático separado. Aqui só labels + booleans mudam de idioma.
- Não mexer em CTAs, tabela de apresentações, nem em qualquer outra parte do card.
