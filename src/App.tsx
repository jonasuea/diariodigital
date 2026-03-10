import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Auth from "./pages/Auth";
import Painel from "./pages/Painel";
import Estudantes from "./pages/Estudantes";
import NovoEstudante from "./pages/NovoEstudante";
import Escolas from "./pages/Escolas";
import NovaEscola from "./pages/NovaEscola";
import Professores from "./pages/Professores";
import NovoProfessor from "./pages/NovoProfessor";
import Turmas from "./pages/Turmas";
import Notas from "./pages/Notas";
import Frequencia from "./pages/Frequencia";
import AtaFinal from "./pages/AtaFinal";
import EquipeGestora from "./pages/EquipeGestora";
import NovoMembro from "./pages/NovoMembro";
import Horario from "./pages/Horario";
import Calendario from "./pages/Calendario";
import DiarioDigital from "./pages/DiarioDigital";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Responsaveis from "./pages/Responsaveis";
import Mensagens from "./pages/Mensagens";
import Usuarios from "./pages/Usuarios";
import NotFound from "./pages/NotFound";
import Logs from "./pages/Logs";
import Manutencao from "./pages/Manutencao";
import ObjetosDeConhecimento from "./pages/ObjetosDeConhecimento";
import Avaliacoes from "./pages/Avaliacoes";
import PerfilEstudante from "./pages/PerfilEstudante";
import PerfilProfessor from "./pages/PerfilProfessor";

import PerfilMembro from "./pages/PerfilMembro";
import NotasParciais from "./pages/NotasParciais";
import ManualUso from "./pages/ManualUso";
import PreMatriculas from "./pages/PreMatriculas";
import ErrorPage from "./components/ErrorPage";
import EscolhaPerfil from "./pages/EscolhaPerfil";

import { useAutoUpdate } from "@/hooks/useAutoUpdate";
import { UserRoleProvider } from "@/hooks/useUserRole";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <ErrorPage />,
    children: [
      { path: "/", element: <Auth /> },
      { path: "/auth", element: <Auth /> },
      { path: "/manutencao", element: <Manutencao /> },
      { path: "/escolha-perfil", element: <EscolhaPerfil /> },

      { path: "/painel", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor', 'estudante']}><Painel /></ProtectedRoute> },

      { path: "/escolas", element: <ProtectedRoute allowedRoles={['admin']}><Escolas /></ProtectedRoute> },
      { path: "/escolas/nova", element: <ProtectedRoute allowedRoles={['admin']}><NovaEscola /></ProtectedRoute> },
      { path: "/escolas/:id/editar", element: <ProtectedRoute allowedRoles={['admin']}><NovaEscola /></ProtectedRoute> },

      { path: "/estudantes", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><Estudantes /></ProtectedRoute> },
      { path: "/estudantes/novo", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoEstudante /></ProtectedRoute> },
      { path: "/estudantes/:id", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor', 'estudante']}><PerfilEstudante /></ProtectedRoute> },
      { path: "/estudantes/:id/editar", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoEstudante /></ProtectedRoute> },
      { path: "/pre-matriculas", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><PreMatriculas /></ProtectedRoute> },


      { path: "/professores", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><Professores /></ProtectedRoute> },
      { path: "/professores/novo", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoProfessor /></ProtectedRoute> },
      { path: "/professores/:id", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><PerfilProfessor /></ProtectedRoute> },
      { path: "/professores/:id/editar", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoProfessor /></ProtectedRoute> },

      { path: "/turmas", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><Turmas /></ProtectedRoute> },
      { path: "/turmas/:turmaId/notas", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><Notas /></ProtectedRoute> },
      { path: "/turmas/:turmaId/notas-parciais", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><NotasParciais /></ProtectedRoute> },
      { path: "/turmas/:turmaId/frequencia", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><Frequencia /></ProtectedRoute> },
      { path: "/turmas/:turmaId/ata-final", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><AtaFinal /></ProtectedRoute> },

      { path: "/equipe-gestora", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><EquipeGestora /></ProtectedRoute> },
      { path: "/equipe-gestora/novo", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoMembro /></ProtectedRoute> },
      { path: "/equipe-gestora/:id", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><PerfilMembro /></ProtectedRoute> },
      { path: "/equipe-gestora/:id/editar", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoMembro /></ProtectedRoute> },

      { path: "/horario", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor', 'estudante']}><Horario /></ProtectedRoute> },
      { path: "/calendario", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><Calendario /></ProtectedRoute> },
      { path: "/diario-digital", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><DiarioDigital /></ProtectedRoute> },
      { path: "/diario-digital/objetos-de-conhecimento/:turmaId", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><ObjetosDeConhecimento /></ProtectedRoute> },
      { path: "/diario-digital/objetos-de-conhecimento", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><ObjetosDeConhecimento /></ProtectedRoute> },
      { path: "/diario-digital/avaliacoes", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><Avaliacoes /></ProtectedRoute> },
      { path: "/relatorios", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><Relatorios /></ProtectedRoute> },
      { path: "/configuracoes", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor', 'estudante']}><Configuracoes /></ProtectedRoute> },
      { path: "/usuarios", element: <ProtectedRoute allowedRoles={['admin', 'gestor']}><Usuarios /></ProtectedRoute> },
      { path: "/responsaveis", element: <ProtectedRoute allowedRoles={['admin', 'gestor']}><Responsaveis /></ProtectedRoute> },
      { path: "/mensagens", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><Mensagens /></ProtectedRoute> },
      { path: "/logs", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><Logs /></ProtectedRoute> },
      { path: "/manual-uso", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor', 'estudante']}><ManualUso /></ProtectedRoute> },

      { path: "*", element: <NotFound /> },
    ]
  },
], {
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <UserRoleProvider>
            <RouterProvider router={router} />
          </UserRoleProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
