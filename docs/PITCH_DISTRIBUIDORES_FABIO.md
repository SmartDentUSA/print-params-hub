# Programa de Distribuidores Oficiais Smart Dent
## One-pager comercial — para Fábio (Exportação)

> Versão 1 · Junho/2026 · Dono do programa: Fábio · Suporte técnico/digital: TI Smart Dent

---

## 1. O que o distribuidor ganha ao preencher o formulário

Não é burocracia — é uma ferramenta de **aceleração de vendas** para o parceiro.

1. **Visibilidade imediata para leads internacionais**
   No momento em que o formulário é enviado, o distribuidor entra no mapa global Smart Dent. Quando um dentista nos EUA, Chile ou Colômbia pesquisa por uma linha (Vitality, NanoClean, SmartMake) no Google, no ChatGPT ou no Perplexity, o sistema aponta automaticamente aquele parceiro como representante oficial local — com endereço, WhatsApp e site dele.

2. **Controle de portfólio sem atrito**
   O formulário já define quais categorias e linhas o parceiro está autorizado a comercializar. O cliente final sabe exatamente o que comprar de cada distribuidor — acabam as vendas cruzadas indevidas e os atritos de catálogo.

3. **Fim do gargalo de TI / Marketing**
   Você não pede mais "atualiza o site, fechei contrato com fulano". O distribuidor preenche o formulário, o card é gerado automaticamente com logo e dados, e a página da Smart Dent reflete em tempo real o tamanho real da presença internacional da marca.

4. **Bônus B2B para fechar contrato**
   Use no pitch: *"Ao assinar conosco você ganha uma página oficial no nosso portal internacional que transfere a autoridade de SEO da Smart Dent para o seu e-commerce. Em 60 dias o Google e o ChatGPT passam a recomendar você como ponto de venda oficial Smart Dent na sua região — de graça."*

---

## 2. A contrapartida (regra comercial — escrever em contrato)

Para ativar e manter o status de **Distribuidor Oficial Smart Dent** no portal, o parceiro se compromete a:

- **Exibir o selo "Distribuidor Oficial Smart Dent"** no rodapé do site ou e-commerce (HTML pronto entregue no Kit de Divulgação).
- **Manter um backlink ativo** apontando para `https://www.smartdent.com.br` (logo Smart Dent linkada, snippet HTML pronto no Kit — já vem com UTM `?utm_source=distribuidor&utm_medium=backlink&utm_campaign={parceiro}` para rastrearmos o tráfego no GA).
- **Citar Smart Dent como fabricante** nas descrições dos produtos das linhas representadas.
- **Marcar @smartdent_oficial** ao postar conteúdo de produtos Smart Dent nas redes (bios prontas em PT/ES/EN no Kit).

O sistema **verifica automaticamente todo mês** (cron `verify-distributor-backlinks-monthly`, dia 1 às 04:15 UTC) se o backlink ainda existe e exibe um badge no painel: 🔗 ok · ≈ cita s/ link · ✗ sem backlink · ? offline. O botão **Verificar backlinks** no topo da lista também dispara a checagem sob demanda. Distribuidores com `missing` por mais de 30 dias podem perder o selo até regularizar — argumento de retenção para você cobrar.

---

## 3. Como funciona por trás (resumido)

Cada distribuidor cadastrado gera 1 página única no nosso domínio com URL canônica permanente:

```
https://admin.smartdent.com.br/distribuidores/{país}/{distribuidor}
```

Essa página entrega para Google e IAs (Perplexity, ChatGPT, Gemini):

- `LocalBusiness` schema.org com endereço, telefone, brand Smart Dent.
- Vínculo direto com a entidade Wikidata da Smart Dent (`Q138636902`) — IAs entendem que aquele parceiro pertence à rede oficial da fabricante.
- `makesOffer` listando cada linha autorizada → respondem "onde comprar Vitality no Chile" com o parceiro certo.
- `areaServed` com país + cidades cobertas.
- Inclusão no `sitemap.xml` e no `llms-full.txt` (alimento direto para LLMs).

E a **Dra. LIA** consulta esses dados em tempo real: se um lead internacional perguntar "where can I buy Vitality resin?", ela responde com o distribuidor exato da região + link canônico + WhatsApp.

---

## 4. Roteiro de e-mail para mandar ao distribuidor

### 🇧🇷 Português

> **Assunto:** Sua nova página oficial Smart Dent + selo de distribuidor
>
> Olá [Nome],
>
> Para ativar você no nosso portal internacional como Distribuidor Oficial Smart Dent, preciso de 2 passos rápidos:
>
> 1. **Preencher o formulário** (5 min): https://admin.smartdent.com.br/cadastro-distribuidor
> 2. **Receber o Kit de Divulgação** com selo, snippets HTML e textos prontos em 3 idiomas para você colar no seu site e redes.
>
> Assim que o cadastro for aprovado, sua página exclusiva (`/distribuidores/{seu-país}/{sua-empresa}`) é publicada e começa a aparecer em buscas no Google, ChatGPT e Perplexity como ponto de venda oficial Smart Dent na sua região.
>
> Em troca pedimos só uma coisa: o selo Smart Dent linkado no rodapé do seu site (HTML pronto, leva 1 minuto pro seu webmaster).
>
> Qualquer dúvida me chama,
> Fábio | Smart Dent Export

### 🇪🇸 Español

> **Asunto:** Tu nueva página oficial Smart Dent + sello de distribuidor
>
> Hola [Nombre],
>
> Para activarte en nuestro portal internacional como Distribuidor Oficial Smart Dent necesito 2 pasos rápidos:
>
> 1. **Completar el formulario** (5 min): https://admin.smartdent.com.br/cadastro-distribuidor
> 2. **Recibir el Kit de Divulgación** con sello, snippets HTML y textos listos en 3 idiomas para tu sitio y redes.
>
> En cuanto se apruebe el registro, tu página exclusiva (`/distribuidores/{tu-país}/{tu-empresa}`) se publica y empieza a aparecer en Google, ChatGPT y Perplexity como punto de venta oficial Smart Dent en tu región.
>
> A cambio te pedimos solo una cosa: el sello Smart Dent enlazado en el pie de tu sitio (HTML listo, 1 minuto para tu webmaster).
>
> Cualquier duda, escríbeme,
> Fábio | Smart Dent Export

### 🇺🇸 English

> **Subject:** Your new official Smart Dent page + distributor seal
>
> Hi [Name],
>
> To activate you on our international portal as an Official Smart Dent Distributor I need 2 quick steps:
>
> 1. **Fill the form** (5 min): https://admin.smartdent.com.br/cadastro-distribuidor
> 2. **Receive the Distribution Kit** with the seal, HTML snippets and ready-to-use copy in 3 languages for your website and social media.
>
> Once approved, your dedicated page (`/distribuidores/{your-country}/{your-company}`) goes live and starts showing up on Google, ChatGPT and Perplexity as the official Smart Dent point of sale in your region.
>
> In return we only ask for one thing: the Smart Dent seal linked on your site footer (HTML ready, 1 minute for your webmaster).
>
> Any questions, just reach out,
> Fábio | Smart Dent Export

---

## 5. Checklist de onboarding (use como passo-a-passo)

- [ ] **Pré-contrato** — Distribuidor recebe o e-mail acima + link do formulário público.
- [ ] **Cadastro** — Distribuidor preenche `/cadastro-distribuidor` (form em PT, com logo, contatos, redes, linhas representadas, regiões atendidas).
- [ ] **Aprovação** — Time interno valida no Smart Ops > Distribuidores e marca como **Ativo**.
- [ ] **Publicação** — Página `/distribuidores/{país}/{slug}` vai pro ar (canônica + LocalBusiness + Wikidata sameAs).
- [ ] **Kit entregue** — Você abre o card no Smart Ops, clica em **Kit** e envia para o distribuidor: link canônico + selo PNG + 4 snippets (HTML selo, HTML logo backlink, bio social, texto institucional) em PT/ES/EN.
- [ ] **Backlink instalado** — Distribuidor cola o snippet do logo no rodapé do site.
- [ ] **Verificação** — Cron mensal `verify-distributor-backlinks-monthly` (dia 1, 04:15 UTC) confirma o status. Badge no painel = 🔗 ok. Botão manual disponível para checagem imediata.
- [ ] **Indexação** — Sitemap reenviado (automático); em 7-14 dias o Google indexa e Perplexity/ChatGPT começam a responder com o parceiro.

---

## 6. Métricas internas (para você defender o programa)

| Métrica                                | Onde ver                                                 | Meta inicial          |
|----------------------------------------|----------------------------------------------------------|-----------------------|
| Distribuidores ativos com página       | Smart Ops > Distribuidores (badge Ativo)                 | 100% dos contratados  |
| Backlinks verificados (🔗 ok)          | Coluna `backlink_status = 'found'`                       | ≥ 80% em 60 dias      |
| Páginas no sitemap                     | `/sitemap.xml`                                           | 1 por país + 1 por parceiro |
| Cliques inbound dos distribuidores     | GA4 → `utm_source=distribuidor`                          | crescente mês a mês   |
| Queries de IA respondidas c/ parceiro  | Logs Dra. LIA (bloco "DISTRIBUIDORES OFICIAIS" injetado) | tendência de alta     |
| Citação "Distribuidor Oficial Smart Dent" em Perplexity/ChatGPT | Busca manual mensal                | 100% dos países cobertos em 90 dias |

---

## 7. Recursos operacionais

- **Formulário público:** https://admin.smartdent.com.br/cadastro-distribuidor
- **Painel interno:** Smart Ops > Distribuidores (botão **Kit** em cada card)
- **Verificar backlinks agora:** botão "Verificar backlinks" no topo da lista (dispara `verify-distributor-backlink`)
- **Hub público global:** https://admin.smartdent.com.br/distribuidores
- **Entidade Wikidata Smart Dent:** https://www.wikidata.org/wiki/Q138636902