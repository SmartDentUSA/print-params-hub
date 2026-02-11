import { Lock, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoGateOverlayProps {
  membersAreaUrl: string;
  onClose: () => void;
}

export function VideoGateOverlay({ membersAreaUrl, onClose }: VideoGateOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-lg">
      <div className="bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm mx-4 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-foreground">
            Conteúdo Exclusivo para Membros
          </h3>
          <p className="text-sm text-muted-foreground">
            Continue assistindo este vídeo completo na área de membros.
          </p>
        </div>

        <div className="space-y-2">
          {membersAreaUrl && (
            <Button 
              className="w-full gap-2" 
              onClick={() => window.open(membersAreaUrl, '_blank')}
            >
              Acessar Área de Membros
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-muted-foreground"
            onClick={onClose}
          >
            <X className="w-4 h-4 mr-1" />
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
