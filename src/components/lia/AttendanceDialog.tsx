import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function AttendanceDialog({ open, onOpenChange, url }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const update = () => {
      const element = contentRef.current;
      if (!element) return;
      element.style.setProperty("--attendance-height", `${viewport?.height ?? window.innerHeight}px`);
      element.style.setProperty("--attendance-top", `${viewport?.offsetTop ?? 0}px`);
    };
    const frame = window.requestAnimationFrame(update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={contentRef} className="attendance-dialog max-w-md overflow-hidden p-0">
        <DialogTitle className="sr-only">Atendimento Smart Dent</DialogTitle>
        <DialogDescription className="sr-only">Conversa com o atendimento Smart Dent</DialogDescription>
        {open && <iframe title="Atendimento Smart Dent" src={url} className="attendance-dialog-frame block h-[80vh] w-full border-0" />}
      </DialogContent>
    </Dialog>
  );
}