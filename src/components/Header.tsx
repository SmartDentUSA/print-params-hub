import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";

interface HeaderProps {
  onSearch?: (searchTerm: string) => void;
  searchValue?: string;
}

export function Header({ onSearch, searchValue = "" }: HeaderProps) {
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const { t } = useLanguage();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchValue(value);
    onSearch?.(value);
  };

  return (
    <header className="bg-gradient-surface border-b border-border shadow-soft">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">3D</span>
          </div>
          <span className="font-semibold text-lg text-foreground">Smart Dent</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder={t('header.search_placeholder')}
              className="pl-10 bg-card border-border"
              value={localSearchValue}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        {/* Language Selector */}
        <LanguageSelector />
      </div>
    </header>
  );
}