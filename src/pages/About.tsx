import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCompanyData } from "@/hooks/useCompanyData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Helmet } from "react-helmet-async";
import { Target, Eye, Heart, Users, Award, TrendingUp } from "lucide-react";

export default function About() {
  const { data: company, isLoading } = useCompanyData();

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </main>
      </>
    );
  }

  if (!company) {
    return (
      <>
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Informações da empresa não disponíveis.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Sobre Nós - {company.name}</title>
        <meta name="description" content={company.description} />
      </Helmet>

      <Header />

      <main className="container mx-auto px-4 py-8 space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-4">
          {company.logo_url && (
            <img 
              src={company.logo_url} 
              alt={company.name}
              className="h-20 w-auto object-contain mx-auto"
            />
          )}
          <h1 className="text-4xl font-bold text-foreground">{company.name}</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">{company.description}</p>
        </section>

        {/* Mission, Vision, Values */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {company.corporate.mission && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Missão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{company.corporate.mission}</p>
              </CardContent>
            </Card>
          )}

          {company.corporate.vision && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  Visão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{company.corporate.vision}</p>
              </CardContent>
            </Card>
          )}

          {company.corporate.values && company.corporate.values.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  Valores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {company.corporate.values.map((value, index) => (
                    <li key={index} className="text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{value}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Company Info */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {company.corporate.founded_year && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Fundação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{company.corporate.founded_year}</p>
              </CardContent>
            </Card>
          )}

          {company.corporate.team_size && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Equipe
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{company.corporate.team_size}</p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Differentiators */}
        {company.corporate.differentiators && company.corporate.differentiators.length > 0 && (
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Nossos Diferenciais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {company.corporate.differentiators.map((diff, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                      <p className="text-muted-foreground">{diff}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Company Videos */}
        {company.company_videos && company.company_videos.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Vídeos Institucionais</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {company.company_videos.map((video, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <a 
                      href={video.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block space-y-2 hover:opacity-80 transition-opacity"
                    >
                      {video.thumbnail && (
                        <img 
                          src={video.thumbnail} 
                          alt={video.title}
                          className="w-full h-48 object-cover rounded"
                        />
                      )}
                      <h3 className="font-semibold text-foreground">{video.title}</h3>
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
