import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const DocumentProxyRoute = () => {
  const { filename } = useParams<{ filename: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const redirectToDocument = async () => {
      if (!filename) {
        setError(true);
        return;
      }

      // Em preview (lovableproject.com), redirecionar para a Edge Function
      if (window.location.hostname.includes('lovableproject.com')) {
        const edgeFunctionUrl = `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/document-proxy/${filename}`;
        
        // Verificar se o documento existe antes de redirecionar
        try {
          const response = await fetch(edgeFunctionUrl, { method: 'HEAD' });
          if (response.ok) {
            window.location.replace(edgeFunctionUrl);
          } else {
            setError(true);
          }
        } catch (err) {
          setError(true);
        }
      }
      // Em produção, o vercel.json cuida do rewrite
    };

    redirectToDocument();
  }, [filename]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-foreground mb-4">Documento não encontrado</h1>
          <p className="text-muted-foreground">O documento solicitado não existe ou foi removido.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Carregando documento...</p>
      </div>
    </div>
  );
};

export default DocumentProxyRoute;
