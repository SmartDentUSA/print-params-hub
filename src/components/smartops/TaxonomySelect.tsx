import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { findOption, type TaxonomyOption } from "@/lib/dentalTaxonomy";

export function TaxonomySelect({
  options, value, onChange, placeholder, className,
}: {
  options: TaxonomyOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const hasMatch = !!findOption(options, value);
  const showLegacy = !!value && !hasMatch;
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder || "Selecione..."} />
      </SelectTrigger>
      <SelectContent>
        {showLegacy && (
          <SelectItem value={value}>{`(atual) ${value}`}</SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}