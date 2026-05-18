## Objetivo
Fazer o WhatsApp (Evolution) ter exatamente o mesmo protocolo de atendimento da Dra. LIA no site: mesma qualificação, mesmas rotas (commercial/support/parameters), mesma análise de imagem, mesmos guards.

## Diagnóstico (resumo)
Hoje o WhatsApp chama `dra-lia` via `dra-lia-whatsapp`, mas:
1. `topic_context` é sempre `null` → nunca dispara fluxo comercial (SPIN), suporte estruturado, nem rota de parâmetros.
2. Imagens vão por **outra função** (`smart-ops-wa-inbox-webhook`) com `topic_context: "support"` fixo, e não passam pelo classificador visual do site.
3. Existem **duas funções** recebendo o mesmo webhook Evolution com responsabilidades sobrepostas (drift garantido).
4. Pre-seed de identidade + placeholder lead `wa_*@whatsapp.lead` bypassam a qualificação progressiva do site.
5. Resposta truncada em 4000 chars sem fallback "ver no site".

## Mudanças

### 1. Consolidar em uma única função `dra-lia-whatsapp`
- Mover a lógica de **intent classification** + **hot lead alert** + **inbox logging** de `smart-ops-wa-inbox-webhook` para dentro de `dra-lia-whatsapp`.
- Apontar o webhook da Evolution para `dra-lia-whatsapp` apenas.
- Deprecar `smart-ops-wa-inbox-webhook` (manter um stub que faz forward para a nova função até o webhook ser repontado, depois remover).

### 2. Derivar `topic_context` dinamicamente
Antes de chamar `dra-lia`, computar `topic_context` na seguinte ordem:
- Se mensagem tem imagem → roteamento idêntico ao site (não fixar "support").
- Se intent classificado for `interesse_imediato`, `interesse_futuro`, `objecao`, `pedido_info` → `topic_context = "commercial"`.
- Se intent for `suporte` ou regex `isSupportQuestion` casar → `topic_context = "support"`.
- Se mensagem casar regex de parâmetros (impressora/resina/modelo) → `topic_context = "parameters"`.
- Caso contrário → `null` (comportamento atual).
- Persistir `topic_context` em `agent_sessions.extracted_entities.topic_context` para continuidade entre turnos.

### 3. Imagens com mesmo protocolo do site
- Em `dra-lia-whatsapp`, quando o payload Evolution trouxer mídia tipo imagem:
  - Baixar a imagem, converter para base64.
  - Chamar `dra-lia` passando `image_data: { base64, mime_type }` (mesmo formato do site) **sem** forçar `topic_context: "support"` — deixar o classificador visual (Gemini Flash Lite) decidir.
- Remover a rota de imagem do inbox-webhook (vai junto com a consolidação do item 1).

### 4. Qualificação progressiva também no WhatsApp
- Remover o pre-seed agressivo que pula coleta de email para qualquer lead conhecido por telefone.
- Manter pre-seed apenas quando o lead tem **nome real + email real + telefone real** (não placeholder `@whatsapp.lead`).
- Para lead novo (sem match): **não criar placeholder** imediatamente. Deixar `dra-lia` rodar o fluxo de qualificação (nome → email → telefone → área → especialidade) e só criar o `lia_attendances` quando os campos mínimos estiverem presentes (respeitando `validateLeadIdentity`).
- `session_id = wa_<digits>` continua igual; o lead é vinculado depois via merge engine.

### 5. Encurtamento inteligente da resposta
- Manter `stripMarkdownForWhatsApp` (necessário para WhatsApp não renderizar markdown).
- Se resposta > 4000 chars: cortar no último parágrafo completo + fallback "📖 Resposta completa: {URL do artigo RAG mais relevante}" usando o primeiro link do contexto RAG retornado.
- Se não houver link RAG, fallback genérico para `parametros.smartdent.com.br`.

### 6. Repasse de contexto comercial/SPIN
- Quando `topic_context = "commercial"`, garantir que o histórico (`agent_interactions`) é repassado igual ao site, para que o SPIN avance entre turnos.
- Persistir `spin_progress` em `agent_sessions.extracted_entities` (já é feito pelo `dra-lia`, só precisa garantir que o `session_id` é estável).

### 7. Atualizar memory
- `mem://dra-lia/whatsapp-session-and-identity-v3` → bump v4 documentando: (a) `topic_context` derivado dinamicamente, (b) imagens com classificador visual, (c) qualificação progressiva mantida.
- Nova memória `mem://dra-lia/whatsapp-protocol-parity-v1` consolidando "WhatsApp = Site" como regra.

## Detalhes técnicos (resumo de código)

**Arquivos a alterar:**
- `supabase/functions/dra-lia-whatsapp/index.ts` — absorve classificação de intent, derivação de `topic_context`, processamento de imagem, ajuste do pre-seed.
- `supabase/functions/smart-ops-wa-inbox-webhook/index.ts` — vira um forward 1:1 para `dra-lia-whatsapp` (para não quebrar webhooks já apontados); marcado como deprecated.
- `supabase/functions/_shared/lia-guards.ts` — reuso de `isSupportQuestion`, novo helper `deriveTopicContext(message, intent)` exportado.

**Sem alteração de schema** (`agent_sessions`, `lia_attendances`, `whatsapp_inbox` já têm os campos necessários).

## Não faz parte deste plano
- Mudança no `dra-lia` (site) — permanece intocado, é a referência de verdade.
- Migração para outro provedor de WhatsApp.
- Mudança na UI do Inbox/Kanban.

## Validação
1. Mensagem comercial via WA ("quero comprar uma Phrozen") → deve disparar SPIN igual ao site (verificar `spin_progress` em `agent_sessions`).
2. Foto de impressão com defeito via WA → deve passar pelo classificador visual (verificar log `[IMAGE_RAG]` em `dra-lia`).
3. "Como faço cura de resina?" via WA → resposta idêntica à do site, com mesmos links canônicos.
4. Lead novo via WA → não cria placeholder até ter nome+email reais.