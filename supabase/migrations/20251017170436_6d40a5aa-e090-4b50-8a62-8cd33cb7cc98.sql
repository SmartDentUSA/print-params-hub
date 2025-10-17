-- Etapa 2: Criar funções e policies para authors

-- Criar função para verificar se usuário é author
CREATE OR REPLACE FUNCTION public.is_author(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = $1 AND role = 'author'
  );
$$;

-- Criar função para verificar se usuário tem acesso ao painel (admin ou author)
CREATE OR REPLACE FUNCTION public.has_panel_access(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = $1 AND role IN ('admin', 'author')
  );
$$;

-- Adicionar policies para authors poderem editar conteúdo
CREATE POLICY "Authors can update contents"
ON knowledge_contents
FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid()) OR is_author(auth.uid())
);

CREATE POLICY "Authors can insert contents"
ON knowledge_contents
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR is_author(auth.uid())
);

-- Adicionar policies para authors poderem editar autores
CREATE POLICY "Authors can update authors"
ON authors
FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid()) OR is_author(auth.uid())
);

CREATE POLICY "Authors can insert authors"
ON authors
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR is_author(auth.uid())
);