interface LanguageFlagsProps {
  size?: 'xs' | 'sm' | 'md';
  showBorder?: boolean;
  className?: string;
}

export const LanguageFlags = ({ 
  size = 'sm',
  showBorder = false,
  className = ''
}: LanguageFlagsProps) => {
  const sizeClasses = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm'
  };
  
  return (
    <div className={`flex items-center gap-1 ${showBorder ? 'pt-2 border-t border-border/50' : ''} ${className}`}>
      <span className={sizeClasses[size]} title="Disponível em Português">🇧🇷</span>
      <span className={sizeClasses[size]} title="Available in English">🇺🇸</span>
      <span className={sizeClasses[size]} title="Disponible en Español">🇪🇸</span>
    </div>
  );
};
