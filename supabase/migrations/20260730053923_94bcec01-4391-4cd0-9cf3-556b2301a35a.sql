-- Limpa tokens Evolution Go duplicados/obsoletos: instâncias vivas usam Evolution API (:8080)
UPDATE team_members
SET evo_go_instance_token = NULL, evo_go_instance_id = NULL, messaging_provider = 'evolution'
WHERE evolution_instance_name IN ('smartdent_marketing','cs_principal','Suporte_tecnico');

-- Instância Danilo-Henrique não existe mais no servidor: desativa alvos e config
UPDATE post_group_instance_config SET enabled = false WHERE instance_name = 'Danilo-Henrique';
UPDATE post_group_targets SET enabled = false WHERE instance_name = 'Danilo-Henrique';

-- Garante que a instância principal ativa seja o marketing
UPDATE post_group_instance_config SET is_primary = (instance_name = 'smartdent_marketing');