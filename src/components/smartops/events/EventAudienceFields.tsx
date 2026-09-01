import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";

export const EVENT_AUDIENCE_AREAS = [
  "Consultório / Clínica odontológica",
  "Laboratório de prótese dentária",
  "Clínica de ortodontia",
  "Centro de radiologia / imagem",
  "Faculdade / Ensino",
  "Distribuidor / Revenda",
  "Indústria / Fabricante",
  "Estudantes de odontologia",
  "Gestores / Empresários da saúde",
];

export const EVENT_AUDIENCE_SPECIALTIES = [
  "Clínica geral",
  "Prótese dentária",
  "Implantodontia",
  "Ortodontia / alinhadores",
  "Dentística / Estética",
  "Endodontia",
  "Periodontia",
  "Odontopediatria",
  "Cirurgia e Traumatologia BMF",
  "Radiologia e Imagenologia",
  "DTM e Oclusão",
  "Técnico em prótese dentária (TPD)",
  "CAD designer / Planejamento digital",
];

function TagPicker({
  label,
  hint,
  options,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const selected = values || [];

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!selected.includes(v)) onChange([...selected, v]);
    setCustom("");
  };

  const extras = selected.filter((v) => !options.includes(v));

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{label}</Label>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <Badge
              key={o}
              variant={on ? "default" : "outline"}
              className="cursor-pointer text-[11px]"
              onClick={() => toggle(o)}
            >
              {o}
            </Badge>
          );
        })}
        {extras.map((o) => (
          <Badge key={o} variant="secondary" className="cursor-pointer text-[11px]" onClick={() => toggle(o)}>
            {o}
            <X className="ml-1 h-3 w-3" />
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Adicionar outro..."
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={addCustom}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function EventAudienceFields({
  areas,
  specialties,
  notes,
  onChange,
}: {
  areas: string[];
  specialties: string[];
  notes: string | null | undefined;
  onChange: (patch: { audience_areas?: string[]; audience_specialties?: string[]; audience_notes?: string }) => void;
}) {
  return (
    <div className="space-y-4 border rounded-md p-3">
      <div>
        <Label className="text-sm font-semibold">Público presente no evento</Label>
        <p className="text-[11px] text-muted-foreground">
          Usado pela IA na geração de copys para contextualizar os produtos selecionados com as áreas e especialidades presentes.
        </p>
      </div>
      <TagPicker
        label="Áreas de atuação"
        options={EVENT_AUDIENCE_AREAS}
        values={areas}
        onChange={(v) => onChange({ audience_areas: v })}
      />
      <TagPicker
        label="Especialidades"
        options={EVENT_AUDIENCE_SPECIALTIES}
        values={specialties}
        onChange={(v) => onChange({ audience_specialties: v })}
      />
      <div className="space-y-1">
        <Label className="text-sm">Observações sobre o público (opcional)</Label>
        <Textarea
          rows={2}
          value={notes || ""}
          onChange={(e) => onChange({ audience_notes: e.target.value })}
          placeholder="Ex: forte presença de laboratórios de prótese da região norte; muitos iniciantes em fluxo digital."
        />
      </div>
    </div>
  );
}
