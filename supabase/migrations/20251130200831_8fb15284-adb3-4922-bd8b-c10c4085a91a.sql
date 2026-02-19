-- Criar enum para papéis de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'professor', 'aluno');

-- Tabela de papéis de usuários (separada do profiles para segurança)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'aluno',
    UNIQUE (user_id, role)
);

-- Tabela de perfis
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de professores
CREATE TABLE public.professores (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    disciplina TEXT NOT NULL,
    matricula TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de turmas
CREATE TABLE public.turmas (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    serie TEXT NOT NULL,
    turno TEXT NOT NULL,
    ano INTEGER NOT NULL,
    professor_id INTEGER REFERENCES public.professores(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de alunos
CREATE TABLE public.alunos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    matricula TEXT UNIQUE NOT NULL,
    ano INTEGER NOT NULL,
    status TEXT DEFAULT 'Ativo',
    turma_id INTEGER REFERENCES public.turmas(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de equipe gestora
CREATE TABLE public.equipe_gestora (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    cargo TEXT NOT NULL,
    matricula TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT,
    status TEXT DEFAULT 'Ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de eventos
CREATE TABLE public.eventos (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT,
    data DATE NOT NULL,
    tipo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de anotações
CREATE TABLE public.anotacoes (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    data DATE NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'diario',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de horários
CREATE TABLE public.horarios (
    id SERIAL PRIMARY KEY,
    turma_id INTEGER REFERENCES public.turmas(id) ON DELETE CASCADE NOT NULL,
    dia TEXT NOT NULL,
    inicio TEXT NOT NULL,
    fim TEXT NOT NULL,
    disciplina TEXT NOT NULL
);

-- Tabela de usuários administrativos
CREATE TABLE public.usuarios (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    papel TEXT NOT NULL DEFAULT 'aluno',
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_gestora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Função de segurança para verificar papel do usuário
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para criar perfil e papel ao registrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Políticas RLS para user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Políticas RLS para profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Políticas RLS para todas as tabelas de dados (usuários autenticados podem acessar)
CREATE POLICY "Authenticated users can view professores"
ON public.professores FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert professores"
ON public.professores FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update professores"
ON public.professores FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete professores"
ON public.professores FOR DELETE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view turmas"
ON public.turmas FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert turmas"
ON public.turmas FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update turmas"
ON public.turmas FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete turmas"
ON public.turmas FOR DELETE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view alunos"
ON public.alunos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert alunos"
ON public.alunos FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update alunos"
ON public.alunos FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete alunos"
ON public.alunos FOR DELETE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view equipe_gestora"
ON public.equipe_gestora FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert equipe_gestora"
ON public.equipe_gestora FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update equipe_gestora"
ON public.equipe_gestora FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete equipe_gestora"
ON public.equipe_gestora FOR DELETE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view eventos"
ON public.eventos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert eventos"
ON public.eventos FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update eventos"
ON public.eventos FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete eventos"
ON public.eventos FOR DELETE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view anotacoes"
ON public.anotacoes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert anotacoes"
ON public.anotacoes FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update anotacoes"
ON public.anotacoes FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete anotacoes"
ON public.anotacoes FOR DELETE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view horarios"
ON public.horarios FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert horarios"
ON public.horarios FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update horarios"
ON public.horarios FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete horarios"
ON public.horarios FOR DELETE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view usuarios"
ON public.usuarios FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert usuarios"
ON public.usuarios FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update usuarios"
ON public.usuarios FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete usuarios"
ON public.usuarios FOR DELETE TO authenticated
USING (true);