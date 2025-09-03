import { useState } from "react";
import { Header } from "@/components/Header";
import { BrandSelector } from "@/components/BrandSelector";
import { ModelGrid } from "@/components/ModelGrid";
import { ResinAccordion } from "@/components/ResinAccordion";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DataStats } from "@/components/DataStats";
import { DataImport } from "@/components/DataImport";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Database } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { 
  getUniqueBrands,
  getModelsByBrandReal, 
  getResinsByModelReal, 
  getBrandBySlugReal, 
  getModelBySlugReal 
} from "@/data/realData";

const Index = () => {
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { data, setData } = useData();

  const handleBrandSelect = (brandSlug: string) => {
    setSelectedBrand(brandSlug);
    setSelectedModel("");
  };

  const handleModelSelect = (modelSlug: string) => {
    setSelectedModel(modelSlug);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  // Get data first
  const brands = getUniqueBrands(data);
  const selectedBrandData = selectedBrand ? getBrandBySlugReal(selectedBrand, data) : null;
  const selectedModelData = selectedModel ? getModelBySlugReal(selectedModel, data) : null;
  const models = selectedBrand ? getModelsByBrandReal(selectedBrand, data) : [];
  const resins = selectedModel ? getResinsByModelReal(selectedModel, data) : [];

  // Filter brands based on search term
  const filteredBrands = brands.filter(brand => 
    brand.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const breadcrumbItems = [];
  if (selectedBrandData) {
    breadcrumbItems.push({ label: selectedBrandData.name });
  }
  if (selectedModelData) {
    breadcrumbItems.push({ label: selectedModelData.name });
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      <Header onSearch={handleSearch} searchValue={searchTerm} />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Database className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">
              Parâmetros de Impressão 3D
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
            Base de dados profissional com parâmetros testados para impressoras e resinas odontológicas.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-success rounded-full"></span>
              {brands.length} Marcas
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              {data.length > 0 ? 'Dados Importados' : 'Aguardando Import'}
            </span>
          </div>
        </div>

        {/* Navigation and Content */}
        <div className="space-y-8">
          {/* Breadcrumb */}
          {breadcrumbItems.length > 0 && (
            <Breadcrumb items={breadcrumbItems} />
          )}

          {/* Brand Selection */}
          <BrandSelector 
            brands={filteredBrands} 
            selectedBrand={selectedBrand}
            onBrandSelect={handleBrandSelect}
          />

          {/* Model Selection */}
          {selectedBrand && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">
                Modelos {selectedBrandData?.name}
              </h2>
              <ModelGrid 
                models={models}
                onModelSelect={handleModelSelect}
              />
            </div>
          )}

          {/* Resin Parameters */}
          {selectedModel && selectedModelData && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-foreground">
                  Resinas para {selectedModelData.name}
                </h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedModel("")}
                >
                  Voltar aos Modelos
                </Button>
              </div>
              <ResinAccordion resins={resins} />
            </div>
          )}

          {/* Data Statistics and Import */}
          {!selectedBrand && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-6">
                  Estatísticas da Base de Dados
                </h2>
                <DataStats data={data} />
              </div>
              
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-6">
                  Importar Novos Dados
                </h2>
                <DataImport onDataLoaded={setData} />
              </div>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-16 bg-gradient-card rounded-xl p-8 border border-border shadow-medium text-center">
          <h3 className="text-xl font-semibold text-foreground mb-4">
            Precisa de Ajuda?
          </h3>
          <p className="text-muted-foreground mb-6">
            Nossa equipe está pronta para ajudar você a encontrar os melhores parâmetros 
            ou tirar dúvidas sobre impressão 3D.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              variant="accent" 
              className="flex items-center gap-2"
              onClick={() => window.open("https://api.whatsapp.com/send/?phone=551634194735&text=Ol%C3%A1%2C+n%C3%A3o+encontrei+os+par%C3%A2metros+da+minha+impressora+no+site+de+voc%C3%AAs%2C+como+posso+iniciar+a+parametriza%C3%A7%C3%A3o%3F&type=phone_number&app_absent=0&utm_source=chatgpt.com", "_blank")}
            >
              <MessageCircle className="w-4 h-4" />
              Falar no WhatsApp
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-gradient-surface mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 Smart Dent. Desenvolvido para a comunidade de impressão 3D.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
