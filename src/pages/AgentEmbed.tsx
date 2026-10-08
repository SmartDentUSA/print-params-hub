import { useSearchParams } from "react-router-dom";
import DraLIA from "@/components/DraLIA";
import LiaCaptureChat from "@/components/lia/LiaCaptureChat";

export default function AgentEmbed() {
  const [sp] = useSearchParams();
  const formId = sp.get("form");
  const campaign = sp.get("c");
  const product = sp.get("p");

  if (formId || campaign || product) {
    return (
      <div className="w-full h-screen flex flex-col">
        <LiaCaptureChat formId={formId} campaign={campaign} product={product} />
      </div>
    );
  }

  return (
    <div className="lia-whatsapp w-full h-screen bg-background text-foreground flex flex-col">
      <DraLIA embedded={true} />
    </div>
  );
}
