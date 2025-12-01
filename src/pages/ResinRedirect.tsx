import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ResinRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const findAndRedirect = async () => {
      if (!slug) {
        navigate("/404", { replace: true });
        return;
      }

      try {
        // Buscar a resina pelo slug ou ID
        const { data: resin, error } = await supabase
          .from("resins")
          .select("id, slug, name")
          .or(`slug.eq.${slug},id.eq.${slug}`)
          .eq("active", true)
          .single();

        if (error || !resin) {
          console.error("Resin not found:", slug);
          navigate("/404", { replace: true });
          return;
        }

        // Buscar um parameter_set para descobrir brand e model
        const { data: paramSet, error: paramError } = await supabase
          .from("parameter_sets")
          .select("brand_slug, model_slug, resin_name, resin_manufacturer")
          .eq("resin_name", resin.name)
          .eq("active", true)
          .limit(1)
          .single();

        if (paramError || !paramSet) {
          console.error("No parameter set found for resin:", resin.name);
          navigate("/404", { replace: true });
          return;
        }

        // Redirecionar para a rota correta
        const targetPath = `/${paramSet.brand_slug}/${paramSet.model_slug}/${resin.slug || resin.id}`;
        navigate(targetPath, { replace: true });
      } catch (err) {
        console.error("Error redirecting resin:", err);
        navigate("/404", { replace: true });
      }
    };

    findAndRedirect();
  }, [slug, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    </div>
  );
};

export default ResinRedirect;
