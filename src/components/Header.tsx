import { Settings, BookOpen } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  showAdminButton?: boolean;
}

export function Header({ showAdminButton = false }: HeaderProps) {
  const { t } = useLanguage();
  const location = useLocation();
  const isKnowledgeBasePage = location.pathname.startsWith('/base-conhecimento');

  return (
    <header className="bg-gradient-surface border-b border-border shadow-soft">
      <div className="container mx-auto px-3 md:px-4 h-14 md:h-16 flex items-center justify-between gap-2 md:gap-4">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0">
          <img 
            src="https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/h7stblp3qxn_1760720051743.png"
            alt="Smart Dent Logo"
            className="h-8 md:h-12 w-auto object-contain"
            loading="eager"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 md:gap-2">
          {showAdminButton && (
            <Link to="/admin">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden md:inline">{t('common.admin')}</span>
              </Button>
            </Link>
          )}
          <LanguageSelector />
        </div>
      </div>
    </header>
  );
}