import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { isFieldVisible } from "@/lib/formConditions";

export interface QualificationField {
  id: string;
  label: string;
  field_type: string;
  db_column: string | null;
  custom_field_name: string | null;
  options: any;
  required: boolean;
  placeholder: string | null;
  order_index: number;
  workflow_cell_target: string | null;
  conditions?: any;
}

export interface QualificationSubmitPayload {
  form_id: string;
  form_name?: string;
  db_columns: Record<string, any>;
  custom_fields: Record<string, any>;
  form_responses: { label: string; value: string }[];
  workflow_responses: {
    field_id: string;
    field_label: string;
    value: string;
    workflow_cell_target: string;
  }[];
}

interface Props {
  slug: string;
  submitLabel?: string;
  submitting?: boolean;
  onSubmit: (payload: QualificationSubmitPayload) => Promise<void> | void;
}

/**
 * Renders a `smartops_forms` form (loaded by slug) inline, one question at a
 * time, applying the same conditional engine as `/f/:slug`. Used inside the
 * public course enrollment flow for non-clients so the lead is fully qualified
 * before the matrícula is created.
 */
export function QualificationFormInline({ slug, submitLabel, submitting, onSubmit }: Props) {
  const [loading, setLoading] = useState(true);
  const [formId, setFormId] = useState<string | null>(null);
  const [formName, setFormName] = useState<string | undefined>(undefined);
  const [fields, setFields] = useState<QualificationField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: form } = await (supabase as any)
        .from("smartops_forms")
        .select("id, name")
        .eq("slug", slug)
        .maybeSingle();
      if (!form || cancelled) {
        setLoading(false);
        return;
      }
      setFormId(form.id);
      setFormName(form.name);
      const { data: ff } = await (supabase as any)
        .from("smartops_form_fields")
        .select(
          "id, label, field_type, db_column, custom_field_name, options, required, placeholder, order_index, workflow_cell_target, conditions",
        )
        .eq("form_id", form.id)
        .order("order_index");
      if (!cancelled) {
        setFields((ff ?? []) as QualificationField[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const visible = useMemo(
    () => fields.filter((f) => isFieldVisible(f as any, values)),
    [fields, values],
  );
  const total = visible.length;
  const safeStep = Math.min(step, Math.max(0, total - 1));
  const current = visible[safeStep];

  const setVal = (id: string, v: any) => {
    setValues((s) => ({ ...s, [id]: v }));
    setError(null);
  };

  const validate = (f: QualificationField): string | null => {
    const v = values[f.id];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (f.required && empty) return `"${f.label}" é obrigatório.`;
    return null;
  };

  const handleNext = async () => {
    if (!current) return;
    const err = validate(current);
    if (err) {
      setError(err);
      return;
    }
    if (safeStep < total - 1) {
      setStep((s) => s + 1);
      return;
    }
    // Final submit
    if (!formId) return;
    const db_columns: Record<string, any> = {};
    const custom_fields: Record<string, any> = {};
    const form_responses: { label: string; value: string }[] = [];
    const workflow_responses: QualificationSubmitPayload["workflow_responses"] = [];
    for (const f of visible) {
      const raw = values[f.id];
      if (raw === undefined || raw === null || raw === "") continue;
      const str = Array.isArray(raw) ? raw.join(", ") : String(raw);
      form_responses.push({ label: f.label, value: str });
      if (f.db_column) db_columns[f.db_column] = str;
      else if (f.custom_field_name) custom_fields[f.custom_field_name] = str;
      if (f.workflow_cell_target) {
        workflow_responses.push({
          field_id: f.id,
          field_label: f.label,
          value: str,
          workflow_cell_target: f.workflow_cell_target,
        });
      }
    }
    await onSubmit({
      form_id: formId,
      form_name: formName,
      db_columns,
      custom_fields,
      form_responses,
      workflow_responses,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!formId || total === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Não conseguimos carregar as perguntas. Tente novamente em instantes.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((safeStep + 1) / total) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Pergunta {safeStep + 1} de {total}
      </p>

      {current && (
        <div className="space-y-2">
          <Label className="text-base">
            {current.label}
            {current.required && <span className="text-destructive ml-1">*</span>}
          </Label>

          {current.field_type === "text" && (
            <Input
              value={values[current.id] || ""}
              placeholder={current.placeholder ?? ""}
              onChange={(e) => setVal(current.id, e.target.value)}
            />
          )}

          {current.field_type === "select" && (
            <select
              className="w-full border rounded-md h-11 px-3 text-sm bg-background border-input"
              value={values[current.id] || ""}
              onChange={(e) => setVal(current.id, e.target.value)}
            >
              <option value="">{current.placeholder ?? "Selecione..."}</option>
              {(Array.isArray(current.options) ? current.options : []).map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}

          {current.field_type === "radio" && (
            <div className="space-y-2">
              {(Array.isArray(current.options) ? current.options : []).map((opt: string) => (
                <label key={opt} className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="radio"
                    name={`q-${current.id}`}
                    checked={values[current.id] === opt}
                    onChange={() => setVal(current.id, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {current.field_type === "checkbox" && (
            <div className="space-y-2">
              {(Array.isArray(current.options) ? current.options : []).map((opt: string) => {
                const arr: string[] = Array.isArray(values[current.id]) ? values[current.id] : [];
                const checked = arr.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2 text-sm py-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setVal(
                          current.id,
                          e.target.checked ? [...arr, opt] : arr.filter((v) => v !== opt),
                        )
                      }
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          )}

          {current.field_type === "textarea" && (
            <textarea
              className="w-full border rounded-md p-3 text-sm min-h-[100px] bg-background border-input"
              value={values[current.id] || ""}
              placeholder={current.placeholder ?? ""}
              onChange={(e) => setVal(current.id, e.target.value)}
            />
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 pt-2">
        {safeStep > 0 && (
          <Button
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Voltar
          </Button>
        )}
        <Button className="flex-1" disabled={submitting} onClick={handleNext}>
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : safeStep === total - 1 ? (
            submitLabel ?? "Concluir inscrição"
          ) : (
            "Próximo"
          )}
        </Button>
      </div>
    </div>
  );
}