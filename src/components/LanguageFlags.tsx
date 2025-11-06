import brFlag from '@/assets/flags/br.png';
import usFlag from '@/assets/flags/us.png';
import esFlag from '@/assets/flags/es.png';

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
  const sizeMap = {
    xs: 'w-4 h-3',
    sm: 'w-5 h-4',
    md: 'w-6 h-5'
  };
  
  const flagSize = sizeMap[size];
  
  return (
    <div className={`flex items-center gap-1.5 ${showBorder ? 'pt-2 border-t border-border/50' : ''} ${className}`}>
      <img 
        src={brFlag} 
        alt="Disponível em Português" 
        title="Disponível em Português"
        className={`${flagSize} object-cover rounded-sm shadow-sm`}
      />
      <img 
        src={usFlag} 
        alt="Available in English" 
        title="Available in English"
        className={`${flagSize} object-cover rounded-sm shadow-sm`}
      />
      <img 
        src={esFlag} 
        alt="Disponible en Español" 
        title="Disponible en Español"
        className={`${flagSize} object-cover rounded-sm shadow-sm`}
      />
    </div>
  );
};
