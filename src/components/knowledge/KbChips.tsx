export interface KbChipOption { key: string; label: string }

interface Props {
  options: KbChipOption[];
  active: string;
  onChange: (key: string) => void;
  align?: 'left' | 'center' | 'right';
}

// Sentence case: primeira letra maiúscula, restante minúsculo.
// Exceção: preserva "3D" maiúsculo.
function toSentenceCase(s: string): string {
  if (!s) return s;
  const lower = s.toLocaleLowerCase('pt-BR');
  const cased = lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
  return cased.replace(/\b3d\b/g, '3D');
}

export default function KbChips({ options, active, onChange, align = 'center' }: Props) {
  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  return (
    <div className={`kb-cw kb-cw--${align}`} style={{ justifyContent: justify }}>
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