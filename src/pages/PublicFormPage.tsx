import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Instagram, Youtube, Facebook, Linkedin, Twitter } from "lucide-react";
import { PhoneInputWithDDI } from "@/components/PhoneInputWithDDI";
import { useCompanyData } from "@/hooks/useCompanyData";
import { Slider } from "@/components/ui/slider";
import { isFieldVisible } from "@/lib/formConditions";

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
  workflow_cell_target: string | null;
  conditions?: any;
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
  hero_image_url: string | null;
  hero_image_alt: string | null;
  media_type: string | null;
  video_thumbnail_url: string | null;
  video_embed_url: string | null;
  workflow_stage_target: string | null;
  brand_color_h: number | null;
  brand_color_s: number | null;
  brand_color_l: number | null;
  badge_text: string | null;
  cta_text: string | null;
  trust_text: string | null;
  display_mode?: string | null;
  show_progress?: boolean | null;
}

export default function PublicFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { data: company } = useCompanyData();
  const [form, setForm] = useState<FormData | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const isStepMode = form?.display_mode === "step";
  // Filter fields by conditional logic against current answers
  const renderableFields = fields.filter((f) => isFieldVisible(f, values));
  const totalSteps = renderableFields.length;
  const safeStep = Math.min(currentStep, Math.max(0, totalSteps - 1));
  const visibleFields = isStepMode
    ? (renderableFields[safeStep] ? [renderableFields[safeStep]] : [])
    : renderableFields;
  const isLastStep = !isStepMode || safeStep >= totalSteps - 1;

  const validateField = (field: FormField): string | null => {
    const val = values[field.id];
    const empty = val === undefined || val === null || val === "" ||
      (Array.isArray(val) && val.length === 0);
    if (field.required && empty) return `Campo "${field.label}" é obrigatório.`;
    if (!empty && field.field_type === "email" && !/^\S+@\S+\.\S+$/.test(String(val))) {
      return "Informe um e-mail válido.";
    }
    if (!empty && field.field_type === "phone" && String(val).replace(/\D/g, "").length < 10) {
      return "Informe um telefone válido.";
    }
    return null;
  };

  const goNext = () => {
    const f = renderableFields[safeStep];
    if (f) {
      const err = validateField(f);
      if (err) { setInlineError(err); return; }
    }
    setInlineError(null);
    setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
  };
  const goBack = () => {
    setInlineError(null);
    setCurrentStep((s) => Math.max(0, s - 1));
  };

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      const { data: formData } = await supabase
        .from("smartops_forms" as any)
        .select("*")
        .eq("slug", slug)
        .single();

      if (!formData) {
        setError("Formulário não encontrado.");
        setLoading(false);
        return;
      }
      if (!(formData as any).active) {
        setError("Formulário temporariamente indisponível.");
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

  // OG image meta tag
  useEffect(() => {
    if (!form) return;
    const ogImage =
      form.media_type === "video" ? form.video_thumbnail_url : form.hero_image_url;
    if (!ogImage) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("property", "og:image");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", ogImage);
    return () => {
      meta?.removeAttribute("content");
    };
  }, [form]);

  // Adaptive color palette — apply brand_color_h/s/l as CSS vars (DB fallback)
  useEffect(() => {
    if (!form) return;
    const h = form.brand_color_h ?? 215;
    const s = form.brand_color_s ?? 78;
    const l = form.brand_color_l ?? 54;
    const root = document.documentElement;
    root.style.setProperty('--brand-h', String(h));
    root.style.setProperty('--brand-s', `${s}%`);
    root.style.setProperty('--brand-l', `${l}%`);
    return () => {
      root.style.removeProperty('--brand-h');
      root.style.removeProperty('--brand-s');
      root.style.removeProperty('--brand-l');
    };
  }, [form?.brand_color_h, form?.brand_color_s, form?.brand_color_l]);

  // Dynamically load Google Fonts for chosen heading/body fonts
  useEffect(() => {
    if (!form) return;
    const fonts = Array.from(new Set([
      (form as any).font_heading,
      (form as any).font_body,
    ].filter(Boolean))) as string[];
    if (fonts.length === 0) return;
    const family = fonts.map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`).join("&");
    const href = `https://fonts.googleapis.com/css2?${family}&display=swap`;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [form]);

  // Form-specific tracking pixels (GTM/GA4/Meta/TikTok) — injected only if differ from globals
  useEffect(() => {
    if (!form) return;
    const f: any = form;
    const created: HTMLElement[] = [];
    const html = document.documentElement.outerHTML;

    const append = (el: HTMLElement) => { document.head.appendChild(el); created.push(el); };
    const inlineScript = (code: string) => {
      const s = document.createElement('script');
      s.text = code;
      append(s);
    };
    const srcScript = (src: string) => {
      const s = document.createElement('script');
      s.async = true;
      s.src = src;
      append(s);
    };

    // GTM
    if (f.tracking_gtm_id && !html.includes(f.tracking_gtm_id)) {
      inlineScript(`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${f.tracking_gtm_id}');`);
    }
    // GA4
    if (f.tracking_ga4_id && !html.includes(f.tracking_ga4_id)) {
      srcScript(`https://www.googletagmanager.com/gtag/js?id=${f.tracking_ga4_id}`);
      inlineScript(`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;gtag('js',new Date());gtag('config','${f.tracking_ga4_id}',{send_page_view:true});`);
    }
    // Meta Pixel
    if (f.tracking_meta_pixel_id && !html.includes(f.tracking_meta_pixel_id)) {
      inlineScript(`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${f.tracking_meta_pixel_id}');fbq('track','PageView');`);
    }
    // TikTok Pixel
    if (f.tracking_tiktok_pixel_id && !html.includes(f.tracking_tiktok_pixel_id)) {
      inlineScript(`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${f.tracking_tiktok_pixel_id}');ttq.page();}(window,document,'ttq');`);
    }
    // Snippet livre
    if (f.tracking_extra_head) {
      const wrap = document.createElement('div');
      wrap.setAttribute('data-tracking-extra', '1');
      wrap.innerHTML = f.tracking_extra_head;
      // Mover scripts inline para executar
      wrap.querySelectorAll('script').forEach((old) => {
        const ns = document.createElement('script');
        for (const a of Array.from(old.attributes)) ns.setAttribute(a.name, a.value);
        ns.text = old.textContent || '';
        append(ns);
      });
    }

    return () => { created.forEach((el) => el.remove()); };
  }, [form]);

  // Immediate GA4/Meta/TikTok page_view for the form (bypass hook debounce of 2s)
  useEffect(() => {
    if (!form) return;
    const f: any = form;
    const sp = new URLSearchParams(window.location.search);
    // Set document.title BEFORE firing page_view so GA4 records the form name
    const formTitle = `${f.name} | Smart Dent`;
    document.title = formTitle;
    try {
      const gtag = (window as any).gtag;
      if (typeof gtag === 'function') {
        gtag('event', 'page_view', {
          page_path: window.location.pathname,
          page_title: formTitle,
          page_location: window.location.href,
          page_referrer: document.referrer || undefined,
          form_slug: f.slug,
          form_name: f.name,
          campaign_source: sp.get('utm_source') || undefined,
          campaign_medium: sp.get('utm_medium') || undefined,
          campaign_name: sp.get('utm_campaign') || undefined,
          campaign_content: sp.get('utm_content') || undefined,
          campaign_term: sp.get('utm_term') || undefined,
        });
      }
    } catch {}
    try { (window as any).fbq?.('track', 'ViewContent', { content_name: f.name, content_category: 'form' }); } catch {}
    try { (window as any).ttq?.page?.(); } catch {}
  }, [form]);

  // Extract vibrant color from hero image/thumbnail and override CSS vars
  const handleHeroImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    try {
      const img = e.currentTarget;
      const canvas = document.createElement('canvas');
      canvas.width = 60;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 60, 60);
      const { data } = ctx.getImageData(0, 0, 60, 60);

      let bestH = -1, bestS = 0, bestL = 0, bestScore = -1;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const lv = (max + min) / 2;
        if (lv < 0.18 || lv > 0.82) continue; // skip too dark/light
        const d = max - min;
        if (d < 0.12) continue; // skip near-grey
        const sv = d / (1 - Math.abs(2 * lv - 1));
        const score = sv * (1 - Math.abs(lv - 0.45) * 1.5);
        if (score > bestScore) {
          bestScore = score;
          let hv = 0;
          if (max === r) hv = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          else if (max === g) hv = ((b - r) / d + 2) / 6;
          else hv = ((r - g) / d + 4) / 6;
          bestH = Math.round(hv * 360);
          bestS = Math.round(sv * 100);
          bestL = Math.round(lv * 100);
        }
      }
      if (bestH >= 0) {
        const root = document.documentElement;
        root.style.setProperty('--brand-h', String(bestH));
        root.style.setProperty('--brand-s', `${bestS}%`);
        root.style.setProperty('--brand-l', `${bestL}%`);
      }
    } catch {
      // CORS or canvas error — keep DB/default values
    }
  };

  const handleChange = (fieldId: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);

    // Build payload mapping db_column -> value, custom fields -> raw_payload
    // Only include answers from currently visible fields (drop hidden/conditional)
    const activeFieldIds = new Set(renderableFields.map((f) => f.id));
    const activeFields = fields.filter((f) => activeFieldIds.has(f.id));
    const payload: Record<string, any> = {
      source: "form",
      form_name: form.name,
      form_purpose: form.form_purpose,
      // Enviar respostas inline para evitar race condition com lia-assign
      form_responses: activeFields
        .filter(f => values[f.id] !== undefined && values[f.id] !== null && values[f.id] !== "")
        .map(f => ({
          label: f.label,
          value: Array.isArray(values[f.id]) ? (values[f.id] as string[]).join(", ") : String(values[f.id]),
        })),
    };

    const customFields: Record<string, any> = {};

    for (const field of activeFields) {
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
      const { data: ingestData, error } = await supabase.functions.invoke("smart-ops-ingest-lead", {
        body: payload,
      });
      if (error) throw error;

      // Increment submissions count
      await supabase.from("smartops_forms" as any)
        .update({ submissions_count: (form as any).submissions_count + 1 } as any)
        .eq("id", form.id);

      // Gravar respostas dos campos de mapeamento
      const leadId = ingestData?.lead_id;
      if (form.form_purpose === "sdr_captacao" && leadId) {
        const mappingFields = activeFields.filter((f) => f.workflow_cell_target);
        if (mappingFields.length > 0) {
          const responses = mappingFields
            .map((f) => {
              const raw = values[f.id];
              if (raw === undefined || raw === null || raw === "") return null;
              const value = Array.isArray(raw) ? raw.join(", ") : String(raw);
              return {
                form_id: form.id,
                field_id: f.id,
                lead_id: leadId,
                value,
                workflow_cell_target: f.workflow_cell_target,
                field_label: f.label,
              };
            })
            .filter(Boolean);

          if (responses.length > 0) {
            supabase
              .from("smartops_form_field_responses" as any)
              .insert(responses as any)
              .then(({ error: respError }: { error: any }) => {
                if (respError) console.error("[PublicFormPage] Erro ao gravar field responses:", respError);
              });
          }
        }
      }

      // Enviar respostas como nota no deal do PipeRun (fire-and-forget)
      if (leadId) {
        const allResponses = activeFields
          .filter((f) => values[f.id] !== undefined && values[f.id] !== null && values[f.id] !== "")
          .map((f) => ({
            label: f.label,
            value: Array.isArray(values[f.id]) ? (values[f.id] as string[]).join(", ") : String(values[f.id]),
          }));

        if (allResponses.length > 0) {
          supabase.functions
            .invoke("smart-ops-deal-form-note", {
              body: { lead_id: leadId, form_name: form.name, responses: allResponses },
            })
            .catch((err) => console.warn("[PublicFormPage] Deal note error:", err));
        }
      }

      // GTM — Lead gerado via formulário SDR-CAPTAÇÃO
      try {
        if (typeof window !== 'undefined' && (window as any).dataLayer) {
          (window as any).dataLayer.push({
            event: 'generate_lead',
            form_name: form.name ?? '',
            form_purpose: form.form_purpose ?? '',
            product_name: form.workflow_stage_target ?? '',
          });
        }
      } catch (e) {
        console.error('GTM dataLayer error:', e);
      }

      // Meta Pixel — Lead
      try {
        const fbq = (window as any).fbq;
        if (typeof fbq === 'function') {
          fbq('track', 'Lead', { content_name: form.name ?? '' });
        }
      } catch {}

      // GA4 — generate_lead
      try {
        const gtag = (window as any).gtag;
        if (typeof gtag === 'function') {
          gtag('event', 'generate_lead', {
            form_name: form.name ?? '',
            form_purpose: form.form_purpose ?? '',
          });
        }
      } catch {}

      // TikTok Pixel — SubmitForm
      try {
        const ttq = (window as any).ttq;
        if (ttq && typeof ttq.track === 'function') {
          ttq.track('SubmitForm', { content_name: form.name ?? '' });
        }
      } catch {}

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
          <CheckCircle className="w-16 h-16 mx-auto" style={{ color: `hsl(var(--brand-h, 215), var(--brand-s, 78%), var(--brand-l, 54%))` }} />
          <p className="text-lg font-medium">{form.success_message}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`public-form-page min-h-screen flex flex-col items-center p-4 pt-8 md:pt-16 ${(form as any).theme_mode === "dark" ? "dark" : ""}`}
      data-layout={(form as any).layout_variant || "split"}
      data-pp-default={(() => {
        const f: any = form;
        const t = f.bg_type || "solid";
        if (t === "gradient" && f.bg_color && f.bg_color_to) return "false";
        if (t === "image" && f.bg_image_url) return "false";
        if (t === "solid" && f.bg_color) return "false";
        return "true";
      })()}
      style={(() => {
        const f: any = form;
        const bgType = f.bg_type || "solid";
        // ---- Background ----
        let bgStyle: React.CSSProperties = {};
        if (bgType === "gradient" && f.bg_color && f.bg_color_to) {
          bgStyle = { background: `linear-gradient(${f.bg_gradient_angle ?? 135}deg, ${f.bg_color}, ${f.bg_color_to})` };
        } else if (bgType === "image" && f.bg_image_url) {
          const ov = f.bg_overlay_opacity ?? 0.5;
          bgStyle = {
            backgroundImage: `linear-gradient(rgba(0,0,0,${ov}), rgba(0,0,0,${ov})), url("${f.bg_image_url}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
          };
        } else if (bgType === "solid" && f.bg_color) {
          bgStyle = { backgroundColor: f.bg_color };
        } else {
          // Default — Smart Dent "Conhecimento" look
          bgStyle = { backgroundColor: "#EEF1F6" };
        }
        // ---- Text colors ----
        const hexToRgb = (hex: string) => {
          const h = hex.replace("#", "");
          const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
          const n = parseInt(v, 16);
          return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
        };
        const isLight = (hex?: string | null) => {
          if (!hex || !/^#?[0-9a-fA-F]{3,6}$/.test(hex)) return f.theme_mode !== "dark";
          try {
            const { r, g, b } = hexToRgb(hex);
            // YIQ luminance
            return ((r * 299 + g * 587 + b * 114) / 1000) > 150;
          } catch { return true; }
        };
        const refBg = bgType === "image" ? null : (f.bg_color || null);
        const lightBg = bgType === "image" ? false : isLight(refBg);
        const auto = f.auto_contrast !== false;
        const fallbackHeading = lightBg ? "#0f172a" : "#f8fafc";
        const fallbackBody = lightBg ? "#1f2937" : "#e5e7eb";
        const fallbackLabel = lightBg ? "#0f172a" : "#f1f5f9";
        const fallbackMuted = lightBg ? "rgba(15,23,42,0.65)" : "rgba(248,250,252,0.7)";
        const textVars: Record<string, string> = {
          "--form-heading": (!auto && f.heading_color) ? f.heading_color : fallbackHeading,
          "--form-body":    (!auto && f.body_color)    ? f.body_color    : fallbackBody,
          "--form-label":   (!auto && f.label_color)   ? f.label_color   : fallbackLabel,
          "--form-muted":   (!auto && f.muted_color)   ? f.muted_color   : fallbackMuted,
        };
        return { ...bgStyle, ...(textVars as any) };
      })()}
    >
      <style>{`
        :root {
          --brand-h: 215;
          --brand-s: 78%;
          --brand-l: 54%;
        }
        .public-form-page {
          --brand:       hsl(var(--brand-h), var(--brand-s), var(--brand-l));
          --brand-dark:  hsl(var(--brand-h), var(--brand-s), calc(var(--brand-l) - 12%));
          --brand-glow:  hsl(var(--brand-h), 90%,            calc(var(--brand-l) + 14%));
          --brand-faint: hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.12);
          --brand-border:hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.28);
          font-family: ${(form as any).font_body ? `"${(form as any).font_body}", ` : ""}'Inter', system-ui, -apple-system, sans-serif;
          color: var(--form-body);
        }
        .public-form-page h1, .public-form-page h2, .public-form-page h3 {
          font-family: ${(form as any).font_heading ? `"${(form as any).font_heading}", ` : ""}'Inter', system-ui, -apple-system, sans-serif;
          color: var(--form-heading);
          letter-spacing: -0.01em;
        }
        .public-form-page label { color: var(--form-label); }
        .public-form-page .text-muted-foreground { color: var(--form-muted) !important; }
        .public-form-page .text-foreground { color: var(--form-heading) !important; }
        .public-form-page.dark input, .public-form-page.dark select, .public-form-page.dark textarea {
          background-color: rgba(255,255,255,0.06); color: #f5f5f5; border-color: rgba(255,255,255,0.18);
        }
        /* KB-style fallback form panel (only when no custom background) */
        .public-form-page[data-pp-default="true"] form {
          background: #FFFFFF;
          border: 1px solid rgba(0,0,0,0.07);
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
          padding: 24px;
        }
        .public-form-page[data-pp-default="true"] input,
        .public-form-page[data-pp-default="true"] select,
        .public-form-page[data-pp-default="true"] textarea {
          background: #E8ECF4;
          border: 1px solid #C8CACF;
          border-radius: 10px;
        }
        .public-form-page[data-pp-default="true"] input:hover,
        .public-form-page[data-pp-default="true"] select:hover,
        .public-form-page[data-pp-default="true"] textarea:hover { background: #E2E6EE; }
        .public-form-page button[type="submit"] {
          border-radius: ${({ none: "0", sm: "6px", md: "10px", lg: "16px", pill: "9999px" } as any)[(form as any).button_radius || "md"]};
          box-shadow: ${({ none: "none", sm: "0 2px 8px rgba(0,0,0,0.08)", md: "0 8px 24px rgba(0,0,0,0.12)", glow: "0 0 32px var(--brand-faint), 0 4px 16px var(--brand-faint)" } as any)[(form as any).button_shadow || "sm"]};
          transition: transform .15s ease, box-shadow .15s ease;
        }
        .public-form-page button[type="submit"]:hover { transform: translateY(-1px); }
        .public-form-page .brand-strip {
          background: var(--brand);
        }
        .public-form-page input:focus,
        .public-form-page select:focus,
        .public-form-page textarea:focus {
          outline: none;
          box-shadow: 0 0 0 2px var(--brand-faint), 0 0 0 1px var(--brand-border);
          border-color: var(--brand);
        }
        .public-form-page .video-glow {
          box-shadow: 0 0 32px var(--brand-faint);
        }
        .public-form-page[data-layout="centered"] .form-grid { grid-template-columns: 1fr !important; max-width: 640px; margin-inline: auto; }
        .public-form-page[data-layout="centered"] .form-grid > div:first-child { text-align: center; }
        .public-form-page[data-layout="full"] .form-grid { grid-template-columns: 1fr !important; }
        ${(form as any).custom_css || ""}
      `}</style>
      {/* Brand color strip */}
      <div className="brand-strip fixed top-0 left-0 right-0 h-1 z-50" />
      <div className="form-grid w-full max-w-5xl mt-1 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
        {/* Left column — media + text (sticky on desktop) */}
        <div className="md:sticky md:top-8 space-y-6">
          {/* Mídia HERO */}
          {form.media_type === "video" && form.video_embed_url && (
            <div className="video-glow w-full rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <iframe
                src={form.video_embed_url}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; encrypted-media"
                style={{ border: 0 }}
              />
            </div>
          )}
          {form.media_type === "video" && !form.video_embed_url && form.video_thumbnail_url && (
            <img
              src={form.video_thumbnail_url}
              alt={form.hero_image_alt ?? ""}
              className="w-full rounded-lg object-cover"
              crossOrigin="anonymous"
              onLoad={handleHeroImageLoad}
            />
          )}
          {form.media_type === "video" && form.video_embed_url && form.video_thumbnail_url && (
            <img
              src={form.video_thumbnail_url}
              alt=""
              className="hidden"
              crossOrigin="anonymous"
              onLoad={handleHeroImageLoad}
            />
          )}
          {form.media_type !== "video" && form.hero_image_url && (
            <img
              src={form.hero_image_url}
              alt={form.hero_image_alt ?? ""}
              className="w-full rounded-lg object-cover"
              crossOrigin="anonymous"
              onLoad={handleHeroImageLoad}
            />
          )}

          <div className="space-y-2">
            {form.badge_text && (
              <span
                className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ backgroundColor: 'var(--brand-faint)', color: 'var(--brand)', border: '1px solid var(--brand-border)' }}
              >
                {form.badge_text}
              </span>
            )}
            <h1 className="text-2xl font-bold">{form.title || form.name}</h1>
            {form.subtitle && (
              <p className="text-lg text-muted-foreground">{form.subtitle}</p>
            )}
            {form.description && (
              <p className="text-sm text-muted-foreground">{form.description}</p>
            )}
          </div>
        </div>

        {/* Right column — form fields */}
        <div>
          <form
            onSubmit={(e) => {
              if (isStepMode && !isLastStep) { e.preventDefault(); goNext(); return; }
              handleSubmit(e);
            }}
            className="space-y-5"
          >
            {isStepMode && form.show_progress !== false && totalSteps > 0 && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${((safeStep + 1) / totalSteps) * 100}%`, backgroundColor: 'var(--brand)' }}
                />
              </div>
            )}
            {visibleFields.map((field) => (
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
                    className="h-12 text-base md:h-10 md:text-sm"
                  />
                )}

                {field.field_type === "email" && (
                  <Input
                    type="email"
                    placeholder={field.placeholder || "email@exemplo.com"}
                    value={values[field.id] || ""}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    required={field.required}
                    className="h-12 text-base md:h-10 md:text-sm"
                  />
                )}

                {field.field_type === "phone" && (
                  <PhoneInputWithDDI
                    placeholder={field.placeholder || "(11) 99999-9999"}
                    value={values[field.id] || ""}
                    onChange={(val) => handleChange(field.id, val)}
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
                    className="h-12 text-base md:h-10 md:text-sm"
                  />
                )}

                {field.field_type === "textarea" && (
                  <textarea
                    className="w-full border rounded-md p-3 text-base min-h-[140px] bg-background border-input md:p-2 md:text-sm md:min-h-[100px]"
                    placeholder={field.placeholder || ""}
                    value={values[field.id] || ""}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    required={field.required}
                  />
                )}

                {field.field_type === "select" && (
                  <select
                    className="w-full border rounded-md h-12 px-3 text-base bg-background border-input md:h-10 md:px-2 md:text-sm"
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
                      <label key={opt} className="flex items-center gap-3 text-base py-1.5 md:gap-2 md:text-sm md:py-0">
                        <input
                          type="radio"
                          name={`field-${field.id}`}
                          value={opt}
                          checked={values[field.id] === opt}
                          onChange={() => handleChange(field.id, opt)}
                          required={field.required && !values[field.id]}
                          className="w-5 h-5 md:w-4 md:h-4"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}

                {field.field_type === "checkbox" && (
                  <div className="space-y-2">
                    {(Array.isArray(field.options) ? field.options : []).map((opt: string) => (
                      <label key={opt} className="flex items-center gap-3 text-base py-1.5 md:gap-2 md:text-sm md:py-0">
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
                          className="w-5 h-5 md:w-4 md:h-4"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}

                {field.field_type === "slider" && (() => {
                  const opts = (field.options && !Array.isArray(field.options)) ? field.options as Record<string, any> : {};
                  const min = opts.min ?? 0;
                  const mid = opts.mid ?? 50;
                  const max = opts.max ?? 100;
                  const current = values[field.id] ?? mid;
                  return (
                    <div className="space-y-3 pt-2">
                      <Slider
                        min={min}
                        max={max}
                        step={1}
                        value={[current]}
                        onValueChange={([v]) => handleChange(field.id, v)}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{min}</span>
                        <span>{mid}</span>
                        <span>{max}</span>
                      </div>
                      <p className="text-sm font-medium text-center">Valor: {current}</p>
                    </div>
                  );
                })()}
              </div>
            ))}

            {inlineError && (
              <p className="text-sm text-destructive">{inlineError}</p>
            )}

            {isStepMode ? (
              <div className="flex gap-2">
                {safeStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={goBack}
                    disabled={submitting}
                  >
                    Voltar
                  </Button>
                )}
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={submitting}
                  style={{ backgroundColor: 'var(--brand)', borderColor: 'var(--brand-dark)' }}
                >
                  {submitting ? "Enviando..." : (isLastStep ? (form.cta_text || "Enviar") : "Próximo")}
                </Button>
              </div>
            ) : (
              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
                style={{ backgroundColor: 'var(--brand)', borderColor: 'var(--brand-dark)' }}
              >
                {submitting ? "Enviando..." : (form.cta_text || "Enviar")}
              </Button>
            )}
            {form.trust_text && (
              <p className="text-xs text-center text-muted-foreground pt-1">{form.trust_text}</p>
            )}
          </form>
        </div>
      </div>

      {/* Seções extras (landing page) */}
      {Array.isArray((form as any).extra_sections) && (form as any).extra_sections.length > 0 && (
        <div className="w-full max-w-5xl mt-12 space-y-12">
          {(form as any).extra_sections.map((sec: any, idx: number) => {
            if (!sec || !sec.type) return null;
            return (
              <section key={idx} className="space-y-4">
                {sec.title && <h2 className="text-2xl font-bold text-center">{sec.title}</h2>}
                {sec.type === "testimonials" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(sec.items || []).map((it: any, i: number) => (
                      <div key={i} className="rounded-lg border p-4 space-y-2 bg-card">
                        <p className="text-sm italic">"{it.quote}"</p>
                        <div className="text-xs">
                          <p className="font-semibold">{it.name}</p>
                          {it.role && <p className="text-muted-foreground">{it.role}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {sec.type === "features" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(sec.items || []).map((it: any, i: number) => (
                      <div key={i} className="rounded-lg border p-4 space-y-2 bg-card">
                        <div className="text-2xl">{it.icon || "✨"}</div>
                        <h3 className="font-semibold">{it.title}</h3>
                        <p className="text-sm text-muted-foreground">{it.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                {sec.type === "faq" && (
                  <div className="space-y-2 max-w-3xl mx-auto">
                    {(sec.items || []).map((it: any, i: number) => (
                      <details key={i} className="rounded-lg border p-3 bg-card">
                        <summary className="font-medium cursor-pointer">{it.q}</summary>
                        <p className="text-sm text-muted-foreground mt-2">{it.a}</p>
                      </details>
                    ))}
                  </div>
                )}
                {sec.type === "logos" && (
                  <div className="flex flex-wrap items-center justify-center gap-6 opacity-80">
                    {(sec.items || []).map((it: any, i: number) => (
                      it.src ? <img key={i} src={it.src} alt={it.alt || ""} className="h-10 object-contain" loading="lazy" /> : null
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Footer — dados da empresa */}
    </div>
  );
}
