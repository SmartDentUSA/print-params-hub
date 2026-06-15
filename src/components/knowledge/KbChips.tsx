export interface KbChipOption { key: string; label: string }

interface Props {
  options: KbChipOption[];
  active: string;
  onChange: (key: string) => void;
}

// Sentence case: primeira letra maiúscula, restante minúsculo.
// Exceção: preserva "3D" maiúsculo.
function toSentenceCase(s: string): string {
  if (!s) return s;
  const lower = s.toLocaleLowerCase('pt-BR');
  const cased = lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
  return cased.replace(/\b3d\b/g, '3D');
}

export default function KbChips({ options, active, onChange }: Props) {
  return (
    <div className="kb-cw">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={active === o.key}
          className={`kb-chip${active === o.key ? ' on' : ''}`}
          onClick={() => onChange(o.key)}
        >
          {toSentenceCase(o.label)}
        </button>
      ))}
    </div>
  );
}