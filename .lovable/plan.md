## Plano: fazer o e-mail ficar visualmente igual à Landing Page DentalCAD

### Objetivo
Gerar o e-mail de campanha do produto **“Ativação DentalCAD Ultimate Lab Bundle - RMS — SOFTWARES”** usando a Landing Page como fonte visual e de conteúdo, não apenas como inspiração de copy.

### Problema atual
O e-mail ainda está sendo montado por um template genérico de 600px com “card branco”, paleta roxa genérica `#7C3AED`, poucos blocos e sem a mesma estrutura visual da LP. A LP real usa outro design: tons `#605882 / #DF7344 / #42495C`, hero editorial em duas colunas, imagem grande do produto, badge, CTA pill, trust row, banner de oportunidade, cards “Como funciona”, benefícios e módulos.

### O que vou alterar

1. **Trocar o template de e-mail LP por um “clone email-safe” da `PremiumLandingTemplate`**
   - Recriar no HTML de e-mail os mesmos blocos visuais principais da LP:
     - header Smart Dent + badge “Revendedor Oficial exocad”
     - hero com badge, eyebrow, headline grande, subheadline, CTAs e trust row
     - imagem hero grande à direita/no topo, com sombra e bordas iguais à LP
     - bloco “Oportunidade histórica / posicionamento” com fundo suave e destaque
     - seção “Como funciona” em 3 cards numerados
     - seção “Por que escolher”/benefícios em cards
     - seção “Módulos” para o Ultimate Lab Bundle, quando existir no conteúdo da LP
     - CTA final
   - Manter HTML compatível com Gmail/Outlook: tabelas, estilos inline, largura 640–680px, fallback de cores.

2. **Usar as cores reais do tema da LP**
   - Em vez de paleta fixa roxa/laranja genérica, ler `content.theme` e mapear para os tokens da LP (`LP_THEMES`).
   - Para esta LP, aplicar `exocad-purple`: `#605882`, `#DF7344`, `#42495C`, `#F3F0F8`, `#FBFAFD`.

3. **Carregar o conteúdo completo da Landing Page**
   - Expandir `loadLpDossier` para trazer também:
     - `modules`
     - `benefits`
     - `implementation`
     - `conditions`/`price` apenas como fonte textual sanitizada
     - `theme`, `brandName`, `logoUrl`, `nav.cta`, `finalCta`
   - Continuar obedecendo a regra: **não inserir preços/valores no e-mail gerado por IA**. Valores da LP serão removidos automaticamente antes do envio.

4. **Parar de deixar a IA redesenhar o layout**
   - A IA só ajustará textos curtos ao “Tom da mensagem”.
   - O layout será determinístico e sempre igual ao padrão da LP.
   - Se a IA falhar, o sistema usará a copy original da LP sanitizada, mas mantendo o mesmo layout premium.

5. **Melhorar o preview no Wizard**
   - Exibir um indicador claro quando o e-mail estiver usando o template clonado da LP.
   - Se por algum motivo cair no fallback do catálogo, mostrar aviso explícito para não parecer que a LP foi usada.

6. **Validar especificamente com a LP DentalCAD RMS**
   - Conferir que o HTML gerado contém os blocos esperados e a mesma identidade visual da página:
     - headline “Exocad oficial…”
     - imagem hero do bundle
     - badge oficial
     - seção “Como funciona a assinatura RMS”
     - benefícios/módulos quando disponíveis
     - cores exocad-purple

### Arquivos envolvidos
- `supabase/functions/smart-ops-generate-email-ai/index.ts`
- `src/components/smartops/EmailCampaignWizard.tsx` (somente ajustes de status/preview, se necessário)

### Fora do escopo
- Não vou alterar envio Gmail.
- Não vou alterar a Landing Page publicada.
- Não vou criar preços no e-mail gerado por IA.
- Não vou mexer em banco/migrations.