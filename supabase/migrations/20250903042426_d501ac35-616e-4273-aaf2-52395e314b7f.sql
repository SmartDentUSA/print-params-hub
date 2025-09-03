-- Create enum for resin types
CREATE TYPE public.resin_type AS ENUM ('standard', 'flexible', 'tough', 'transparent', 'biocompatible', 'high_temp');

-- Create brands table
CREATE TABLE public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create models table
CREATE TABLE public.models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(brand_id, name)
);

-- Create resins table
CREATE TABLE public.resins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  manufacturer TEXT NOT NULL,
  color TEXT,
  type resin_type DEFAULT 'standard',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create parameter_sets table
CREATE TABLE public.parameter_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_slug TEXT NOT NULL,
  model_slug TEXT NOT NULL,
  resin_name TEXT NOT NULL,
  resin_manufacturer TEXT NOT NULL,
  layer_height DECIMAL(4,3) NOT NULL,
  cure_time INTEGER NOT NULL, -- in seconds
  light_intensity INTEGER NOT NULL, -- percentage
  bottom_layers INTEGER DEFAULT 5,
  bottom_cure_time INTEGER, -- in seconds
  lift_distance DECIMAL(4,2) DEFAULT 5.0, -- in mm
  lift_speed DECIMAL(5,2) DEFAULT 3.0, -- in mm/min
  retract_speed DECIMAL(5,2) DEFAULT 3.0, -- in mm/min
  anti_aliasing BOOLEAN DEFAULT true,
  xy_size_compensation DECIMAL(4,3) DEFAULT 0.0,
  wait_time_before_cure INTEGER DEFAULT 0, -- in seconds
  wait_time_after_cure INTEGER DEFAULT 0, -- in seconds
  wait_time_after_lift INTEGER DEFAULT 0, -- in seconds
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_models_brand_id ON public.models(brand_id);
CREATE INDEX idx_models_slug ON public.models(slug);
CREATE INDEX idx_parameter_sets_brand_slug ON public.parameter_sets(brand_slug);
CREATE INDEX idx_parameter_sets_model_slug ON public.parameter_sets(model_slug);
CREATE INDEX idx_parameter_sets_resin ON public.parameter_sets(resin_name, resin_manufacturer);

-- Enable Row Level Security
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parameter_sets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access (catalog data)
CREATE POLICY "Allow public read access to brands" ON public.brands
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to models" ON public.models
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to resins" ON public.resins
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to parameter_sets" ON public.parameter_sets
  FOR SELECT USING (true);

-- Admin policies for write access (will be restricted later with auth)
CREATE POLICY "Allow insert for parameter_sets" ON public.parameter_sets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update for parameter_sets" ON public.parameter_sets
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete for parameter_sets" ON public.parameter_sets
  FOR DELETE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_models_updated_at
  BEFORE UPDATE ON public.models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_resins_updated_at
  BEFORE UPDATE ON public.resins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parameter_sets_updated_at
  BEFORE UPDATE ON public.parameter_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();