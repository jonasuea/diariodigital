import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { UserCog, Key, UserCheck, UserX, Trash2, Search, ChevronLeft, ChevronRight, RotateCcw, Trash } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, query, where, updateDoc, deleteDoc, setDoc, limit, startAfter, orderBy, QueryDocumentSnapshot, DocumentData, getDoc } from 'firebase/firestore';
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
  escolas?: string[];
  excluido?: boolean;
}

const PAGE_SIZE = 20;

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState<Usuario | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [usuarioToAssign, setUsuarioToAssign] = useState<Usuario | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [escolasDisponiveis, setEscolasDisponiveis] = useState<{ id: string, nome: string }[]>([]);
  const [selectedEscolas, setSelectedEscolas] = useState<string[]>([]);
  const { role: currentUserRole, isMasterAdmin, isSecretario, isAdmin } = useUserRole();

  useEffect(() => {
    async function loadEscolas() {
      const snap = await getDocs(collection(db, 'escolas'));
      setEscolasDisponiveis(snap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome })));
    }
    loadEscolas();
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [searchTerm, showDeleted]);

  async function fetchUsuarios(next = false, prev = false) {
    setLoading(true);
    try {
      // 1. Construir a query para perfis (profiles)
      let profilesQuery = query(
        collection(db, 'profiles'),
        where('excluido', '==', showDeleted),
        orderBy('nome'),
        limit(PAGE_SIZE + 1)
      );

      if (searchTerm) {
        profilesQuery = query(
          collection(db, 'profiles'),
          where('excluido', '==', showDeleted),
          where('nome', '>=', searchTerm),
          where('nome', '<=', searchTerm + '\uf8ff'),
          orderBy('nome'),
          limit(PAGE_SIZE + 1)
        );
      }

      if (next && lastVisible) {
        profilesQuery = query(profilesQuery, startAfter(lastVisible), limit(PAGE_SIZE + 1));
      }

      // Nota: Implementar "Anterior" no Firestore é mais complexo sem endBefore estável.
      // Para simplicidade, focaremos em "Próximo" e reset ao buscar.

      const profilesSnapshot = await getDocs(profilesQuery);
      const docs = profilesSnapshot.docs;

      const hasNext = docs.length > PAGE_SIZE;
      const displayDocs = hasNext ? docs.slice(0, PAGE_SIZE) : docs;

      setHasMore(hasNext);
      if (displayDocs.length > 0) {
        setFirstVisible(displayDocs[0]);
        setLastVisible(displayDocs[displayDocs.length - 1]);
      }

      const profilesData = displayDocs.map(doc => ({ id: doc.id, ...doc.data() as { nome: string, email?: string, excluido?: boolean } }));
      const userIds = profilesData.map(p => p.id);

      // 2. Buscar os papéis (roles) para os perfis encontrados
      const userRolesMap = new Map<string, any>();
      if (userIds.length > 0) {
        const rolesPromises = [];
        for (let i = 0; i < userIds.length; i += 30) {
          const chunk = userIds.slice(i, i + 30);
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

      // 3. Combinar os dados
      const usuariosData = profilesData.map(profile => {
        const userRole = userRolesMap.get(profile.id);
        const role = userRole?.role || 'pending';
        const status = role === 'admin' ? 'ativo' : (userRole?.status || 'inativo');

        return {
          id: profile.id,
          nome: profile.nome || 'Nome não encontrado',
          email: profile.email || userRole?.email || 'E-mail não encontrado',
          role: role,
          status: status as 'ativo' | 'inativo',
          escolas: userRole?.escolas || (userRole?.escola_id ? [userRole.escola_id] : []),
          excluido: profile.excluido || false,
        };
      });

      setUsuarios(usuariosData);
      if (!next && !prev) setPage(1);
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error);
      const errorMessage = error?.message || 'Erro desconhecido';
      toast.error(`Erro ao carregar usuários: ${errorMessage}`);

      // Se for erro de índice, dar um aviso mais claro
      if (errorMessage.includes('index')) {
        console.warn('Este erro geralmente indica que um índice composto do Firestore está faltando. Verifique o link no console.');
      }
    } finally {
      setLoading(false);
    }
  }

  const handleNextPage = () => {
    setPage(prev => prev + 1);
    fetchUsuarios(true);
  };

  const handlePrevPage = () => {
    // Reset para o início por simplicidade no momento, 
    // ou implementar endBefore/limitToLast se necessário.
    setPage(1);
    fetchUsuarios();
  };

  async function handleResetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
      await logActivity(`solicitou a redefinição de senha para o e-mail "${email}".`);
      toast.success(`E-mail de reset enviado para ${email}`);
    } catch (error) {
      console.error('Sem permissão para enviar reset:', error);
      toast.error('Sem permissão para enviar email de reset');
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
      console.error('Sem permissão para alterar status:', error);
      toast.error('Sem permissão para alterar status');
    }
  }

  async function handleDeleteUsuario() {
    if (!usuarioToDelete) return;

    if (usuarioToDelete.role === 'admin') {
      toast.error('Não é permitido excluir um administrador.');
      setDeleteDialogOpen(false);
      setUsuarioToDelete(null);
      return;
    }

    try {
      if (isMasterAdmin && showDeleted) {
        // Exclusão permanente (precisa remover de ambas as coleções)
        await deleteDoc(doc(db, 'user_roles', usuarioToDelete.id));
        await deleteDoc(doc(db, 'profiles', usuarioToDelete.id));
        await logActivity(`excluiu permanentemente o usuário "${usuarioToDelete.nome}".`);
        toast.success('Usuário excluído permanentemente!');
      } else {
        // Soft delete (move para a lixeira)
        const profileRef = doc(db, 'profiles', usuarioToDelete.id);
        const rolesRef = doc(db, 'user_roles', usuarioToDelete.id);

        const timestamp = new Date();
        const deletedBy = isMasterAdmin ? 'Master Admin' : 'Admin/Gestor';

        await updateDoc(profileRef, {
          excluido: true,
          excluido_em: timestamp,
          excluido_por: deletedBy
        } as any);

        await updateDoc(rolesRef, {
          excluido: true,
          excluido_em: timestamp,
          excluido_por: deletedBy
        } as any);

        await logActivity(`moveu o usuário "${usuarioToDelete.nome}" para a lixeira.`);
        toast.success('Usuário movido para a lixeira!');
      }

      setDeleteDialogOpen(false);
      setUsuarioToDelete(null);
      fetchUsuarios();
    } catch (error) {
      console.error('Sem permissão para excluir usuário:', error);
      toast.error('Sem permissão para excluir usuário');
    }
  }

  async function handleReactivateUsuario(usuario: Usuario) {
    try {
      const profileRef = doc(db, 'profiles', usuario.id);
      const rolesRef = doc(db, 'user_roles', usuario.id);

      const timestamp = new Date();

      await updateDoc(profileRef, {
        excluido: false,
        reativado_em: timestamp
      } as any);

      await updateDoc(rolesRef, {
        excluido: false,
        reativado_em: timestamp
      } as any);

      await logActivity(`reativou o usuário "${usuario.nome}".`);
      toast.success('Usuário reativado com sucesso!');
      fetchUsuarios();
    } catch (error) {
      console.error('Erro ao reativar usuário:', error);
      toast.error('Erro ao reativar usuário');
    }
  }

  async function handleAssignRole() {
    if (!usuarioToAssign || !selectedRole) return;

    if (selectedRole !== 'admin' && selectedEscolas.length === 0) {
      toast.error('Selecione pelo menos uma escola para este usuário.');
      return;
    }

    try {
      const payload: any = {
        role: selectedRole,
        status: 'ativo'
      };

      if (selectedRole !== 'admin') {
        payload.escolas = selectedEscolas;
        payload.escola_id = selectedEscolas[0];
      }

      await setDoc(doc(db, 'user_roles', usuarioToAssign.id), payload, { merge: true });
      await logActivity(`atribuiu o perfil "${selectedRole}" para o usuário "${usuarioToAssign.nome}".`);

      setUsuarios(prev => prev.map(u => (u.id === usuarioToAssign.id ? { ...u, role: selectedRole, status: 'ativo', escolas: selectedEscolas } : u)));

      toast.success(`Perfil "${selectedRole}" atribuído com sucesso!`);
      setAssignDialogOpen(false);
      setUsuarioToAssign(null);
      setSelectedRole('');
      setSelectedEscolas([]);
    } catch (error) {
      console.error('Sem permissão para atribuir perfil:', error);
      toast.error('Sem permissão para atribuir perfil');
    }
  }

  const columns = [
    { key: 'nome', header: 'Nome' },
    { key: 'email', header: 'E-mail' },
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
      key: 'actions',
      header: 'Ações',
      render: (item: Usuario) => (
        <div className="flex items-center gap-2">
          {(() => {
            if (item.id === auth.currentUser?.uid) {
              return <Badge variant="outline">Você</Badge>;
            }

            const canPerformAction = (targetRole: string) => {
              if (!currentUserRole) return false;
              if (currentUserRole === 'admin') return true;
              if (currentUserRole === 'gestor' && targetRole === 'admin') return false;
              if (currentUserRole === 'pedagogo' && ['admin', 'gestor'].includes(targetRole)) return false;
              if (currentUserRole === 'secretario' && ['admin', 'gestor', 'pedagogo'].includes(targetRole)) return false;
              return false;
            };
            const canAct = canPerformAction(item.role);

            if (showDeleted) {
              return (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!isAdmin}
                    onClick={() => handleReactivateUsuario(item)}
                    title="Reativar usuário"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  {isMasterAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setUsuarioToDelete(item);
                        setDeleteDialogOpen(true);
                      }}
                      title="Excluir permanentemente"
                    >
                      <Trash className="h-4 w-4 text-white" />
                    </Button>
                  )}
                </>
              );
            }

            return <>
              <Button
                variant="outline"
                size="sm"
                disabled={!canAct}
                onClick={() => {
                  setUsuarioToAssign(item);
                  setSelectedRole(item.role);
                  setSelectedEscolas(item.escolas || []);
                  setAssignDialogOpen(true);
                }}
                title={canAct ? "Atribuir/Alterar perfil" : "Permissão negada"}
              >
                <UserCog className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleResetPassword(item.email)} title="Resetar senha" disabled={isSecretario}>
                <Key className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={item.role === 'admin' || isSecretario}
                onClick={() => handleToggleStatus(item.id, item.status, item.nome)}
                title={item.role === 'admin' ? 'O status do administrador não pode ser alterado' : (item.status === 'ativo' ? 'Desativar' : 'Ativar')}
              >
                {item.status === 'ativo' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!canAct || isSecretario || item.role === 'admin'}
                onClick={() => {
                  setUsuarioToDelete(item);
                  setDeleteDialogOpen(true);
                }}
                title={item.role === 'admin' ? "Administradores não podem ser excluídos" : (canAct ? "Excluir usuário" : "Permissão negada")}
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Usuários</h1>
            <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {isAdmin && (
              <Button
                variant={showDeleted ? "destructive" : "outline"}
                onClick={() => {
                  setShowDeleted(!showDeleted);
                  setPage(1);
                }}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {showDeleted ? "Ver Ativos" : "Ver Lixeira"}
              </Button>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={usuarios}
          loading={loading}
          emptyMessage="Nenhum usuário encontrado"
        />

        <div className="flex items-center justify-between py-4">
          <p className="text-sm text-muted-foreground">
            Página {page}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Início
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!hasMore || loading}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {showDeleted ? 'Excluir Permanentemente' : 'Mover para Lixeira'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {showDeleted
                ? `Você tem certeza que deseja excluir permanentemente o usuário "${usuarioToDelete?.nome}"? Esta ação não pode ser desfeita.`
                : `Você tem certeza que deseja mover o usuário "${usuarioToDelete?.nome}" para a lixeira? Isso removerá o acesso ao sistema, mas não excluirá dados de estudantes ou funcionários.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUsuario} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {showDeleted ? 'Excluir Permanentemente' : 'Mover para Lixeira'}
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
          <div className="py-4 space-y-4">
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

            {selectedRole && selectedRole !== 'admin' && (
              <div className="space-y-2 border rounded-md p-3">
                <p className="text-sm font-medium mb-2">Escolas Vinculadas</p>
                <div className="max-h-40 overflow-y-auto space-y-3">
                  {escolasDisponiveis.map(escola => (
                    <div key={escola.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`escola-${escola.id}`}
                        checked={selectedEscolas.includes(escola.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedEscolas([...selectedEscolas, escola.id]);
                          } else {
                            setSelectedEscolas(selectedEscolas.filter(id => id !== escola.id));
                          }
                        }}
                      />
                      <label htmlFor={`escola-${escola.id}`} className="text-sm font-medium leading-none cursor-pointer">
                        {escola.nome}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
