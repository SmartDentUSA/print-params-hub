## Problema

Na aba **Seções** aparece só a mensagem "Este email não tem seções marcadas" mesmo depois de regenerar. Isso acontece porque:

1. O prompt do `smart-ops-generate-email-ai` foi atualizado para pedir `data-section`, mas emails já gerados anteriormente (como o da imagem) não têm o markup.
2. Mesmo em novas gerações, o modelo às vezes ignora o atributo — não há garantia estrutural.
3. O parser exige `<section data-section="...">` exato; qualquer variação (div, section sem atributo) cai no fallback de bloco único.

## Plano

**1. Auto-segmentação heurística (fallback robusto)**
Em `emailSections.ts`, quando não houver `data-section`, quebrar o `<body>` em blocos por heurística:
- Cada `<section>`, `<table role="presentation">` de primeiro nível, ou `<div>` filho direto do container principal vira uma seção.
- Rotular automaticamente detectando palavras-chave no conteúdo/classe: hero, benefícios, prova social, CTA, rodapé, preço, etc.
- Retornar `Array<Section>` normal — a UI de toggle passa a funcionar em qualquer email, mesmo legado.

**2. Injetar `data-section` ao carregar**
Ao abrir o wizard, reserializar o HTML com os atributos adicionados. Assim Visual/HTML/Seções ficam sincronizados e o toggle persiste corretamente.

**3. Reforçar o prompt do gerador**
Adicionar exemplo few-shot no `smart-ops-generate-email-ai` mostrando o HTML com `data-section` já preenchido, além de instrução explícita "OBRIGATÓRIO: cada bloco visual deve ter `data-section="chave"`".

**4. UI da aba Seções**
- Se auto-detectado, mostrar aviso sutil "Seções detectadas automaticamente" com botão "Regenerar com IA" para melhorar rótulos.
- Manter switches enabled/disabled + botões de reordenar.

## Fora de escopo

- Editor visual por seção (continua editando HTML completo no Visual/HTML).
- Migrar emails já enviados no histórico.

## Validação

- Abrir campanha existente (email da imagem) → aba Seções deve listar hero, preço, CTA, rodapé com switches.
- Desativar uma seção → preview e envio omitem o bloco.
- Gerar novo email → seções vêm rotuladas pela IA.
