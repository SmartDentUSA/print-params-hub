import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { PostInput } from '@/lib/social/postSchema';
import { isoToLocalInput, nowLocalInput } from '@/lib/social/scheduleTime';

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Lisbon',
  'Europe/London',
  'UTC',
];

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

interface Props {
  value: PostInput;
  onChange: (patch: Partial<PostInput>) => void;
}

export function StepSchedule({ value, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const platform = value.channels?.[0]?.platform;
  const tz = value.timezone || 'America/Sao_Paulo';

  async function suggestBestTime() {
    setLoading(true);
    setSuggestion(null);
    try {
      const { data, error } = await supabase.functions.invoke('social-analytics', {
        body: { action: 'best_time', ...(platform ? { platform } : {}) },
      });
      if (error) throw error;
      const slots: any[] = Array.isArray(data?.slots) ? data.slots : [];
      const valid = slots.filter((s) => s && s.hour != null && s.day_of_week != null);
      if (!valid.length) {
        toast({ title: 'Sem dados suficientes', description: 'O Analytics ainda não tem histórico para sugerir horário.', variant: 'destructive' });
        return;
      }
      const best = valid.reduce((a, b) => (Number(b.avg_engagement ?? 0) > Number(a.avg_engagement ?? 0) ? b : a));
      const dow = Number(best.day_of_week) % 7; // 0 = domingo (UTC)
      const hour = Number(best.hour);

      // Próxima ocorrência do dia/hora (slots em UTC)
      const now = new Date();
      const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
      let diff = (dow - target.getUTCDay() + 7) % 7;
      target.setUTCDate(target.getUTCDate() + diff);
      // 30 minutos antes do melhor horário
      target.setUTCMinutes(target.getUTCMinutes() - 30);
      if (target.getTime() < Date.now() + 5 * 60 * 1000) target.setUTCDate(target.getUTCDate() + 7);

      onChange({ publish_now: false, scheduled_at: isoToLocalInput(target.toISOString(), tz) });
      setSuggestion(
        `Melhor desempenho: ${WEEKDAYS[dow]} às ${String(hour).padStart(2, '0')}:00 (UTC). ` +
          `Agendamos 30 minutos antes: ${target.toLocaleString('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`,
      );
    } catch (e: any) {
      toast({ title: 'Não foi possível analisar', description: String(e?.message ?? e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border rounded-md p-3">
        <div>
          <div className="font-medium text-sm">Publicar agora</div>
          <div className="text-xs text-muted-foreground">Envia imediatamente para a fila</div>
        </div>
        <Switch checked={value.publish_now} onCheckedChange={(v) => onChange({ publish_now: v })} />
      </div>

      {!value.publish_now && (
        <>
          <div className="space-y-2">
            <Button type="button" variant="outline" onClick={suggestBestTime} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Analisando histórico…' : 'Deixe o sistema agendar no melhor horário'}
            </Button>
            {suggestion && <p className="text-xs text-muted-foreground">{suggestion} Você pode alterar a data e a hora abaixo.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data e hora ({tz.split('/')[1]?.replace('_', ' ') || tz})</Label>
              <Input
                type="datetime-local"
                value={value.scheduled_at ?? ''}
                min={nowLocalInput(tz, 60)}
                onChange={(e) => onChange({ scheduled_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Fuso horário</Label>
              <Select value={value.timezone} onValueChange={(v) => onChange({ timezone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
