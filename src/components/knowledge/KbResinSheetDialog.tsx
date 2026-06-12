import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { ResinAccordion } from '@/components/ResinAccordion';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  open: boolean;
  onClose: () => void;
  resinName: string | null;
  modelSlug?: string | null;
}

export default function KbResinSheetDialog({ open, onClose, resinName, modelSlug }: Props) {
  const { t } = useLanguage();
  const [resins, setResins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !resinName) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      let q = supabase
        .from('parameter_sets')
        .select('*')
        .eq('resin_name', resinName)
        .eq('active', true)
        .order('layer_height');
      if (modelSlug) q = q.eq('model_slug', modelSlug);
      const { data: params } = await q;
      const { data: resinData } = await supabase
        .from('resins')
        .select('*')
        .eq('name', resinName)
        .maybeSingle();

      if (cancel) return;
      const built = (params && params.length > 0) ? [{
        id: resinName,
        name: resinName,
        manufacturer: (params[0] as any).resin_manufacturer || resinData?.manufacturer || '',
        image_url: resinData?.image_url,
        color: resinData?.color,
        cta_1_label: resinData?.cta_1_label,
        cta_1_url: resinData?.cta_1_url,
        cta_1_description: resinData?.cta_1_description,
        cta_2_label: resinData?.cta_2_label,
        cta_2_url: resinData?.cta_2_url,
        cta_2_description: resinData?.cta_2_description,
        cta_3_label: resinData?.cta_3_label,
        cta_3_url: resinData?.cta_3_url,
        cta_3_description: resinData?.cta_3_description,
        cta_4_label: resinData?.cta_4_label,
        cta_4_url: resinData?.cta_4_url,
        cta_4_description: resinData?.cta_4_description,
        processing_instructions: resinData?.processing_instructions || null,
        parameterSets: params.map((p: any) => ({
          id: p.id,
          label: `${p.layer_height}mm - ${p.cure_time}s`,
          layer_height: p.layer_height,
          cure_time: p.cure_time,
          bottom_cure_time: p.bottom_cure_time || 0,
          bottom_layers: p.bottom_layers || 8,
          light_intensity: p.light_intensity,
          xy_adjustment_x_pct: p.xy_adjustment_x_pct || 100,
          xy_adjustment_y_pct: p.xy_adjustment_y_pct || 100,
          wait_time_before_cure: p.wait_time_before_cure || 0,
          wait_time_after_cure: p.wait_time_after_cure || 0,
          wait_time_after_lift: p.wait_time_after_lift || 0,
          notes: p.notes,
        })),
      }] : [];
      setResins(built);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, resinName, modelSlug]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">{t('kb.parametros.loading_sheet')}</div>
        ) : resins.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {t('kb.parametros.no_sheet', { name: resinName || '' })}
          </div>
        ) : (
          <ResinAccordion resins={resins} />
        )}
      </DialogContent>
    </Dialog>
  );
}