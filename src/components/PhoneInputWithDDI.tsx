import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  { code: "55", flag: "🇧🇷", name: "Brasil" },
  { code: "1", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "351", flag: "🇵🇹", name: "Portugal" },
  { code: "54", flag: "🇦🇷", name: "Argentina" },
  { code: "56", flag: "🇨🇱", name: "Chile" },
  { code: "57", flag: "🇨🇴", name: "Colômbia" },
  { code: "52", flag: "🇲🇽", name: "México" },
  { code: "598", flag: "🇺🇾", name: "Uruguai" },
  { code: "595", flag: "🇵🇾", name: "Paraguai" },
  { code: "51", flag: "🇵🇪", name: "Peru" },
  { code: "591", flag: "🇧🇴", name: "Bolívia" },
  { code: "593", flag: "🇪🇨", name: "Equador" },
  { code: "58", flag: "🇻🇪", name: "Venezuela" },
  { code: "34", flag: "🇪🇸", name: "Espanha" },
  { code: "39", flag: "🇮🇹", name: "Itália" },
  { code: "49", flag: "🇩🇪", name: "Alemanha" },
  { code: "33", flag: "🇫🇷", name: "França" },
  { code: "44", flag: "🇬🇧", name: "Reino Unido" },
  { code: "41", flag: "🇨🇭", name: "Suíça" },
  { code: "81", flag: "🇯🇵", name: "Japão" },
  { code: "86", flag: "🇨🇳", name: "China" },
  { code: "82", flag: "🇰🇷", name: "Coreia do Sul" },
  { code: "91", flag: "🇮🇳", name: "Índia" },
  { code: "971", flag: "🇦🇪", name: "Emirados Árabes" },
  { code: "972", flag: "🇮🇱", name: "Israel" },
  { code: "61", flag: "🇦🇺", name: "Austrália" },
  { code: "64", flag: "🇳🇿", name: "Nova Zelândia" },
  { code: "27", flag: "🇿🇦", name: "África do Sul" },
  { code: "234", flag: "🇳🇬", name: "Nigéria" },
  { code: "7", flag: "🇷🇺", name: "Rússia" },
] as const;

interface PhoneInputWithDDIProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function PhoneInputWithDDI({ value, onChange, placeholder, required }: PhoneInputWithDDIProps) {
  const [open, setOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState("55");

  const selected = useMemo(() => COUNTRIES.find(c => c.code === selectedCode) || COUNTRIES[0], [selectedCode]);

  // Extract phone number without DDI
  const phoneNumber = useMemo(() => {
    if (!value) return "";
    if (value.startsWith(selectedCode)) return value.slice(selectedCode.length);
    return value;
  }, [value, selectedCode]);

  const handlePhoneChange = (num: string) => {
    const digits = num.replace(/\D/g, "");
    onChange(digits ? selectedCode + digits : "");
  };

  const handleCountrySelect = (code: string) => {
    setSelectedCode(code);
    setOpen(false);
    // Re-emit value with new DDI
    if (phoneNumber) onChange(code + phoneNumber);
  };

  return (
    <div className="flex gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="w-[110px] shrink-0 justify-between px-2 font-normal"
          >
            <span className="text-base mr-1">{selected.flag}</span>
            <span className="text-sm">+{selected.code}</span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar país..." />
            <CommandList>
              <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((country) => (
                  <CommandItem
                    key={country.code + country.name}
                    value={country.name}
                    onSelect={() => handleCountrySelect(country.code)}
                  >
                    <span className="text-base mr-2">{country.flag}</span>
                    <span className="flex-1 text-sm">{country.name}</span>
                    <span className="text-xs text-muted-foreground">+{country.code}</span>
                    <Check className={cn("ml-2 h-3.5 w-3.5", selectedCode === country.code ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        type="tel"
        placeholder={placeholder || "(11) 99999-9999"}
        value={phoneNumber}
        onChange={(e) => handlePhoneChange(e.target.value)}
        required={required}
        className="flex-1"
      />
    </div>
  );
}
