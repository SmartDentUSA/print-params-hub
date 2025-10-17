import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Resin {
  id: string;
  name: string;
  manufacturer: string;
}

interface ResinMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function ResinMultiSelect({ value, onChange }: ResinMultiSelectProps) {
  const [resins, setResins] = useState<Resin[]>([]);
  const [search, setSearch] = useState('');
  
  useEffect(() => {
    const fetchResins = async () => {
      const { data } = await supabase
        .from('resins')
        .select('id, name, manufacturer')
        .eq('active', true)
        .order('manufacturer')
        .order('name');
      
      if (data) setResins(data);
    };
    
    fetchResins();
  }, []);
  
  const filteredResins = resins.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.manufacturer.toLowerCase().includes(search.toLowerCase())
  );
  
  const toggleResin = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };
  
  return (
    <div className="space-y-2">
      <Input 
        placeholder="🔍 Buscar resina..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      
      <div className="max-h-48 overflow-y-auto border border-border rounded p-2 space-y-1">
        {filteredResins.map(resin => (
          <div 
            key={resin.id}
            className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
            onClick={() => toggleResin(resin.id)}
          >
            <Checkbox checked={value.includes(resin.id)} />
            <span className="text-sm">
              {resin.name} <span className="text-muted-foreground">({resin.manufacturer})</span>
            </span>
          </div>
        ))}
        {filteredResins.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Nenhuma resina encontrada
          </div>
        )}
      </div>
      
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map(id => {
            const resin = resins.find(r => r.id === id);
            return resin ? (
              <span 
                key={id} 
                className="px-2 py-1 bg-primary/10 text-primary rounded text-sm flex items-center gap-1"
              >
                {resin.name}
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-destructive" 
                  onClick={() => toggleResin(id)}
                />
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
