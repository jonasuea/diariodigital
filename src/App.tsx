import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import PerfilMembro from "./pages/PerfilMembro";
import PerfilProfessor from "./pages/PerfilProfessor";
import PerfilEstudante from "./pages/PerfilEstudante";
import Horario from "./pages/Horario";
import Calendario from "./pages/Calendario";
import DiarioDigital from "./pages/DiarioDigital";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Usuarios from "./pages/Usuarios";
import NotFound from "./pages/NotFound";
import Perfil from "./pages/Perfil";
import Manutencao from "./pages/Manutencao";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/manutencao" element={<Manutencao />} />

            <Route path="/painel" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><Painel /></ProtectedRoute>} />

            <Route path="/estudantes" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><Estudantes /></ProtectedRoute>} />
            <Route path="/estudantes/novo" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><NovoEstudante /></ProtectedRoute>} />
            <Route path="/estudantes/:id" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><PerfilEstudante /></ProtectedRoute>} />
            <Route path="/estudantes/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><NovoEstudante /></ProtectedRoute>} />

            <Route path="/professores" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><Professores /></ProtectedRoute>} />
            <Route path="/professores/novo" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><NovoProfessor /></ProtectedRoute>} />
            <Route path="/professores/:id" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><PerfilProfessor /></ProtectedRoute>} />
            <Route path="/professores/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><NovoProfessor /></ProtectedRoute>} />

            <Route path="/turmas" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><Turmas /></ProtectedRoute>} />
            <Route path="/turmas/:turmaId/notas" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><Notas /></ProtectedRoute>} />
            <Route path="/turmas/:turmaId/frequencia" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><Frequencia /></ProtectedRoute>} />
            <Route path="/turmas/:turmaId/ata-final" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><AtaFinal /></ProtectedRoute>} />

            <Route path="/equipe-gestora" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><EquipeGestora /></ProtectedRoute>} />
            <Route path="/equipe-gestora/novo" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><NovoMembro /></ProtectedRoute>} />
            <Route path="/equipe-gestora/:id" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><PerfilMembro /></ProtectedRoute>} />
            <Route path="/equipe-gestora/:id/editar" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><NovoMembro /></ProtectedRoute>} />

            <Route path="/horario" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><Horario /></ProtectedRoute>} />
            <Route path="/calendario" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor', 'estudante']}><Calendario /></ProtectedRoute>} />
            <Route path="/diario-digital" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><DiarioDigital /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><Relatorios /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute allowedRoles={['admin']}><Configuracoes /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><Usuarios /></ProtectedRoute>} />

            <Route path="/perfil" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'pedagogo', 'secretario', 'professor', 'estudante']}><Perfil /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
