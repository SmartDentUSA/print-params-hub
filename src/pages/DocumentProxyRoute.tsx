import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const DocumentProxyRoute = () => {
  const { filename } = useParams<{ filename: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!filename) {
      setError(true);
      return;
    }

    // Redirecionar SEMPRE para a Edge Function pública
    // Funciona para usuários logados E não logados
    const edgeFunctionUrl = `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/document-proxy/${filename}`;
    
    console.log('[DocumentProxyRoute] Redirecting to:', edgeFunctionUrl);
    
    // Redirect imediato
    window.location.replace(edgeFunctionUrl);
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
