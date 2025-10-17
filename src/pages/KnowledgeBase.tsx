import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Header } from "@/components/Header";
import { KnowledgeCategoryPills } from "@/components/KnowledgeCategoryPills";
import { KnowledgeSidebar } from "@/components/KnowledgeSidebar";
import { KnowledgeContentViewer } from "@/components/KnowledgeContentViewer";
import { KnowledgeSEOHead } from "@/components/KnowledgeSEOHead";
import { useKnowledge } from "@/hooks/useKnowledge";
import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function KnowledgeBase() {
  const { categoryLetter, contentSlug } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const contentRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  const [categories, setCategories] = useState<any[]>([]);
  const [contents, setContents] = useState<any[]>([]);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { 
    fetchCategories, 
    fetchContentsByCategory, 
    fetchContentBySlug,
    loading
  } = useKnowledge();

  // Load categories
  useEffect(() => {
    const load = async () => {
      const cats = await fetchCategories();
      setCategories(cats.filter(c => c.enabled));
    };
    load();
  }, []);

  // Load contents when category changes
  useEffect(() => {
    if (categoryLetter) {
      const load = async () => {
        const data = await fetchContentsByCategory(categoryLetter);
        setContents(data);
      };
      load();
    } else {
      setContents([]);
    }
  }, [categoryLetter]);

  // Load specific content by slug
  useEffect(() => {
    if (contentSlug) {
      const load = async () => {
        const data = await fetchContentBySlug(contentSlug);
        setSelectedContent(data);
      };
      load();
    } else {
      setSelectedContent(null);
    }
  }, [contentSlug]);

  // Auto-scroll to content on mobile
  useEffect(() => {
    if (selectedContent && isMobile && contentRef.current) {
      setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [selectedContent, isMobile]);

  const handleCategorySelect = (letter: string) => {
    navigate(`/base-conhecimento/${letter.toLowerCase()}`);
  };

  const handleContentSelect = (slug: string) => {
    navigate(`/base-conhecimento/${categoryLetter}/${slug}`);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const filteredContents = searchTerm
    ? contents.filter(c => 
        c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : contents;

  if (loading && categories.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      <KnowledgeSEOHead 
        content={selectedContent}
        category={categories.find(c => c.letter === categoryLetter?.toUpperCase())}
      />
      
      <Header onSearch={handleSearch} searchValue={searchTerm} showAdminButton={true} />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Base de Conhecimento
          </h1>
          <p className="text-lg text-muted-foreground mb-4">
            Aprenda tudo sobre impressão 3D odontológica
          </p>
        </div>

        {/* Category Pills */}
        <div className="mb-8">
          <KnowledgeCategoryPills 
            categories={categories}
            selectedCategory={categoryLetter?.toUpperCase()}
            onCategorySelect={handleCategorySelect}
          />
        </div>

        {/* Two Column Layout */}
        {categoryLetter && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar - Articles */}
            <div className="lg:col-span-1">
              <div className="bg-gradient-card rounded-xl border border-border shadow-medium p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Conteúdo
                </h3>
                <KnowledgeSidebar 
                  contents={filteredContents}
                  selectedSlug={contentSlug}
                  onContentSelect={handleContentSelect}
                />
              </div>
            </div>

            {/* Right Content - Article Viewer */}
            <div className="lg:col-span-3">
              <div ref={contentRef}>
                {selectedContent ? (
                  <KnowledgeContentViewer content={selectedContent} />
                ) : (
                  <div className="bg-gradient-card rounded-xl border border-border shadow-medium p-12 text-center">
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Selecione um conteúdo
                    </h2>
                    <p className="text-muted-foreground">
                      Escolha um conteúdo ao lado para visualizar
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-16 bg-gradient-card rounded-xl p-8 border border-border shadow-medium text-center">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            {t('help.need_help') || 'Precisa de Ajuda?'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {t('help.help_description') || 'Nossa equipe está pronta para ajudar você'}
          </p>
          <Button 
            variant="accent"
            onClick={() => window.open("https://api.whatsapp.com/send/?phone=551634194735", "_blank")}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            {t('help.whatsapp_button') || 'Falar no WhatsApp'}
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-gradient-surface mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>{t('footer.copyright') || '© 2024 Smart Dent. Desenvolvido para a comunidade de impressão 3D.'}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
