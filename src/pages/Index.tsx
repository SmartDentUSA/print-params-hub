import { useState, useEffect } from "react";
import { DataImport } from "@/components/DataImport";
import { Button } from "@/components/ui/button";
import { MessageCircle, Database } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useLanguage } from "@/contexts/LanguageContext";
import UserViewSupabase from "./UserViewSupabase";

const Index = () => {
  const { getUniqueBrands, loading } = useData();
  const { t } = useLanguage();
  const [hasData, setHasData] = useState(false);
  const [checkingData, setCheckingData] = useState(true);

  useEffect(() => {
    const checkData = async () => {
      try {
        setCheckingData(true);
        const brands = await getUniqueBrands();
        setHasData(brands.length > 0);
      } catch (error) {
        setHasData(false);
      } finally {
        setCheckingData(false);
      }
    };
    checkData();
  }, [getUniqueBrands]);

  const handleDataLoaded = () => {
    setHasData(true);
  };

  if (checkingData || loading) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return hasData ? (
    <UserViewSupabase />
  ) : (
    <div className="min-h-screen bg-gradient-surface">      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Database className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">
              {t('index.title')}
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
            {t('index.subtitle')}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              {t('index.waiting_import')}
            </span>
          </div>
        </div>

        {/* Data Import */}
        <div className="space-y-8">              
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-6">
              {t('index.import_data')}
            </h2>
            <DataImport />
          </div>
        </div>

        {/* Help Section */}
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

export default Index;
