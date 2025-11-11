import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation, useNavigate } from "react-router-dom";
import { Globe } from "lucide-react";

const languages = [
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const currentLanguage = languages.find(lang => lang.code === language);

  const handleLanguageChange = (value: 'pt' | 'en' | 'es') => {
    setLanguage(value);
    
    // Map language prefixes for Knowledge Base routes
    const knowledgeBasePaths = {
      pt: '/base-conhecimento',
      en: '/en/knowledge-base',
      es: '/es/base-conocimiento'
    };
    
    // Check if we're on a Knowledge Base route
    const isKnowledgeBase = Object.values(knowledgeBasePaths).some(path => 
      location.pathname.startsWith(path)
    );
    
    if (isKnowledgeBase) {
      // Find current prefix
      const currentPrefix = Object.entries(knowledgeBasePaths).find(([_, path]) => 
        location.pathname.startsWith(path)
      )?.[1];
      
      if (currentPrefix) {
        // Extract the suffix (category/slug) after the base path
        const suffix = location.pathname.substring(currentPrefix.length);
        
        // Build new route with selected language
        const newPath = knowledgeBasePaths[value] + suffix;
        
        // Navigate to new route
        navigate(newPath, { replace: true });
      }
    }
  };

  return (
    <Select value={language} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[70px] sm:w-auto border-border bg-card hover:bg-accent transition-smooth">
        <div className="flex items-center gap-2">
          <span className="text-lg">{currentLanguage?.flag}</span>
          <span className="hidden sm:inline text-sm">{currentLanguage?.name}</span>
        </div>
        <SelectValue className="sr-only" />
      </SelectTrigger>
      <SelectContent className="z-50 bg-popover border border-border">
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <div className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}