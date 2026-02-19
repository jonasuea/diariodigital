-- Add new columns to professores table
ALTER TABLE public.professores 
ADD COLUMN IF NOT EXISTS foto_url text,
ADD COLUMN IF NOT EXISTS rg text,
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS status_funcional text DEFAULT 'Lotado',
ADD COLUMN IF NOT EXISTS data_lotacao date,
ADD COLUMN IF NOT EXISTS arquivo_url text,
ADD COLUMN IF NOT EXISTS formacoes jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS link_lattes text,
ADD COLUMN IF NOT EXISTS biografia text,
ADD COLUMN IF NOT EXISTS disciplinas text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS series text[] DEFAULT '{}';

-- Add new columns to equipe_gestora table
ALTER TABLE public.equipe_gestora 
ADD COLUMN IF NOT EXISTS foto_url text,
ADD COLUMN IF NOT EXISTS rg text,
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS data_lotacao date,
ADD COLUMN IF NOT EXISTS arquivo_url text,
ADD COLUMN IF NOT EXISTS formacoes jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS biografia text;

-- Add new columns to turmas table
ALTER TABLE public.turmas 
ADD COLUMN IF NOT EXISTS professor_id_2 integer REFERENCES public.professores(id),
ADD COLUMN IF NOT EXISTS capacidade integer DEFAULT 30;

-- Create notas table
CREATE TABLE IF NOT EXISTS public.notas (
  id serial PRIMARY KEY,
  aluno_id integer REFERENCES public.alunos(id) ON DELETE CASCADE NOT NULL,
  turma_id integer REFERENCES public.turmas(id) ON DELETE CASCADE NOT NULL,
  disciplina text NOT NULL,
  bimestre_1 numeric(4,2),
  bimestre_2 numeric(4,2),
  bimestre_3 numeric(4,2),
  bimestre_4 numeric(4,2),
  media_anual numeric(4,2) GENERATED ALWAYS AS (
    CASE 
      WHEN bimestre_1 IS NOT NULL AND bimestre_2 IS NOT NULL AND bimestre_3 IS NOT NULL AND bimestre_4 IS NOT NULL 
      THEN (bimestre_1 + bimestre_2 + bimestre_3 + bimestre_4) / 4 
      ELSE NULL 
    END
  ) STORED,
  situacao text GENERATED ALWAYS AS (
    CASE 
      WHEN bimestre_1 IS NOT NULL AND bimestre_2 IS NOT NULL AND bimestre_3 IS NOT NULL AND bimestre_4 IS NOT NULL 
      THEN 
        CASE WHEN (bimestre_1 + bimestre_2 + bimestre_3 + bimestre_4) / 4 >= 6 THEN 'Aprovado' ELSE 'Reprovado' END
      ELSE 'Em andamento'
    END
  ) STORED,
  ano integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at timestamp with time zone DEFAULT now()
);

-- Create frequencia table  
CREATE TABLE IF NOT EXISTS public.frequencia (
  id serial PRIMARY KEY,
  aluno_id integer REFERENCES public.alunos(id) ON DELETE CASCADE NOT NULL,
  turma_id integer REFERENCES public.turmas(id) ON DELETE CASCADE NOT NULL,
  data date NOT NULL,
  status text NOT NULL DEFAULT 'presente' CHECK (status IN ('presente', 'faltou', 'justificado')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(aluno_id, turma_id, data)
);

-- Enable RLS on new tables
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequencia ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notas
CREATE POLICY "Authenticated users can view notas" ON public.notas FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert notas" ON public.notas FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update notas" ON public.notas FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete notas" ON public.notas FOR DELETE USING (true);

-- Create RLS policies for frequencia
CREATE POLICY "Authenticated users can view frequencia" ON public.frequencia FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert frequencia" ON public.frequencia FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update frequencia" ON public.frequencia FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete frequencia" ON public.frequencia FOR DELETE USING (true);