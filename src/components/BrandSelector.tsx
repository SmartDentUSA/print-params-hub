import { useState } from "react";
import { Button } from "@/components/ui/button";

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
  return (
    <div className="bg-gradient-card rounded-xl p-6 shadow-medium border border-border">
      <h2 className="text-lg font-semibold text-foreground mb-4">Selecione a Marca</h2>
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
                alt={brand.name}
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