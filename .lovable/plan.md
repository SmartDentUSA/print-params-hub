# Gerar Card Informativo (Pré/Pós-Processamento)

## Objetivo

Adicionar um botão **"Gerar Card Informativo"** ao lado de *Formatar com IA* no editor de resinas. Ao clicar, o sistema gera uma imagem infográfica (estilo do exemplo enviado — logo Smart Dent, imagem do produto, blocos 1) Pré-Processamento, 2) Pós-Processamento, 3) Pós-Cura) em **3 idiomas (PT/EN/ES)** e disponibiliza cada versão no Card da Base de Conhecimento conforme o seletor de idioma.

## Arquitetura

```text
[Admin: Editar Resina]
   └─ Botão "Gerar Card Informativo"
        │
        ▼
   generate-resin-info-card (edge fn nova)
        │  parseia processing_instructions_{pt,en,es}
        │  monta HTML template (logo + product img + blocos)
        │  para cada idioma:
        │      chama /api/render-template (Puppeteer → PNG)
        │      faz upload no bucket product-images
        │      guarda URL
        │
        ▼
   resins.info_card_url_pt / _en / _es (novas colunas)
        │
        ▼
   KbTabCatalogo → renderiza <img> conforme idioma atual
```

## Passos

### 1. Migration
Adicionar 3 colunas em `public.resins`:
- `info_card_url_pt text`
- `info_card_url_en text`
- `info_card_url_es text`
- `info_card_generated_at timestamptz`

### 2. Edge Function `generate-resin-info-card`
- Input: `{ resin_id, languages?: ['pt','en','es'] }`
- Busca `resins` (nome, image_url, processing_instructions_{pt/en/es}).
- Reutiliza `parseMarkdownInstructions` (portada para Deno) para dividir em Pré / Pós / seções extras.
- Monta HTML com CSS inline seguindo o mockup (fundo com padrão sutil, header azul-escuro, blocos coloridos: azul PRÉ, verde PÓS, roxo PÓS-CURA, callouts vermelho-claros para `> notas`).
- Logo fixo: `https://pgfgripuanuwwolmtknn.supabase.co/.../h7stblp3qxn_1760720051743.png`.
- Chama `POST /api/render-template` (Puppeteer já existente) com `width:1080 height:1500` — o endpoint já retorna PNG.
- Upload no bucket `product-images` (path `resin-info-cards/{resin_slug}-{lang}-{timestamp}.png`) via `storage.upload`.
- Atualiza `resins.info_card_url_{lang}`.

### 3. UI — `src/components/AdminModal.tsx`
- Botão **"Gerar Card Informativo"** (variant outline, ícone `ImageIcon`) ao lado do botão Formatar com IA.
- Estado `isGeneratingCard`. Chama `supabase.functions.invoke('generate-resin-info-card', { body:{ resin_id: formData.id } })`.
- Toast de progresso e sucesso; ao terminar, mostra preview em miniatura das 3 versões geradas (`info_card_url_pt/en/es`) com link para abrir em nova aba.
- Desabilitado se resina ainda não foi salva ou se `processing_instructions` está vazio.

### 4. KB Card — `src/components/knowledge/KbTabCatalogo.tsx`
- Dentro da dialog **🧪 Pré/Pós-Processamento**, se `procResin.info_card_url_{lang}` existir para o idioma atual (`language` do contexto), renderiza a imagem no topo (`<img class="w-full rounded-lg border">`) *acima* do `<ProcessingInstructionsView />` (mantém compatibilidade com resinas sem card).
- Botão discreto "Baixar card" abre a imagem em nova aba.

### 5. Traduções UI
Adicionar chaves em `pt/en/es.json`: `admin.resin.generateInfoCard`, `admin.resin.generatingInfoCard`, `kb.resin.downloadCard`.

## O que NÃO muda
- Formato/parser das `processing_instructions` continua o mesmo.
- Hook `useCardTranslations` intacto — o card usa colunas dedicadas.
- Nenhuma alteração no fluxo de tradução automática (o card só é regenerado sob demanda pelo botão).

## Detalhes técnicos do template HTML

- Google Fonts: Inter (700/600/400).
- Header: título grande `Processo de Uso e Pós-Processamento — {resin_name}`, subtítulo cinza "Guia visual para manual de instruções", faixa azul no topo, logo à esquerda e product image (crop vertical) à direita.
- Bloco 1 (PRÉ): borda azul, badge circular com ícone termômetro (emoji 🌡️ em círculo azul). Cada subseção vira coluna com ícone + título + bullets. Notas `> ` viram callouts vermelho-claros com ícone ⚠️.
- Bloco 2 (PÓS): mesma estrutura, borda verde, ícone ⚙️.
- Bloco 3 (PÓS-CURA UV): se existir subseção com "cura"/"UV" no título, entra num bloco roxo com ícone ☀️.
- Rodapé "Importante": card cinza com escudo azul + texto de conclusão fixo por idioma.
- Regras de fit: se número de subseções > 3, renderiza em 2 linhas.

## Riscos e mitigações

- **Layout quebrando com texto longo**: aplicar `overflow: hidden` + `text-wrap: pretty` no CSS; template testado com o exemplo do usuário.
- **Puppeteer cold start no Vercel**: já existe endpoint `api/render-template.ts` funcional (60s max duration). Se der timeout, cair para geração sequencial por idioma dentro da edge function e responder progressivamente.
- **Custo de storage**: chaveado por `resin_slug + lang`, sobrescrevendo geração anterior (não acumula).
