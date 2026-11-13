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

/** Seletor de idioma: três bandeiras redondas lado a lado, sem dropdown. */
export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const changeLanguage = (value: LangCode) => {
    if (value === language) return;
    setLanguage(value);

    // Map language prefixes for Knowledge Base routes
    const knowledgeBasePaths: Record<LangCode, string> = {
      pt: '/base-conhecimento',
      en: '/en/knowledge-base',
      es: '/es/base-conocimiento'
    };

    const isKnowledgeBase = Object.values(knowledgeBasePaths).some(path =>
      location.pathname.startsWith(path)
    );

    if (isKnowledgeBase) {
      const currentPrefix = Object.values(knowledgeBasePaths).find(path =>
        location.pathname.startsWith(path)
      );

      if (currentPrefix) {
        const suffix = location.pathname.substring(currentPrefix.length);
        // Preserva query string e hash (ex.: ?tab=catalogo) para não perder a aba atual.
        const newPath = knowledgeBasePaths[value] + suffix + location.search + location.hash;
        navigate(newPath, { replace: true });
      }
    }
  };

  return (
    <div
      role="group"
      aria-label="Idioma"
      className="flex items-center gap-1.5 sm:gap-2 px-1"
    >
      {languages.map((lang) => {
        const active = lang.code === language;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => changeLanguage(lang.code)}
            aria-label={lang.name}
            aria-pressed={active}
            title={lang.name}
            className={cn(
              "fi fis rounded-full ring-1 ring-black/10 shadow-[0_1px_3px_rgba(15,23,42,0.18)]",
              "transition-all duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              active
                ? "opacity-100 ring-2 ring-primary/60 scale-105"
                : "opacity-55 hover:opacity-100",
              `fi-${lang.flag}`,
              "text-[18px] sm:text-[20px]"
            )}
          />
        );
      })}
    </div>
  );
}
