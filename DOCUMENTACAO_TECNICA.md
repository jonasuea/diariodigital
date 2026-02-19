# DOCUMENTAÇÃO TÉCNICA
## EducaFácil - Sistema de Gestão Escolar

**Versão:** 1.0  
**Data:** Dezembro de 2024  
**Autor:** Equipe de Desenvolvimento

---

# 1. VISÃO GERAL DO PROJETO

## 1.1. Nome do Sistema

**EducaFácil** - Sistema de Gestão Escolar

## 1.2. Resumo

O EducaFácil é um sistema web completo para gestão escolar, desenvolvido para atender às necessidades de instituições de ensino fundamental. O sistema centraliza todas as operações acadêmicas e administrativas em uma única plataforma, permitindo o gerenciamento eficiente de alunos, professores, turmas, frequência, notas e equipe gestora.

A aplicação foi construída utilizando tecnologias modernas de desenvolvimento web, com foco em usabilidade, responsividade e performance. O backend é totalmente gerenciado pela plataforma Lovable Cloud (baseada em Supabase), oferecendo autenticação segura, banco de dados PostgreSQL e APIs REST automáticas.

O sistema implementa controle de acesso baseado em autenticação, garantindo que apenas usuários autorizados possam acessar as funcionalidades do sistema.

## 1.3. Público-Alvo

- **Coordenação Pedagógica:** Gestão geral do sistema, visualização de relatórios e indicadores.
- **Equipe Gestora:** Diretores, vice-diretores, coordenadores e secretários escolares.
- **Professores:** Lançamento de frequência, notas e acompanhamento de turmas.
- **Secretaria Escolar:** Cadastro de alunos, matrícula e documentação.

## 1.4. Principais Módulos/Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Painel (Dashboard)** | Visão geral com estatísticas, gráficos e indicadores do sistema |
| **Alunos** | Cadastro completo de alunos com dados pessoais, familiares e administrativos |
| **Professores** | Gestão de professores com formações, disciplinas e status funcional |
| **Turmas** | Organização de turmas por ano, série e turno |
| **Diário Digital** | Módulo integrado para frequência, notas, objetos de conhecimento e avaliações |
| **Frequência** | Registro de presença com estados: presente, faltou, justificado |
| **Notas** | Lançamento de notas bimestrais com cálculo automático de média |
| **Ata Final** | Geração de atas finais com situação dos alunos |
| **Equipe Gestora** | Cadastro de membros da equipe administrativa |
| **Calendário** | Gestão de eventos escolares |
| **Horário** | Configuração de grades horárias por turma |
| **Relatórios** | Geração de relatórios em PDF |
| **Configurações** | Configurações gerais do sistema |

---

# 2. ARQUITETURA E TECNOLOGIAS

## 2.1. Arquitetura Geral

O sistema utiliza uma arquitetura moderna de aplicação web Single Page Application (SPA) com as seguintes camadas:

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Páginas   │  │ Componentes │  │  Contextos/Hooks    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS/REST
┌───────────────────────────▼─────────────────────────────────┐
│                  LOVABLE CLOUD (Supabase)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Auth      │  │  Database   │  │   Edge Functions    │  │
│  │  (Supabase) │  │ (PostgreSQL)│  │   (se necessário)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 2.2. Stack Tecnológica

### 2.2.1. Frontend

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **React** | ^18.3.1 | Biblioteca principal para construção de interfaces |
| **TypeScript** | - | Superset do JavaScript com tipagem estática |
| **Vite** | - | Build tool e dev server de alta performance |
| **React Router DOM** | ^6.30.1 | Roteamento SPA |
| **TanStack React Query** | ^5.83.0 | Gerenciamento de estado servidor e cache |
| **Tailwind CSS** | - | Framework CSS utility-first |
| **shadcn/ui** | - | Biblioteca de componentes UI baseada em Radix UI |

### 2.2.2. Componentes UI (Radix UI)

- `@radix-ui/react-dialog` - Modais e diálogos
- `@radix-ui/react-select` - Selects customizáveis
- `@radix-ui/react-tabs` - Sistema de abas
- `@radix-ui/react-toast` - Notificações toast
- `@radix-ui/react-accordion` - Acordeões
- `@radix-ui/react-checkbox` - Checkboxes
- `@radix-ui/react-dropdown-menu` - Menus dropdown
- E diversos outros componentes Radix

### 2.2.3. Backend (Lovable Cloud / Supabase)

| Tecnologia | Descrição |
|------------|-----------|
| **Supabase** | Plataforma Backend-as-a-Service |
| **PostgreSQL** | Banco de dados relacional |
| **Supabase Auth** | Sistema de autenticação |
| **Row Level Security (RLS)** | Políticas de segurança em nível de linha |

### 2.2.4. Bibliotecas Auxiliares

| Biblioteca | Versão | Uso |
|------------|--------|-----|
| **jspdf** | ^3.0.4 | Geração de PDFs |
| **jspdf-autotable** | ^5.0.2 | Tabelas em PDFs |
| **date-fns** | ^3.6.0 | Manipulação de datas |
| **lucide-react** | ^0.462.0 | Ícones |
| **recharts** | ^2.15.4 | Gráficos e visualizações |
| **react-hook-form** | ^7.61.1 | Gerenciamento de formulários |
| **zod** | ^3.25.76 | Validação de schemas |
| **sonner** | ^1.7.4 | Notificações toast |
| **class-variance-authority** | ^0.7.1 | Variantes de classes CSS |
| **clsx** | ^2.1.1 | Utilitário para classes condicionais |
| **tailwind-merge** | ^2.6.0 | Merge de classes Tailwind |

## 2.3. Comunicação entre Camadas

1. **Frontend → Backend:** O frontend se comunica com o Supabase através do cliente JavaScript oficial (`@supabase/supabase-js`), que abstrai chamadas REST e WebSocket.

2. **Autenticação:** Utiliza Supabase Auth com persistência de sessão em `localStorage`. O token JWT é automaticamente incluído em todas as requisições.

3. **Consultas ao Banco:** Realizadas através do cliente Supabase com sintaxe fluent (query builder), que gera automaticamente as queries SQL.

4. **Row Level Security:** Todas as tabelas possuem políticas RLS que garantem que usuários autenticados só acessem dados permitidos.

---

# 3. COMO RODAR O PROJETO LOCALMENTE

## 3.1. Pré-requisitos

- **Node.js** versão 18.x ou superior
- **npm** ou **bun** como gerenciador de pacotes
- **Git** para clonagem do repositório
- Conta no **GitHub** (para clonar via integração Lovable)

## 3.2. Passo a Passo

### 3.2.1. Clonar o Repositório

```bash
# Via HTTPS
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git

# Entrar no diretório
cd SEU_REPOSITORIO
```

> 🔧 **TODO (preencher manualmente):** Substituir `SEU_USUARIO/SEU_REPOSITORIO` pela URL real do repositório GitHub.

### 3.2.2. Instalar Dependências

```bash
# Usando npm
npm install

# OU usando bun (mais rápido)
bun install
```

### 3.2.3. Configurar Variáveis de Ambiente

O projeto já possui um arquivo `.env` configurado automaticamente pelo Lovable Cloud com as seguintes variáveis:

```env
VITE_SUPABASE_PROJECT_ID="gawuozkqutikslqqxaum"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1..."
VITE_SUPABASE_URL="https://gawuozkqutikslqqxaum.supabase.co"
```

**Importante:** Estas variáveis são geradas automaticamente e não devem ser alteradas manualmente.

### 3.2.4. Executar o Servidor de Desenvolvimento

```bash
# Usando npm
npm run dev

# OU usando bun
bun run dev
```

### 3.2.5. Acessar o Sistema

Abra o navegador e acesse:

```
http://localhost:5173
```

O sistema redirecionará automaticamente para a tela de login (`/auth`).

## 3.3. Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Gera build de produção |
| `npm run preview` | Preview do build de produção |
| `npm run lint` | Executa linter (ESLint) |

---

# 4. CONFIGURAÇÃO DE AMBIENTE

## 4.1. Variáveis de Ambiente

O sistema utiliza as seguintes variáveis de ambiente (prefixo `VITE_` para exposição ao frontend):

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | Sim |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública (anon key) do Supabase | Sim |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto Supabase | Sim |

## 4.2. Secrets do Backend (Supabase)

Os seguintes secrets estão configurados no backend:

| Secret | Descrição |
|--------|-----------|
| `SUPABASE_URL` | URL interna do Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Chave anon para operações públicas |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (acesso administrativo) |
| `SUPABASE_DB_URL` | URL de conexão direta ao PostgreSQL |

**Importante:** O `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser exposto ao frontend.

## 4.3. Configuração de Autenticação

O sistema utiliza autenticação via email/senha com as seguintes configurações:

- **Auto-confirm email:** Recomendado habilitar em desenvolvimento para testes rápidos.
- **Redirect URL:** Configurado para `${window.location.origin}/` após signup.

> 🔧 **TODO (preencher manualmente):** Verificar no dashboard se "Confirm email" está desabilitado para ambiente de desenvolvimento.

---

# 5. MODELOS DE DADOS / BANCO DE DADOS

## 5.1. Diagrama Entidade-Relacionamento (Simplificado)

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   alunos    │──────▶│   turmas    │◀──────│ professores │
└─────────────┘       └─────────────┘       └─────────────┘
      │                     │
      │                     │
      ▼                     ▼
┌─────────────┐       ┌─────────────┐
│ frequencia  │       │   notas     │
└─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  profiles   │──────▶│ user_roles  │◀──────│   auth      │
└─────────────┘       └─────────────┘       └─────────────┘
```

## 5.2. Descrição das Tabelas

### 5.2.1. Tabela: `alunos`

Armazena informações completas dos alunos matriculados.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | integer (PK) | Sim | Identificador único (auto-incremento) |
| `nome` | text | Sim | Nome completo do aluno |
| `matricula` | text | Sim | Número de matrícula |
| `ano` | integer | Sim | Ano escolar (1-9) |
| `turma_id` | integer (FK) | Não | Referência à turma |
| `status` | text | Não | Status: 'Ativo', 'Inativo', 'Transferido' (default: 'Ativo') |
| `data_nascimento` | date | Não | Data de nascimento |
| `sexo` | text | Não | Sexo do aluno |
| `raca_cor` | text | Não | Raça/cor autodeclarada |
| `nacionalidade` | text | Não | Nacionalidade (default: 'Brasileira') |
| `naturalidade` | text | Não | Cidade de nascimento |
| `uf` | text | Não | Estado de nascimento |
| `rg` | text | Não | Número do RG |
| `cpf` | text | Não | Número do CPF |
| `cartao_sus` | text | Não | Número do cartão SUS |
| `vacinado_covid` | text | Não | Status vacinação COVID (default: 'Não') |
| `mae_nome` | text | Não | Nome da mãe |
| `mae_email` | text | Não | Email da mãe |
| `mae_contato` | text | Não | Telefone da mãe |
| `mae_rg` | text | Não | RG da mãe |
| `mae_cpf` | text | Não | CPF da mãe |
| `pai_nome` | text | Não | Nome do pai |
| `pai_email` | text | Não | Email do pai |
| `pai_contato` | text | Não | Telefone do pai |
| `pai_rg` | text | Não | RG do pai |
| `pai_cpf` | text | Não | CPF do pai |
| `endereco` | text | Não | Logradouro |
| `endereco_numero` | text | Não | Número |
| `bairro` | text | Não | Bairro |
| `cidade` | text | Não | Cidade |
| `estado` | text | Não | Estado |
| `cep` | text | Não | CEP |
| `bolsa_familia` | boolean | Não | Beneficiário Bolsa Família (default: false) |
| `censo_escola` | boolean | Não | Incluído no Censo Escolar (default: false) |
| `aluno_pcd` | boolean | Não | Pessoa com deficiência (default: false) |
| `aluno_aee` | boolean | Não | Atendimento Educacional Especializado (default: false) |
| `dieta_restritiva` | boolean | Não | Possui dieta restritiva (default: false) |
| `transporte_escolar` | boolean | Não | Utiliza transporte escolar (default: false) |
| `largura_farda` | text | Não | Tamanho largura da farda |
| `altura_farda` | text | Não | Tamanho altura da farda |
| `pasta` | text | Não | Número da pasta física |
| `prateleira` | text | Não | Localização na prateleira |
| `foto_url` | text | Não | URL da foto do aluno |
| `tipo_movimentacao` | text | Não | Tipo de movimentação (matrícula, transferência) |
| `de_onde_veio` | text | Não | Escola de origem (transferência) |
| `para_onde_vai` | text | Não | Escola de destino (transferência) |
| `data_movimentacao` | date | Não | Data da movimentação |
| `created_at` | timestamptz | Não | Data de criação (default: now()) |

### 5.2.2. Tabela: `professores`

Armazena informações dos professores.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | integer (PK) | Sim | Identificador único |
| `nome` | text | Sim | Nome completo |
| `matricula` | text | Sim | Número de matrícula funcional |
| `email` | text | Sim | Email institucional |
| `disciplina` | text | Sim | Disciplina principal (legado) |
| `disciplinas` | text[] | Não | Array de disciplinas lecionadas |
| `series` | text[] | Não | Array de séries que leciona |
| `telefone` | text | Não | Telefone de contato |
| `cpf` | text | Não | CPF |
| `rg` | text | Não | RG |
| `foto_url` | text | Não | URL da foto |
| `arquivo_url` | text | Não | URL de documento anexo |
| `ativo` | boolean | Não | Professor ativo (default: true) |
| `status_funcional` | text | Não | Status: 'Lotado', 'Afastado', etc. (default: 'Lotado') |
| `formacoes` | jsonb | Não | Array de formações acadêmicas |
| `biografia` | text | Não | Biografia/currículo resumido |
| `link_lattes` | text | Não | Link do currículo Lattes |
| `data_lotacao` | date | Não | Data de lotação na escola |
| `created_at` | timestamptz | Não | Data de criação |

### 5.2.3. Tabela: `turmas`

Organização de turmas por período letivo.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | integer (PK) | Sim | Identificador único |
| `nome` | text | Sim | Nome da turma (ex: "5º Ano A") |
| `serie` | text | Sim | Série (1º ao 9º ano) |
| `turno` | text | Sim | Turno: 'Manhã', 'Tarde', 'Noite' |
| `ano` | integer | Sim | Ano letivo (ex: 2024) |
| `capacidade` | integer | Não | Capacidade máxima (default: 30) |
| `professor_id` | integer (FK) | Não | Professor titular |
| `professor_id_2` | integer (FK) | Não | Professor auxiliar/segundo |
| `created_at` | timestamptz | Não | Data de criação |

### 5.2.4. Tabela: `notas`

Registro de notas bimestrais dos alunos.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | integer (PK) | Sim | Identificador único |
| `aluno_id` | integer (FK) | Sim | Referência ao aluno |
| `turma_id` | integer (FK) | Sim | Referência à turma |
| `disciplina` | text | Sim | Nome da disciplina |
| `ano` | integer | Sim | Ano letivo (default: ano atual) |
| `bimestre_1` | numeric | Não | Nota do 1º bimestre |
| `bimestre_2` | numeric | Não | Nota do 2º bimestre |
| `bimestre_3` | numeric | Não | Nota do 3º bimestre |
| `bimestre_4` | numeric | Não | Nota do 4º bimestre |
| `media_anual` | numeric | Não | Média anual calculada |
| `situacao` | text | Não | Situação: 'Aprovado', 'Reprovado', etc. |
| `created_at` | timestamptz | Não | Data de criação |

### 5.2.5. Tabela: `frequencia`

Registro de presença/ausência dos alunos.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | integer (PK) | Sim | Identificador único |
| `aluno_id` | integer (FK) | Sim | Referência ao aluno |
| `turma_id` | integer (FK) | Sim | Referência à turma |
| `data` | date | Sim | Data do registro |
| `status` | text | Sim | Status: 'presente', 'faltou', 'justificado' (default: 'presente') |
| `created_at` | timestamptz | Não | Data de criação |

### 5.2.6. Tabela: `equipe_gestora`

Membros da equipe administrativa da escola.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | integer (PK) | Sim | Identificador único |
| `nome` | text | Sim | Nome completo |
| `cargo` | text | Sim | Cargo: 'Diretor', 'Vice-Diretor', 'Coordenador', 'Secretário' |
| `matricula` | text | Sim | Matrícula funcional |
| `email` | text | Sim | Email institucional |
| `telefone` | text | Não | Telefone |
| `status` | text | Não | Status: 'Ativo', 'Inativo' (default: 'Ativo') |
| `foto_url` | text | Não | URL da foto |
| `rg` | text | Não | RG |
| `cpf` | text | Não | CPF |
| `arquivo_url` | text | Não | URL de documento anexo |
| `formacoes` | jsonb | Não | Array de formações |
| `biografia` | text | Não | Biografia |
| `data_lotacao` | date | Não | Data de lotação |
| `created_at` | timestamptz | Não | Data de criação |

### 5.2.7. Tabela: `eventos`

Calendário de eventos escolares.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | integer (PK) | Sim | Identificador único |
| `titulo` | text | Sim | Título do evento |
| `tipo` | text | Sim | Tipo: 'reuniao', 'feriado', 'prova', etc. |
| `data` | date | Sim | Data do evento |
| `descricao` | text | Não | Descrição detalhada |
| `hora_inicio` | text | Não | Horário de início |
| `hora_fim` | text | Não | Horário de término |
| `local` | text | Não | Local do evento |
| `created_at` | timestamptz | Não | Data de criação |

### 5.2.8. Tabela: `horarios`

Grade horária das turmas.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | integer (PK) | Sim | Identificador único |
| `turma_id` | integer (FK) | Sim | Referência à turma |
| `dia` | text | Sim | Dia da semana |
| `disciplina` | text | Sim | Disciplina |
| `inicio` | text | Sim | Horário de início |
| `fim` | text | Sim | Horário de término |

### 5.2.9. Tabela: `anotacoes`

Anotações e registros diversos.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | integer (PK) | Sim | Identificador único |
| `titulo` | text | Sim | Título da anotação |
| `conteudo` | text | Sim | Conteúdo |
| `tipo` | text | Sim | Tipo (default: 'diario') |
| `data` | date | Sim | Data da anotação |
| `created_at` | timestamptz | Não | Data de criação |

### 5.2.10. Tabela: `profiles`

Perfis de usuários do sistema (vinculados ao auth.users).

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | uuid (PK) | Sim | ID do usuário (ref. auth.users) |
| `nome` | text | Sim | Nome do usuário |
| `created_at` | timestamptz | Não | Data de criação |

### 5.2.11. Tabela: `user_roles`

Papéis/funções dos usuários no sistema.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | uuid (PK) | Sim | Identificador único |
| `user_id` | uuid (FK) | Sim | ID do usuário |
| `role` | app_role (enum) | Sim | Papel: 'admin', 'professor', 'aluno' (default: 'aluno') |

### 5.2.12. Tabela: `usuarios` (legado)

Tabela de usuários legada.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | integer (PK) | Sim | Identificador único |
| `nome` | text | Sim | Nome |
| `email` | text | Sim | Email |
| `papel` | text | Sim | Papel (default: 'aluno') |
| `ativo` | boolean | Não | Usuário ativo (default: true) |
| `created_at` | timestamptz | Não | Data de criação |

## 5.3. Relacionamentos Principais

| Relacionamento | Tipo | Descrição |
|----------------|------|-----------|
| `alunos` → `turmas` | N:1 | Muitos alunos pertencem a uma turma |
| `turmas` → `professores` | N:1 | Uma turma tem um ou dois professores |
| `frequencia` → `alunos` | N:1 | Registros de frequência por aluno |
| `frequencia` → `turmas` | N:1 | Frequência vinculada à turma |
| `notas` → `alunos` | N:1 | Notas por aluno |
| `notas` → `turmas` | N:1 | Notas vinculadas à turma |
| `horarios` → `turmas` | N:1 | Grade horária por turma |
| `profiles` → `auth.users` | 1:1 | Perfil vinculado ao usuário autenticado |
| `user_roles` → `profiles` | N:1 | Usuário pode ter múltiplos papéis |

---

# 6. API (SUPABASE CLIENT)

O sistema não utiliza uma API REST tradicional. Em vez disso, utiliza o cliente JavaScript do Supabase que abstrai as operações de banco de dados.

## 6.1. Configuração do Cliente

```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(
  SUPABASE_URL, 
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
```

## 6.2. Operações Principais

### 6.2.1. Autenticação

| Operação | Método | Descrição |
|----------|--------|-----------|
| Login | `supabase.auth.signInWithPassword()` | Autenticação com email/senha |
| Cadastro | `supabase.auth.signUp()` | Registro de novo usuário |
| Logout | `supabase.auth.signOut()` | Encerramento de sessão |
| Sessão | `supabase.auth.getSession()` | Recuperar sessão atual |
| Listener | `supabase.auth.onAuthStateChange()` | Observar mudanças de estado |

### 6.2.2. Consultas (SELECT)

```typescript
// Buscar todos os alunos ativos
const { data, error } = await supabase
  .from('alunos')
  .select('*')
  .eq('status', 'Ativo')
  .order('nome');

// Buscar alunos com turma (join)
const { data, error } = await supabase
  .from('alunos')
  .select(`
    *,
    turmas (
      id,
      nome
    )
  `);
```

### 6.2.3. Inserção (INSERT)

```typescript
const { data, error } = await supabase
  .from('alunos')
  .insert({
    nome: 'João Silva',
    matricula: '2024001',
    ano: 5
  })
  .select()
  .single();
```

### 6.2.4. Atualização (UPDATE)

```typescript
const { error } = await supabase
  .from('alunos')
  .update({ status: 'Inativo' })
  .eq('id', alunoId);
```

### 6.2.5. Exclusão (DELETE)

```typescript
const { error } = await supabase
  .from('alunos')
  .delete()
  .eq('id', alunoId);
```

## 6.3. Políticas de Segurança (RLS)

Todas as tabelas possuem Row Level Security habilitado. As políticas padrão permitem operações apenas para usuários autenticados:

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| alunos | ✅ Auth | ✅ Auth | ✅ Auth | ✅ Auth |
| professores | ✅ Auth | ✅ Auth | ✅ Auth | ✅ Auth |
| turmas | ✅ Auth | ✅ Auth | ✅ Auth | ✅ Auth |
| notas | ✅ Auth | ✅ Auth | ✅ Auth | ✅ Auth |
| frequencia | ✅ Auth | ✅ Auth | ✅ Auth | ✅ Auth |
| equipe_gestora | ✅ Auth | ✅ Auth | ✅ Auth | ✅ Auth |
| eventos | ✅ Auth | ✅ Auth | ✅ Auth | ✅ Auth |
| horarios | ✅ Auth | ✅ Auth | ✅ Auth | ✅ Auth |
| profiles | Own only | ❌ | Own only | ❌ |
| user_roles | Own only | ❌ | ❌ | ❌ |

**Legenda:**
- ✅ Auth = Permitido para usuários autenticados
- Own only = Apenas para o próprio registro do usuário
- ❌ = Não permitido via cliente (apenas backend)

---

# 7. FRONTEND: ESTRUTURA E FLUXOS

## 7.1. Estrutura de Pastas

```
src/
├── components/
│   ├── layout/           # Componentes de layout (Header, Sidebar, etc.)
│   │   ├── AppHeader.tsx
│   │   ├── AppLayout.tsx
│   │   └── AppSidebar.tsx
│   ├── relatorios/       # Componentes de relatórios
│   │   ├── DocumentTemplateDialog.tsx
│   │   ├── GenerateDocumentDialog.tsx
│   │   ├── ReportCapacidadeDialog.tsx
│   │   ├── ReportDesempenhoDialog.tsx
│   │   ├── ReportFrequenciaDialog.tsx
│   │   ├── ReportMatriculasDialog.tsx
│   │   ├── ReportNotasDialog.tsx
│   │   └── ReportTransferenciasDialog.tsx
│   ├── ui/               # Componentes UI base (shadcn)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── data-table.tsx
│   │   └── ... (50+ componentes)
│   ├── NavLink.tsx
│   └── ProtectedRoute.tsx
├── contexts/
│   └── AuthContext.tsx   # Contexto de autenticação
├── hooks/
│   ├── use-mobile.tsx    # Hook para detecção mobile
│   └── use-toast.ts      # Hook para notificações
├── integrations/
│   └── supabase/
│       ├── client.ts     # Cliente Supabase (auto-gerado)
│       └── types.ts      # Tipos do banco (auto-gerado)
├── lib/
│   └── utils.ts          # Utilitários (cn, etc.)
├── pages/
│   ├── Auth.tsx          # Tela de login/cadastro
│   ├── Painel.tsx        # Dashboard principal
│   ├── Alunos.tsx        # Lista de alunos
│   ├── NovoAluno.tsx     # Cadastro/edição de aluno
│   ├── Professores.tsx   # Lista de professores
│   ├── NovoProfessor.tsx # Cadastro/edição de professor
│   ├── Turmas.tsx        # Lista de turmas
│   ├── Notas.tsx         # Lançamento de notas
│   ├── Frequencia.tsx    # Registro de frequência
│   ├── AtaFinal.tsx      # Ata final da turma
│   ├── EquipeGestora.tsx # Lista da equipe
│   ├── NovoMembro.tsx    # Cadastro de membro
│   ├── PerfilMembro.tsx  # Perfil do membro
│   ├── Horario.tsx       # Grade horária
│   ├── Calendario.tsx    # Calendário de eventos
│   ├── DiarioDigital.tsx # Hub do diário digital
│   ├── Relatorios.tsx    # Central de relatórios
│   ├── Configuracoes.tsx # Configurações
│   └── NotFound.tsx      # Página 404
├── App.tsx               # Componente raiz e rotas
├── App.css               # Estilos globais (mínimo)
├── index.css             # Design system (Tailwind)
├── main.tsx              # Entry point
└── vite-env.d.ts         # Tipos Vite
```

## 7.2. Principais Telas

### 7.2.1. Tela de Login (`/auth`)

- Formulário de login com email e senha
- Opção de alternar para cadastro (signup)
- Validação de campos
- Feedback visual de erros
- Redirecionamento automático após autenticação

### 7.2.2. Painel/Dashboard (`/painel`)

- Cards com estatísticas principais (total de alunos, professores, turmas)
- Gráficos de frequência e desempenho
- Lista de próximos eventos
- Atividades recentes

### 7.2.3. Alunos (`/alunos`, `/alunos/novo`, `/alunos/:id/editar`)

- Lista paginada de alunos com busca
- Filtros por status
- Formulário completo de cadastro com múltiplas seções:
  - Dados pessoais
  - Documentação
  - Dados familiares
  - Endereço
  - Programas sociais
  - Informações escolares

### 7.2.4. Turmas (`/turmas`)

- Lista de turmas organizadas por período letivo
- Indicador de capacidade
- Acesso rápido a frequência, notas e ata final

### 7.2.5. Diário Digital (`/diario-digital`)

- Hub central para atividades pedagógicas
- Seleção de professor e turma
- Acesso a:
  - Frequência
  - Objetos de Conhecimento
  - Avaliações
  - Notas

### 7.2.6. Frequência (`/turmas/:turmaId/frequencia`)

- Calendário de frequência
- Marcação: presente, faltou, justificado
- Toggle rápido por clique

### 7.2.7. Notas (`/turmas/:turmaId/notas`)

- Tabela de notas por disciplina
- Colunas: 4 bimestres + média anual
- Cálculo automático de média
- Situação automática (aprovado/reprovado)

### 7.2.8. Relatórios (`/relatorios`)

- Geração de relatórios em PDF:
  - Relatório de Notas
  - Relatório de Frequência
  - Relatório de Desempenho
  - Relatório de Matrículas
  - Relatório de Capacidade
  - Relatório de Transferências
- Modelos de documentos personalizáveis

## 7.3. Fluxo de Navegação

```
                    ┌─────────────┐
                    │   /auth     │
                    │   (Login)   │
                    └──────┬──────┘
                           │ autenticado
                           ▼
┌──────────────────────────────────────────────────────────┐
│                      /painel (Dashboard)                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  /alunos    │  │/professores │  │    /turmas      │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                  │            │
│         ▼                ▼                  ▼            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │/alunos/novo │  │/prof/novo   │  │  /turmas/:id/   │  │
│  │/alunos/:id  │  │/prof/:id    │  │  notas          │  │
│  │  /editar    │  │  /editar    │  │  frequencia     │  │
│  └─────────────┘  └─────────────┘  │  ata-final      │  │
│                                    └─────────────────┘  │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │/equipe-     │  │ /horario    │  │  /calendario    │  │
│  │gestora      │  └─────────────┘  └─────────────────┘  │
│  └──────┬──────┘                                        │
│         │                                                │
│         ▼                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │/equipe/novo │  │ /diario-    │  │  /relatorios    │  │
│  │/equipe/:id  │  │ digital     │  └─────────────────┘  │
│  └─────────────┘  └─────────────┘                       │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              /configuracoes                      │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

# 8. AUTENTICAÇÃO E CONTROLE DE ACESSO

## 8.1. Implementação da Autenticação

O sistema utiliza Supabase Auth com as seguintes características:

### 8.1.1. Contexto de Autenticação

```typescript
// src/contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null;          // Usuário autenticado
  session: Session | null;    // Sessão com tokens
  loading: boolean;           // Estado de carregamento
  signIn: (email, password) => Promise<{ error: Error | null }>;
  signUp: (email, password, nome) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}
```

### 8.1.2. Fluxo de Autenticação

1. **Inicialização:** Ao carregar, o sistema verifica se existe sessão válida em `localStorage`
2. **Login:** Usuário informa email/senha → Supabase valida → Sessão criada
3. **Persistência:** Token JWT armazenado em `localStorage` com auto-refresh
4. **Proteção de Rotas:** Componente `ProtectedRoute` verifica autenticação
5. **Logout:** Limpa sessão local e no Supabase

### 8.1.3. Proteção de Rotas

```typescript
// src/components/ProtectedRoute.tsx
export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/auth" replace />;
  
  return children;
};
```

## 8.2. Sistema de Papéis (Roles)

O sistema possui uma estrutura de papéis baseada na tabela `user_roles`:

| Papel | Descrição |
|-------|-----------|
| `admin` | Acesso total ao sistema |
| `professor` | Acesso a funcionalidades pedagógicas |
| `aluno` | Acesso limitado (não implementado no frontend) |

### 8.2.1. Atribuição Automática de Papel

Ao criar um novo usuário, um trigger no banco automaticamente:
1. Cria um registro na tabela `profiles`
2. Atribui o papel `admin` ao novo usuário

```sql
-- Função handle_new_user()
INSERT INTO public.profiles (id, nome)
VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email));

INSERT INTO public.user_roles (user_id, role)
VALUES (NEW.id, 'admin');
```

### 8.2.2. Verificação de Papel

```sql
-- Função has_role(user_id, role)
SELECT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = _user_id AND role = _role
)
```

> 🔧 **TODO (preencher manualmente):** Implementar controle de acesso baseado em papéis no frontend (mostrar/ocultar funcionalidades por papel).

---

# 9. DECISÕES DE PROJETO E BOAS PRÁTICAS

## 9.1. Decisões Arquiteturais

### 9.1.1. Uso do Supabase como BaaS

**Decisão:** Utilizar Supabase/Lovable Cloud em vez de backend Node.js tradicional.

**Vantagens:**
- Redução significativa de código backend
- Autenticação pronta com segurança
- APIs geradas automaticamente
- Row Level Security nativo
- Escalabilidade automática

**Limitações:**
- Menor controle sobre lógica de negócio complexa
- Dependência da plataforma

### 9.1.2. Componentes UI com shadcn/ui

**Decisão:** Usar shadcn/ui como base de componentes em vez de Material UI ou Bootstrap.

**Vantagens:**
- Componentes copiados para o projeto (não dependência)
- Altamente customizáveis
- Baseados em Radix UI (acessibilidade)
- Integração nativa com Tailwind CSS

### 9.1.3. Design System com Tailwind CSS

**Decisão:** Centralizar tokens de design em variáveis CSS.

**Implementação:**
- Cores definidas em HSL no `index.css`
- Mapeamento para classes Tailwind no `tailwind.config.ts`
- Suporte a dark mode via classe `.dark`

### 9.1.4. Gerenciamento de Estado

**Decisão:** Usar React Query para estado servidor + useState/useContext para estado local.

**Vantagens:**
- Cache automático de queries
- Revalidação inteligente
- Separação clara entre estado servidor e cliente

## 9.2. Padrões de Código

### 9.2.1. Estrutura de Páginas

Todas as páginas seguem o padrão:
```typescript
export default function NomeDaPagina() {
  // 1. Hooks (useState, useEffect, custom hooks)
  // 2. Funções de fetch/mutação
  // 3. Handlers de eventos
  // 4. Return com JSX usando AppLayout
}
```

### 9.2.2. Consultas ao Banco

Padrão consistente para queries Supabase:
```typescript
const { data, error } = await supabase
  .from('tabela')
  .select('campos')
  .eq('filtro', valor)
  .order('campo');

if (error) {
  toast({ title: 'Erro', description: error.message, variant: 'destructive' });
  return;
}
```

### 9.2.3. Feedback ao Usuário

Uso consistente de toasts para feedback:
```typescript
// Sucesso
toast({ title: 'Sucesso', description: 'Operação realizada' });

// Erro
toast({ title: 'Erro', description: mensagem, variant: 'destructive' });
```

### 9.2.4. Geração de PDFs

Padrão para relatórios PDF com jsPDF:
```typescript
const doc = new jsPDF();
doc.setFontSize(18);
doc.text('Título', 14, 22);

autoTable(doc, {
  head: [['Col1', 'Col2']],
  body: dados.map(item => [item.col1, item.col2]),
  startY: 30
});

doc.save('relatorio.pdf');
```

---

# 10. LIMITAÇÕES CONHECIDAS E PRÓXIMOS PASSOS

## 10.1. Limitações Atuais

### 10.1.1. Autenticação e Autorização

- **Controle de papéis não implementado no frontend:** Embora exista estrutura de roles no banco, o frontend não diferencia funcionalidades por papel.
- **Todos os usuários são admin:** O trigger de criação atribui `admin` a todos os novos usuários.

### 10.1.2. Validações

- **Validações básicas:** Muitos formulários não possuem validação completa com Zod/React Hook Form.
- **Validações server-side:** Dependem apenas das constraints do banco.

### 10.1.3. Testes

- **Sem testes automatizados:** O projeto não possui testes unitários ou de integração.
- **Sem testes E2E:** Não há testes de ponta a ponta.

### 10.1.4. Funcionalidades Incompletas

- **Objetos de Conhecimento:** Mencionado no Diário Digital mas não implementado.
- **Avaliações:** Mencionado no Diário Digital mas não implementado.
- **Filtros avançados:** Algumas listagens não possuem filtros além de busca.

### 10.1.5. Performance

- **Sem paginação server-side:** Listas carregam todos os registros.
- **Sem lazy loading de imagens:** Fotos de perfil não são otimizadas.

### 10.1.6. UX/Acessibilidade

- **Internacionalização:** Sistema apenas em português.
- **Acessibilidade:** Não foi auditado para WCAG.

## 10.2. Melhorias Sugeridas

### 10.2.1. Curto Prazo (1-2 sprints)

| Melhoria | Prioridade | Esforço |
|----------|------------|---------|
| Implementar validação completa com Zod em formulários | Alta | Médio |
| Adicionar paginação server-side nas listagens | Alta | Médio |
| Implementar filtros avançados (status, turma, ano) | Média | Baixo |
| Adicionar loading states em todas as operações | Média | Baixo |

### 10.2.2. Médio Prazo (3-4 sprints)

| Melhoria | Prioridade | Esforço |
|----------|------------|---------|
| Implementar controle de acesso por papel | Alta | Alto |
| Criar testes unitários para componentes críticos | Alta | Alto |
| Implementar módulo de Objetos de Conhecimento | Média | Médio |
| Implementar módulo de Avaliações | Média | Médio |
| Adicionar exportação para Excel nos relatórios | Baixa | Baixo |

### 10.2.3. Longo Prazo

| Melhoria | Prioridade | Esforço |
|----------|------------|---------|
| Implementar testes E2E com Playwright/Cypress | Média | Alto |
| Adicionar PWA para uso offline | Baixa | Alto |
| Implementar notificações push | Baixa | Médio |
| Criar app mobile (React Native) | Baixa | Muito Alto |

---

# APÊNDICES

## A. Glossário

| Termo | Definição |
|-------|-----------|
| **AEE** | Atendimento Educacional Especializado |
| **PCD** | Pessoa com Deficiência |
| **RLS** | Row Level Security (segurança em nível de linha) |
| **SPA** | Single Page Application |
| **JWT** | JSON Web Token |
| **BaaS** | Backend as a Service |

## B. Referências

- [Documentação Supabase](https://supabase.com/docs)
- [Documentação React](https://react.dev)
- [Documentação Tailwind CSS](https://tailwindcss.com/docs)
- [Documentação shadcn/ui](https://ui.shadcn.com)
- [Documentação React Router](https://reactrouter.com)
- [Documentação TanStack Query](https://tanstack.com/query)

## C. Histórico de Versões do Documento

| Versão | Data | Autor | Alterações |
|--------|------|-------|------------|
| 1.0 | Dez/2024 | Equipe | Versão inicial |

---

> 🔧 **TODO (preencher manualmente):** Adicionar informações de contato da equipe de desenvolvimento e suporte.

> 🔧 **TODO (preencher manualmente):** Inserir URL do ambiente de produção quando disponível.

> 🔧 **TODO (preencher manualmente):** Documentar regras de negócio específicas da instituição (critérios de aprovação, cálculo de frequência mínima, etc.).
