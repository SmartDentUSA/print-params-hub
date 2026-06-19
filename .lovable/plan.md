## Objetivo

Eliminar três campos manuais redundantes no `DistributorForm` (admin e público), preenchendo-os automaticamente a partir de dados que já existem no formulário/banco:

1. **Linhas Smart Dent representadas** — derivadas da Autorização Comercial.
2. **Idioma preferencial** — derivado do país.
3. **Regiões / cidades atendidas** — derivadas do país (todas as regiões).

## Mudanças no `src/components/smartops/DistributorForm.tsx`

### 1. Linhas Smart Dent representadas (auto)
- Ampliar a query de `system_a_catalog` no `useEffect` para trazer também `name`, `product_category`, `product_subcategory`.
- Montar um mapa `cat → sub → Set<linha>` onde `linha` = nome curto do produto (heurística: primeiras 2–3 palavras de `name` normalizadas, ex.: "Smart Print Atos Try-in" → "Smart Print Atos"; "SmartMake Kit" → "SmartMake"). Lista final ordenada e deduplicada.
- Sempre que `authorized_scope` mudar:
  - Se categoria marcada com subs → unir linhas das subs selecionadas.
  - Se categoria marcada sem subs → unir linhas de todas as subs da categoria.
- Aplicar em `form.linhas_representadas` automaticamente (sobrescreve, não merge).
- Trocar o `<Input>` editável por um bloco **read-only** com as linhas exibidas como chips + texto "Calculado a partir da Autorização Comercial".

### 2. Idioma preferencial (auto pelo país)
- Mapa `paisCodigo → idioma`:
  - `BR` → `pt`
  - `US, CA (en), GB, AU, IE` → `en`
  - resto da América Latina + Espanha → `es`
  - fallback → `pt`.
- Em `handleCountryChange`, setar `language_preference` automaticamente.
- Remover o `<Select>` manual; substituir por um campo informativo: "Idioma: Español (definido automaticamente pelo país Chile)".

### 3. Regiões / cidades atendidas (auto pelo país)
- Em `handleCountryChange`, popular `service_areas` com **todas as regiões/estados** do país via `State.getStatesOfCountry(country.isoCode)` (já temos `country-state-city` importado). Para Chile retorna as 16 regiões oficiais; para Brasil os 26 estados + DF; etc.
- Remover o `<Input>` manual; substituir por bloco read-only mostrando "Cobertura nacional: 16 regiões do Chile" com lista colapsável (chips).
- Manter botão **"Restringir cobertura"** (opcional, futuro) — fora do escopo agora.

### 4. Defaults em `emptyDistributorForm`
- `language_preference` permanece `"pt"` (será sobrescrito quando país for escolhido).
- `service_areas` começa `[]` e é preenchido no primeiro `handleCountryChange`.

## Efeitos colaterais
- Páginas SSR (`seo-proxy`) já consomem `service_areas`, `linhas_representadas` e `language_preference` direto do banco — sem mudanças no edge function. O JSON-LD `areaServed` e `makesOffer` vão ficar mais completos automaticamente para distribuidores que forem re-salvos.

## Fora do escopo
- Não mexer no schema do banco.
- Não recalcular distribuidores existentes em massa (só vão atualizar ao re-salvar). Posso fazer um backfill em seguida se quiser.
- Não mexer em `seo-proxy`, sitemap, ou backlinks.