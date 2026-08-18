import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePushSubscription, isIos, isIosStandalone } from "@/hooks/usePushSubscription";

/**
 * Aceitação obrigatória de notificações: assim que o cliente faz login,
 * o aviso é exibido e não pode ser fechado até autorizar as notificações.
 */
export function PushOptInGate() {
  const { supported, permission, subscribed, loading, error, subscribe } = usePushSubscription();
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    const isCliente = (user?: { user_metadata?: Record<string, unknown> } | null) =>
      !!user && (user.user_metadata as { tipo?: string } | undefined)?.tipo === "cliente";
    supabase.auth.getSession().then(({ data }) => setLogged(isCliente(data.session?.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setLogged(isCliente(session?.user)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const iosNeedsInstall = isIos() && !isIosStandalone();
  const open = logged && !subscribed && (supported || iosNeedsInstall);

  if (!open) return null;

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Ative as notificações para continuar</DialogTitle>
          <DialogDescription className="text-center">
            A autorização de notificações é obrigatória para usar sua área Smart Dent: é por
            ela que enviamos avisos de treinamentos, suporte e novidades.
          </DialogDescription>
        </DialogHeader>

        {iosNeedsInstall ? (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Share2 className="h-4 w-4" /> No iPhone/iPad
            </p>
            <p className="text-muted-foreground">
              Toque em <strong>Compartilhar</strong> e escolha{" "}
              <strong>“Adicionar à Tela de Início”</strong>. Abra o app pelo ícone criado e
              autorize as notificações.
            </p>
          </div>
        ) : permission === "denied" ? (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Notificações bloqueadas no navegador</p>
            <p className="text-muted-foreground">
              Abra o cadeado ao lado do endereço do site, mude <strong>Notificações</strong> para{" "}
              <strong>Permitir</strong> e recarregue a página.
            </p>
            <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
              Já autorizei — recarregar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {error && <p className="text-center text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={subscribe} disabled={loading}>
              {loading ? "Ativando..." : "Autorizar notificações"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
