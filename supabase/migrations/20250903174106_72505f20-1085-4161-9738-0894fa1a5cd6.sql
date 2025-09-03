-- Limpar todos os dados das tabelas para permitir nova importação
-- Deletar parameter_sets primeiro (não tem foreign keys)
DELETE FROM parameter_sets;

-- Deletar resins
DELETE FROM resins;

-- Deletar models (caso existam)
DELETE FROM models;

-- Deletar brands (caso existam)  
DELETE FROM brands;