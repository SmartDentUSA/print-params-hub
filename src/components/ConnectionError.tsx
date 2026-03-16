import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ConnectionErrorProps {
  onRetry: () => void;
  retrying?: boolean;
}

export function ConnectionError({ onRetry, retrying = false }: ConnectionErrorProps) {
  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <WifiOff className="w-16 h-16 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Problema de conexão</CardTitle>
          <CardDescription>
            O servidor está temporariamente indisponível. Seus dados estão seguros — tente novamente em alguns instantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRetry} disabled={retrying} className="w-full">
            <RefreshCw className={`w-4 h-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Tentando...' : 'Tentar novamente'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
