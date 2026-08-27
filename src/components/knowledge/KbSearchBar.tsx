import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  placeholder: string;
  value: string;
  onDebouncedChange: (v: string) => void;
  delay?: number;
}

export default function KbSearchBar({ placeholder, value, onDebouncedChange, delay = 300 }: Props) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => {
    const id = setTimeout(() => { onDebouncedChange(local); }, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <div className="relative w-full min-w-[220px] max-w-md mb-5">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-9 rounded-full border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
      />
      {local && (
        <button
          type="button"
          onClick={() => setLocal('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Limpar busca"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}