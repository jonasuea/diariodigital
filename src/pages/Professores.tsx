import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Eye, Pencil, Trash2, Upload, Download } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { useUserRole } from '@/hooks/useUserRole';

interface Professor {
  id: string;
  nome: string;
  componente: string;
  matricula: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  status_funcional: string | null;
  rg: string | null;
  cpf: string | null;
  data_lotacao: string | null;
  link_lattes: string | null;
  biografia: string | null;
  componentes: string[] | null;
  series: string[] | null;
  formacoes: string[] | null;
}

export default function Professores() {
  const navigate = useNavigate();
  const { isAdmin, escolaAtivaId } = useUserRole();
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [professorToDelete, setProfessorToDelete] = useState<Professor | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchProfessores();
  }, [search, escolaAtivaId]);

  async function fetchProfessores() {
    if (!escolaAtivaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let professoresQuery = query(collection(db, 'professores'), where('escola_id', '==', escolaAtivaId), orderBy('nome'));

      if (search) {
        // NOTE: Firestore queries are case-sensitive. For case-insensitive search,
        // you'd typically store a lowercase version of the fields.
        // This search is simplified to query by name only.
        professoresQuery = query(collection(db, 'professores'), where('escola_id', '==', escolaAtivaId), where('nome', '>=', search), where('nome', '<=', search + '\uf8ff'), orderBy('nome'));
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

  async function handleImportCSV(file: File) {
    setImporting(true);
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.onerror = (error) => {
          reject(error);
        };
        reader.readAsText(file, 'UTF-8');
      });

      let result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase(),
        delimiter: ';',
      });

      if (result.errors.length > 0 || (result.data && result.data.length > 0 && Object.keys(result.data[0]).length < 2)) {
        result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim().toLowerCase(),
          delimiter: ',',
        });
      }

      if (result.errors.length > 0) {
        toast.error('Erro ao fazer o parsing do CSV. Verifique o formato.');
        console.error('Erros de parsing do CSV:', result.errors);
        return;
      }

      const requiredColumns = ['nome', 'email'];
      const fileColumns = result.meta.fields.map(f => f.toLowerCase().trim());
      const missingColumns = requiredColumns.filter(col => !fileColumns.includes(col));

      if (missingColumns.length > 0) {
        toast.error(`Colunas obrigatórias em falta no CSV: ${missingColumns.join(', ')}`);
        return;
      }

      const professoresData = result.data as any[];
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      // Otimização: Carregar matrículas existentes do tenant
      const matriculasSnapshot = await getDocs(query(collection(db, 'professores'), where('escola_id', '==', escolaAtivaId), where('matricula', '!=', '')));
      const existingMatriculas = new Set(matriculasSnapshot.docs.map(doc => doc.data().matricula));
      const matriculasInCsv = new Set();

      for (const row of professoresData) {
        try {
          if (!row.nome || !row.email) {
            errorCount++;
            continue;
          }

          const matricula = row.matricula?.trim();
          if (matricula) {
            if (existingMatriculas.has(matricula) || matriculasInCsv.has(matricula)) {
              skippedCount++;
              continue; // Pula o registro
            }
            matriculasInCsv.add(matricula);
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

          const professorData = {
            nome: row.nome.trim(),
            email: row.email.trim(),
            matricula: matricula || '',
            rg: row.rg?.trim() || '',
            cpf: row.cpf?.trim() || '',
            telefone: row.telefone?.trim() || null,
            status_funcional: row.status_funcional?.trim() || 'Lotado',
            data_lotacao: row.data_lotacao?.trim() || '',
            link_lattes: row.link_lattes?.trim() || '',
            biografia: row.biografia?.trim() || '',
            componentes: row.componentes ? row.componentes.split(',').map((d: string) => d.trim()) : [],
            series: row.series ? row.series.split(',').map((s: string) => s.trim()) : [],
            formacoes,
            ativo: row.ativo ? (row.ativo.toLowerCase() === 'true' || row.ativo === '1') : true,
            componente: row.componentes ? row.componentes.split(',')[0].trim() : '',
            escola_id: escolaAtivaId,
          };
          await addDoc(collection(db, 'professores'), professorData);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error('Erro ao importar linha:', row, error);
        }
      }

      if (successCount > 0) toast.success(`${successCount} professores importados com sucesso!`);
      if (skippedCount > 0) toast.info(`${skippedCount} professores foram ignorados por já terem uma matrícula existente.`);
      if (errorCount > 0) toast.warning(`${errorCount} linhas não puderam ser importadas. Verifique a consola para mais detalhes.`);

      fetchProfessores();
    } catch (error) {
      toast.error('Ocorreu um erro ao importar o arquivo.');
      console.error(error);
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
      const professoresQuery = query(collection(db, 'professores'), where('escola_id', '==', escolaAtivaId), orderBy('nome'));
      const querySnapshot = await getDocs(professoresQuery);
      const professoresData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          nome: data.nome || '',
          matricula: data.matricula || '',
          rg: data.rg || '',
          cpf: data.cpf || '',
          email: data.email || '',
          telefone: data.telefone || '',
          status_funcional: data.status_funcional || '',
          data_lotacao: data.data_lotacao || '',
          link_lattes: data.link_lattes || '',
          biografia: data.biografia || '',
          componentes: (data.componentes || []).join(','),
          series: (data.series || []).join(','),
          formacoes: JSON.stringify(data.formacoes || []),
          ativo: data.ativo ?? true,
          componente: data.componente || '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          bairro: data.bairro || '',
          cep: data.cep || '',
          foto_url: data.foto_url || '',
          arquivo_url: data.arquivo_url || '',
        };
      });

      const csv = Papa.unparse(professoresData, { delimiter: ';' });
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `professores_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Exportação concluída com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar professores.');
      console.error(error);
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
    { key: 'componente', header: 'componente' },
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
            <Eye className="h-4 w-4 text-blue-500" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/professores/${p.id}/editar`); }}>
            <Pencil className="h-4 w-4 text-orange-500" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDeleteDialog(p); }}>
            <Trash2 className="h-4 w-4 text-red-500" />
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

          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <>
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
            <Button onClick={() => navigate('/professores/novo')}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Professor
            </Button>
          </div>
        </div>

        <div className="mobile-safe-area">
          <DataTable columns={columns} data={professores} loading={loading} emptyMessage="Nenhum professor encontrado" />
        </div>

        {/* Dialog de Importação CSV */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar Professores via CSV</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-semibold">Instruções Importantes</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Para garantir que os acentos (ex: ç, ã, é) funcionem corretamente, salve seu arquivo no Excel com o formato <strong>"CSV UTF-8 (Delimitado por vírgulas)"</strong>.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                As colunas <strong>nome</strong> e <strong>email</strong> são obrigatórias. Use ponto e vírgula (;) como separador de campos.
              </p>
              <p className="text-sm">
                <a href="/exemplo_professores.csv" download className="text-primary hover:underline">
                  Baixar modelo CSV (recomendado)
                </a>
              </p>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImportCSV(file);
                  }
                }}
                disabled={importing}
              />
              {importing && <p className="text-sm text-muted-foreground">A importar...</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importing}>
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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