import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'destructive' | 'muted';
  action?: React.ReactNode;
}

const toneMap: Record<string, string> = {
  default: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  muted: 'text-muted-foreground',
};

export function MetricCard({ label, value, icon: Icon, tone = 'default', action }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-bold mt-1', toneMap[tone])}>{value}</p>
          </div>
          <Icon className={cn('w-5 h-5', toneMap[tone])} />
        </div>
        {action && <div className="mt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}