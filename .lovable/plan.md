## Restaurar tabela técnica nos cards do Catálogo

**Problema**: A "tabela técnica" que aparecia em cada card sumiu. Hoje `KbTabCatalogo.tsx` (linhas 651-659) resolve specs SÓ de:
1. `catalog_documents.technical_specifications` (Sistema A)
2. `extra_data.system_a_live.technical_specs`

Quando nenhum dos dois existe, o botão "Specs" some — mesmo quando há resina vinculada com `resins.technical_specs` populado (caso L'Aqua e dezenas de outras resinas).

### Mudança (1 arquivo, cirúrgica)

**`src/components/knowledge/KbTabCatalogo.tsx`** — adicionar a terceira fonte na cascata `rawSpecs`:

```ts
const rawSpecs: any = (() => {
  const fromDocs = normalizeSpecs(d?.technical_specifications, specLang);
  if (fromDocs.length) return d?.technical_specifications;
  const live = (p as any)?.extra_data?.system_a_live?.technical_specs;
  const fromLive = normalizeSpecs(live, specLang);
  if (fromLive.length) return live;
  // Fallback: usar technical_specs da resina vinculada (PT/EN/ES)
  if (resin) {
    const resinSpecs =
      (specLang === 'en' && (resin as any).technical_specs_en) ||
      (specLang === 'es' && (resin as any).technical_specs_es) ||
      (resin as any).technical_specs;
    const fromResin = normalizeSpecs(resinSpecs, specLang);
    if (fromResin.length) return resinSpecs;
  }
  return null;
})();
```

E ampliar o `select` de `resins` (linha 418) para incluir `technical_specs_en, technical_specs_es`, e o mapeamento em `resins.set(...)` (~linha 526) para preservar esses campos.

### Resultado
- Botão **Specs** volta a aparecer em todo card de resina com `technical_specs` preenchido.
- Catálogo (Sistema A) e `system_a_live` continuam tendo prioridade — nada muda onde já funciona.
- i18n respeitado (EN/ES caem no PT se vazio).

### Não tocar
- Lookup de resina (slug + apóstrofo) — já corrigido.
- `normalizeSpecs`, modal de specs, ordem dos botões, demais cascatas (FDS/IFU/CTAs).
