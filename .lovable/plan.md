## Objetivo
Após capturar o produto, (1) confirmar visualmente a escolha com sub-opções específicas quando aplicável, e (2) coletar **área de atuação** e **especialidade** caso o lead ainda não tenha esses campos preenchidos.

## Novo fluxo

```
ask_name → ask_email → ask_phone → ask_product
  → ask_product_model (se impressora_3d ou scanner_intraoral)
  → ask_area        (se lia_attendances.area_atuacao vazio)
  → ask_specialty   (se lia_attendances.especialidade vazio)
  → completed (rotas)
```

## 1. Confirmação + sub-opção por produto

Quando o produto for capturado, responder com **uma única mensagem** que confirma e já oferece a próxima pergunta.

### Sub-listas
- `impressora_3d` → "🖨️ Impressora 3D"
  - 1) RayShape Edge Mini
  - 2) Elegoo Mars 5 Ultra
  - 3) Outra (descreva)
- `scanner_intraoral` → "📷 Scanner intraoral"
  - 1) Scanner Medit
  - 2) Scanner BLZ
  - 3) Outro (descreva)
- `resinas` → "🧪 Resinas e consumíveis" — sem sub-lista, segue direto.
- `cursos` → "🎓 Cursos e treinamentos" — sem sub-lista, segue direto.
- texto livre → usa o texto capitalizado, sem sub-lista.

Mensagem exemplo (impressora):
```
Anotado: 🖨️ Impressora 3D ✅
Qual modelo te interessa mais?
1) RayShape Edge Mini
2) Elegoo Mars 5 Ultra
3) Outro (descreva)
```

Estado: `qualification_state = "ask_product_model"`, `entities.awaiting_manychat_product_model = true`.

Resposta do modelo é persistida em `lia_attendances.produto_interesse_raw` (concatenando: `"{canonical} | {modelo escolhido}"`) — `produto_interesse_auto` continua sendo o canonical do produto-mãe. Loga `manychat_product_model_captured`.

## 2. Área de atuação (condicional)

Disparada se, após product/model, `lia_attendances.area_atuacao` estiver nulo/vazio.

Lista numerada usando `AREA_ATUACAO_OPTIONS` de `src/lib/dentalTaxonomy.ts` (replicada no edge function — import direto não é possível em Deno, então copia o array em `_shared/dental-taxonomy.ts` para reuso):
```
Para te direcionar melhor, qual é a sua área de atuação?
1) Clínica ou Consultório
2) Laboratório de Prótese
3) Radiologia Odontológica
4) Planning Center
5) Empresa de Alinhadores
6) Gestor de Rede de Clínicas
7) Gestor de Franquias
8) Central de Impressões
9) Educação
```
- Aceita número (1-9) ou texto (matching via `canonicalize`).
- Persiste em `lia_attendances.area_atuacao` (valor canônico em MAIÚSCULA).
- Estado: `ask_area`, `entities.awaiting_manychat_area = true`.
- Log: `manychat_area_captured`. Inválido → retry com lista novamente.

## 3. Especialidade (condicional)

Mesmo padrão, disparada se `lia_attendances.especialidade` estiver vazio. Lista numerada 1-13 usando `ESPECIALIDADE_OPTIONS`. Persiste em `lia_attendances.especialidade`. Estado `ask_specialty`. Log `manychat_specialty_captured`.

## 4. Mensagem final

Após tudo coletado:
```
Tudo certo, {firstName}! ✅
Como posso te ajudar agora?
```
Segue com as 4 rotas atuais (sem mudança no menu).

## Implementação técnica

**Arquivos:**
- `supabase/functions/_shared/dental-taxonomy.ts` (novo) — exporta `AREA_ATUACAO_OPTIONS`, `ESPECIALIDADE_OPTIONS`, `findOptionByIndex`, `normalize`, `canonicalize`. Espelha `src/lib/dentalTaxonomy.ts`.
- `supabase/functions/manychat-lia-bridge/index.ts`:
  - Estender `ReplyMeta.state` com `"ask_product_model" | "ask_area" | "ask_specialty"`.
  - Estender `LeadRow` para incluir `area_atuacao`, `especialidade`, `produto_interesse_raw`.
  - Adicionar `PRODUCT_MODELS: Record<canonical, string[]>` com as listas acima.
  - Estender `nextMissing` na ordem: name → email → phone → product → product_model (condicional) → area (condicional) → specialty (condicional) → null.
  - Helpers `needsProductModel(canonical, raw)`, `needsArea(lead)`, `needsSpecialty(lead)`.
  - Cada novo estado: bloco `else if (nextMissing === "x" && entities.awaiting_manychat_x)` para captura + bloco `if (missingX)` para pergunta + upsert na `agent_sessions`.
  - Para `ask_area`/`ask_specialty`: parse numérico OU `canonicalize(...)`. Inválido → retry com lista.
  - Mensagem final unificada já com "✅ Tudo certo".
- **Sem migration**: colunas `area_atuacao`, `especialidade`, `produto_interesse_raw` já existem em `lia_attendances` (confirmar; se faltar `area_atuacao`/`especialidade`, criar migration mínima).

## Validação
1. Curl com subscriber novo, responder `1` em product → resposta deve trazer `Anotado: 🖨️ Impressora 3D` + sub-lista de modelos.
2. Responder `2` no modelo → grava `produto_interesse_raw = "impressora_3d | Elegoo Mars 5 Ultra"`, segue para área (se vazia).
3. Responder `1` em área → grava `CLÍNICA OU CONSULTÓRIO`, segue para especialidade.
4. Lead que **já tem** `area_atuacao` e `especialidade` preenchidos → pula direto para rotas após product/model.
5. Resposta inválida em área/especialidade → bot repete a lista.

## Não muda
- Persistência/criação do lead, mapeamento ManyChat (`$.reply → chatgpt_resposta`), 4 rotas finais, logs de produto já existentes.
- Sub-lista mostrada apenas para impressora/scanner; resinas/cursos seguem direto.
