

## Plano: Adicionar coleta de telefone para leads NOVOS + Sanitizar `+` no WaLeads

### Diagnóstico

O telefone **funciona para leads retornantes** (linha 2740-2772: verifica `missingPhone` e pede). Para **leads novos**, o estado `"collected"` (linha 2963) pula direto para `awaiting_area` sem nunca pedir telefone. O teste com `jesusnacausa@gmail.com` era um lead novo, por isso não pediu.

O segundo problema: o `whatsapp_number` do team_member tem `+` na frente (ex: `+5516981158403`) e a API WaLeads não aceita o prefixo `+`.

---

### Implementação

#### 1. Adicionar telefone no fluxo de leads novos (`supabase/functions/dra-lia/index.ts`)

**Estado "collected" (linha 2963-2982):** Em vez de ir direto para `awaiting_area`, ir para `awaiting_phone`:
- Mudar `awaiting_area: true` para `awaiting_phone: true` nas `extracted_entities`
- Mudar o texto de resposta de `ASK_AREA` para perguntar o telefone
- O handler `needs_phone` (linha 2873) já trata a validação e salvamento — após salvar, ele já verifica se falta área e redireciona (linha 2906-2925)

Ou seja, a mudança é mínima: apenas no bloco "collected" (linhas 2968-2998), trocar a flag e o texto.

#### 2. Sanitizar `+` no WaLeads (`supabase/functions/smart-ops-send-waleads/index.ts`)

Na linha 115 (WaLeads path), antes de montar `apiBody`:
- `const cleanPhone = phone.replace(/^\+/, '');`
- Usar `cleanPhone` em `apiBody.chat` e na URL da API (linha 121)

### Arquivos modificados
- `supabase/functions/dra-lia/index.ts` — bloco "collected" (~linha 2968): `awaiting_area` → `awaiting_phone` + texto pedindo telefone
- `supabase/functions/smart-ops-send-waleads/index.ts` — sanitizar `+` do phone antes de enviar

