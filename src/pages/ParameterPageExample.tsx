import { Card } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { KnowledgeFAQ } from "@/components/KnowledgeFAQ";

/**
 * EXEMPLO VISUAL - Como seria uma página da Categoria F
 * Esta página mostra a estrutura que será gerada automaticamente
 * pelos Edge Functions para os 50 parâmetros
 */
export default function ParameterPageExample() {
  // Dados de exemplo (serão gerados automaticamente pela IA)
  const exampleContent = {
    title: "Parâmetros Elegoo Mars 4 Ultra + Smart Print Vitality",
    category: { letter: "F", name: "Parâmetros de Impressão" },
    excerpt: "Configurações validadas para Elegoo Mars 4 Ultra com Smart Print Vitality da Smart Dent. 3 perfis otimizados disponíveis para diferentes aplicações odontológicas.",
    ai_summary: "Configurações validadas para Elegoo Mars 4 Ultra com Smart Print Vitality (Smart Dent). Altura de camada: 0.05mm, tempo de cura: 2.5s, intensidade: 80%. 3 perfis disponíveis para diferentes aplicações odontológicas.",
    confidence_score: 9,
    keywords: ["Elegoo", "Mars 4 Ultra", "Smart Print Vitality", "impressão 3D", "parâmetros", "odontologia"],
    faqs: [
      {
        question: "Quais são os parâmetros específicos para Elegoo Mars 4 Ultra com Smart Print Vitality em modelos de alta precisão?",
        answer: "Para modelos odontológicos de alta precisão com Elegoo Mars 4 Ultra e Smart Print Vitality, recomendamos: altura de camada 0.05mm, tempo de cura 2.5s, intensidade de luz 80%, 6 camadas de base com 25s de cura cada. Lift distance de 6mm com velocidade de 65mm/s. Esta configuração oferece excelente equilíbrio entre detalhamento e tempo de impressão, ideal para guias cirúrgicos e modelos diagnósticos."
      },
      {
        question: "Quais são os parâmetros básicos para Mars 4 Ultra com Smart Print Vitality?",
        answer: "Para Elegoo Mars 4 Ultra usando Smart Print Vitality (Smart Dent), os parâmetros principais são: altura de camada 0.05mm, tempo de cura 2.5s, intensidade de luz 80%. Camadas de base: 6 com 25s de cura."
      },
      {
        question: "Smart Print Vitality é compatível com Mars 4 Ultra?",
        answer: "Sim, Smart Print Vitality da Smart Dent é totalmente compatível com Elegoo Mars 4 Ultra. Temos 3 perfis validados com alturas de camada: 0.05, 0.075, 0.10mm."
      },
      {
        question: "Qual o tempo de cura ideal para Mars 4 Ultra?",
        answer: "Para Elegoo Mars 4 Ultra com Smart Print Vitality, o tempo de cura recomendado é 2.5s por camada normal e 25s para camadas de base. Intensidade: 80%."
      },
      {
        question: "Quais alturas de camada posso usar nesta configuração?",
        answer: "Oferecemos perfis validados para as seguintes alturas de camada: 0.05, 0.075, 0.10mm. Cada altura é otimizada para balancear qualidade e velocidade de impressão."
      }
    ]
  };

  const parameterProfiles = [
    {
      layer_height: 0.05,
      cure_time: 2.5,
      light_intensity: 80,
      bottom_layers: 6,
      bottom_cure_time: 25,
      lift_distance: 6,
      lift_speed: 65,
      retract_speed: 150,
      wait_before_cure: 0,
      wait_after_cure: 0,
      wait_after_lift: 0,
      use_case: "Alta precisão - Modelos diagnósticos, guias cirúrgicos"
    },
    {
      layer_height: 0.075,
      cure_time: 3.0,
      light_intensity: 80,
      bottom_layers: 6,
      bottom_cure_time: 25,
      lift_distance: 6,
      lift_speed: 65,
      retract_speed: 150,
      wait_before_cure: 0,
      wait_after_cure: 0,
      wait_after_lift: 0,
      use_case: "Equilíbrio - Modelos de estudo, arcadas"
    },
    {
      layer_height: 0.10,
      cure_time: 3.5,
      light_intensity: 80,
      bottom_layers: 6,
      bottom_cure_time: 25,
      lift_distance: 6,
      lift_speed: 65,
      retract_speed: 150,
      wait_before_cure: 0,
      wait_after_cure: 0,
      wait_after_lift: 0,
      use_case: "Velocidade - Protótipos, testes rápidos"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header com breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="container py-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Início</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/base-conhecimento">Base de Conhecimento</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/base-conhecimento/f">Parâmetros de Impressão</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Elegoo Mars 4 Ultra</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <div className="container py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="secondary" className="text-base">
              Categoria {exampleContent.category.letter}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="text-yellow-500">★</span>
              Confiança: {exampleContent.confidence_score}/10
            </Badge>
          </div>
          
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {exampleContent.title}
          </h1>
          
          <p className="text-lg text-muted-foreground mb-6">
            {exampleContent.excerpt}
          </p>

          {/* Keywords */}
          <div className="flex flex-wrap gap-2">
            {exampleContent.keywords.map((keyword, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>

        {/* AI Summary Card - Para consumo rápido por IAs */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="text-3xl">🤖</div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  Resumo para IA (ai_summary)
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {exampleContent.ai_summary}
                </p>
                <p className="text-xs text-muted-foreground mt-3 opacity-60">
                  Este resumo é otimizado para chatbots responderem em 0.3-0.5s
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-8">
            {/* Perfis de Parâmetros */}
            <Card>
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">Perfis Validados</h2>
                <div className="space-y-6">
                  {parameterProfiles.map((profile, i) => (
                    <div 
                      key={i} 
                      className="border rounded-lg p-5 hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold">
                            Perfil {profile.layer_height}mm
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {profile.use_case}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {i === 0 ? "🏆 Recomendado" : i === 1 ? "⚡ Popular" : "🚀 Rápido"}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground">Altura de Camada</div>
                          <div className="font-semibold text-foreground">{profile.layer_height}mm</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Tempo de Cura</div>
                          <div className="font-semibold text-foreground">{profile.cure_time}s</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Intensidade Luz</div>
                          <div className="font-semibold text-foreground">{profile.light_intensity}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Camadas Base</div>
                          <div className="font-semibold text-foreground">{profile.bottom_layers} ({profile.bottom_cure_time}s)</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Lift Distance</div>
                          <div className="font-semibold text-foreground">{profile.lift_distance}mm</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Lift Speed</div>
                          <div className="font-semibold text-foreground">{profile.lift_speed}mm/s</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* FAQs Estruturadas */}
            <Card>
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">Perguntas Frequentes</h2>
                <KnowledgeFAQ faqs={exampleContent.faqs} />
              </div>
            </Card>

            {/* Detalhes da Configuração */}
            <Card>
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">Detalhes da Configuração</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <span className="text-2xl">🖨️</span>
                      Impressora
                    </h3>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="font-medium">Elegoo Mars 4 Ultra</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Resolução: 8K Mono LCD<br/>
                        Volume: 153.36 × 77.76 × 165mm
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <span className="text-2xl">🧪</span>
                      Resina
                    </h3>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="font-medium">Smart Print Vitality</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Fabricante: Smart Dent<br/>
                        Tipo: Biocompatível Classe IIa
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Exposição Automática via API */}
            <Card className="border-green-500/30 bg-green-500/5">
              <div className="p-5">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="text-xl">✅</span>
                  Disponível para IAs
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Este conteúdo está automaticamente exposto no endpoint <code className="text-xs bg-background px-1 py-0.5 rounded">/data-export</code> para consumo por:
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-base">🤖</span>
                    <span>ChatGPT</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-base">🧠</span>
                    <span>Claude</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-base">🔍</span>
                    <span>Perplexity</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-base">💬</span>
                    <span>Chatbots internos</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Artigos Relacionados */}
            <Card>
              <div className="p-5">
                <h3 className="font-semibold text-foreground mb-4">
                  Artigos Relacionados
                </h3>
                <div className="space-y-3">
                  <a href="#" className="block text-sm text-primary hover:underline">
                    → Guia de impressão 3D para iniciantes
                  </a>
                  <a href="#" className="block text-sm text-primary hover:underline">
                    → Como escolher resina odontológica
                  </a>
                  <a href="#" className="block text-sm text-primary hover:underline">
                    → Troubleshooting: falhas de impressão
                  </a>
                  <a href="#" className="block text-sm text-primary hover:underline">
                    → Manutenção da Elegoo Mars
                  </a>
                </div>
                <p className="text-xs text-muted-foreground mt-4 opacity-60">
                  Links internos gerados automaticamente pelo campo <code className="bg-background px-1 py-0.5 rounded">internal_links[]</code>
                </p>
              </div>
            </Card>

            {/* Metadados Técnicos */}
            <Card className="border-blue-500/30 bg-blue-500/5">
              <div className="p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  Metadados Técnicos
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Confidence Score</div>
                    <div className="font-semibold text-foreground">
                      {exampleContent.confidence_score}/10
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ✓ Múltiplas variações<br/>
                      ✓ Vídeo disponível<br/>
                      ✓ Documentação PDF<br/>
                      ✓ Imagens validadas
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="text-xs text-muted-foreground">Última Validação</div>
                    <div className="font-semibold text-foreground">
                      Hoje, 14:23
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <div className="text-xs text-muted-foreground">SEO Schema</div>
                    <div className="font-semibold text-foreground">
                      TechArticle + FAQPage
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Aviso de Exemplo */}
        <Card className="mt-8 border-orange-500/30 bg-orange-500/5">
          <div className="p-6">
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="text-xl">ℹ️</span>
              Página de Exemplo
            </h3>
            <p className="text-sm text-muted-foreground">
              Esta é uma <strong>visualização de exemplo</strong> de como será uma página da Categoria F. 
              As 50 páginas reais serão geradas automaticamente pelos Edge Functions, 
              com dados reais do banco de dados e FAQs geradas por IA.
            </p>
            <p className="text-xs text-muted-foreground mt-3 opacity-60">
              <strong>Diferenças na versão real:</strong><br/>
              • Dados dinâmicos do Supabase<br/>
              • 1 FAQ específica gerada por IA<br/>
              • Imagens reais das impressoras/resinas<br/>
              • Vídeos relacionados incorporados<br/>
              • Links internos automáticos baseados em keywords
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
