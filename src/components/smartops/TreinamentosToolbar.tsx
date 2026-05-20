import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterTab {
  key: string;
  label: string;
  count: number;
}

interface Props {
  tabs: FilterTab[];
  activeTab: string;
  onTabChange: (k: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  sort: string;
  onSortChange: (s: string) => void;
  sortOptions: { value: string; label: string }[];
  searchPlaceholder?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export function TreinamentosToolbar({
  tabs, activeTab, onTabChange,
  search, onSearchChange,
  sort, onSortChange, sortOptions,
  searchPlaceholder = "Buscar treinamentos…",
  ctaLabel, onCtaClick,
}: Props) {
  return (
    <div className="rounded-xl border bg-card p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                activeTab === t.key
                  ? "text-primary font-semibold border-b-2 border-primary rounded-none"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label} <span className="opacity-70">({t.count})</span>
            </button>
          ))}
        </div>
        {ctaLabel && (
          <Button onClick={onCtaClick} size="sm">{ctaLabel}</Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 bg-background"
          />
        </div>
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sortOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}