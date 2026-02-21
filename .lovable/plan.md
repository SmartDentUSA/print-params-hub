

# Captura de Leads e Historico de Conversas da Dra. LIA

## Visao Geral

Criar um sistema onde a Dra. LIA pergunta nome e email logo no inicio de cada conversa, registra o lead no banco de dados, e vincula todas as interacoes ao lead. Isso resolve tambem o problema de loop, pois o historico fica persistido e consultavel.

## Mudancas

### 1. Nova tabela `leads` no banco de dados

```sql
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  specialty text,
  equipment_status text,
  workflow_interest text,
  pain_point text,
  spin_completed boolean DEFAULT false,
  source text DEFAULT 'dra-lia',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX leads_email_idx ON public.leads(email);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar
CREATE POLICY "Admins can manage leads" ON public.leads
  FOR ALL USING (is_admin(auth.uid()));

-- Edge function insere via service_role (bypassa RLS)
```

### 2. Adicionar coluna `lead_id` na tabela `agent_interactions`

```sql
ALTER TABLE public.agent_interactions
  ADD COLUMN lead_id uuid REFERENCES public.leads(id);
```

### 3. Adicionar coluna `lead_id` na tabela `agent_sessions`

```sql
ALTER TABLE public.agent_sessions
  ADD COLUMN lead_id uuid REFERENCES public.leads(id);
```

### 4. Alterar o fluxo da Dra. LIA (`supabase/functions/dra-lia/index.ts`)

**Novo fluxo de abertura (antes de qualquer SPIN):**

- Quando `history` esta vazio (conversa nova), a LIA responde com a saudacao + pergunta do nome
- Quando o lead responde o nome, a LIA pede o email
- Quando o lead responde o email, a LIA salva na tabela `leads` (upsert por email), vincula ao `agent_sessions`, e so entao inicia o SPIN

**Implementacao tecnica:**

1. Criar funcao `detectLeadCollectionState(history)` que analisa o historico para saber se nome e email ja foram coletados
2. Adicionar logica no handler principal: se lead nao identificado, injetar instrucao de coleta antes do SPIN
3. Ao receber email valido, fazer upsert na tabela `leads` e atualizar `agent_sessions.lead_id`
4. Nas interacoes subsequentes, incluir `lead_id` no insert de `agent_interactions`

**Mudanca no prompt SDR:**

Adicionar ETAPA 0 antes da ETAPA 1:

```text
**ETAPA 0 — IDENTIFICACAO DO LEAD (OBRIGATORIA antes de qualquer outra etapa)**
Na PRIMEIRA mensagem, apresente-se e pergunte o nome do lead:
"Ola! Sou a Dra. L.I.A., especialista em odontologia digital da Smart Dent. Antes de comecarmos, qual o seu nome?"
Apos receber o nome, pergunte o email:
"Prazer, [nome]! Para eu poder te enviar materiais e acompanhar seu caso, qual seu melhor email?"
Apos receber o email, inicie a ETAPA 1 normalmente.
NUNCA inicie o SPIN sem ter nome e email.
```

### 5. Atualizar `extracted_entities` no `agent_sessions`

Ao coletar nome e email, salvar no campo `extracted_entities` do session:

```json
{
  "lead_name": "Dr. Marcelo",
  "lead_email": "marcelo@clinica.com",
  "lead_id": "uuid-do-lead",
  "spin_stage": "etapa_1",
  "specialty": null,
  "equipment_status": null
}
```

Isso permite que a funcao consulte o estado sem depender apenas do historico de mensagens.

### 6. Painel Admin — visualizacao de leads (opcional, fase 2)

Uma nova aba no admin para listar leads capturados com nome, email, especialidade, data, e link para o historico de conversa. Isso pode ser implementado depois.

## Sequencia de implementacao

1. Migracoes SQL (tabela `leads` + colunas `lead_id`)
2. Atualizar `dra-lia/index.ts` com ETAPA 0 e logica de persistencia
3. Deploy da edge function
4. Testar fluxo completo

## Beneficios

- Leads ficam registrados no banco para follow-up comercial
- Historico de conversa vinculado ao lead (rastreabilidade)
- SPIN nao repete porque `extracted_entities` persiste os dados coletados
- Base de dados de leads para o time comercial
