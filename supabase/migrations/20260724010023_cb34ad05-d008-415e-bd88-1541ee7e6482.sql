GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.produto_aliases TO authenticated;
GRANT ALL ON TABLE public.produto_aliases TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.produto_aliases_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.produto_aliases_id_seq TO service_role;