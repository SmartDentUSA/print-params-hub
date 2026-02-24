

## Auditoria do Fluxo de Qualificação da LIA

### Fluxo Documentado (conforme memória do projeto)

O fluxo de qualificação deveria seguir **4 etapas sequenciais**:
1. **E-mail** — primeira coisa pedida
2. **Nome** — se lead novo (não encontrado no banco)
3. **Área de Atuação** — selecionada via grade de botões no frontend, acionada por `ui_action`
4. **Especialidade** — selecionada via grade de botões no frontend, acionada por `ui_action`

Os dados coletados deveriam ser sincronizados imediatamente via upsert na `lia_attendances` (campos `area_atuacao` e `especialidade`).

### Fluxo Real (código atual)

```text
ETAPA 1: E-mail
├── ✅ IMPLEMENTADO (needs_email_first)
├── ✅ Salva context_raw "[INTERCEPTOR] lead_collection:needs_email_first"
└── ✅ Reconhece contexto antes de pedir email

ETAPA 2: Nome (se lead novo)
├── ✅ IMPLEMENTADO (needs_name)
├── ✅ Busca lead existente por email na tabela leads
├── ✅ Se encontra → returning lead com resumo IA + show_topics
├── ✅ Se não encontra → pede nome
└── ✅ Salva context_raw

ETAPA 3: Área de Atuação
├── ❌ NÃO IMPLEMENTADO
├── ❌ Nenhum ui_action "show_area_grid" existe no backend
├── ❌ Nenhum componente de grade de área no frontend (DraLIA.tsx)
├── ❌ Campo area_atuacao NUNCA é preenchido pela LIA
└── ❌ O upsertLead não salva area_atuacao

ETAPA 4: Especialidade
├── ❌ NÃO IMPLEMENTADO como etapa de coleta ativa
├── ⚠️  Detectada PASSIVAMENTE via regex no SPIN progress (linha 2432)
├── ❌ Nenhum ui_action "show_specialty_grid" existe
├── ❌ Nenhum componente de grade de especialidade no frontend
└── ❌ Campo especialidade só é preenchido se o lead mencionar
      espontaneamente durante a conversa comercial
```

### Problemas Identificados

**P1: Etapas 3 e 4 nunca foram implementadas no código**
A memória do projeto documenta que Área de Atuação e Especialidade deveriam ser coletadas via grades de botões (`ui_action`), mas essa funcionalidade não existe — nem no backend (`dra-lia/index.ts`) nem no frontend (`DraLIA.tsx`).

**P2: Dados de qualificação incompletos em `lia_attendances`**
Dos 16 leads, todos têm `area_atuacao = NULL` e `especialidade = NULL` (vindos da LIA). Apenas leads ingeridos pelo webhook externo (`smart-ops-ingest-lead`) podem ter esses campos preenchidos.

**P3: Especialidade detectada passivamente é frágil**
O SPIN progress detecta especialidade via regex (`/implant|prótese|ortodont.../`), mas isso só funciona se o lead mencionar espontaneamente. A detecção é salva apenas em `extracted_entities` da sessão, sem persistir em `lia_attendances`.

**P4: Fluxo pula direto para seleção de tópico**
Após coletar email+nome (ou reconhecer lead existente), o fluxo vai direto para os 4 cards de tópico (Parâmetros, Comercial, Produtos, Suporte), pulando a coleta ativa de Área e Especialidade.

### Plano de Implementação

#### 1. Backend (`dra-lia/index.ts`)

Adicionar duas novas etapas no fluxo de lead collection, entre o "collected" e o "show_topics":

- **Estado `needs_area`**: Após confirmar nome+email de um lead NOVO, enviar `ui_action: "show_area_grid"` com as opções de área de atuação (Clínica, Laboratório, Docência, Indústria, Estudante, etc.)
- **Estado `needs_specialty`**: Após receber a área, enviar `ui_action: "show_specialty_grid"` com especialidades filtradas pela área (ex: se Clínica → Implantodontia, Prótese, Ortodontia, Endodontia, Estética, Clínica Geral)
- Persistir ambos os campos em `lia_attendances` e `leads` imediatamente via upsert
- Para leads RETORNANTES (já têm area/especialidade), pular essas etapas

O `detectLeadCollectionState` precisará de dois novos estados:
```text
| { state: "needs_area"; name: string; email: string; leadId: string }
| { state: "needs_specialty"; name: string; email: string; leadId: string; area: string }
```

#### 2. Frontend (`DraLIA.tsx`)

Criar dois novos componentes de grade de botões:
- **AreaGrid**: Grade com 5-6 opções de área de atuação, renderizada quando `ui_action === "show_area_grid"`
- **SpecialtyGrid**: Grade com especialidades filtradas pela área selecionada, renderizada quando `ui_action === "show_specialty_grid"`

Ao clicar em uma opção, enviar a seleção como mensagem do usuário para o backend (ex: "Clínica" ou "Implantodontia").

#### 3. Dados (`lia_attendances` sync)

Modificar o `upsertLead` para aceitar `area_atuacao` e `especialidade` como parâmetros opcionais, e persistir no upsert de `lia_attendances`. Criar um handler separado que atualiza esses campos quando o lead responde as grades.

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/dra-lia/index.ts` | Adicionar estados `needs_area` e `needs_specialty` no `detectLeadCollectionState`; handlers para cada estado com `ui_action`; persistência em `lia_attendances` |
| `src/components/DraLIA.tsx` | Adicionar renderização de `AreaGrid` e `SpecialtyGrid` via `ui_action`; handlers de clique que enviam seleção ao backend |

### Detalhes técnicos

Opções de Área de Atuação:
- Clínica Odontológica
- Laboratório de Prótese
- Universidade/Docência
- Indústria/Pesquisa
- Estudante

Especialidades por área (Clínica):
- Implantodontia
- Prótese Dentária
- Ortodontia
- Endodontia
- Dentística/Estética
- Clínica Geral
- Cirurgia

Para leads retornantes que já têm `area_atuacao` e `especialidade` preenchidos, o fluxo pula direto para o `show_topics` como já acontece hoje.

