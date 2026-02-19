
# Dra. L.I.A. — Diálogo Guiado 100% Baseado nos Dados do Sistema

## O problema atual

O diálogo guiado já funciona (marca → modelo → link), mas **os exemplos nas perguntas são hardcoded**:

- Pergunta de marca mostra: `"ex: Anycubic, Phrozen, Bambu Lab, Elegoo, MiiCraft..."` — fixo no código
- Pergunta de modelo mostra: `"ex: Photon Mono 4, M3 Max, Sonic Mini 8K..."` — fixo no código

O risco: os exemplos ficam desatualizados e a L.I.A. pode citar marcas/modelos que não existem no banco (como "Bambu Lab" que não está cadastrada).

A sugestão é perfeita: **buscar do banco os dados reais** e usar nas perguntas.

## Solução — Enriquecer o diálogo com dados reais do banco

### O que muda no `supabase/functions/dra-lia/index.ts`

**Mudança 1 — `needs_brand`: mostrar as marcas reais do banco**

Ao detectar que o usuário quer parâmetros, antes de retornar `needs_brand`, buscar todas as marcas ativas do banco:

```
Atual (hardcoded):
"qual é a marca da sua impressora?
(ex: Anycubic, Phrozen, Bambu Lab, Elegoo, MiiCraft...)"

Novo (dados reais):
"qual é a marca da sua impressora?
Marcas disponíveis: Anycubic, Creality, Elegoo, Ezy3d, Flashforge, Miicraft, Phrozen, Pionext, Sprintray, Straumann, Uniz, Wanhao"
```

**Mudança 2 — `needs_model`: mostrar os modelos reais da marca escolhida**

Ao confirmar a marca, buscar apenas os modelos daquela marca do banco:

```
Atual (hardcoded):
"Qual é o modelo da impressora?
(ex: Photon Mono 4, M3 Max, Sonic Mini 8K...)"

Novo (dados reais da Anycubic):
"Qual é o modelo da impressora?
Modelos disponíveis: Mono X, Photon D2 Dlp, Photon M2, Photon M5, Photon M5s, Photon Mono 2, Photon Mono 4, Photon Mono 4 Ultra 10k..."
```

**Mudança 3 — `has_printer`: perguntar também a resina (3º passo)**

Ao invés de enviar direto o link após o modelo, adicionar um 4º passo opcional:

```
"Encontrei a Anycubic Photon Mono 4!
Qual resina você vai usar?

Resinas com parâmetros cadastrados para essa impressora:
Smart Print Bio Vitality, Smart Print Bio Clear Guide, Smart Print Bio Hybrid A2...

Ou acesse diretamente a página com todos os parâmetros:
👉 [Ver todos os parâmetros da Anycubic Photon Mono 4](/anycubic/photon-mono-4)"
```

**Mudança 4 — `has_resin`: link direto para a resina específica na página da impressora**

Quando o usuário responde o nome da resina, a L.I.A. verifica se existe `parameter_sets` para aquela combinação e manda o link com âncora:

```
"Ótimo! Encontrei os parâmetros da Smart Print Bio Vitality para a Anycubic Photon Mono 4:
👉 [Ver parâmetros](/anycubic/photon-mono-4#smart-print-bio-vitality)"
```

Se a resina não tiver parâmetros cadastrados para aquela impressora:
```
"Ainda não temos parâmetros da [Resina X] para a Anycubic Photon Mono 4.
Confira as resinas disponíveis para esse modelo:
👉 [Ver parâmetros da Anycubic Photon Mono 4](/anycubic/photon-mono-4)"
```

## Novo `DialogState` com 4 etapas

```typescript
type DialogState =
  | { state: "needs_brand"; availableBrands: string[] }
  | { state: "needs_model"; brand: string; brandSlug: string; brandId: string; availableModels: string[] }
  | { state: "needs_resin"; brandSlug: string; modelSlug: string; brandName: string; modelName: string; availableResins: string[] }
  | { state: "has_resin"; brandSlug: string; modelSlug: string; resinName: string; found: boolean }
  | { state: "brand_not_found"; brandGuess: string; availableBrands: string[] }
  | { state: "model_not_found"; brand: string; brandSlug: string; availableModels: string[] }
  | { state: "not_in_dialog" };
```

## Fluxo completo após a mudança

```text
Usuário: "preciso de configurações para minha impressora"
    ↓
[busca brands do banco → Anycubic, Creality, Elegoo, Miicraft, Phrozen...]
L.I.A.: "Claro! Qual é a marca da sua impressora?
         Marcas disponíveis: Anycubic, Creality, Elegoo, Ezy3d,
         Flashforge, Miicraft, Phrozen, Pionext, Sprintray..."
    ↓
Usuário: "Anycubic"
    ↓
[busca models WHERE brand_id = Anycubic]
L.I.A.: "Ótimo! A Anycubic está cadastrada. Qual é o modelo?
         Modelos disponíveis: Mono X, Photon D2 Dlp, Photon M2,
         Photon M5, Photon M5s, Photon Mono 2, Photon Mono 4..."
    ↓
Usuário: "Photon Mono 4"
    ↓
[busca parameter_sets WHERE brand_slug=anycubic AND model_slug=photon-mono-4 → retorna resinas distintas]
L.I.A.: "Encontrei! Qual resina você vai usar com a Anycubic Photon Mono 4?
         Resinas com parâmetros cadastrados:
         Smart Print Bio Vitality, Smart Print Bio Clear Guide,
         Smart Print Bio Hybrid A2, Smart Print Bio Bite Splint Clear...
         
         Ou acesse diretamente:
         👉 [Ver todos os parâmetros da Anycubic Photon Mono 4](/anycubic/photon-mono-4)"
    ↓
Usuário: "Vitality"
    ↓
[verifica parameter_sets WHERE resin_name ILIKE '%Vitality%' AND brand_slug='anycubic' AND model_slug='photon-mono-4' → encontrou]
L.I.A.: "Perfeito! Acesse os parâmetros da Smart Print Bio Vitality para a Anycubic Photon Mono 4:
         👉 [Ver parâmetros](/anycubic/photon-mono-4)

         Se precisar dos valores específicos, é só me pedir e busco para você!"

--- Fallback: marca não encontrada ---
L.I.A.: "Não encontrei essa marca no sistema.
         Marcas disponíveis: Anycubic, Creality, Elegoo...
         Ou acesse: 👉 [Ver todos os parâmetros](/)"

--- Fallback: modelo não encontrado ---
L.I.A.: "Não encontrei esse modelo para a Anycubic.
         Modelos disponíveis: Mono X, Photon D2 Dlp, Photon M2...
         Ou acesse: 👉 [Ver modelos da Anycubic](/anycubic)"
```

## Benefícios anti-alucinação

| Antes | Depois |
|---|---|
| Exemplos hardcoded (podem conter marcas inexistentes) | Exemplos 100% do banco — se não existe no banco, não é citado |
| "Bambu Lab" aparecia como exemplo mas não está no banco | Só lista marcas com `active = true` |
| Usuário não sabia quais resinas existem para a impressora | Lista exata das resinas com parâmetros cadastrados |
| Após modelo, enviava link sem perguntar a resina | Pergunta a resina antes de enviar o link (fluxo mais completo) |

## Seção Técnica

- Único arquivo alterado: `supabase/functions/dra-lia/index.ts`
- Queries adicionadas:
  - Step `needs_brand`: `SELECT name FROM brands WHERE active = true ORDER BY name` (já existe, só monta lista de strings)
  - Step `needs_model`: `SELECT name FROM models WHERE brand_id = X AND active = true ORDER BY name` (já existe, só monta lista)
  - Step `needs_resin`: `SELECT DISTINCT resin_name FROM parameter_sets WHERE brand_slug = X AND model_slug = Y AND active = true ORDER BY resin_name` — nova query leve
  - Step `has_resin`: `SELECT id FROM parameter_sets WHERE brand_slug = X AND model_slug = Y AND resin_name ILIKE '%Z%' AND active = true LIMIT 1` — nova query leve
- O `DialogState` ganha mais 2 estados (`needs_resin`, `has_resin`) e os mensagens existentes ganham `availableBrands`, `availableModels`, `availableResins` como dados injetados
- O history detection ganha mais 2 checks: `liaAskedResin` (verifica se a última msg da L.I.A. contém "resina")
- Sem mudanças no frontend — o `history` já é enviado normalmente
- Sem migrações de banco necessárias
- Deploy automático ao salvar
