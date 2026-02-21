
# Inverter Fluxo: E-mail Primeiro + Busca de Historico

## Problema Atual

O backend (edge function `dra-lia`) segue esta ordem fixa:
1. Pergunta o **nome** primeiro
2. Depois pede o **e-mail**
3. Salva o lead

Isso causa dois problemas:
- O usuario que ja interagiu antes precisa repetir tudo
- O sistema nao busca se o e-mail ja existe na tabela `leads` antes de continuar

## Nova Logica

O fluxo de lead collection passara a ser:

1. Perguntar o **e-mail** primeiro
2. Buscar na tabela `leads` pelo e-mail informado
3. Se encontrar: recuperar o nome do lead existente, pular coleta de nome, saudar pelo nome e continuar
4. Se NAO encontrar: perguntar o nome, depois salvar o novo lead

## Mudancas Tecnicas

### Arquivo: `supabase/functions/dra-lia/index.ts`

**1. Alterar `LeadCollectionState` type (linha ~775)**

Adicionar novo estado `needs_email_first` e `checking_email`:
```
type LeadCollectionState =
  | { state: "needs_email_first" }
  | { state: "needs_name"; email: string }
  | { state: "needs_email"; name: string }  // manter por compatibilidade
  | { state: "collected"; name: string; email: string }
  | { state: "from_session"; name: string; email: string; leadId: string };
```

**2. Reescrever `detectLeadCollectionState` (linhas ~781-873)**

Nova logica:
- Se session tem `lead_id` + `lead_name` + `lead_email` -> `from_session`
- Se historico vazio -> `needs_email_first` (antes era `needs_name`)
- Procurar e-mail nas mensagens do usuario
  - Se encontrou e-mail E a ultima resposta do assistant foi pedindo nome -> extrair nome da proxima msg do usuario
  - Se encontrou e-mail MAS sem nome ainda -> `needs_name` (com email)
- Se nenhum e-mail encontrado -> verificar se o assistant ja pediu o e-mail
  - Se sim e usuario respondeu com e-mail -> `needs_name` (com email)
  - Se nao -> `needs_email_first`

**3. Atualizar mensagens de coleta (linhas ~766-885)**

- `GREETING_RESPONSES`: mudar de "qual o seu nome?" para "qual o seu melhor e-mail?"
- `contextAck` (linha ~1482): mudar de "qual o seu nome?" para "qual o seu melhor e-mail?"
- Adicionar `ASK_NAME` (novo): "Prazer! Nao encontrei seu cadastro. Qual o seu nome?"
- Adicionar `RETURNING_LEAD` (novo): "Que bom te ver de novo, {name}! Como posso te ajudar?" — para leads que ja existem

**4. Novo handler no intercept de lead (linhas ~1476-1542)**

- `needs_email_first`: responder pedindo e-mail (GREETING ou contextAck)
- Quando receber e-mail (`needs_name` com email):
  - Fazer `SELECT name, id FROM leads WHERE email = '{email}'`
  - Se encontrar: persistir session com lead_id/name/email, retornar mensagem `RETURNING_LEAD`
  - Se NAO encontrar: retornar `ASK_NAME` pedindo o nome
- Quando receber nome apos email (`collected`): salvar lead normalmente com upsertLead

**5. Atualizar regex de deteccao na `detectLeadCollectionState`**

- Detectar "qual o seu e-mail" / "what's your email" como pergunta de e-mail (ja existente)
- Detectar "qual o seu nome" como pergunta de nome
- A ordem agora e: e-mail primeiro, nome segundo (se necessario)

### Arquivo: `src/locales/pt.json`, `en.json`, `es.json`

- Atualizar `welcome_message` para indicar que o e-mail sera solicitado (nao o nome)
- Exemplo PT: "Ola! Sou a Dra. L.I.A., especialista em odontologia digital da SmartDent. Como posso te ajudar hoje?" (manter generico, o menu de topicos aparece)

### Arquivo: `src/components/DraLIA.tsx`

- Atualizar deteccao de lead confirmado (linha ~385) para tambem reconhecer a mensagem `RETURNING_LEAD` ("Que bom te ver de novo")
- Isso garante que `leadCollected` sera setado corretamente tanto para novos quanto para leads que retornaram

## Resumo do Novo Fluxo

```text
Usuario abre chat
  -> Welcome + Menu de topicos
  -> Seleciona topico (ex: "Produtos")
  -> Backend: "Qual o seu melhor e-mail?"
  -> Usuario: "danilo@gmail.com"
  -> Backend busca: SELECT * FROM leads WHERE email = 'danilo@gmail.com'
     -> ENCONTROU (name = "Danilo"):
        -> "Que bom te ver de novo, Danilo! Como posso te ajudar?"
        -> Sessao atualizada com lead_id, pula para conversa normal
     -> NAO ENCONTROU:
        -> "Prazer! Para eu te conhecer melhor, qual o seu nome?"
        -> Usuario: "Danilo"
        -> Salva lead, confirma e continua
```
