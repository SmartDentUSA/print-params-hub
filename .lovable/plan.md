

# Fix: Card do Paulo Salles com seções faltando

## Diagnóstico

O card do Paulo Salles (psallesjunior@gmail.com) tem **19 deals ganhos** e dados válidos, mas a aba "Análise Cognitiva" aparece vazia porque o `cognitive_analysis` salvo no banco tem formato antigo — só contém `{model, ai_narrative, ai_narrative_updated_at}`, **sem os campos estruturados** (`psychological_profile`, `primary_motivation`, `objection_risk`, `stage_trajectory`, `recommended_approach`, `seasonal_pattern`).

No card do danilohen@gmail.com, esses campos existem porque a análise foi gerada por uma versão mais recente da function.

### Dados reais do Paulo:
- `cognitive_analysis.ai_narrative`: ✅ Existe (texto completo sobre perfil de protesista)
- `cognitive_analysis.psychological_profile`: ❌ Não existe
- `cognitive_analysis.primary_motivation`: ❌ Não existe
- `cognitive_analysis.objection_risk`: ❌ Não existe
- `cognitive_analysis.stage_trajectory`: ❌ Não existe
- `cognitive_analysis.recommended_approach`: ❌ Não existe

O código no frontend (linha 470-481) filtra cards com `.filter(c => c.content)`, então todos os 6 cards cognitivos somem. Resultado: a aba "Cognitivo" mostra apenas "Clique em Reanalisar".

### Segundo problema: `astron_courses_access` é `{}` (objeto) em vez de `[]` (array)
No código (linha 574): `const astronCourses = (ld.astron_courses_access as any[]) || []` — como `{}` é truthy, o fallback `|| []` não ativa. Embora não cause crash hoje (porque `{}.length` é `undefined`, que é falsy), é um bug latente.

## Correções

### 1. Frontend — Exibir `ai_narrative` quando campos estruturados estão vazios (`LeadDetailPanel.tsx`)

Na aba "cognitivo" (linhas 960-1023), quando `cogCards.length === 0` mas `cog?.ai_narrative` existe, mostrar o texto da narrativa em vez de "Clique em Reanalisar":

```ts
// Quando não tem cards estruturados mas tem narrativa, exibir a narrativa
} : cog?.ai_narrative ? (
  <div className="cog-card">
    <h4>🧠 Análise Cognitiva</h4>
    <p>{cog.ai_narrative}</p>
    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
      ⚠️ Análise em formato simplificado. Clique "Reanalisar" para gerar cards estruturados.
    </div>
  </div>
) : (
  // fallback original
```

### 2. Frontend — Guardar `astronCourses` com proteção de tipo (`LeadDetailPanel.tsx`)

Linha 574:
```ts
const astronCourses = Array.isArray(ld.astron_courses_access) ? ld.astron_courses_access : [];
```

### 3. Frontend — Pre-fill `cognitiveText` a partir da narrativa existente

Linha 207: Já existe o pre-fill, mas o `ai_narrative` é usado. O problema é que quando o usuário entra na aba "cognitivo", o `cognitiveText` está null se não tem `ai_narrative` na resposta da API. Garantir que o pre-fill funciona para narrativas do formato antigo.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/smartops/LeadDetailPanel.tsx` | 3 fixes: exibir ai_narrative como fallback, proteger tipo de astronCourses, pre-fill cognitive text |

