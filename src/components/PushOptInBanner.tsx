import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Share2, X } from "lucide-react";
import { usePushSubscription, isIos, isIosStandalone } from "@/hooks/usePushSubscription";

/** Convite discreto para o cliente autorizar notificações do app. */
export function PushOptInBanner() {
  const { supported, permission, subscribed, loading, error, subscribe } = usePushSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || subscribed || permission === "denied") return null;

  const iosNeedsInstall = isIos() && !isIosStandalone();

  if (!supported && !iosNeedsInstall) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <Bell className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm font-medium">Receber avisos da Smart Dent</p>
          <p className="text-xs text-muted-foreground">
            {iosNeedsInstall
              ? "No iPhone, toque em Compartilhar e escolha \"Adicionar à Tela de Início\" para liberar as notificações."
              : "Novidades, treinamentos e avisos importantes direto no seu celular."}
          </p>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
        {iosNeedsInstall ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Share2 className="w-4 h-4" /> Adicionar à Tela de Início
          </span>
        ) : (
          <Button size="sm" onClick={subscribe} disabled={loading}>
            {loading ? "Ativando..." : "Ativar notificações"}
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={() => setDismissed(true)} aria-label="Dispensar">
          <X className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export { BellOff };