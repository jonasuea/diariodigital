-- Adicionar coluna justificativa na tabela frequencia
ALTER TABLE public.frequencia ADD COLUMN IF NOT EXISTS justificativa text;