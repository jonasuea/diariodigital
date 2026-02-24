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
import Usuarios from "./pages/Usuarios";
import NotFound from "./pages/NotFound";
import Logs from "./pages/Logs";
import Manutencao from "./pages/Manutencao";
import ObjetosDeConhecimento from "./pages/ObjetosDeConhecimento";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", element: <Auth /> },
  { path: "/auth", element: <Auth /> },
  { path: "/manutencao", element: <Manutencao /> },

  { path: "/painel", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><Painel /></ProtectedRoute> },

  { path: "/estudantes", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><Estudantes /></ProtectedRoute> },
  { path: "/estudantes/novo", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoEstudante /></ProtectedRoute> },
  { path: "/estudantes/:id/editar", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoEstudante /></ProtectedRoute> },

  { path: "/professores", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><Professores /></ProtectedRoute> },
  { path: "/professores/novo", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoProfessor /></ProtectedRoute> },
  { path: "/professores/:id/editar", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoProfessor /></ProtectedRoute> },

  { path: "/turmas", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><Turmas /></ProtectedRoute> },
  { path: "/turmas/:turmaId/notas", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><Notas /></ProtectedRoute> },
  { path: "/turmas/:turmaId/frequencia", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><Frequencia /></ProtectedRoute> },
  { path: "/turmas/:turmaId/ata-final", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><AtaFinal /></ProtectedRoute> },

  { path: "/equipe-gestora", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><EquipeGestora /></ProtectedRoute> },
  { path: "/equipe-gestora/novo", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoMembro /></ProtectedRoute> },
  { path: "/equipe-gestora/:id/editar", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><NovoMembro /></ProtectedRoute> },

  { path: "/horario", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><Horario /></ProtectedRoute> },
  { path: "/calendario", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor', 'estudante']}><Calendario /></ProtectedRoute> },
  { path: "/diario-digital", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><DiarioDigital /></ProtectedRoute> },
  { path: "/diario-digital/objetos-de-conhecimento/:turmaId", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><ObjetosDeConhecimento /></ProtectedRoute> },
  { path: "/diario-digital/objetos-de-conhecimento", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor']}><ObjetosDeConhecimento /></ProtectedRoute> },
  { path: "/relatorios", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><Relatorios /></ProtectedRoute> },
  { path: "/configuracoes", element: <ProtectedRoute allowedRoles={['admin']}><Configuracoes /></ProtectedRoute> },
  { path: "/usuarios", element: <ProtectedRoute allowedRoles={['admin']}><Usuarios /></ProtectedRoute> },
  { path: "/logs", element: <ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario']}><Logs /></ProtectedRoute> },

  { path: "*", element: <NotFound /> },
], {
  future: {
    v7_startTransition: true,
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
