import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useData } from "@/contexts/DataContext";

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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Selecione a Marca</h2>
        
        {cta3Url && cta3Url !== '#' && (
          <Button
            variant="default"
            size="sm"
            onClick={() => window.open(cta3Url, '_blank')}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {cta3Label}
          </Button>
        )}
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