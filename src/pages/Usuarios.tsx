import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCog } from 'lucide-react';
import { Key, UserCheck, UserX, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, query, where, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useUserRole } from '@/hooks/useUserRole';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: string;
  status: 'ativo' | 'inativo';
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState<Usuario | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [usuarioToAssign, setUsuarioToAssign] = useState<Usuario | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const { role: currentUserRole } = useUserRole();

  useEffect(() => {
    fetchUsuarios();
  }, []);

  async function fetchUsuarios() {
    setLoading(true);
    try {
            // 1. Buscar todos os perfis primeiro, que é a fonte da verdade para usuários existentes.
      const profilesSnapshot = await getDocs(collection(db, 'profiles'));
      const profilesData = profilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as { nome: string, email?: string } }));
      const userIds = profilesData.map(p => p.id);

      // 2. Buscar os papéis (roles) para todos os perfis encontrados, em lotes.
      const userRolesMap = new Map<string, any>();
      if (userIds.length > 0) {
        const rolesPromises = [];
        // O Firestore tem um limite de 30 itens para a cláusula 'in'.
        for (let i = 0; i < userIds.length; i += 30) {
          const chunk = userIds.slice(i, i + 30);
          // Usamos '__name__' para filtrar pelo ID do documento, que é o UID do usuário.
          const q = query(collection(db, 'user_roles'), where('__name__', 'in', chunk));
          rolesPromises.push(getDocs(q));
        }
        
        const rolesSnapshots = await Promise.all(rolesPromises);
        rolesSnapshots.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            userRolesMap.set(doc.id, doc.data());
          });
        });
      }

      // 3. Combinar os dados de perfis e papéis.
      const usuariosData = profilesData.map(profile => {
        const userRole = userRolesMap.get(profile.id);
        const role = userRole?.role || 'pending';
        // O administrador está sempre ativo e não pode ser desativado na interface.
        const status = role === 'admin' ? 'ativo' : (userRole?.status || 'inativo');

        return {
          id: profile.id,
          nome: profile.nome || 'Nome não encontrado',
          // O email no perfil pode não existir, então buscamos do auth se possível, mas aqui não temos acesso.
          // Mantemos a lógica original, mas o ideal seria ter o email no profile.
          email: profile.email || userRole?.email || 'E-mail não encontrado',
          role: role,
          // Um usuário sem status definido deve ser considerado 'inativo' por segurança.
          status: status as 'ativo' | 'inativo',
        };
      });

      // Ordena os usuários por nome
      setUsuarios(usuariosData.sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
      await logActivity(`solicitou a redefinição de senha para o e-mail "${email}".`);
      toast.success(`Email de reset enviado para ${email}`);
    } catch (error) {
      console.error('Erro ao enviar reset:', error);
      toast.error('Erro ao enviar email de reset');
    }
  }

  async function handleToggleStatus(id: string, currentStatus: string, nome: string) {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    try {
      await setDoc(doc(db, 'user_roles', id), { status: newStatus }, { merge: true });
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u));
      await logActivity(`${newStatus === 'ativo' ? 'ativou' : 'desativou'} o usuário "${nome}".`);
      toast.success(`Usuário ${newStatus === 'ativo' ? 'ativado' : 'desativado'}`);
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status');
    }
  }

  async function handleDeleteUsuario() {
    if (!usuarioToDelete) return;

    try {
      // Remover de user_roles e profiles
      await deleteDoc(doc(db, 'user_roles', usuarioToDelete.id));
      await deleteDoc(doc(db, 'profiles', usuarioToDelete.id));
      await logActivity(`excluiu o usuário "${usuarioToDelete.nome}".`);

      setUsuarios(prev => prev.filter(u => u.id !== usuarioToDelete.id));
      toast.success('Usuário removido com sucesso');
      setDeleteDialogOpen(false);
      setUsuarioToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast.error('Erro ao excluir usuário');
    }
  }

  async function handleAssignRole() {
    if (!usuarioToAssign || !selectedRole) return;

    try {
      await setDoc(doc(db, 'user_roles', usuarioToAssign.id), { 
        role: selectedRole,
        status: 'ativo' // Ativar ao atribuir perfil
      }, { merge: true });
      await logActivity(`atribuiu o perfil "${selectedRole}" para o usuário "${usuarioToAssign.nome}".`);
      setUsuarios(prev => prev.map(u => (u.id === usuarioToAssign.id ? { ...u, role: selectedRole, status: 'ativo' } : u)));
      toast.success(`Perfil "${selectedRole}" atribuído e usuário ativado com sucesso!`);
      setAssignDialogOpen(false);
      setUsuarioToAssign(null);
      setSelectedRole('');
    } catch (error) {
      console.error('Erro ao atribuir perfil:', error);
      toast.error('Erro ao atribuir perfil');
    }
  }

  const columns = [
    {
      key: 'nome',
      header: 'Nome',
    },
    {
      key: 'email',
      header: 'E-mail',
    },
    {
      key: 'role',
      header: 'Perfil',
      render: (item: Usuario) => (
        <Badge variant={item.role === 'admin' ? 'default' : 'secondary'}>
          {item.role}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Usuario) => (
        <Badge variant={item.status === 'ativo' ? 'default' : 'destructive'}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: 'senha',
      header: 'Senha',
      render: () => <span className="text-muted-foreground">********</span>,
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (item: Usuario) => (
        <div className="flex items-center gap-2">
          {(() => {
            // Ninguém pode alterar a si mesmo nesta interface
            if (item.id === auth.currentUser?.uid) {
              return <Badge variant="outline">Você</Badge>;
            }

            const canPerformAction = (targetRole: string) => {
              if (!currentUserRole) return false;
              if (currentUserRole === 'admin') return true;
              if (currentUserRole === 'gestor' && targetRole === 'admin') return false;
              if (currentUserRole === 'pedagogo' && ['admin', 'gestor'].includes(targetRole)) return false;
              if (currentUserRole === 'secretario' && ['admin', 'gestor', 'pedagogo'].includes(targetRole)) return false;
              if (['professor', 'estudante'].includes(currentUserRole)) return false;
              return true;
            };
            const canAct = canPerformAction(item.role);

            return <>
              <Button
                variant="outline"
                size="sm"
                disabled={!canAct}
                onClick={() => {
                  setUsuarioToAssign(item);
                  setSelectedRole(item.role);
                  setAssignDialogOpen(true);
                }}
                title={canAct ? "Atribuir/Alterar perfil" : "Permissão negada"}
              >
                <UserCog className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleResetPassword(item.email)}
                title="Resetar senha"
              >
                <Key className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={item.role === 'admin'}
                onClick={() => handleToggleStatus(item.id, item.status, item.nome)}
                title={item.role === 'admin' ? 'O status do administrador não pode ser alterado' : (item.status === 'ativo' ? 'Desativar' : 'Ativar')}
              >
                {item.status === 'ativo' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!canAct}
                onClick={() => {
                  setUsuarioToDelete(item);
                  setDeleteDialogOpen(true);
                }}
                title={canAct ? "Excluir usuário" : "Permissão negada"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          })()}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie os usuários do sistema
          </p>
        </div>

        <DataTable
          columns={columns}
          data={usuarios}
          loading={loading}
          searchKey="nome"
          searchPlaceholder="Buscar por nome..."
        />
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário "{usuarioToDelete?.nome}"? 
              Isso removerá o acesso ao sistema, mas não excluirá dados de estudantes ou funcionários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUsuario} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atribuir Perfil</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o perfil para o usuário "{usuarioToAssign?.nome}". Ao atribuir um
              perfil, o usuário será ativado e poderá acessar o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
                <SelectItem value="pedagogo">Pedagogo</SelectItem>
                <SelectItem value="secretario">Secretário</SelectItem>
                <SelectItem value="professor">Professor</SelectItem>
                <SelectItem value="estudante">Estudante</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssignRole} disabled={!selectedRole}>
              Atribuir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}