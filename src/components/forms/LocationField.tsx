import { useMemo } from "react";
import { Country, State, City } from "country-state-city";
import { Input } from "@/components/ui/input";
import { Combobox, resolveCountry } from "@/components/smartops/DistributorForm";
import type { LocationAnswer } from "@/lib/locationAnswer";

const ALL_COUNTRIES = Country.getAllCountries();

/** País → estado → cidade com as mesmas listas do cadastro de distribuidor. */
export function LocationField({ value, onChange }: { value: LocationAnswer | null | undefined; onChange: (v: LocationAnswer) => void }) {
  const v = value ?? { pais: "Brazil" };
  const country = useMemo(() => resolveCountry(v.pais), [v.pais]);
  const states = useMemo(() => (country ? State.getStatesOfCountry(country.isoCode) : []), [country]);
  const state = useMemo(() => states.find((s) => s.name === v.estado), [states, v.estado]);
  const cities = useMemo(() => (country && state ? City.getCitiesOfState(country.isoCode, state.isoCode) : []), [country, state]);

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <Combobox
        value={country?.name || ""}
        placeholder="País"
        emptyText="Nenhum país encontrado"
        options={ALL_COUNTRIES.map((c) => ({ value: c.name, label: `${c.flag || ""} ${c.name}`.trim() }))}
        onChange={(pais) => onChange({ pais, estado: "", estadoSigla: "", cidade: "" })}
      />
      <Combobox
        value={state?.name || ""}
        placeholder={states.length ? "Estado" : "—"}
        emptyText="Nenhum estado encontrado"
        disabled={!states.length}
        options={states.map((s) => ({ value: s.name, label: s.name }))}
        onChange={(estado) => onChange({ ...v, estado, estadoSigla: states.find((s) => s.name === estado)?.isoCode ?? "", cidade: "" })}
      />
      {cities.length ? (
        <Combobox
          value={v.cidade || ""}
          placeholder="Cidade"
          emptyText="Nenhuma cidade encontrada"
          options={cities.map((c) => ({ value: c.name, label: c.name }))}
          onChange={(cidade) => onChange({ ...v, cidade })}
        />
      ) : (
        <Input className="h-10" value={v.cidade || ""} placeholder="Cidade" onChange={(e) => onChange({ ...v, cidade: e.target.value })} />
      )}
    </div>
  );
}
