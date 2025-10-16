import { useState, useEffect, useMemo, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Header } from "@/components/Header";
import { BrandSelector } from "@/components/BrandSelector";
import { ModelGrid } from "@/components/ModelGrid";
import { ResinAccordion } from "@/components/ResinAccordion";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DataStats } from "@/components/DataStats";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { MessageCircle, Settings } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

const UserViewSupabase = () => {
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { getUniqueBrands, getModelsByBrand, getResinsByModel, loading } = useData();
  const { t } = useLanguage();

  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [resins, setResins] = useState<any[]>([]);
  
  const isMobile = useIsMobile();
  const resinsRef = useRef<HTMLDivElement>(null);

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

  // Load brands
  useEffect(() => {
    const loadBrands = async () => {
      try {
        const brandsData = await getUniqueBrands();
        setBrands(brandsData);
      } catch (error) {
        // Silent error handling
      }
    };
    loadBrands();
  }, [getUniqueBrands]);

  // Load models when brand changes
  useEffect(() => {
    if (selectedBrand) {
      const loadModels = async () => {
        try {
          const modelsData = await getModelsByBrand(selectedBrand);
          setModels(modelsData);
        } catch (error) {
          // Silent error handling
        }
      };
      loadModels();
    } else {
      setModels([]);
      setSelectedModel('');
    }
  }, [selectedBrand, getModelsByBrand]);

  // Load resins when model changes
  useEffect(() => {
    if (selectedModel) {
      const loadResins = async () => {
        try {
          const resinsData = await getResinsByModel(selectedModel);
          setResins(resinsData);
        } catch (error) {
          // Silent error handling
        }
      };
      loadResins();
    } else {
      setResins([]);
    }
  }, [selectedModel, getResinsByModel]);

  // Auto-scroll to resins section on mobile when model is selected
  useEffect(() => {
    if (selectedModel && resins.length > 0 && isMobile && resinsRef.current) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        resinsRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }, 300);
    }
  }, [selectedModel, resins, isMobile]);

  const filteredBrands = useMemo(() => {
    if (!searchTerm) return brands;
    return brands.filter(brand => 
      brand.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [brands, searchTerm]);

  const selectedBrandData = selectedBrand ? brands.find(b => b.slug === selectedBrand) : null;
  const selectedModelData = selectedModel ? models.find(m => m.slug === selectedModel) : null;

  // Determine page type for SEO
  const pageType = !selectedBrand ? 'home' : !selectedModel ? 'brand' : 'model';

  const breadcrumbItems: Array<{ label: string; href?: string; onClick?: () => void }> = [
    { label: 'Home', href: '/' }
  ];
  if (selectedBrandData) {
    breadcrumbItems.push({ 
      label: selectedBrandData.name, 
      onClick: () => setSelectedModel(null)
    });
  }
  if (selectedModelData) {
    breadcrumbItems.push({ 
      label: selectedModelData.name 
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-lg">Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      <SEOHead 
        pageType={pageType}
        brand={selectedBrandData}
        model={selectedModelData}
        resins={resins}
      />
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
              {t('hero.real_parameters', { count: 'Supabase' })}
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

        {/* Two Column Layout */}
        {selectedBrand && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar - Models */}
            <div className="lg:col-span-1">
              <div className="bg-gradient-card rounded-xl border border-border shadow-medium p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {t('brands.brand_models', { brand: selectedBrandData?.name })}
                </h3>
                <ModelGrid 
                  models={models.map(model => ({
                    id: model.id || model.slug,
                    name: model.name,
                    slug: model.slug,
                    imageUrl: model.image_url,
                    isActive: model.active !== false,
                    notes: model.notes
                  }))}
                  onModelSelect={handleModelSelect}
                />
              </div>
            </div>

            {/* Right Content - Model Details */}
            <div className="lg:col-span-3">
              {selectedModel && selectedModelData ? (
                <div ref={resinsRef} className="space-y-6">
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
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {t('models.select_model')}
          </h2>
                  <p className="text-muted-foreground">
                    {t('models.select_model_description')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Help Section - Always visible */}
        <div className="mt-16 bg-gradient-card rounded-xl p-8 border border-border shadow-medium text-center">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            {t('help.need_help')}
          </h2>
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

export default UserViewSupabase;