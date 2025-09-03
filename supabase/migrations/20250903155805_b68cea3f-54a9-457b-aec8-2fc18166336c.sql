-- Create storage bucket for model images
INSERT INTO storage.buckets (id, name, public) VALUES ('model-images', 'model-images', true);

-- Create storage policies for model images
CREATE POLICY "Model images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'model-images');

CREATE POLICY "Admins can upload model images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'model-images' AND is_admin(auth.uid()));

CREATE POLICY "Admins can update model images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'model-images' AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete model images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'model-images' AND is_admin(auth.uid()));

-- Add trigger to update updated_at on models table
CREATE TRIGGER update_models_updated_at
BEFORE UPDATE ON public.models
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();