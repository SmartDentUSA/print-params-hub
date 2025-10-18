import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, BookOpen } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
}

interface BrandSelectorProps {
  brands: Brand[];
  selectedBrand?: string;
  onBrandSelect: (brandSlug: string) => void;
}

export function BrandSelector({ brands, selectedBrand, onBrandSelect }: BrandSelectorProps) {
  const { fetchSetting } = useData();
  const { t } = useLanguage();
  const [cta3Label, setCta3Label] = useState<string>("Download");
  const [cta3Url, setCta3Url] = useState<string>("#");

  useEffect(() => {
    const loadCta3Config = async () => {
      const label = await fetchSetting('cta3_label');
      const url = await fetchSetting('cta3_url');
      
      if (label) setCta3Label(label);
      if (url) setCta3Url(url);
    };
    
    loadCta3Config();
  }, [fetchSetting]);

  return (
    <div className="bg-gradient-card rounded-xl p-6 shadow-medium border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Selecione a Marca</h2>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Link to="/base-conhecimento" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center justify-center gap-2 w-full text-xs sm:text-sm whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{t('knowledge.knowledge_base')}</span>
            </Button>
          </Link>

          {cta3Url && cta3Url !== '#' && (
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open(cta3Url, '_blank')}
              className="flex items-center justify-center gap-2 w-full sm:w-auto text-xs sm:text-sm whitespace-nowrap"
            >
              <Download className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{cta3Label}</span>
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-3">
        {brands.map((brand) => (
          <Button
            key={brand.id}
            variant={selectedBrand === brand.slug ? "default" : "outline"}
            size="sm"
            onClick={() => onBrandSelect(brand.slug)}
            className="flex items-center gap-2 transition-smooth hover:shadow-soft"
          >
            {brand.logoUrl && (
              <img 
                src={brand.logoUrl} 
                alt={`${brand.name} logo`}
                title={brand.name}
                width="16"
                height="16"
                loading="lazy"
                decoding="async"
                className="w-4 h-4 object-contain"
              />
            )}
            {brand.name}
          </Button>
        ))}
      </div>
    </div>
  );
}