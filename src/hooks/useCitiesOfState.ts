import { useEffect, useState } from "react";
import type { ICity } from "country-state-city";

// The full city list is ~8 MB: load it only when a country + state are chosen,
// so public forms open without downloading every city of the world.
let cityModule: Promise<typeof import("country-state-city/lib/city")> | null = null;
const loadCity = () => (cityModule ??= import("country-state-city/lib/city"));

export function useCitiesOfState(countryIso?: string, stateIso?: string): ICity[] {
  const [cities, setCities] = useState<ICity[]>([]);
  useEffect(() => {
    if (!countryIso || !stateIso) { setCities([]); return; }
    let alive = true;
    loadCity()
      .then((m) => { if (alive) setCities(m.default.getCitiesOfState(countryIso, stateIso)); })
      .catch(() => { if (alive) setCities([]); });
    return () => { alive = false; };
  }, [countryIso, stateIso]);
  return cities;
}
