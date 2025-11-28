import { useLanguage } from '@/contexts/LanguageContext';

interface ArticleSummaryProps {
  aiContext: string | null;
  aiContextEn?: string | null;
  aiContextEs?: string | null;
}

export function ArticleSummary({ aiContext, aiContextEn, aiContextEs }: ArticleSummaryProps) {
  const { language } = useLanguage();

  // Select appropriate context based on language
  const context = language === 'en' ? (aiContextEn || aiContext) 
    : language === 'es' ? (aiContextEs || aiContext)
    : aiContext;

  // Return null if no context available
  if (!context) return null;

  // Multilingual titles
  const titles = {
    pt: 'Resumo Técnico',
    en: 'Technical Summary',
    es: 'Resumen Técnico'
  };

  return (
    <aside 
      className="article-summary"
      data-llm-summary="true"
      data-section="summary"
      itemProp="abstract"
    >
      <h2 className="article-summary-title">
        {titles[language as keyof typeof titles] || titles.pt}
      </h2>
      <div className="article-summary-content">
        {context}
      </div>
    </aside>
  );
}
