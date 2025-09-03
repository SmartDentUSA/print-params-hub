import { useState } from "react";
import { Header } from "@/components/Header";
import { BrandSelector } from "@/components/BrandSelector";
import { ModelGrid } from "@/components/ModelGrid";
import { ResinAccordion } from "@/components/ResinAccordion";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Settings } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { 
  getUniqueBrands,
  getModelsByBrandReal, 
  getResinsByModelReal, 
  getBrandBySlugReal, 
  getModelBySlugReal 
} from "@/data/realData";
import { Link } from "react-router-dom";

const UserView = () => {
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const { data } = useData();

  const handleBrandSelect = (brandSlug: string) => {
    setSelectedBrand(brandSlug);
    setSelectedModel("");
  };

  const handleModelSelect = (modelSlug: string) => {
    setSelectedModel(modelSlug);
  };

  const brands = getUniqueBrands(data);
  const selectedBrandData = selectedBrand ? getBrandBySlugReal(selectedBrand, data) : null;
  const selectedModelData = selectedModel ? getModelBySlugReal(selectedModel, data) : null;
  const models = selectedBrand ? getModelsByBrandReal(selectedBrand, data) : [];
  const resins = selectedModel ? getResinsByModelReal(selectedModel, data) : [];

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
      
      {/* Admin Button */}
      <div className="fixed top-4 right-20 z-50">
        <Link to="/admin">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Admin
          </Button>
        </Link>
      </div>
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Parâmetros de Impressão 3D
          </h1>
          <p className="text-lg text-muted-foreground mb-4">
            Base de dados profissional com parâmetros testados para impressoras e resinas odontológicas.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-success rounded-full"></span>
              13 Marcas Integradas
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              266+ Parâmetros Reais
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full"></span>
              Dados Odontológicos
            </span>
          </div>
        </div>

        {/* Brand Selection */}
        <div className="mb-8">
          <BrandSelector 
            brands={brands} 
            selectedBrand={selectedBrand}
            onBrandSelect={handleBrandSelect}
          />
        </div>

        {/* Two Column Layout like the reference image */}
        {selectedBrand && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar - Models */}
            <div className="lg:col-span-1">
              <div className="bg-gradient-card rounded-xl border border-border shadow-medium p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {selectedBrandData?.name} Models
                </h3>
                <div className="space-y-3">
                  {models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.slug)}
                      className={`w-full p-4 rounded-lg border text-left transition-smooth ${
                        selectedModel === model.slug 
                          ? 'bg-primary text-primary-foreground border-primary' 
                          : 'bg-card border-border hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <div className="font-medium">{model.name}</div>
                      {model.notes && (
                        <div className="text-sm opacity-75 mt-1">{model.notes}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Content - Model Details */}
            <div className="lg:col-span-3">
              {selectedModel && selectedModelData ? (
                <div className="space-y-6">
                  {/* Breadcrumb */}
                  <Breadcrumb items={breadcrumbItems} />
                  
                  {/* Model Header */}
                  <div className="bg-gradient-card rounded-xl border border-border shadow-medium p-6">
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      {selectedModelData.name}
                    </h2>
                    <p className="text-muted-foreground">
                      {selectedModelData.notes}
                    </p>
                  </div>

                  {/* Resins and Parameters */}
                  <ResinAccordion resins={resins} />
                </div>
              ) : (
                <div className="bg-gradient-card rounded-xl border border-border shadow-medium p-12 text-center">
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Selecione um Modelo
                  </h3>
                  <p className="text-muted-foreground">
                    Escolha um modelo na lista ao lado para ver os parâmetros disponíveis.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Help Section */}
        {!selectedBrand && (
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
        )}
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

export default UserView;