-- Fix security vulnerability: Remove public access to user_roles table
-- This ensures only authenticated users can access role information

-- First, drop any existing policies that might allow public access
DROP POLICY IF EXISTS "Allow public read access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Public can view user roles" ON public.user_roles;

-- Ensure we have the correct restrictive policies
-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;

-- Recreate secure policies
-- Only authenticated users can view their own roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Only admins can view all roles
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (is_admin(auth.uid()));

-- Only admins can insert new roles
CREATE POLICY "Admins can insert roles" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Only admins can update roles
CREATE POLICY "Admins can update roles" 
ON public.user_roles 
FOR UPDATE 
TO authenticated
USING (is_admin(auth.uid()));

-- Only admins can delete roles
CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
TO authenticated
USING (is_admin(auth.uid()));

-- Ensure RLS is enabled (should already be enabled but let's make sure)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;