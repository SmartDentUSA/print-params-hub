import { useState } from "react";
import { Header } from "@/components/Header";
import { BrandSelector } from "@/components/BrandSelector";
import { ModelGrid } from "@/components/ModelGrid";
import { ResinAccordion } from "@/components/ResinAccordion";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail } from "lucide-react";
import { 
  mockBrands, 
  getModelsByBrand, 
  getResinsByModel, 
  getBrandBySlug, 
  getModelBySlug 
} from "@/data/mockData";

const Index = () => {
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  const handleBrandSelect = (brandSlug: string) => {
    setSelectedBrand(brandSlug);
    setSelectedModel("");
  };

  const handleModelSelect = (modelSlug: string) => {
    setSelectedModel(modelSlug);
  };

  const selectedBrandData = selectedBrand ? getBrandBySlug(selectedBrand) : null;
  const selectedModelData = selectedModel ? getModelBySlug(selectedModel) : null;
  const models = selectedBrand ? getModelsByBrand(selectedBrand) : [];
  const resins = selectedModel ? getResinsByModel(selectedModel) : [];

  const breadcrumbItems = [];
  if (selectedBrandData) {
    breadcrumbItems.push({ label: selectedBrandData.name });
  }
  if (selectedModelData) {
    breadcrumbItems.push({ label: selectedModelData.name });
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Parâmetros de Impressão 3D
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Encontre os parâmetros perfeitos para sua impressora e resina. 
            Configurações testadas e otimizadas pela comunidade.
          </p>
        </div>

        {/* Navigation and Content */}
        <div className="space-y-8">
          {/* Breadcrumb */}
          {breadcrumbItems.length > 0 && (
            <Breadcrumb items={breadcrumbItems} />
          )}

          {/* Brand Selection */}
          <BrandSelector 
            brands={mockBrands.filter(b => b.isActive)} 
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
            <Button variant="accent" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Falar no WhatsApp
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Enviar Email
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-gradient-surface mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 PrinterParams. Desenvolvido para a comunidade de impressão 3D.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
