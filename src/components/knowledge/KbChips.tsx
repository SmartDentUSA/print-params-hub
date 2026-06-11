export interface KbChipOption { key: string; label: string }

interface Props {
  options: KbChipOption[];
  active: string;
  onChange: (key: string) => void;
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
          {o.label}
        </button>
      ))}
    </div>
  );
}