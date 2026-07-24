import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import {
  MEC_INSTITUTIONS,
  UNIVERSITY_ROLE_OPTIONS,
  QUALIFICATION_LEVELS,
  type QualificationEntry,
  type UniversityRoleEntry,
} from "@/lib/mecInstitutions";

interface Props {
  disabled?: boolean;
  qualifications: Record<string, QualificationEntry[]>;
  onQualificationsChange: (v: Record<string, QualificationEntry[]>) => void;
  universityRoles: UniversityRoleEntry[];
  onUniversityRolesChange: (v: UniversityRoleEntry[]) => void;
}

function InstitutionInput({
  value,
  onChange,
  disabled,
  listId,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  listId: string;
  placeholder?: string;
}) {
  return (
    <>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        list={listId}
        placeholder={placeholder ?? "Instituição (MEC)"}
      />
      <datalist id={listId}>
        {MEC_INSTITUTIONS.map((i) => (
          <option key={i} value={i} />
        ))}
      </datalist>
    </>
  );
}

export default function ProfessionalQualifications({
  disabled,
  qualifications,
  onQualificationsChange,
  universityRoles,
  onUniversityRolesChange,
}: Props) {
  const updateLevel = (level: string, next: QualificationEntry[]) => {
    onQualificationsChange({ ...qualifications, [level]: next });
  };

  const addEntry = (level: string) => {
    const arr = qualifications[level] ?? [];
    updateLevel(level, [...arr, { institution: "", completion_date: "", course: "" }]);
  };

  const removeEntry = (level: string, idx: number) => {
    const arr = qualifications[level] ?? [];
    updateLevel(level, arr.filter((_, i) => i !== idx));
  };

  const updateEntry = (level: string, idx: number, patch: Partial<QualificationEntry>) => {
    const arr = qualifications[level] ?? [];
    updateLevel(
      level,
      arr.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Qualificações do profissional — Formação acadêmica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {QUALIFICATION_LEVELS.map((lvl) => {
            const items = qualifications[lvl.value] ?? [];
            return (
              <div key={lvl.value} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{lvl.label}</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => addEntry(lvl.value)}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                </div>
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum registro.</p>
                )}
                {items.map((entry, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-[1fr_1fr_180px_auto] gap-2 items-end border rounded-md p-3"
                  >
                    <div>
                      <Label className="text-xs">Instituição (MEC)</Label>
                      <InstitutionInput
                        value={entry.institution}
                        onChange={(v) => updateEntry(lvl.value, idx, { institution: v })}
                        disabled={disabled}
                        listId={`mec-${lvl.value}-${idx}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Curso / Programa</Label>
                      <Input
                        value={entry.course ?? ""}
                        onChange={(e) => updateEntry(lvl.value, idx, { course: e.target.value })}
                        disabled={disabled}
                        placeholder="Ex.: Odontologia, Implantodontia..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Conclusão</Label>
                      <Input
                        type="month"
                        value={entry.completion_date?.slice(0, 7) || ""}
                        onChange={(e) => updateEntry(lvl.value, idx, { completion_date: e.target.value })}
                        disabled={disabled}
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() => removeEntry(lvl.value, idx)}
                      aria-label="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Funções no ambiente universitário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                onUniversityRolesChange([...universityRoles, { institution: "", role: "" }])
              }
            >
              <Plus className="w-4 h-4 mr-1" /> Adicionar função
            </Button>
          </div>
          {universityRoles.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma função cadastrada.</p>
          )}
          {universityRoles.map((entry, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-2 items-end border rounded-md p-3"
            >
              <div>
                <Label className="text-xs">Instituição (MEC)</Label>
                <InstitutionInput
                  value={entry.institution}
                  onChange={(v) =>
                    onUniversityRolesChange(
                      universityRoles.map((e, i) => (i === idx ? { ...e, institution: v } : e)),
                    )
                  }
                  disabled={disabled}
                  listId={`mec-role-${idx}`}
                />
              </div>
              <div>
                <Label className="text-xs">Função</Label>
                <Select
                  value={entry.role || undefined}
                  onValueChange={(v) =>
                    onUniversityRolesChange(
                      universityRoles.map((e, i) => (i === idx ? { ...e, role: v } : e)),
                    )
                  }
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIVERSITY_ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled}
                onClick={() =>
                  onUniversityRolesChange(universityRoles.filter((_, i) => i !== idx))
                }
                aria-label="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}