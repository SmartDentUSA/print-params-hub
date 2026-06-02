import { Sparkles } from 'lucide-react';

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <Sparkles className="w-10 h-10 text-primary mb-3" />
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-md">
        Em construção. Esta página entrará na próxima fase do Social Publisher.
      </p>
    </div>
  );
}