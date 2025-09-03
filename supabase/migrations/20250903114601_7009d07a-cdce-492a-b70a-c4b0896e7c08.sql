-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_roles.user_id = $1 ORDER BY created_at DESC LIMIT 1;
$$;

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = $1 AND role = 'admin'
  );
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own roles" 
  ON public.user_roles 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" 
  ON public.user_roles 
  FOR SELECT 
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles" 
  ON public.user_roles 
  FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles" 
  ON public.user_roles 
  FOR UPDATE 
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles" 
  ON public.user_roles 
  FOR DELETE 
  USING (public.is_admin(auth.uid()));

-- Update RLS policies for brands table
DROP POLICY IF EXISTS "Allow insert for brands" ON public.brands;
DROP POLICY IF EXISTS "Allow update for brands" ON public.brands;
DROP POLICY IF EXISTS "Allow delete for brands" ON public.brands;

CREATE POLICY "Admins can insert brands" 
  ON public.brands 
  FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update brands" 
  ON public.brands 
  FOR UPDATE 
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete brands" 
  ON public.brands 
  FOR DELETE 
  USING (public.is_admin(auth.uid()));

-- Update RLS policies for models table
DROP POLICY IF EXISTS "Allow insert for models" ON public.models;
DROP POLICY IF EXISTS "Allow update for models" ON public.models;
DROP POLICY IF EXISTS "Allow delete for models" ON public.models;

CREATE POLICY "Admins can insert models" 
  ON public.models 
  FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update models" 
  ON public.models 
  FOR UPDATE 
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete models" 
  ON public.models 
  FOR DELETE 
  USING (public.is_admin(auth.uid()));

-- Update RLS policies for resins table
DROP POLICY IF EXISTS "Allow insert for resins" ON public.resins;
DROP POLICY IF EXISTS "Allow update for resins" ON public.resins;
DROP POLICY IF EXISTS "Allow delete for resins" ON public.resins;

CREATE POLICY "Admins can insert resins" 
  ON public.resins 
  FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update resins" 
  ON public.resins 
  FOR UPDATE 
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete resins" 
  ON public.resins 
  FOR DELETE 
  USING (public.is_admin(auth.uid()));

-- Update RLS policies for parameter_sets table
DROP POLICY IF EXISTS "Allow insert for parameter_sets" ON public.parameter_sets;
DROP POLICY IF EXISTS "Allow update for parameter_sets" ON public.parameter_sets;
DROP POLICY IF EXISTS "Allow delete for parameter_sets" ON public.parameter_sets;

CREATE POLICY "Admins can insert parameter_sets" 
  ON public.parameter_sets 
  FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update parameter_sets" 
  ON public.parameter_sets 
  FOR UPDATE 
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete parameter_sets" 
  ON public.parameter_sets 
  FOR DELETE 
  USING (public.is_admin(auth.uid()));