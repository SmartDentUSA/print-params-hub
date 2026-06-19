CREATE OR REPLACE FUNCTION public.fn_social_post_to_wa_campaign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_campaign_id CONSTANT uuid := '3af64f4c-9ea9-47c6-8e14-93047b85f36e';
  existing_flow jsonb;
  new_nodes jsonb := '[]'::jsonb;
  img_url text;
  desc_text text;
  msg_text CONSTANT text := E'Conteúdo postado no ar!\n\nPessoal, esse grupo é de colaboradores — preciso da força de todos:\n1. Entrem no post\n2. Curtam\n3. Salvem\n4. Compartilhem com clientes\n5. Comentem o CTA\n\nBora engajar!';
BEGIN
  IF NEW.platform IS DISTINCT FROM 'instagram' THEN RETURN NEW; END IF;
  IF NEW.post_url IS NULL OR length(trim(NEW.post_url)) = 0 THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.post_url IS NOT NULL AND OLD.post_url = NEW.post_url)
       AND (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT flow_json INTO existing_flow FROM wa_campaigns WHERE id = target_campaign_id;
  IF existing_flow IS NULL THEN
    RAISE WARNING '[fn_social_post_to_wa_campaign] target campaign % not found', target_campaign_id;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(existing_flow) AS n
    WHERE (n->>'source_post_id') = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  img_url := COALESCE(NULLIF(NEW.thumbnail_url, ''), NULLIF(NEW.media_url, ''));
  IF img_url IS NOT NULL THEN
    new_nodes := new_nodes || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'image',
      'media_url', img_url,
      'caption', COALESCE(NEW.product_name, ''),
      'mime_type', 'image/jpeg',
      'source_post_id', NEW.id::text
    ));
  END IF;

  desc_text := COALESCE(NEW.caption, '');
  IF length(desc_text) > 180 THEN desc_text := left(desc_text, 177) || '...'; END IF;
  new_nodes := new_nodes || jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'type', 'link',
    'title', 'Novo post no Instagram',
    'description', desc_text,
    'url', NEW.post_url,
    'source_post_id', NEW.id::text
  ));

  new_nodes := new_nodes || jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'type', 'msg',
    'text', msg_text,
    'source_post_id', NEW.id::text
  ));

  UPDATE wa_campaigns
  SET flow_json   = flow_json || new_nodes,
      status      = 'active',
      finished_at = NULL,
      next_send_at = COALESCE(next_send_at, now())
  WHERE id = target_campaign_id;

  INSERT INTO system_health_logs (event_type, severity, metadata)
  VALUES (
    'social_post_to_wa_appended',
    'info',
    jsonb_build_object(
      'post_id', NEW.id,
      'platform', NEW.platform,
      'post_url', NEW.post_url,
      'campaign_id', target_campaign_id,
      'nodes_added', jsonb_array_length(new_nodes)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_social_post_to_wa_campaign] error for post %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;