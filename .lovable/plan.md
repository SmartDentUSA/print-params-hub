## Mudança

Adicionar **5º passo de qualificação** no `manychat-lia-bridge`: após coletar nome → email → telefone, perguntar **produto de interesse** antes de enviar as rotas finais.

## Fluxo novo

```
ask_name → ask_email → ask_phone → ask_product → completed (rotas)
```

## Detalhes

### 1. Pergunta
Após telefone confirmado, retorna:
> "Última pergunta, {firstName}! Qual produto/tema te interessa mais agora?
> 1) 🖨️ Impressora 3D
> 2) 📷 Scanner intraoral
> 3) 🧪 Resinas e consumíveis
> 4) 🎓 Cursos e treinamentos
> 5) 💬 Outro (descreva)"

`qualification_state = "ask_product"`.

### 2. Captura da resposta
- Aceita número (1-5) OU texto livre.
- Mapeia número → label canônica:
  - 1 → `impressora_3d`
  - 2 → `scanner_intraoral`
  - 3 → `resinas`
  - 4 → `cursos`
  - 5 → texto livre do usuário
- Reaproveita lógica de keyword existente (`anycubic`, `phrozen`, `scanner`, `medit`, etc.) para enriquecer quando vier texto livre — referência: `mem://smart-ops/behavioral-form-ingestion`.

### 3. Persistência em `lia_attendances`
- `produto_interesse_auto` = label canônica (ou texto livre cru).
- `produto_interesse_raw` = mensagem original do usuário (para auditoria).
- `updated_at = now()`.
- Em caso de coluna inexistente, fallback grava em `form_data` JSONB (`form_data.produto_interesse_manychat`).

### 4. Sessão
- `entities.awaiting_manychat_product = true` quando perguntando.
- `entities.collected_product` armazenado após resposta.
- Após captura: `current_state = "idle"` e segue para rotas.

### 5. Rotas finais
Mensagem de fechamento personalizada conforme produto escolhido:
- Impressora/Scanner/Resinas → realça rota "Ver produtos" + link de catálogo.
- Cursos → realça rota "Cursos".
- Outro → mantém as 4 rotas padrão.

`qualification_state = "completed"`, `lead_product` adicionado ao envelope JSON (para ManyChat mapear em Custom Field se quiser).

### 6. `nextMissing` atualizado
Cascade vira: name → email → phone → **product** → null. Sessões antigas sem product param em `ask_product`.

### 7. Logs
- `manychat_ask_product` (info)
- `manychat_invalid_product` (info, se vazio)
- `manychat_product_captured` (info, com label final)

## Arquivos
- `supabase/functions/manychat-lia-bridge/index.ts` (única mudança de código)
- Sem migration: colunas `produto_interesse_auto` e `produto_interesse_raw` já existem em `lia_attendances` (confirmar no schema; senão, criar migration mínima adicionando-as como `text NULL`).

## Validação
1. Curl 5 passos com subscriber novo → última resposta antes de `completed` deve ser `ask_product`.
2. Enviar "1" → `produto_interesse_auto = 'impressora_3d'`, segue para rotas.
3. Enviar "tenho interesse em scanner Medit" → texto livre salvo cru + keyword detecta `scanner`.
4. Conferir `lia_attendances.produto_interesse_auto` populado.
5. `system_health_logs` mostra sequência `ask_name → ask_email → ask_phone → ask_product → manychat_profile_completed`.

## Não muda
- ManyChat mapping continua `$.reply → chatgpt_resposta`.
- Email sintético, origem Instagram, channel — intocados.
- Async / Send API — fora deste escopo (bridge segue síncrona).