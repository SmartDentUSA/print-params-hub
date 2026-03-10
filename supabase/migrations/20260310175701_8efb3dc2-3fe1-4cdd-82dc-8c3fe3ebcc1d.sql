
-- Technical tickets table
CREATE TABLE public.technical_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.lia_attendances(id) ON DELETE SET NULL,
  ticket_sequence integer NOT NULL,
  ticket_version char(1) NOT NULL DEFAULT 'A',
  ticket_full_id text NOT NULL UNIQUE,
  equipment text,
  client_summary text,
  ai_summary text,
  conversation_log jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  notified_at timestamptz,
  support_team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL
);

-- Technical ticket messages table
CREATE TABLE public.technical_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.technical_tickets(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'client',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_technical_tickets_lead_id ON public.technical_tickets(lead_id);
CREATE INDEX idx_technical_tickets_status ON public.technical_tickets(status);
CREATE INDEX idx_technical_ticket_messages_ticket_id ON public.technical_ticket_messages(ticket_id);

-- RLS
ALTER TABLE public.technical_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Admins can manage all tickets
CREATE POLICY "admin_all_tickets" ON public.technical_tickets FOR ALL USING (is_admin(auth.uid()));

-- Service role (edge functions) can insert/update
CREATE POLICY "service_insert_tickets" ON public.technical_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "service_update_tickets" ON public.technical_tickets FOR UPDATE USING (true);

-- Admin manage messages
CREATE POLICY "admin_all_ticket_messages" ON public.technical_ticket_messages FOR ALL USING (is_admin(auth.uid()));

-- Service role can insert messages
CREATE POLICY "service_insert_ticket_messages" ON public.technical_ticket_messages FOR INSERT WITH CHECK (true);
