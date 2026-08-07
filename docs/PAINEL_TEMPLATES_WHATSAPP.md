# Painel "Templates WhatsApp" — requisitos

Painel de leitura dos templates da WhatsApp Cloud API dentro de
**SmartOps → Campanhas**. Serve de vitrine local do que está aprovado na Meta,
para que o wizard de campanha possa oferecer só o que realmente pode ser
disparado.

---

## Identificação da aba

| Campo | Valor |
|---|---|
| Rótulo | **Templates WhatsApp** |
| `value` | `templates-wa` |
| Posição | último item, logo após `Origens` (`formularios-meta`) |
| Arquivo | `src/components/SmartOpsCampaigns.tsx` (`TabsList` da linha ~2806) |

Ordem final das abas:

```
Biblioteca de Conteúdo · Criar Campanha · Rascunhos · Histórico ·
Grupos WA · Origens · Templates WhatsApp
```

---

## Conta de origem

Valores já apurados. Não usar outros.

| Campo | Valor |
|---|---|
| WABA ID | `1289569149586649` — "Smart Dent Marketing" |
| Phone Number ID | `1242448845619620` |
| Número | +55 16 99750-1531 |
| App Meta | `1111860051255546` |

---

## Escopo — o que este painel é e o que não é

**É** um espelho local, somente leitura, do que existe na Meta.

**Não é** um editor de templates. A criação e a submissão continuam sendo
feitas no Gerenciador do WhatsApp. Não construir formulário de criação,
edição ou submissão de template.

Motivo: texto de template aprovado não pode ser alterado livremente — a
edição volta para análise e tem limite mensal. Um editor local daria a
impressão errada de que o texto muda quando se quiser.

---

## Fonte de dados

A tabela **`whatsapp_templates` já existe e está vazia** (0 linhas). Ela foi
criada para outro fim e nunca foi usada. Reaproveitar — não criar tabela nova.

Colunas existentes:

```
template_name, template_category, language_code, header_type, header_content,
body_text, footer_text, buttons (jsonb), variables (array), status,
source_system, source_id, related_product_ids, performance_data, metadata,
created_at, updated_at, approved_at
```

Colunas a acrescentar:

```sql
alter table whatsapp_templates
  add column waba_id          text,
  add column meta_template_id text,
  add column components       jsonb,   -- payload cru da Meta
  add column rejected_reason  text,
  add column last_synced_at   timestamptz;
```

Chave de deduplicação na sincronização: `(waba_id, template_name, language_code)`.

---

## Requisitos funcionais

### 1. Sincronizar com a Meta

Botão que chama a edge function `smart-ops-whatsapp-templates-sync`, que por
sua vez consulta:

```
GET /{GRAPH_API_VERSION}/1289569149586649/message_templates
```

Grava/atualiza `whatsapp_templates`, preservando o `components` cru e o
`status` exatamente como a Meta devolve (`APPROVED`, `PENDING`, `REJECTED`).
Marca `last_synced_at`.

Durante a chamada: estado de carregamento no botão. Ao terminar: toast com
quantos templates foram criados e quantos atualizados.

### 2. Lista de templates

Uma linha por template, com:

- nome (`template_name`)
- categoria — `MARKETING`, `UTILITY` ou `AUTHENTICATION`
- idioma (`language_code`)
- status com cor:
  - `APPROVED` → verde
  - `PENDING` → amarelo
  - `REJECTED` → vermelho, **exibindo `rejected_reason`**
- variáveis detectadas no corpo (`{{1}}`, `{{2}}`…)
- botões do template, quando houver
- data da última sincronização

### 3. Prévia renderizada

Ao abrir um template, mostrar como a mensagem chega no WhatsApp: cabeçalho,
corpo com as variáveis destacadas, rodapé e botões. Não é preciso simular o
balão do WhatsApp — basta a estrutura legível na ordem correta.

### 4. Filtros

Por status e por categoria. Padrão: mostrar todos.

### 5. Aviso de modo de desenvolvimento

Alerta fixo no topo do painel:

> App em modo de desenvolvimento — envio limitado aos números de teste
> cadastrados no App Dashboard.

O app `1111860051255546` está em `dev_mode` e ainda não passou pelo App Review.
Nesse estado a Meta só entrega mensagem para até 5 números de teste. A
interface não pode sugerir que o disparo para a base já está liberado.

### 6. Estados

- **Vazio, nunca sincronizado**: explicar que é preciso sincronizar e mostrar
  o botão em destaque.
- **Vazio após sincronizar**: informar que a WABA não tem template cadastrado
  e apontar o Gerenciador do WhatsApp como o lugar de criar.
- **Erro na sincronização**: mostrar a mensagem de erro da Meta legível, não
  só o código HTTP.

---

## Ligação com o wizard de campanha

O wizard usa este painel como fonte: ao escolher o canal **API Oficial Meta**
no passo 1, o select de templates lista **apenas os `APPROVED`**. `PENDING` e
`REJECTED` não podem ser escolhidos.

Cada variável do template é mapeada para uma coluna do lead, e o mapeamento é
salvo em `campaigns.wa_variable_map` no formato `{"1":"nome","2":"produto_interesse"}`.

**Alerta obrigatório no mapeamento**: variável vazia faz a Meta rejeitar o
envio. Ao lado de cada mapeamento, mostrar quantos leads do segmento têm
aquele campo preenchido.

Esse alerta não é teórico. Medição na base em 07/08/2026, no segmento de
2.145 leads com telefone ligados a RayShape:

| Campo | Preenchido | Serve de variável? |
|---|---|---|
| `nome` | 2.145 (100%) | sim |
| `area_atuacao` | 2.048 (95%) | com reserva para os 97 restantes |
| `especialidade` | **202 (9%)** | não |

Mapear `especialidade` numa variável faria 91% dos envios falharem.

---

## Fora do escopo deste painel

- Envio de campanha — é o wizard, em `Criar Campanha`
- Configuração de janela, dias e ritmo de disparo — passo 3 do wizard
- Webhook de recebimento e qualificação — bloco separado
- Canal Evolution e Grupos WA — permanecem como estão
