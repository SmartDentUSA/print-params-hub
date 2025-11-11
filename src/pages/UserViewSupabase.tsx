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
import { Link, useSearchParams, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LegacyRedirect } from "@/components/LegacyRedirect";
import { KnowledgeFeed } from "@/components/KnowledgeFeed";
import { GoogleReviewsBadge } from "@/components/GoogleReviewsBadge";
import { GoogleReviewsWidget } from "@/components/GoogleReviewsWidget";

const UserViewSupabase = () => {
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { getUniqueBrands, getModelsByBrand, getResinsByModel, loading } = useData();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [resins, setResins] = useState<any[]>([]);
  const [preSelectedResins, setPreSelectedResins] = useState<string[]>([]);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  const isMobile = useIsMobile();
  const resinsRef = useRef<HTMLDivElement>(null);

  // Debug log para mobile
  useEffect(() => {
    console.log('📱 UserViewSupabase - Estado atual:', {
      isMobile,
      loading,
      brandsCount: brands.length,
      modelsCount: models.length,
      resinsCount: resins.length,
      selectedBrand,
      selectedModel
    });
  }, [isMobile, loading, brands, models, resins, selectedBrand, selectedModel]);

  // Loading timeout de segurança
  useEffect(() => {
    if (!loading) {
      setLoadingTimeout(false);
      return;
    }
    
    const timer = setTimeout(() => {
      if (loading) {
        setLoadingTimeout(true);
        console.error('⏱️ Loading timeout - possível problema ao carregar dados');
      }
    }, 10000); // 10 segundos
    
    return () => clearTimeout(timer);
  }, [loading]);

  const handleBrandSelect = (brandSlug: string) => {
    setSelectedBrand(brandSlug);
    setSelectedModel("");
    navigate(`/${brandSlug}`);
  };

  const handleModelSelect = (modelSlug: string) => {
    setSelectedModel(modelSlug);
    if (selectedBrand) {
      navigate(`/${selectedBrand}/${modelSlug}`);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  // Sync URL params to state
  useEffect(() => {
    if (params.brandSlug && params.brandSlug !== selectedBrand) {
      setSelectedBrand(params.brandSlug);
    }
    if (params.modelSlug && params.modelSlug !== selectedModel) {
      setSelectedModel(params.modelSlug);
    }
    if (!params.brandSlug && selectedBrand) {
      setSelectedBrand("");
      setSelectedModel("");
    }
  }, [params.brandSlug, params.modelSlug]);

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

  // Check for pre-selected resins from URL query params
  useEffect(() => {
    const resinsParam = searchParams.get('resins');
    if (resinsParam) {
      const resinIds = resinsParam.split(',');
      setPreSelectedResins(resinIds);
      
      // Fetch resin names for toast
      supabase
        .from('resins')
        .select('name, manufacturer')
        .in('id', resinIds)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const names = data.map(r => `${r.name} (${r.manufacturer})`).join(', ');
            toast({
              title: "🎯 Resinas Filtradas",
              description: names,
            });
            
            // Auto-scroll to resins section
            setTimeout(() => {
              resinsRef.current?.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
              });
            }, 500);
          }
        });
    }
  }, [searchParams, toast]);

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

  if (loading && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (loadingTimeout) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <p className="text-lg text-foreground mb-4">⚠️ Erro ao carregar dados</p>
          <p className="text-muted-foreground mb-6">
            Não foi possível carregar os dados. Verifique sua conexão ou tente novamente.
          </p>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      <LegacyRedirect />
      <SEOHead 
        pageType={pageType}
        brand={selectedBrandData}
        model={selectedModelData}
        resins={resins}
      />
      <Header showAdminButton={true} />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('header.title')}
          </h1>
          <p className="text-lg text-muted-foreground mb-4">
            {t('header.subtitle')}
          </p>
          {/* Reviews Badge */}
          <div className="flex justify-center">
            <GoogleReviewsBadge 
              onClick={() => {
                document.getElementById('google-reviews-section')?.scrollIntoView({ 
                  behavior: 'smooth' 
                });
              }}
            />
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
                  <ResinAccordion 
                    resins={resins} 
                    preSelectedResins={preSelectedResins}
                  />
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

        {/* Knowledge Feed - Always visible */}
        <KnowledgeFeed />

        {/* Google Reviews Section */}
        <div id="google-reviews-section" className="mt-16">
          <GoogleReviewsWidget />
        </div>

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