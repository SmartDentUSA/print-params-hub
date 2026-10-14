import { useLanguage } from '@/contexts/LanguageContext';

interface ArticleMetaProps {
  createdAt: string;
  updatedAt: string;
}

export function ArticleMeta({ createdAt, updatedAt }: ArticleMetaProps) {
  const { language } = useLanguage();

  // Format dates based on language
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (!Number.isFinite(date.getTime())) return '';
    const locales = {
      pt: 'pt-BR',
      en: 'en-US',
      es: 'es-ES'
    };
    
    return date.toLocaleDateString(locales[language as keyof typeof locales] || 'pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Multilingual labels
  const labels = {
    pt: { published: 'Publicado em', updated: 'Atualizado em' },
    en: { published: 'Published on', updated: 'Updated on' },
    es: { published: 'Publicado el', updated: 'Actualizado el' }
  };

  const label = labels[language as keyof typeof labels] || labels.pt;
  
  // Only show updated date if different from created date
  const createdDate = new Date(createdAt);
  const updatedDate = new Date(updatedAt);
  const showUpdated = Number.isFinite(createdDate.getTime())
    && Number.isFinite(updatedDate.getTime())
    && createdDate.toDateString() !== updatedDate.toDateString();

  return (
    <div className="article-meta">
      <time 
        dateTime={createdAt} 
        itemProp="datePublished"
        className="article-meta-date"
      >
        {label.published} {formatDate(createdAt)}
      </time>
      {showUpdated && (
        <>
          <span className="article-meta-separator">•</span>
          <time 
            dateTime={updatedAt} 
            itemProp="dateModified"
            className="article-meta-date"
          >
            {label.updated} {formatDate(updatedAt)}
          </time>
        </>
      )}
    </div>
  );
}
