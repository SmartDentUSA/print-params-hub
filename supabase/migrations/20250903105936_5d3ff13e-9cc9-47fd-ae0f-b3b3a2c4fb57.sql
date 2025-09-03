-- Enable INSERT/UPDATE/DELETE operations for brands table
CREATE POLICY "Allow insert for brands" 
ON public.brands 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update for brands" 
ON public.brands 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow delete for brands" 
ON public.brands 
FOR DELETE 
USING (true);

-- Enable INSERT/UPDATE/DELETE operations for models table
CREATE POLICY "Allow insert for models" 
ON public.models 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update for models" 
ON public.models 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow delete for models" 
ON public.models 
FOR DELETE 
USING (true);

-- Enable INSERT/UPDATE/DELETE operations for resins table
CREATE POLICY "Allow insert for resins" 
ON public.resins 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update for resins" 
ON public.resins 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow delete for resins" 
ON public.resins 
FOR DELETE 
USING (true);