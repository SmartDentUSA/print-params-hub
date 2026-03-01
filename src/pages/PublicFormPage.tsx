import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";

interface FormField {
  id: string;
  label: string;
  field_type: string;
  db_column: string | null;
  custom_field_name: string | null;
  options: any;
  required: boolean;
  placeholder: string | null;
  order_index: number;
}

interface FormData {
  id: string;
  name: string;
  slug: string;
  form_purpose: string;
  theme_color: string | null;
  success_message: string | null;
  success_redirect_url: string | null;
  title: string | null;
  subtitle: string | null;
  description: string | null;
}

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<FormData | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      const { data: formData } = await supabase
        .from("smartops_forms" as any)
        .select("*")
        .eq("slug", slug)
        .eq("active", true)
        .single();

      if (!formData) {
        setError("Formulário não encontrado.");
        setLoading(false);
        return;
      }
      setForm(formData as any);

      const { data: fieldsData } = await supabase
        .from("smartops_form_fields" as any)
        .select("*")
        .eq("form_id", (formData as any).id)
        .order("order_index");

      if (fieldsData) setFields(fieldsData as any);
      setLoading(false);
    };
    load();
  }, [slug]);

  const handleChange = (fieldId: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);

    // Build payload mapping db_column -> value, custom fields -> raw_payload
    const payload: Record<string, any> = {
      source: "form",
      form_name: form.name,
      form_purpose: form.form_purpose,
    };

    const customFields: Record<string, any> = {};

    for (const field of fields) {
      const val = values[field.id];
      if (!val && field.required) {
        toast_inline(`Campo "${field.label}" é obrigatório.`);
        setSubmitting(false);
        return;
      }
      if (!val) continue;

      if (field.db_column) {
        payload[field.db_column] = val;
      } else if (field.custom_field_name) {
        customFields[field.custom_field_name] = val;
      }
    }

    // UTMs from URL
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term"];
    for (const key of utmKeys) {
      const v = searchParams.get(key);
      if (v) payload[key] = v;
    }

    if (Object.keys(customFields).length > 0) {
      payload.raw_payload = { custom_fields: customFields };
    }

    // Ensure required email field
    if (!payload.email) {
      payload.email = `form-${Date.now()}@no-email.com`;
    }
    if (!payload.nome) {
      payload.nome = "Anônimo";
    }

    try {
      const { error } = await supabase.functions.invoke("smart-ops-ingest-lead", {
        body: payload,
      });
      if (error) throw error;

      // Increment submissions count
      await supabase.from("smartops_forms" as any)
        .update({ submissions_count: (form as any).submissions_count + 1 } as any)
        .eq("id", form.id);

      // Redirect if URL configured
      const redirectUrl = (form as any).success_redirect_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      setSubmitted(true);
    } catch (err: any) {
      toast_inline(`Erro ao enviar: ${err.message || "tente novamente"}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Simple inline toast
  const [inlineError, setInlineError] = useState<string | null>(null);
  const toast_inline = (msg: string) => {
    setInlineError(msg);
    setTimeout(() => setInlineError(null), 4000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-destructive">{error || "Formulário não encontrado"}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <CheckCircle className="w-16 h-16 mx-auto" style={{ color: form.theme_color || "#3b82f6" }} />
          <p className="text-lg font-medium">{form.success_message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-8 md:pt-16">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{form.name}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>

              {field.field_type === "text" && (
                <Input
                  placeholder={field.placeholder || ""}
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                />
              )}

              {field.field_type === "email" && (
                <Input
                  type="email"
                  placeholder={field.placeholder || "email@exemplo.com"}
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                />
              )}

              {field.field_type === "phone" && (
                <Input
                  type="tel"
                  placeholder={field.placeholder || "(11) 99999-9999"}
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                />
              )}

              {field.field_type === "number" && (
                <Input
                  type="number"
                  placeholder={field.placeholder || ""}
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                />
              )}

              {field.field_type === "textarea" && (
                <textarea
                  className="w-full border rounded-md p-2 text-sm min-h-[100px] bg-background border-input"
                  placeholder={field.placeholder || ""}
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                />
              )}

              {field.field_type === "select" && (
                <select
                  className="w-full border rounded-md p-2 text-sm bg-background border-input"
                  value={values[field.id] || ""}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  required={field.required}
                >
                  <option value="">{field.placeholder || "Selecione..."}</option>
                  {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.field_type === "radio" && (
                <div className="space-y-2">
                  {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`field-${field.id}`}
                        value={opt}
                        checked={values[field.id] === opt}
                        onChange={() => handleChange(field.id, opt)}
                        required={field.required && !values[field.id]}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {field.field_type === "checkbox" && (
                <div className="space-y-2">
                  {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(values[field.id] || []).includes(opt)}
                        onChange={(e) => {
                          const current = values[field.id] || [];
                          handleChange(
                            field.id,
                            e.target.checked ? [...current, opt] : current.filter((v: string) => v !== opt)
                          );
                        }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {inlineError && (
            <p className="text-sm text-destructive">{inlineError}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
            style={{ backgroundColor: form.theme_color || undefined }}
          >
            {submitting ? "Enviando..." : "Enviar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
