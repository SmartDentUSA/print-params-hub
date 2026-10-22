import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import DraLIA from "@/components/DraLIA";
import LiaCaptureChat from "@/components/lia/LiaCaptureChat";

export default function AgentEmbed() {
  const [sp] = useSearchParams();
  const formId = sp.get("form");
  const campaign = sp.get("c");
  const product = sp.get("p");
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    const updateHeight = () => viewportRef.current?.style.setProperty("--lia-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    updateHeight();
    viewport?.addEventListener("resize", updateHeight);
    window.addEventListener("resize", updateHeight);
    return () => {
      document.body.style.overflow = previousOverflow;
      viewport?.removeEventListener("resize", updateHeight);
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  if (formId || campaign || product) {
    return (
      <div ref={viewportRef} className="lia-viewport w-full flex flex-col">
        <LiaCaptureChat formId={formId} campaign={campaign} product={product} />
      </div>
    );
  }

  return (
    <div ref={viewportRef} className="lia-viewport lia-whatsapp w-full bg-background text-foreground flex flex-col">
      <DraLIA embedded={true} />
    </div>
  );
}
