import { useState } from "react";
import { Header } from "@/components/Header";
import { BrandSelector } from "@/components/BrandSelector";
import { ModelGrid } from "@/components/ModelGrid";
import { ResinAccordion } from "@/components/ResinAccordion";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { MessageCircle, Settings } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { data } = useData();
  const { t } = useLanguage();

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
      
      {/* Admin Button */}
      <div className="fixed top-4 right-20 z-50">
        <Link to="/admin">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {t('common.admin')}
          </Button>
        </Link>
      </div>
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('header.title')}
          </h1>
          <p className="text-lg text-muted-foreground mb-4">
            {t('header.subtitle')}
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-success rounded-full"></span>
              {t('hero.brands_integrated', { count: brands.length })}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              {t('hero.real_parameters', { count: data.length })}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full"></span>
              {t('hero.dental_data')}
            </span>
          </div>
        </div>

        {/* Brand Selection */}
        <div className="mb-8">
          <BrandSelector 
            brands={filteredBrands} 
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
                  {t('brands.brand_models', { brand: selectedBrandData?.name })}
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
                      <div className="flex items-center gap-3">
                        {model.imageUrl && (
                          <div className="w-20 aspect-[7/10] bg-muted rounded-lg overflow-hidden flex-shrink-0">
                            <img 
                              src={model.imageUrl} 
                              alt={`${model.name} 3D Printer`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{model.name}</div>
                          {model.notes && (
                            <div className="text-sm opacity-75 mt-1">{model.notes}</div>
                          )}
                        </div>
                      </div>
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
                    {t('models.select_model')}
                  </h3>
                  <p className="text-muted-foreground">
                    {t('models.select_model_description')}
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
              {t('help.need_help')}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t('help.help_description')}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button 
                variant="accent" 
                className="flex items-center gap-2"
                onClick={() => window.open("https://api.whatsapp.com/send/?phone=551634194735&text=Ol%C3%A1%2C+n%C3%A3o+encontrei+os+par%C3%A2metros+da+minha+impressora+no+site+de+voc%C3%AAs%2C+como+posso+iniciar+a+parametriza%C3%A7%C3%A3o%3F&type=phone_number&app_absent=0&utm_source=chatgpt.com", "_blank")}
              >
                <MessageCircle className="w-4 h-4" />
                {t('help.whatsapp_button')}
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-gradient-surface mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>{t('footer.copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default UserView;