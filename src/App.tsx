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
import RegistroObjetoConhecimento from "./pages/RegistroObjetoConhecimento";
import Avaliacoes from "./pages/Avaliacoes";
import RegistroAvaliacao from "./pages/RegistroAvaliacao";
import CriarAvaliacao from "./pages/CriarAvaliacao";
import CriarAvaliacaoIA from "./pages/CriarAvaliacaoIA";
import PerfilEstudante from "./pages/PerfilEstudante";
import PerfilProfessor from "./pages/PerfilProfessor";

import PerfilMembro from "./pages/PerfilMembro";
import NotasParciais from "./pages/NotasParciais";
import ManualUso from "./pages/ManualUso";
import PreMatriculas from "./pages/PreMatriculas";
import ErrorPage from "./components/ErrorPage";
import EscolhaPerfil from "./pages/EscolhaPerfil";
import BaseCurricular from "./pages/BaseCurricular";
import { MessagePopup } from "./components/MessagePopup";

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

      { path: "/painel", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor', ]}><Painel /></ProtectedRoute> },



      { path: "/estudantes/:id", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor', ]}><PerfilEstudante /></ProtectedRoute> },
      { path: "/professores/:id", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><PerfilProfessor /></ProtectedRoute> },

      { path: "/turmas", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><Turmas /></ProtectedRoute> },
      { path: "/turmas/:turmaId/notas", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><Notas /></ProtectedRoute> },
      { path: "/turmas/:turmaId/notas-parciais", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><NotasParciais /></ProtectedRoute> },
      { path: "/turmas/:turmaId/frequencia", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><Frequencia /></ProtectedRoute> },
      { path: "/turmas/:turmaId/ata-final", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><AtaFinal /></ProtectedRoute> },

      { path: "/equipe-gestora/:id", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><PerfilMembro /></ProtectedRoute> },

      { path: "/horario", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor', ]}><Horario /></ProtectedRoute> },
      { path: "/calendario", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><Calendario /></ProtectedRoute> },
      { path: "/diario-digital", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><DiarioDigital /></ProtectedRoute> },
      { path: "/diario-digital/objetos-de-conhecimento/:turmaId", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><ObjetosDeConhecimento /></ProtectedRoute> },
      { path: "/diario-digital/objetos-de-conhecimento/:turmaId/registro", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><RegistroObjetoConhecimento /></ProtectedRoute> },
      { path: "/diario-digital/objetos-de-conhecimento", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><ObjetosDeConhecimento /></ProtectedRoute> },
      { path: "/diario-digital/avaliacoes/:turmaId", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><Avaliacoes /></ProtectedRoute> },
      { path: "/diario-digital/avaliacoes/:turmaId/registro", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><RegistroAvaliacao /></ProtectedRoute> },
      { path: "/diario-digital/avaliacoes/:turmaId/criar/:avaliacaoId", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><CriarAvaliacao /></ProtectedRoute> },
      { path: "/diario-digital/avaliacoes/:turmaId/criar-ia/:avaliacaoId", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><CriarAvaliacaoIA /></ProtectedRoute> },
      { path: "/mensagens", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor']}><Mensagens /></ProtectedRoute> },
      { path: "/configuracoes", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor', ]}><Configuracoes /></ProtectedRoute> },
      { path: "/manual-uso", element: <ProtectedRoute allowedRoles={['admin', , , , 'professor', ]}><ManualUso /></ProtectedRoute> },

      { path: "*", element: <NotFound /> },
    ]
  },
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
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
            <MessagePopup />
          </UserRoleProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
