import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Auth from "./pages/Auth";
import Painel from "./pages/Painel";
import Alunos from "./pages/Alunos";
import NovoAluno from "./pages/NovoAluno";
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
import PerfilAluno from "./pages/PerfilAluno";
import Horario from "./pages/Horario";
import Calendario from "./pages/Calendario";
import DiarioDigital from "./pages/DiarioDigital";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Usuarios from "./pages/Usuarios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>

            {/* Agora a raiz abre normalmente sem redirect */}
            <Route path="/" element={<Auth />} />

            <Route path="/auth" element={<Auth />} />
            <Route path="/painel" element={<ProtectedRoute><Painel /></ProtectedRoute>} />

            <Route path="/alunos" element={<ProtectedRoute><Alunos /></ProtectedRoute>} />
            <Route path="/alunos/novo" element={<ProtectedRoute><NovoAluno /></ProtectedRoute>} />
            <Route path="/alunos/:id" element={<ProtectedRoute><PerfilAluno /></ProtectedRoute>} />
            <Route path="/alunos/:id/editar" element={<ProtectedRoute><NovoAluno /></ProtectedRoute>} />

            <Route path="/professores" element={<ProtectedRoute><Professores /></ProtectedRoute>} />
            <Route path="/professores/novo" element={<ProtectedRoute><NovoProfessor /></ProtectedRoute>} />
            <Route path="/professores/:id" element={<ProtectedRoute><PerfilProfessor /></ProtectedRoute>} />
            <Route path="/professores/:id/editar" element={<ProtectedRoute><NovoProfessor /></ProtectedRoute>} />

            <Route path="/turmas" element={<ProtectedRoute><Turmas /></ProtectedRoute>} />
            <Route path="/turmas/:turmaId/notas" element={<ProtectedRoute><Notas /></ProtectedRoute>} />
            <Route path="/turmas/:turmaId/frequencia" element={<ProtectedRoute><Frequencia /></ProtectedRoute>} />
            <Route path="/turmas/:turmaId/ata-final" element={<ProtectedRoute><AtaFinal /></ProtectedRoute>} />

            <Route path="/equipe-gestora" element={<ProtectedRoute><EquipeGestora /></ProtectedRoute>} />
            <Route path="/equipe-gestora/novo" element={<ProtectedRoute><NovoMembro /></ProtectedRoute>} />
            <Route path="/equipe-gestora/:id" element={<ProtectedRoute><PerfilMembro /></ProtectedRoute>} />
            <Route path="/equipe-gestora/:id/editar" element={<ProtectedRoute><NovoMembro /></ProtectedRoute>} />

            <Route path="/horario" element={<ProtectedRoute><Horario /></ProtectedRoute>} />
            <Route path="/calendario" element={<ProtectedRoute><Calendario /></ProtectedRoute>} />
            <Route path="/diario-digital" element={<ProtectedRoute><DiarioDigital /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
