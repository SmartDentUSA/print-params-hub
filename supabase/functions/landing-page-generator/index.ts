import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CANONICAL_MODULES = `LISTA CANÔNICA DOS 15 MÓDULOS ULTIMATE LAB BUNDLE (sempre que o input for sobre exocad/DentalCAD/Ultimate Lab Bundle):
1. DentalCAD Core Version — Coroas, pontes, copings, inlays, onlays, overlays, facetas, enceramentos, telescópicas e fluxos restauradores essenciais.
2. Virtual Articulator — Simulação de movimentos mandibulares e análise de oclusão dinâmica.
3. Provisional Module — Desenho de provisórios, incluindo estruturas do tipo eggshell com base em escaneamentos pré-operatórios.
4. TruSmile™ Module — Visualização e renderização realista das restaurações.
5. ZRS Tooth Library — Biblioteca adicional de formas dentais naturais.
6. Implant Module — Pilares personalizados, coroas sobre implante e restaurações parafusadas.
7. Bar Module — Desenho de barras simples e complexas para soluções implantossuportadas.
8. DICOM Viewer Module — Visualização de dados volumétricos durante o processo de desenho. Não substitui o exoplan nem constitui ferramenta autônoma de diagnóstico.
9. Model Creator Module — Criação de modelos físicos a partir de escaneamentos digitais, para impressão 3D.
10. Smile Creator Module — Planejamento estético com integração de dados 2D e 3D.
11. Full Denture Module — Desenho digital de próteses totais, incluindo fluxos compatíveis previstos no pacote.
12. Inspira™ Denture Tooth Library — Biblioteca de dentes para fluxos digitais de prótese total, conforme disponibilidade da versão.
13. PartialCAD Module — Desenho de estruturas metálicas ou digitais para próteses parciais removíveis.
14. Bite Splint Module — Placas oclusais, night guards, splints e estruturas tabletop.
15. Jaw Motion Import Module — Importação de movimentos reais de sistemas de registro mandibular e arco facial digital.`;

const CANONICAL_FAQS = `LISTA CANÔNICA DE 25 FAQS (sempre que o input for sobre exocad/RMS/Ultimate Lab Bundle/DentalCAD):
1. O que é o exocad RMS? — RMS significa Regional Monthly Subscription (Assinatura Mensal Regional). É o modelo que permite ao seu laboratório utilizar a licença oficial e completa do exocad no Brasil através de uma assinatura mensal. Isso elimina a barreira do alto investimento inicial de uma licença perpétua, adequando-se perfeitamente ao seu fluxo de caixa.
2. A licença é oficial? — Sim. A licença é fornecida dentro da parceria e dos procedimentos oficiais da exocad, com ativação e validação exclusiva para o território brasileiro.
3. A licença será minha para sempre? — Não se trata de uma compra vitalícia ou perpétua. O cliente adquire o direito temporário de usar a licença oficial enquanto a assinatura estiver ativa. Ao interromper a mensalidade, o acesso ao software é pausado.
4. Preciso ter uma conta my.exocad? — Sim. A conta deve ser obrigatoriamente vinculada ao cliente e estar cadastrada com dados e país compatíveis com o Brasil.
5. Como funciona o pagamento da Ativação Inicial? — Para começar, você paga apenas o valor de Ativação e Implantação Inicial (de R$ 3.700 por R$ 2.390 na pré-venda). Este pagamento único no início já inclui o seu primeiro mês de uso da licença, além de todo o serviço de cadastramento, validação da conta, configuração, treinamento e acompanhamento de implantação pela Smart Dent.
6. Qual será o valor da minha mensalidade a partir do segundo mês? — Após o período coberto pela Ativação Inicial, a sua assinatura entra no ciclo de recorrência mensal. Na condição promocional de lançamento, a mensalidade cai de R$ 2.390,00 para R$ 1.199/mês, debitada automaticamente no cartão.
7. O pagamento é seguro? — Sim. O checkout e a cobrança são processados de forma 100% segura pela Stripe. A Smart Dent não recebe nem armazena os dados completos do seu cartão de crédito.
8. Quem fornece a licença e quem cobra? — A licença, a ativação e o suporte local são realizados pela MMTech Brasil / Smart Dent. O pagamento é processado pela MMTech North America LLC por meio da Stripe, conforme os documentos de contratação.
9. Quem aparece no extrato do cartão? — A descrição na sua fatura pode conter termos como MMTECH, SMART DENT, STRIPE ou LINK, dependendo do meio de pagamento e do banco emissor do seu cartão.
10. O que acontece se o cartão falhar na mensalidade? — A Stripe e a Smart Dent poderão enviar avisos e realizar novas tentativas de cobrança. A continuidade ou renovação da licença depende da regularização do pagamento antes do próximo ciclo de faturamento da exocad.
11. Posso cancelar a assinatura? — Sim, você pode cancelar seguindo os prazos e condições do contrato. O modelo RMS foi criado para oferecer previsibilidade sem amarras desnecessárias. Contudo, não há reembolso proporcional do período já iniciado, e uma contratação futura após o encerramento poderá exigir o pagamento de uma nova taxa de ativação.
12. O Ultimate Bundle inclui todos os produtos da exocad? — O pacote reúne a maior amplitude de módulos do DentalCAD voltada para laboratórios e clínicos (como Implant Module, Model Creator, Smile Creator, PartialCAD, Bite Splint, Provisional, Full Denture, Bar, DICOM Viewer, entre outros). No entanto, não inclui produtos independentes (como exoplan, ChairsideCAD ou exocam), nem add-ons que não façam parte do pacote vigente.
13. Existe cobrança por caso ou taxa de exportação (click fees)? — Não. O DentalCAD RMS Ultimate Lab Bundle permite um número ilimitado de casos e não possui click fees (taxas ocultas) para exportação.
14. Funciona com meu scanner, impressora ou fresadora? — Sim. O DentalCAD possui arquitetura aberta e ampla compatibilidade com o mercado. A integração específica depende do equipamento, do formato de arquivo, das bibliotecas e do fluxo utilizados. Nossa equipe orientará essa análise durante a implantação.
15. Terei direito a atualizações do exocad? — Sim. Enquanto a sua assinatura estiver ativa e regular, você terá acesso a todas as atualizações previstas no plano e disponibilizadas oficialmente pela exocad.
16. A inteligência artificial da exocad está incluída? — Na atual promoção de lançamento, os assinantes ganham 30 Créditos de I.A. por mês. No entanto, é importante ressaltar que os serviços de IA e seus créditos dependem da versão do software, do tipo de licença e da disponibilidade regional definida pela exocad, não sendo garantidos permanentemente fora destas condições específicas.
17. Ser um assinante Smart Dent traz outros benefícios? — Sim! Além do software completo, os assinantes ativos têm acesso a um pacote de cursos online completos e descontos exclusivos em toda a linha de resinas e insumos para odontologia digital do portfólio Smart Dent.
18. Posso usar em mais de um computador? — Não. Cada licença RMS não é flutuante; ela é por seat e fica limitada a um usuário final e a um computador por vez. Mudanças de equipamento precisam ser avaliadas, comunicadas e autorizadas previamente.
19. Posso acessar a licença de fora do Brasil? — Não. A modalidade RMS é estritamente regional e deve ser utilizada no Brasil. É proibido utilizar VPN, proxy, hospedagem remota (hosting) ou mecanismos semelhantes com a finalidade de mascarar ou contornar a localização geográfica, sob pena de suspensão.
20. Meu computador é compatível? — A compatibilidade técnica será analisada durante o nosso onboarding. De qualquer forma, o cliente é responsável por manter o computador, o sistema operacional, a conexão de internet e demais requisitos de hardware em condições adequadas para rodar o software.
21. Preciso estar conectado à internet? — Sim. A ativação inicial e a validação contínua da sua licença dependem de conexão com a internet para comunicação com os servidores da exocad.
22. Há uso de dongle físico (pen drive)? — A licença pode utilizar um dongle USB ou outro mecanismo de licenciamento digital, conforme a solução disponibilizada pela exocad. Caso haja um dispositivo físico, ele é entregue para uso temporário, não transfere propriedade ao cliente, e deve ser guardado com segurança e devolvido quando solicitado.
23. Acabei de realizar o pagamento da Ativação. E agora? — Bem-vindo ao ecossistema Smart Dent! Nossa equipe fará a conferência do pagamento e iniciará a implantação. Validaremos sua conta my.exocad, associaremos sua licença, auxiliaremos na configuração inicial e agendaremos seu treinamento.
24. O treinamento está incluído? — Sim. A ativação inicial inclui um treinamento remoto voltado à introdução do ambiente, fluxo de trabalho e recursos essenciais, realizado conforme o formato e a agenda definidos pela equipe Smart Dent.
25. O suporte técnico está incluído? — Sim, você terá suporte em português pelos canais oficiais da Smart Dent em horário comercial. O atendimento cobre o escopo técnico da licença (orientação, ativação, configuração e incidentes do software). Nota: O suporte não inclui a execução/desenho de casos para o laboratório, responsabilidade clínica ou manutenção de equipamentos não contratados.`;

const CANONICAL_MODULE_ITEMS: Array<{ name: string; application: string }> = [
  { name: "DentalCAD Core Version", application: "Coroas, pontes, copings, inlays, onlays, overlays, facetas, enceramentos, telescópicas e fluxos restauradores essenciais." },
  { name: "Virtual Articulator", application: "Simulação de movimentos mandibulares e análise de oclusão dinâmica." },
  { name: "Provisional Module", application: "Desenho de provisórios, incluindo estruturas do tipo eggshell com base em escaneamentos pré-operatórios." },
  { name: "TruSmile™ Module", application: "Visualização e renderização realista das restaurações." },
  { name: "ZRS Tooth Library", application: "Biblioteca adicional de formas dentais naturais." },
  { name: "Implant Module", application: "Pilares personalizados, coroas sobre implante e restaurações parafusadas." },
  { name: "Bar Module", application: "Desenho de barras simples e complexas para soluções implantossuportadas." },
  { name: "DICOM Viewer Module", application: "Visualização de dados volumétricos durante o processo de desenho. Não substitui o exoplan nem constitui ferramenta autônoma de diagnóstico." },
  { name: "Model Creator Module", application: "Criação de modelos físicos a partir de escaneamentos digitais, para impressão 3D." },
  { name: "Smile Creator Module", application: "Planejamento estético com integração de dados 2D e 3D." },
  { name: "Full Denture Module", application: "Desenho digital de próteses totais, incluindo fluxos compatíveis previstos no pacote." },
  { name: "Inspira™ Denture Tooth Library", application: "Biblioteca de dentes para fluxos digitais de prótese total, conforme disponibilidade da versão." },
  { name: "PartialCAD Module", application: "Desenho de estruturas metálicas ou digitais para próteses parciais removíveis." },
  { name: "Bite Splint Module", application: "Placas oclusais, night guards, splints e estruturas tabletop." },
  { name: "Jaw Motion Import Module", application: "Importação de movimentos reais de sistemas de registro mandibular e arco facial digital." },
];

const CANONICAL_FAQ_ITEMS: Array<{ q: string; a: string }> = [
  { q: "O que é o exocad RMS?", a: "RMS significa Regional Monthly Subscription (Assinatura Mensal Regional). É o modelo que permite ao seu laboratório utilizar a licença oficial e completa do exocad no Brasil através de uma assinatura mensal. Isso elimina a barreira do alto investimento inicial de uma licença perpétua, adequando-se perfeitamente ao seu fluxo de caixa." },
  { q: "A licença é oficial?", a: "Sim. A licença é fornecida dentro da parceria e dos procedimentos oficiais da exocad, com ativação e validação exclusiva para o território brasileiro." },
  { q: "A licença será minha para sempre?", a: "Não se trata de uma compra vitalícia ou perpétua. O cliente adquire o direito temporário de usar a licença oficial enquanto a assinatura estiver ativa. Ao interromper a mensalidade, o acesso ao software é pausado." },
  { q: "Preciso ter uma conta my.exocad?", a: "Sim. A conta deve ser obrigatoriamente vinculada ao cliente e estar cadastrada com dados e país compatíveis com o Brasil." },
  { q: "Como funciona o pagamento da Ativação Inicial?", a: "Para começar, você paga apenas o valor de Ativação e Implantação Inicial (de R$ 3.700 por R$ 2.390 na pré-venda). Este pagamento único no início já inclui o seu primeiro mês de uso da licença, além de todo o serviço de cadastramento, validação da conta, configuração, treinamento e acompanhamento de implantação pela Smart Dent." },
  { q: "Qual será o valor da minha mensalidade a partir do segundo mês?", a: "Após o período coberto pela Ativação Inicial, a sua assinatura entra no ciclo de recorrência mensal. Na condição promocional de lançamento, a mensalidade cai de R$ 2.390,00 para R$ 1.199/mês, debitada automaticamente no cartão." },
  { q: "O pagamento é seguro?", a: "Sim. O checkout e a cobrança são processados de forma 100% segura pela Stripe. A Smart Dent não recebe nem armazena os dados completos do seu cartão de crédito." },
  { q: "Quem fornece a licença e quem cobra?", a: "A licença, a ativação e o suporte local são realizados pela MMTech Brasil / Smart Dent. O pagamento é processado pela MMTech North America LLC por meio da Stripe, conforme os documentos de contratação." },
  { q: "Quem aparece no extrato do cartão?", a: "A descrição na sua fatura pode conter termos como MMTECH, SMART DENT, STRIPE ou LINK, dependendo do meio de pagamento e do banco emissor do seu cartão." },
  { q: "O que acontece se o cartão falhar na mensalidade?", a: "A Stripe e a Smart Dent poderão enviar avisos e realizar novas tentativas de cobrança. A continuidade ou renovação da licença depende da regularização do pagamento antes do próximo ciclo de faturamento da exocad." },
  { q: "Posso cancelar a assinatura?", a: "Sim, você pode cancelar seguindo os prazos e condições do contrato. O modelo RMS foi criado para oferecer previsibilidade sem amarras desnecessárias. Contudo, não há reembolso proporcional do período já iniciado, e uma contratação futura após o encerramento poderá exigir o pagamento de uma nova taxa de ativação." },
  { q: "O Ultimate Bundle inclui todos os produtos da exocad?", a: "O pacote reúne a maior amplitude de módulos do DentalCAD voltada para laboratórios e clínicos (como Implant Module, Model Creator, Smile Creator, PartialCAD, Bite Splint, Provisional, Full Denture, Bar, DICOM Viewer, entre outros). No entanto, não inclui produtos independentes (como exoplan, ChairsideCAD ou exocam), nem add-ons que não façam parte do pacote vigente." },
  { q: "Existe cobrança por caso ou taxa de exportação (click fees)?", a: "Não. O DentalCAD RMS Ultimate Lab Bundle permite um número ilimitado de casos e não possui click fees (taxas ocultas) para exportação." },
  { q: "Funciona com meu scanner, impressora ou fresadora?", a: "Sim. O DentalCAD possui arquitetura aberta e ampla compatibilidade com o mercado. A integração específica depende do equipamento, do formato de arquivo, das bibliotecas e do fluxo utilizados. Nossa equipe orientará essa análise durante a implantação." },
  { q: "Terei direito a atualizações do exocad?", a: "Sim. Enquanto a sua assinatura estiver ativa e regular, você terá acesso a todas as atualizações previstas no plano e disponibilizadas oficialmente pela exocad." },
  { q: "A inteligência artificial da exocad está incluída?", a: "Na atual promoção de lançamento, os assinantes ganham 30 Créditos de I.A. por mês. No entanto, é importante ressaltar que os serviços de IA e seus créditos dependem da versão do software, do tipo de licença e da disponibilidade regional definida pela exocad, não sendo garantidos permanentemente fora destas condições específicas." },
  { q: "Ser um assinante Smart Dent traz outros benefícios?", a: "Sim! Além do software completo, os assinantes ativos têm acesso a um pacote de cursos online completos e descontos exclusivos em toda a linha de resinas e insumos para odontologia digital do portfólio Smart Dent." },
  { q: "Posso usar em mais de um computador?", a: "Não. Cada licença RMS não é flutuante; ela é por seat e fica limitada a um usuário final e a um computador por vez. Mudanças de equipamento precisam ser avaliadas, comunicadas e autorizadas previamente." },
  { q: "Posso acessar a licença de fora do Brasil?", a: "Não. A modalidade RMS é estritamente regional e deve ser utilizada no Brasil. É proibido utilizar VPN, proxy, hospedagem remota (hosting) ou mecanismos semelhantes com a finalidade de mascarar ou contornar a localização geográfica, sob pena de suspensão." },
  { q: "Meu computador é compatível?", a: "A compatibilidade técnica será analisada durante o nosso onboarding. De qualquer forma, o cliente é responsável por manter o computador, o sistema operacional, a conexão de internet e demais requisitos de hardware em condições adequadas para rodar o software." },
  { q: "Preciso estar conectado à internet?", a: "Sim. A ativação inicial e a validação contínua da sua licença dependem de conexão com a internet para comunicação com os servidores da exocad." },
  { q: "Há uso de dongle físico (pen drive)?", a: "A licença pode utilizar um dongle USB ou outro mecanismo de licenciamento digital, conforme a solução disponibilizada pela exocad. Caso haja um dispositivo físico, ele é entregue para uso temporário, não transfere propriedade ao cliente, e deve ser guardado com segurança e devolvido quando solicitado." },
  { q: "Acabei de realizar o pagamento da Ativação. E agora?", a: "Bem-vindo ao ecossistema Smart Dent! Nossa equipe fará a conferência do pagamento e iniciará a implantação. Validaremos sua conta my.exocad, associaremos sua licença, auxiliaremos na configuração inicial e agendaremos seu treinamento." },
  { q: "O treinamento está incluído?", a: "Sim. A ativação inicial inclui um treinamento remoto voltado à introdução do ambiente, fluxo de trabalho e recursos essenciais, realizado conforme o formato e a agenda definidos pela equipe Smart Dent." },
  { q: "O suporte técnico está incluído?", a: "Sim, você terá suporte em português pelos canais oficiais da Smart Dent em horário comercial. O atendimento cobre o escopo técnico da licença (orientação, ativação, configuração e incidentes do software). Nota: O suporte não inclui a execução/desenho de casos para o laboratório, responsabilidade clínica ou manutenção de equipamentos não contratados." },
];

function isExocadContext(...parts: Array<string | null | undefined>): boolean {
  const hay = parts.filter(Boolean).join(" ").toLowerCase();
  return /exocad|dentalcad|\brms\b|ultimate\s*lab\s*bundle/.test(hay);
}

function enforceCanonicalContent(content: any): any {
  if (!content || typeof content !== "object") return content;
  const modules = (content.modules && typeof content.modules === "object") ? content.modules : {};
  const faq = (content.faq && typeof content.faq === "object") ? content.faq : {};
  content.modules = {
    ...modules,
    eyebrow: modules.eyebrow ?? "O que está incluído",
    title: modules.title ?? "Um pacote para o laboratório inteiro",
    subtitle: modules.subtitle ?? "O Ultimate Lab Bundle reúne 15 módulos do DentalCAD — do fluxo restaurador básico até prótese total, implantes, barras, splints e planejamento estético.",
    items: CANONICAL_MODULE_ITEMS,
  };
  content.faq = {
    ...faq,
    title: faq.title ?? "Perguntas frequentes",
    items: CANONICAL_FAQ_ITEMS,
  };
  return content;
}

const CONTENT_SCHEMA_DOC = `Retorne APENAS JSON válido no schema abaixo. Nada de HTML, CSS, markdown, comentários, texto fora do JSON.

{
  "brandName": string (opcional, ex: "SMART DENT"),
  "resellerBadge": string OPCIONAL (ex: "Official Reseller exocad"),
  "nav": { "items": [ { "label": string, "anchor": string } ] (4-6 itens curtos, ex: Produto, Módulos, Como funciona, Preço, FAQ), "cta": string (ex: "Assinar Agora") },
  "hero": {
    "badge": string (obrigatório, ex: "Licença Oficial · RMS para o Brasil"),
    "eyebrow": string OPCIONAL (curto, uppercase),
    "headline": string (uma frase impactante, 6-14 palavras),
    "headlineParts": [ { "text": string, "highlight": boolean } ] (3-5 chunks que somados reconstroem a headline letra por letra; marque 1 chunk semanticamente central como highlight:true — será renderizado em gradiente roxo→laranja),
    "sub": string (uma frase de apoio, 12-24 palavras),
    "trustInline": [ { "icon": "shield"|"headphones"|"infinity"|"check"|"clock", "label": string } ] (2-4 selos inline curtos),
    "pricePill": { "label": string (ex: "Ativação + 1º mês"), "value": string (ex: "R$ 2.390"), "note": string OPCIONAL (ex: "depois"), "noteStrong": string OPCIONAL (ex: "R$ 1.199/mês") } (OPCIONAL — SÓ inclua se houver preço EXPLÍCITO no input; caso contrário OMITA),
    "primaryCta": string,
    "secondaryCta": string OPCIONAL,
    "productCardCaption": string OPCIONAL (ex: "Revenda Oficial exocad")
  },
  "positioning": { "eyebrow": string, "headline": string (use o placeholder literal "{strike}" onde entra o preço-âncora), "strikePrice": string OPCIONAL, "highlightPrice": string OPCIONAL, "body": string OPCIONAL } (OPCIONAL — SÓ quando o input compara preço anterior vs. atual),
  "howItWorks": { "title": string, "items": [ { "title": string, "desc": string } ] (exatamente 3 passos) },
  "price": {
    "ribbon": string (ex: "Ativação inicial"),
    "title": string,
    "priceLabel": string OPCIONAL (SÓ inclua se o briefing trouxer preço EXPLÍCITO),
    "priceNote": string OPCIONAL,
    "includes": string[] (4-7 itens),
    "cta": string,
    "footnote": string OPCIONAL
  },
  "benefits": { "title": string, "items": [ { "icon": "licenca"|"computador"|"treinamento"|"cartao"|"suporte"|"brasil"|"modulos"|"shield"|"sparkles"|"rocket"|"clock", "title": string, "desc": string } ] (6 itens) },
  "modules": { "eyebrow": string OPCIONAL (uppercase curto, ex: "O QUE ESTÁ INCLUÍDO"), "title": string, "subtitle": string, "items": [ { "name": string, "application": string } ], "footnote": string OPCIONAL } (OPCIONAL — só inclua se o input listar módulos/features explicitamente; NUNCA invente módulos além dos oficialmente listados),
  "regionalRules": { "title": string, "intro": string OPCIONAL, "items": string[], "footnote": string OPCIONAL } (OPCIONAL — regras de uso da licença; tom institucional e informativo, NUNCA ameaçador),
  "implementation": { "title": string, "subtitle": string OPCIONAL, "activation": { "title": string, "items": string[] }, "training": { "title": string, "body": string }, "support": { "title": string, "items": string[] } } (OPCIONAL — para treinamento, use exatamente: "Treinamento inicial remoto, conforme agenda e formato definidos pela Smart Dent, voltado à introdução ao ambiente, fluxo de trabalho e recursos essenciais do plano."),
  "testimonials": { "title": string, "items": [ { "quote": string, "author": string, "role": string } ] (2-3; OMITA se sem depoimentos reais) },
  "faq": { "title": string, "items": [ { "q": string, "a": string } ] (5-8 itens genéricos; 25 itens obrigatórios quando o input for sobre exocad/RMS/Ultimate Lab Bundle/DentalCAD, usando a lista canônica abaixo) },
  "finalCta": { "headline": string, "sub": string, "cta": string },
  "legal": string
}

REGRAS CRÍTICAS:
- NUNCA invente preços, prazos, números, depoimentos ou dados fora do input.
- Sem preço explícito → OMITA priceLabel/priceNote e hero.pricePill.
- headline + headlineParts DEVEM ser consistentes: concatenar todos os "text" na ordem deve reproduzir "headline" letra por letra.
- positioning só quando o input compara preços; use exatamente "{strike}" como placeholder.
- Sem depoimentos reais → OMITA "testimonials".
- Tom Smart Dent: profissional, direto, PT-BR. Copy curta e potente.
- Icons apenas da lista permitida.
- Para landing pages de exocad / Ultimate Lab Bundle / DentalCAD, a seção "modules" DEVE conter obrigatoriamente os 15 módulos canônicos na ordem e com as descrições fornecidas abaixo. Não omita nenhum, não altere os nomes e não adicione módulos extras.
- Para landing pages de exocad / RMS / Ultimate Lab Bundle / DentalCAD, a seção "faq" DEVE conter obrigatoriamente as 25 perguntas e respostas canônicas fornecidas abaixo. Não omita nenhuma, não altere as respostas e não adicione FAQs extras.

${CANONICAL_MODULES}

${CANONICAL_FAQS}`;

function buildSystemPrompt(form: { name: string; slug: string; form_purpose: string }) {
  return `Você é copywriter sênior da Smart Dent (odontologia digital premium). Sua tarefa é preencher o conteúdo estruturado de uma landing page.

O design é fixo (template React premium já feito). Você SÓ escreve o conteúdo em JSON.

${CONTENT_SCHEMA_DOC}

${CANONICAL_MODULES}

${CANONICAL_FAQS}

FORMULÁRIO ALVO: "${form.name}" — finalidade ${form.form_purpose} — slug ${form.slug}.`;
}

function buildUserPrompt(mode: "ai" | "briefing", input: string) {
  if (mode === "briefing") {
    return `MODO: BRIEFING (fidelidade total).\n\nProduza o JSON de conteúdo baseado FIELMENTE no briefing abaixo — respeitando preços, ofertas, módulos e textos citados. Não invente nada que não esteja no briefing.\n\n=== BRIEFING ===\n${input}\n=== FIM DO BRIEFING ===`;
  }
  return `MODO: IA (expansão criativa).\n\nA ideia central da landing page é:\n\n${input}\n\nProduza o JSON de conteúdo com hero envolvente, prova social, benefícios e FAQ. NÃO invente preços — se não houver preço na ideia, omita priceLabel.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { form_id, mode, input } = body ?? {};
    if (!form_id || (mode !== "ai" && mode !== "briefing") || typeof input !== "string" || !input.trim()) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: form, error: formErr } = await admin
      .from("smartops_forms")
      .select("id,name,slug,form_purpose,title,subtitle")
      .eq("id", form_id)
      .maybeSingle();

    if (formErr || !form) {
      return new Response(JSON.stringify({ error: "form_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cascade: GPT-5.5 → GPT-5.4 → Gemini 3.1 Pro → Gemini 3 Flash. Todos com JSON mode.
    const messages = [
      { role: "system", content: buildSystemPrompt(form) },
      { role: "user", content: buildUserPrompt(mode, input) },
    ];
    const callModel = async (model: string, opts: { priority?: boolean } = {}) => {
      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      };
      if (!model.startsWith("openai/")) body.temperature = 0.55;
      if (opts.priority) body.service_tier = "priority";
      return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": LOVABLE_API_KEY,
        },
        body: JSON.stringify(body),
      });
    };

    const cascade: Array<{ model: string; priority?: boolean }> = [
      { model: "openai/gpt-5.5", priority: true },
      { model: "openai/gpt-5.4", priority: true },
      { model: "google/gemini-3.1-pro-preview" },
      { model: "google/gemini-3-flash-preview" },
    ];

    let aiRes: Response | null = null;
    for (const step of cascade) {
      aiRes = await callModel(step.model, { priority: step.priority });
      if (aiRes.ok) break;
      if (![400, 402, 404, 429, 500, 502, 503].includes(aiRes.status)) break;
    }

    if (!aiRes || !aiRes.ok) {
      const errText = await aiRes.text();
      const status = aiRes.status;
      return new Response(
        JSON.stringify({
          error: status === 429 ? "rate_limited" : status === 402 ? "credits_exhausted" : "ai_error",
          detail: errText.slice(0, 500),
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await aiRes.json();
    let raw: string = json?.choices?.[0]?.message?.content ?? "";
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let content: unknown;
    try {
      content = JSON.parse(raw);
    } catch {
      // try to salvage — extract first {...} block
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          content = JSON.parse(m[0]);
        } catch {
          return new Response(
            JSON.stringify({ error: "ai_invalid_json", detail: raw.slice(0, 400) }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "ai_invalid_json", detail: raw.slice(0, 400) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "unexpected", detail: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
