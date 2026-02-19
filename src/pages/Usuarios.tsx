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
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
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

  useEffect(() => {
    fetchUsuarios();
  }, []);

  async function fetchUsuarios() {
    setLoading(true);
    try {
      const userRolesSnapshot = await getDocs(collection(db, 'user_roles'));
      const usuariosData: Usuario[] = [];

      for (const userRoleDoc of userRolesSnapshot.docs) {
        const userId = userRoleDoc.id;
        const role = userRoleDoc.data().role;
        const status = userRoleDoc.data().status || 'ativo';

        // Buscar perfil
        const profileDoc = await getDoc(doc(db, 'profiles', userId));
        if (profileDoc.exists()) {
          const profile = profileDoc.data();
          usuariosData.push({
            id: userId,
            nome: profile.nome || 'N/A',
            email: profile.email || 'N/A',
            role: role || 'pending',
            status: status as 'ativo' | 'inativo'
          });
        } else {
          // Se não tem perfil, ainda adiciona com dados básicos
          usuariosData.push({
            id: userId,
            nome: 'Perfil não encontrado',
            email: 'N/A',
            role: role || 'pending',
            status: status as 'ativo' | 'inativo'
          });
        }
      }

      setUsuarios(usuariosData);
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
      toast.success(`Email de reset enviado para ${email}`);
    } catch (error) {
      console.error('Erro ao enviar reset:', error);
      toast.error('Erro ao enviar email de reset');
    }
  }

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    try {
      await updateDoc(doc(db, 'user_roles', id), { status: newStatus });
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, status: newStatus } : u));
      toast.success(`Usuário ${newStatus === 'ativo' ? 'ativado' : 'desativado'}`);
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  }

  async function handleDeleteUsuario() {
    if (!usuarioToDelete) return;

    try {
      // Remover de user_roles e profiles
      await deleteDoc(doc(db, 'user_roles', usuarioToDelete.id));
      await deleteDoc(doc(db, 'profiles', usuarioToDelete.id));

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
      await updateDoc(doc(db, 'user_roles', usuarioToAssign.id), { 
        role: selectedRole,
        status: 'ativo' // Ativar ao atribuir perfil
      });
      setUsuarios(prev => prev.map(u => u.id === usuarioToAssign.id ? { ...u, role: selectedRole, status: 'ativo' } : u));
      toast.success(`Perfil ${selectedRole} atribuído com sucesso`);
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
        <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUsuarioToAssign(item);
                setSelectedRole(item.role);
                setAssignDialogOpen(true);
              }}
              title="Atribuir/Alterar perfil"
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
            onClick={() => handleToggleStatus(item.id, item.status)}
            title={item.status === 'ativo' ? 'Desativar' : 'Ativar'}
          >
            {item.status === 'ativo' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUsuarioToDelete(item);
              setDeleteDialogOpen(true);
            }}
            title="Excluir usuário"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
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
              Isso removerá o acesso ao sistema, mas não excluirá dados de alunos ou funcionários.
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
              Selecione o perfil para o usuário "{usuarioToAssign?.nome}".
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
                <SelectItem value="professor">Professor</SelectItem>
                <SelectItem value="pedagogo">Pedagogo</SelectItem>
                <SelectItem value="secretario">Secretário</SelectItem>
                <SelectItem value="aluno">Aluno</SelectItem>
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