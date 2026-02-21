import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

type Language = 'pt' | 'en' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Import translations
import ptTranslations from '@/locales/pt.json';
import enTranslations from '@/locales/en.json';
import esTranslations from '@/locales/es.json';

const translations = {
  pt: ptTranslations,
  en: enTranslations,
  es: esTranslations,
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Get language from localStorage first
    const saved = localStorage.getItem('language');
    if (saved) return saved as Language;

    // Auto-detect browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('es')) return 'es';
    if (browserLang.startsWith('en')) return 'en';
    if (browserLang.startsWith('pt')) return 'pt';
    
    // Default to Portuguese
    return 'pt';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    
    // Sync HTML lang attribute
    const langMap = {
      'pt': 'pt-BR',
      'en': 'en-US',
      'es': 'es-ES'
    };
    document.documentElement.lang = langMap[language];
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    
    // Fallback to Portuguese if translation not found
    if (value === undefined) {
      let fallback: any = translations.pt;
      for (const k of keys) {
        fallback = fallback?.[k];
        if (fallback === undefined) break;
      }
      value = fallback || key;
    }
    
    // Replace parameters if provided
    if (params && typeof value === 'string') {
      Object.entries(params).forEach(([param, val]) => {
        value = value.replace(`{{${param}}}`, String(val));
      });
    }
    
    return value || key;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
