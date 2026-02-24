
-- Seed team_members
INSERT INTO public.team_members (role, nome_completo, email, whatsapp_number, ativo) VALUES
('vendedor', 'Paulo Comercial', 'paulo@smartdent.com.br', '+5569993831794', true),
('vendedor', 'Vendedor 02', 'vendedor02@smartdent.com.br', '+5500000000002', true),
('vendedor', 'Vendedor 03', 'vendedor03@smartdent.com.br', '+5500000000003', true),
('vendedor', 'Vendedor 04', 'vendedor04@smartdent.com.br', '+5500000000004', true),
('vendedor', 'Vendedor 05', 'vendedor05@smartdent.com.br', '+5500000000005', true),
('vendedor', 'Vendedor 06', 'vendedor06@smartdent.com.br', '+5500000000006', true),
('vendedor', 'Vendedor 07', 'vendedor07@smartdent.com.br', '+5500000000007', true),
('vendedor', 'Vendedor 08', 'vendedor08@smartdent.com.br', '+5500000000008', true),
('vendedor', 'Vendedor 09', 'vendedor09@smartdent.com.br', '+5500000000009', true),
('vendedor', 'Vendedor 10', 'vendedor10@smartdent.com.br', '+5500000000010', true),
('cs', 'CS Principal', 'cs@smartdent.com.br', '+5500000000011', true),
('suporte', 'Suporte Tecnico', 'suporte@smartdent.com.br', '+5500000000012', true);

-- Seed cs_automation_rules
INSERT INTO public.cs_automation_rules (produto_interesse, trigger_event, delay_days, tipo, template_manychat, ativo) VALUES
('Vitality', 'ganho', 3, 'audio', 'vitality_boas_vindas', true),
('Vitality', 'ganho', 7, 'video', 'vitality_tutorial', true),
('Vitality', 'ganho', 30, 'text', 'vitality_upsell', true),
('EdgeMini', 'ganho', 3, 'text', 'edgemini_boas_vindas', true),
('EdgeMini', 'ganho', 14, 'video', 'edgemini_dicas', true),
('IoConnect', 'ganho', 3, 'audio', 'ioconnect_onboarding', true),
('IoConnect', 'ganho', 30, 'text', 'ioconnect_upsell', true);
