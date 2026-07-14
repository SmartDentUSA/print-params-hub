import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

type Rates = { usd: number; eur: number; updatedAt: string };

const CACHE_KEY = "fx_rates_awesomeapi_v1";
const TTL_MS = 10 * 60 * 1000;

const fmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export function FxRateBadge() {
  const [rates, setRates] = useState<Rates | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as Rates & { cachedAt: number };
          if (Date.now() - parsed.cachedAt < TTL_MS) {
            setRates({ usd: parsed.usd, eur: parsed.eur, updatedAt: parsed.updatedAt });
            return;
          }
        }
        const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL");
        if (!res.ok) return;
        const data = await res.json();
        const usd = Number(data?.USDBRL?.bid);
        const eur = Number(data?.EURBRL?.bid);
        const ts = data?.USDBRL?.create_date || data?.EURBRL?.create_date || new Date().toISOString();
        if (!(usd > 0) || !(eur > 0)) return;
        const next: Rates = { usd, eur, updatedAt: ts };
        setRates(next);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...next, cachedAt: Date.now() }));
      } catch {
        // fail silent
      }
    };
    load();
  }, []);

  if (!rates) return null;

  const when = (() => {
    const d = new Date(rates.updatedAt.replace(" ", "T"));
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  })();

  return (
    <div className="flex items-center gap-2 text-xs bg-background border rounded-md px-2.5 py-1.5 whitespace-nowrap">
      <TrendingUp className="w-3.5 h-3.5 text-primary" />
      <span className="font-medium">USD</span>
      <span className="tabular-nums">R$ {fmt.format(rates.usd)}</span>
      <span className="text-muted-foreground">·</span>
      <span className="font-medium">EUR</span>
      <span className="tabular-nums">R$ {fmt.format(rates.eur)}</span>
      {when && <span className="text-muted-foreground hidden md:inline">({when})</span>}
    </div>
  );
}