import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

/**
 * Editor de HTML para emails complexos (tabelas, estilos inline).
 * Nunca reparseia o HTML — o valor do textarea é a fonte de verdade.
 * Preview em <iframe srcDoc> preserva 100% do layout.
 */
export function EmailHtmlEditor({ value, onChange }: Props) {
  const [draft, setDraft] = useState(value);
  const [preview, setPreview] = useState(value);
  const timer = useRef<number | null>(null);

  // Sync externo (ex.: toggle de seções, regerar) — só quando muda de fora.
  useEffect(() => {
    if (value !== draft) {
      setDraft(value);
      setPreview(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (next: string) => {
    setDraft(next);
    onChange(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPreview(next), 300);
  };

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <div className="flex flex-col">
        <div className="text-[11px] text-muted-foreground mb-1">
          Código HTML — edite aqui. Layout, tabelas e estilos são preservados na íntegra.
        </div>
        <Textarea
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          className="font-mono text-xs h-[500px] resize-none"
          spellCheck={false}
        />
      </div>
      <div className="flex flex-col">
        <div className="text-[11px] text-muted-foreground mb-1">Preview ao vivo</div>
        <iframe
          title="Preview do email"
          srcDoc={preview}
          sandbox="allow-same-origin"
          className="w-full h-[500px] border rounded-md bg-white"
        />
      </div>
    </div>
  );
}