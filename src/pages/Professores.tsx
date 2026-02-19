import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface Professor {
  id: string;
  nome: string;
  disciplina: string;
  matricula: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  status_funcional: string | null;
}

export default function Professores() {
  const navigate = useNavigate();
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [professorToDelete, setProfessorToDelete] = useState<Professor | null>(null);

  useEffect(() => {
    fetchProfessores();
  }, [search]);

  async function fetchProfessores() {
    setLoading(true);
    try {
      let professoresQuery = query(collection(db, 'professores'), orderBy('nome'));
      
      if (search) {
        // NOTE: Firestore queries are case-sensitive. For case-insensitive search,
        // you'd typically store a lowercase version of the fields.
        // This search is simplified to query by name only.
        professoresQuery = query(collection(db, 'professores'), where('nome', '>=', search), where('nome', '<=', search + '\uf8ff'), orderBy('nome'));
      }
      
      const querySnapshot = await getDocs(professoresQuery);
      const professoresData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professor));
      setProfessores(professoresData);
    } catch (error) {
      toast.error('Erro ao carregar professores');
      console.error(error);
    }
    setLoading(false);
  }

  function openDeleteDialog(professor: Professor) {
    setProfessorToDelete(professor);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!professorToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'professores', professorToDelete.id));
      toast.success('Professor excluído com sucesso!');
      fetchProfessores();
    } catch (error) {
      toast.error('Erro ao excluir professor');
      console.error(error);
    } finally {
      setDeleteDialogOpen(false);
      setProfessorToDelete(null);
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'Lotado': return 'bg-success text-success-foreground';
      case 'Afastado': return 'bg-muted text-muted-foreground';
      case 'Transferido': return 'bg-warning text-warning-foreground';
      default: return 'bg-success text-success-foreground';
    }
  };

  const columns = [
    { key: 'nome', header: 'Nome' },
    { key: 'disciplina', header: 'Disciplina' },
    { key: 'matricula', header: 'Matrícula' },
    { key: 'email', header: 'E-mail' },
    { key: 'telefone', header: 'Telefone', render: (p: Professor) => p.telefone || '-' },
    { 
      key: 'status', 
      header: 'Status',
      render: (p: Professor) => (
        <Badge className={getStatusColor(p.status_funcional)}>
          {p.status_funcional || (p.ativo ? 'Lotado' : 'Inativo')}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (p: Professor) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/professores/${p.id}`); }}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/professores/${p.id}/editar`); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDeleteDialog(p); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout title="Professores">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Gerencie o corpo docente da instituição</p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Button onClick={() => navigate('/professores/novo')}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Professor
          </Button>
        </div>

        <DataTable columns={columns} data={professores} loading={loading} emptyMessage="Nenhum professor encontrado" />

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o professor "{professorToDelete?.nome}"? 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}