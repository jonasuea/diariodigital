-- Add new columns to eventos table
ALTER TABLE public.eventos 
ADD COLUMN IF NOT EXISTS hora_inicio TEXT,
ADD COLUMN IF NOT EXISTS hora_fim TEXT,
ADD COLUMN IF NOT EXISTS local TEXT;