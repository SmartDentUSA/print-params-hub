
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES team_members(id);
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS mensagem_waleads TEXT;
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS waleads_ativo BOOLEAN DEFAULT false;
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS manychat_ativo BOOLEAN DEFAULT true;
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS waleads_tipo TEXT DEFAULT 'text';
ALTER TABLE cs_automation_rules ADD COLUMN IF NOT EXISTS waleads_media_url TEXT;
