import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation, useNavigate } from "react-router-dom";
import 'flag-icons/css/flag-icons.min.css';
import { cn } from "@/lib/utils";

type LangCode = 'pt' | 'en' | 'es';

const languages: { code: LangCode; name: string; flag: string }[] = [
  { code: 'pt', name: 'Português', flag: 'br' },
  { code: 'en', name: 'English', flag: 'us' },
  { code: 'es', name: 'Español', flag: 'es' },
];

/** Bandeira em círculo (recorte quadrado da lib flag-icons). */
function RoundFlag({ code, className, title }: { code: string; className?: string; title?: string }) {
  return (
    <span
      role="img"
      aria-label={title || `Bandeira de ${code.toUpperCase()}`}
      title={title}
      className={cn(
        "fi fis inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 shadow-[0_1px_3px_rgba(15,23,42,0.18)]",
        `fi-${code}`,
        className
      )}
    />
  );
}

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const currentLanguage = languages.find(lang => lang.code === language);

  const handleLanguageChange = (value: LangCode) => {
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

        // Build new route with selected language, preserving query string and hash
        // (ex.: ?tab=catalogo) para não perder a aba/estado atual.
        const newPath = knowledgeBasePaths[value] + suffix + location.search + location.hash;

        // Navigate to new route
        navigate(newPath, { replace: true });
      }
    }
  };

  return (
    <Select value={language} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[68px] sm:w-auto border-border bg-card hover:bg-accent transition-smooth">
        <div className="flex items-center gap-2">
          <RoundFlag code={currentLanguage?.flag || 'br'} title={currentLanguage?.name} className="text-[18px]" />
          <span className="hidden sm:inline text-sm">{currentLanguage?.name}</span>
        </div>
      </SelectTrigger>
      <SelectContent className="z-50 bg-popover border border-border">
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <div className="flex items-center gap-2.5">
              <RoundFlag code={lang.flag} title={lang.name} className="text-[17px]" />
              <span>{lang.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
