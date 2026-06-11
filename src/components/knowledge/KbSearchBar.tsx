import { useEffect, useState } from 'react';

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
    <div className="kb-sw">
      <span className="kb-si" aria-hidden>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="text"
        className="kb-si-in"
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />
    </div>
  );
}