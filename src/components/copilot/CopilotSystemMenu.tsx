import { Button } from "@/components/ui/button";
import { copilotMenuGroups } from "./copilotMenu";

type Props = { onPick: (sectionId: string) => void; disabled?: boolean };

/** Mesmo menu da barra lateral, em botões, para o Copilot conduzir o cadastro. */
export function CopilotSystemMenu({ onPick, disabled }: Props) {
  return (
    <div className="w-full space-y-3">
      {copilotMenuGroups.map((g) => (
        <div key={g.label} className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <g.icon className="w-3.5 h-3.5" />
            {g.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                disabled={disabled}
                onClick={() => onPick(item.id)}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.title}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
