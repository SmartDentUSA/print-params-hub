import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

const RELOAD_FLAG = "__chunk_reload_attempted__";
// Auto-reload again if the last attempt was more than this many ms ago.
// Prevents infinite reload loops but still recovers from stale chunks after redeploys.
const RELOAD_COOLDOWN_MS = 15_000;

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return (
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: isChunkLoadError(error) ? true : true };
  }

  componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
      const now = Date.now();
      if (!last || now - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
        const url = new URL(window.location.href);
        url.searchParams.set("_cb", String(Date.now()));
        window.location.replace(url.toString());
      }
    } catch {
      window.location.reload();
    }
  }

  handleManualReload = () => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set("_cb", String(Date.now()));
    window.location.replace(url.toString());
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-semibold">Atualizando para a versão mais recente…</h1>
            <p className="text-sm text-muted-foreground">
              Acabamos de publicar uma atualização. Recarregue a página para continuar.
            </p>
            <button
              onClick={this.handleManualReload}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Recarregar agora
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ChunkErrorBoundary;