import 'flag-icons/css/flag-icons.min.css';
import { cn } from '@/lib/utils';

interface LanguageFlagsProps {
  size?: 'xs' | 'sm' | 'md';
  showBorder?: boolean;
  className?: string;
}

const flags = [
  { code: 'br', label: 'Disponível em Português' },
  { code: 'us', label: 'Available in English' },
  { code: 'es', label: 'Disponible en Español' },
];

const sizeMap = {
  xs: 'text-[12px]',
  sm: 'text-[15px]',
  md: 'text-[18px]',
};

export const LanguageFlags = ({
  size = 'sm',
  showBorder = false,
  className = ''
}: LanguageFlagsProps) => {
  const flagSize = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-1.5', showBorder && 'pt-2 border-t border-border/50', className)}>
      {flags.map((f) => (
        <span
          key={f.code}
          role="img"
          aria-label={f.label}
          title={f.label}
          className={cn(
            'fi fis inline-block overflow-hidden rounded-full ring-1 ring-black/10 shadow-[0_1px_2px_rgba(15,23,42,0.16)]',
            `fi-${f.code}`,
            flagSize
          )}
        />
      ))}
    </div>
  );
};
