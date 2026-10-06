import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CaptureEvent, CaptureForm } from "@/lib/lead-event-name";

export function useCaptureEvents() {
  const { data } = useQuery({
    queryKey: ["lead-capture-event-names"],
    staleTime: 60_000,
    queryFn: async () => {
      const [events, forms] = await Promise.all([
        supabase.from("smartops_events").select("id,name,slug").limit(1000),
        supabase.from("smartops_forms").select("id,name,event_id").not("event_id", "is", null).limit(1000),
      ]);
      if (events.error) throw events.error;
      if (forms.error) throw forms.error;
      return { events: events.data as CaptureEvent[], forms: forms.data as CaptureForm[] };
    },
  });
  return data ?? { events: [], forms: [] };
}