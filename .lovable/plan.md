## Objetivo
Incorporar o layout da imagem de referência (anexada) como **regra fixa de posicionamento** no prompt da capa de evento, incluindo a **bandeira do país** selecionado no editor.

## Mudança única: `supabase/functions/event-generate-image/index.ts`

### 1. Adicionar mapa de bandeiras por país
Mapa simples `country → emoji/nome de bandeira` (PT-BR como label legível):
- Brasil 🇧🇷, Estados Unidos 🇺🇸, Itália 🇮🇹, Alemanha 🇩🇪, França 🇫🇷, Espanha 🇪🇸, Reino Unido 🇬🇧, Portugal 🇵🇹, México 🇲🇽, Argentina 🇦🇷, China 🇨🇳, Japão 🇯🇵, Emirados Árabes 🇦🇪, Canadá 🇨🇦, Suíça 🇨🇭, Holanda 🇳🇱
- Fallback: usar o nome do país literal de `ev.country` se não estiver no mapa.

### 2. Bloco fixo `=== LAYOUT OBRIGATÓRIO (posicionamento dos elementos) ===`
Inserido no `fullPrompt` logo antes do bloco de 4 camadas cinematográficas. Conteúdo (texto literal no prompt):

```
Canvas 16:9 (1200x675px), fundo escuro premium conforme camadas cinematográficas.

CANTO SUPERIOR ESQUERDO:
- Logo Smart Dent (branco, traço fino) + ao lado a bandeira do país do evento ({FLAG} {COUNTRY}), pequena, com cantos arredondados sutis.

CANTO SUPERIOR DIREITO:
- Logo do evento fornecido, grande, em branco, com leve sombra. Se não houver logo, escrever o nome do evento em tipografia display branca, peso bold, alinhado à direita.

ÁREA CENTRAL ESQUERDA (texto principal):
- Linha 1: "PRESENÇA CONFIRMADA" em caps, peso bold, branco, tracking amplo, fonte pequena.
- Linha 2 (espaço reservado, NÃO renderizar texto fictício): bloco de respiro de ~3 linhas para a copy gerada por IA depois (deixar a área limpa, apenas com o fundo cinematográfico — não inventar lorem ipsum nem texto placeholder visível).

RODAPÉ (faixa inferior, alinhada à esquerda, separadores verticais finos brancos entre blocos):
- Bloco 1: bandeira {FLAG} grande (cantos arredondados) + ao lado, em duas linhas: "{CITY}" em caps bold branco / "{MONTH} {DAY_RANGE}" em caps branco fino.
- Bloco 2: "STAND:" label fino caps + número do stand "{STAND}" em display bold branco.
- Bloco 3: nome do evento "{EVENT_NAME}" em caps bold branco, alinhado à esquerda.

REGRAS:
- Sem textos inventados, sem lorem ipsum, sem datas falsas — usar EXATAMENTE os valores fornecidos abaixo.
- Tipografia sans-serif geométrica condensada, branca pura sobre o fundo cinematográfico.
- Manter respiro generoso entre blocos; nada deve encostar nas bordas.
- Bandeiras sempre como retângulos com cantos levemente arredondados, nunca como círculos.
```

Os placeholders `{FLAG}`, `{COUNTRY}`, `{CITY}`, `{MONTH} {DAY_RANGE}`, `{STAND}`, `{EVENT_NAME}` são substituídos no servidor pelos dados reais de `ev` (`country`, `location`, `start_date`/`end_date` formatados em PT como `NOV 29 - DEZ 01`, `company_stand`, `name`). Se faltar algum, omitir o bloco correspondente.

### 3. Manter intacto
- Bloco de 4 camadas cinematográficas (REGRA PRINCIPAL + CAMADAS 1-4).
- Upload, persistência em `cover_image_{lang}` e `ai_image_prompt_{lang}`.
- `reference_image_url` continua sendo enviada ao Nano-Banana como `image_url`.

## Fora de escopo
- Frontend (`EventAIPanels.tsx`) não muda — já não pede prompt manual.
- `event-generate-about`, sociais, upload manual.
