import { Button } from "@/components/ui/button";
import { PartyPopper } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BoasVindasButtonProps {
  turmaNumber?: number | null;
}

export function BoasVindasButton({ turmaNumber }: BoasVindasButtonProps) {
  const { toast } = useToast();

  const handleClick = () => {
    if (!turmaNumber) {
      toast({
        title: "Turma sem número",
        description: "Defina o número da turma para gerar a tela de boas-vindas.",
        variant: "destructive",
      });
      return;
    }
    window.open(`/turma${turmaNumber}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick} className="gap-1.5">
      <PartyPopper className="h-4 w-4" />
      Boas-vindas
    </Button>
  );
}
