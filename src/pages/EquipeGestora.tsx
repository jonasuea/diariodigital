import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Eye, Pencil, Trash2, Upload, Download } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc, addDoc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { RotateCcw, Trash } from 'lucide-react';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import Papa from 'papaparse';
import { generateMatriculasBatch } from '@/lib/matriculaUtils';

interface Membro {
  id: string;
  nome: string;
  cargo: string;
  matricula: string;
  email: string;
  contato: string | null;
  status: string;
  link_lattes: string | null;
  formacoes: unknown[];
  excluido?: boolean;
}

export default function EquipeGestora() {
  const navigate = useNavigate();
  const { isAdmin, isMasterAdmin, isSecretario, escolaAtivaId } = useUserRole();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [membroToDelete, setMembroToDelete] = useState<Membro | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchMembros();
  }, [search, escolaAtivaId, showDeleted]);

  async function fetchMembros() {
    if (!escolaAtivaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let membrosQuery = query(
        collection(db, 'equipe_gestora'),
        where('escola_id', '==', escolaAtivaId),
        where('excluido', '==', showDeleted),
        orderBy('nome')
      );

      if (search) {
        membrosQuery = query(
          collection(db, 'equipe_gestora'),
          where('escola_id', '==', escolaAtivaId),
          where('excluido', '==', showDeleted),
          where('nome', '>=', search),
          where('nome', '<=', search + '\uf8ff'),
          orderBy('nome')
        );
      }

      const querySnapshot = await getDocs(membrosQuery);
      const membrosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Membro));
      setMembros(membrosData);
    } catch (error) {
      toast.error('Sem permissão para carregar equipe gestora');
      console.error(error);
    }
    setLoading(false);
  }

  function openDeleteDialog(membro: Membro) {
    if (isSecretario) {
      toast.error('Secretários não têm permissão para excluir registros.');
      return;
    }
    setMembroToDelete(membro);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!membroToDelete) return;

    try {
      const now = new Date();
      const deletedBy = isMasterAdmin ? 'Master Admin' : 'Admin/Gestor';

      if (isMasterAdmin && showDeleted) {
        // Exclusão permanente
        await deleteDoc(doc(db, 'equipe_gestora', membroToDelete.id));
        // Remove conta de usuário vinculada (doc.id === uid para membros da equipe gestora)
        try {
          await deleteDoc(doc(db, 'user_roles', membroToDelete.id));
          await deleteDoc(doc(db, 'profiles', membroToDelete.id));
        } catch (_) { /* conta pode não existir */ }
        await logActivity(`Excluiu permanentemente o membro da equipe gestora "${membroToDelete.nome}"`);
        toast.success('Membro excluído permanentemente!');
      } else {
        const docRef = doc(db, 'equipe_gestora', membroToDelete.id);
        await updateDoc(docRef, {
          excluido: true,
          excluido_em: now,
          excluido_por: deletedBy
        } as any);
        // Desativa conta de usuário vinculada
        try {
          const userRoleRef = doc(db, 'user_roles', membroToDelete.id);
          const snap = await getDoc(userRoleRef);
          if (snap.exists()) {
            await setDoc(userRoleRef, { status: 'inativo', excluido: true, excluido_em: now, excluido_por: deletedBy }, { merge: true });
          }
          const profileRef = doc(db, 'profiles', membroToDelete.id);
          const pSnap = await getDoc(profileRef);
          if (pSnap.exists()) {
            await updateDoc(profileRef, { excluido: true, excluido_em: now, excluido_por: deletedBy } as any);
          }
        } catch (_) { /* conta pode não existir */ }
        await logActivity(`Moveu o membro da equipe gestora "${membroToDelete.nome}" para a lixeira`);
        toast.success('Membro movido para a lixeira!');
      }
      fetchMembros();
    } finally {
      setDeleteDialogOpen(false);
      setMembroToDelete(null);
    }
  }


  async function fixMissingExcluido() {
    if (!escolaAtivaId) return;
    setLoading(true);
    try {
      // Busca todos os membros da escola ativa sem filtrar por excluido
      const allDocs = await getDocs(query(collection(db, 'equipe_gestora'), where('escola_id', '==', escolaAtivaId)));
      let updatedCount = 0;

      for (const d of allDocs.docs) {
        const data = d.data();
        // Se o campo excluido não existe, define como false
        if (data.excluido === undefined) {
          await updateDoc(doc(db, 'equipe_gestora', d.id), { excluido: false });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        toast.success(`${updatedCount} registros corrigidos!`);
        fetchMembros();
      } else {
        toast.info('Nenhum registro precisava de correção.');
      }
    } catch (error) {
      toast.error('Erro ao corrigir registros');
      console.error(error);
    }
    setLoading(false);
  }

  async function handleReactivate(membro: Membro) {
    try {
      const docRef = doc(db, 'equipe_gestora', membro.id);
      await updateDoc(docRef, {
        excluido: false,
        reativado_em: new Date()
      } as any);
      await logActivity(`Reativou o membro da equipe gestora "${membro.nome}"`);
      toast.success('Membro reativado com sucesso!');
      fetchMembros();
    } catch (error) {
      toast.error('Erro ao reativar membro');
      console.error(error);
    }
  }

  async function handleImportCSV(file: File) {
    setImporting(true);
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file, 'UTF-8');
      });

      let result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase(),
        delimiter: ';',
      });

      if (result.errors.length > 0) {
        result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim().toLowerCase(),
          delimiter: ',',
        });
      }

      if (result.errors.length > 0) {
        toast.error('Sem permissão para fazer o parsing do CSV. Verifique o formato e o separador.');
        return;
      }

      const requiredColumns = ['nome', 'email', 'cargo'];
      const fileColumns = result.meta.fields?.map(f => f.toLowerCase().trim()) || [];
      const missingColumns = requiredColumns.filter(col => !fileColumns.includes(col));

      if (missingColumns.length > 0) {
        toast.error(`Colunas obrigatórias em falta no CSV: ${missingColumns.join(', ')}`);
        return;
      }

      const membrosData = result.data as any[];
      let successCount = 0;
      let errorCount = 0;

      // Coletar membros válidos antes de salvar
      const validMembros: any[] = [];
      for (const row of membrosData) {
        if (!row.nome || !row.email || !row.cargo) {
          errorCount++;
          continue;
        }

        let formacoes = [];
        if (row.formacoes) {
          try {
            formacoes = JSON.parse(row.formacoes);
            if (!Array.isArray(formacoes)) formacoes = [];
          } catch (e) {
            formacoes = [];
          }
        }

        validMembros.push({
          nome: row.nome.trim(),
          email: row.email.trim(),
          rg: row.rg?.trim() || '',
          cpf: row.cpf?.trim() || '',
          contato: row.contato?.trim() || '',
          cargo: row.cargo.trim(),
          status: row.status?.trim() || 'Lotado',
          data_lotacao: row.data_lotacao?.trim() || '',
          biografia: row.biografia?.trim() || '',
          link_lattes: row.link_lattes?.trim() || '',
          formacoes,
          escola_id: escolaAtivaId,
          excluido: false,
        });
      }

      // Gerar matrículas em lote (GEST) para todos os válidos
      const matriculas = await generateMatriculasBatch(validMembros.length, 'GEST', 'gestores');

      for (let i = 0; i < validMembros.length; i++) {
        try {
          await addDoc(collection(db, 'equipe_gestora'), { ...validMembros[i], matricula: matriculas[i] });
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      if (successCount > 0) toast.success(`${successCount} membros importados com sucesso!`);
      if (errorCount > 0) toast.warning(`${errorCount} linhas não puderam ser importadas.`);

      fetchMembros();
    } catch (error) {
      toast.error('Ocorreu um erro ao importar o arquivo.');
    } finally {
      setImporting(false);
      setImportDialogOpen(false);
    }
  }

  async function handleExportCSV() {
    try {
      if (!escolaAtivaId) {
        toast.error('Nenhuma escola selecionada para exportar.');
        return;
      }
      const membrosQuery = query(collection(db, 'equipe_gestora'), where('escola_id', '==', escolaAtivaId), orderBy('nome'));
      const querySnapshot = await getDocs(membrosQuery);
      const membrosData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          nome: data.nome,
          matricula: data.matricula,
          rg: data.rg,
          cpf: data.cpf,
          email: data.email,
          contato: data.contato,
          cargo: data.cargo,
          status: data.status,
          data_lotacao: data.data_lotacao,
          biografia: data.biografia,
          link_lattes: data.link_lattes,
          formacoes: JSON.stringify(data.formacoes || []),
        };
      });

      const csv = Papa.unparse(membrosData, { delimiter: ';' });
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `equipe-gestora_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Exportação concluída com sucesso!');
    } catch (error) {
      toast.error('Sem permissão para exportar dados da equipe gestora.');
    }
  }

  const getCargoColor = (cargo: string) => {
    switch (cargo) {
      case 'Diretor': return 'bg-primary text-primary-foreground';
      case 'Coordenador Pedagógico': return 'bg-success text-success-foreground';
      case 'Secretário': return 'bg-info text-info-foreground';
      case 'Vice-Diretor': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Lotado': return 'bg-success text-success-foreground';
      case 'Ativo': return 'bg-success text-success-foreground';
      case 'Transferido': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getInitials = (nome: string) => {
    return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  };

  const columns = [
    {
      key: 'nome',
      header: 'Nome',
      render: (m: Membro) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials(m.nome)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{m.nome}</span>
        </div>
      )
    },
    {
      key: 'cargo',
      header: 'Cargo',
      render: (m: Membro) => (
        <Badge className={getCargoColor(m.cargo)}>{m.cargo}</Badge>
      )
    },
    { key: 'matricula', header: 'Matrícula' },
    {
      key: 'email',
      header: 'E-mail',
      render: (m: Membro) => (
        <a href={`mailto:${m.email}`} className="text-primary hover:underline">{m.email}</a>
      )
    },
    { key: 'contato', header: 'Contato', render: (m: Membro) => m.contato || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (m: Membro) => (
        <Badge className={getStatusColor(m.status)}>{m.status}</Badge>
      )
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (m: any) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/equipe-gestora/${m.id}`); }}>
            <Eye className="h-4 w-4 text-blue-500" />
          </Button>
          {!m.excluido && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/equipe-gestora/${m.id}/editar`); }}>
              <Pencil className="h-4 w-4 text-orange-500" />
            </Button>
          )}
          {m.excluido && isAdmin && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleReactivate(m); }} title="Reativar">
              <RotateCcw className="h-4 w-4 text-green-500" />
            </Button>
          )}
          {!isSecretario && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDeleteDialog(m); }}>
              <Trash2 className={`h-4 w-4 ${m.excluido ? 'text-red-700' : 'text-red-500'}`} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppLayout title="Equipe Gestora">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Gerencie os membros da equipe gestora da instituição</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar membro por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <>
                <Button
                  variant={showDeleted ? "destructive" : "outline"}
                  onClick={() => setShowDeleted(!showDeleted)}
                >
                  <Trash className="h-4 w-4 mr-2" />
                  {showDeleted ? 'Ver Ativos' : 'Ver Lixeira'}
                </Button>
                <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar CSV
                </Button>
                <Button variant="outline" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </>
            )}
            <Button onClick={() => navigate('/equipe-gestora/novo')}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Membro
            </Button>
          </div>
        </div>

        <DataTable columns={columns} data={membros} loading={loading} emptyMessage="Nenhum membro encontrado" />

        {/* Dialog de Importação CSV */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar Membros via CSV</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-semibold">Instruções Importantes</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Para garantir que acentos funcionem, salve seu arquivo no Excel como <strong>"CSV UTF-8"</strong>.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Colunas obrigatórias: <strong>nome</strong>, <strong>email</strong>, <strong>cargo</strong>. Use ponto e vírgula (;) como separador.
              </p>
              <p className="text-sm">
                <a href="/exemplo_equipe_gestora.csv" download className="text-primary hover:underline">
                  Baixar modelo CSV
                </a>
              </p>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleImportCSV(e.target.files[0]);
                  }
                }}
                disabled={importing}
              />
              {importing && <p className="text-sm">Importando...</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                {showDeleted
                  ? `Tem certeza que deseja excluir PERMANENTEMENTE o membro "${membroToDelete?.nome}"? Esta ação não pode ser desfeita.`
                  : `Tem certeza que deseja mover o membro "${membroToDelete?.nome}" para a lixeira?`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {showDeleted ? 'Excluir Permanentemente' : 'Mover para Lixeira'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}