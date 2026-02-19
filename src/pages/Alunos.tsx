import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, Eye, Upload, Download } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { useUserRole } from '@/hooks/useUserRole';

interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  ano: number;
  status: string;
  turma_id: string | null;
  turma_nome?: string;
}

export default function Alunos() {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [alunoToDelete, setAlunoToDelete] = useState<Aluno | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchAlunos();
  }, [search]);

  async function fetchAlunos() {
    setLoading(true);
    try {
      // NOTE: Firestore queries are case-sensitive. For case-insensitive search,
      // you would typically store a lowercase version of the field to search on.
      let alunosQuery = query(collection(db, 'alunos'), orderBy('nome'));

      if (search) {
        // Firestore does not support OR queries on different fields directly.
        // A common workaround is to perform separate queries and merge the results.
        // For simplicity here, we will search by name first, and if no results, by matricula.
        // A better solution for complex search is using a dedicated search service like Algolia.
        const searchQuery = query(collection(db, 'alunos'), where('nome', '>=', search), where('nome', '<=', search + '\uf8ff'));
        const querySnapshot = await getDocs(searchQuery);
        if (!querySnapshot.empty) {
          alunosQuery = searchQuery;
        } else {
          alunosQuery = query(collection(db, 'alunos'), where('matricula', '>=', search), where('matricula', '<=', search + '\uf8ff'));
        }
      }

      const querySnapshot = await getDocs(alunosQuery);
      const alunosData = await Promise.all(querySnapshot.docs.map(async (doc) => {
        const alunoData = doc.data() as Omit<Aluno, 'id' | 'turma_nome'>;
        let turma_nome: string | undefined = '-';

        if (alunoData.turma_id) {
          const turmaDocRef = doc(db, 'turmas', alunoData.turma_id);
          const turmaDoc = await getDoc(turmaDocRef);
          if (turmaDoc.exists()) {
            turma_nome = turmaDoc.data().nome;
          }
        }
        
        return {
          id: doc.id,
          ...alunoData,
          turma_nome,
        };
      }));

      setAlunos(alunosData);
    } catch (error) {
      toast.error('Erro ao carregar alunos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function openDeleteDialog(aluno: Aluno) {
    setAlunoToDelete(aluno);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!alunoToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'alunos', alunoToDelete.id));
      toast.success('Aluno excluído com sucesso!');
      setDeleteDialogOpen(false);
      setAlunoToDelete(null);
      fetchAlunos();
    } catch (error) {
      toast.error('Erro ao excluir aluno');
      console.error(error);
    }
  }

  async function handleImportCSV(file: File) {
    setImporting(true);
    try {
      // Validar tipo do arquivo
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Por favor, selecione um arquivo CSV válido.');
        return;
      }

      // Validar tamanho do arquivo (máximo 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error('O arquivo é muito grande. Tamanho máximo permitido: 10MB.');
        return;
      }

      const text = await file.text();

      // Verificar se o arquivo não está vazio
      if (!text.trim()) {
        toast.error('O arquivo CSV está vazio.');
        return;
      }

      // Tentar primeiro com ponto e vírgula (padrão brasileiro/Excel)
      let result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase(),
        delimiter: ';', // Padrão brasileiro/Excel
        dynamicTyping: false,
      });

      // Se não conseguiu parsear corretamente, tentar com vírgula
      if (result.errors.length > 0 || (result.data && result.data.length > 0 && Object.keys(result.data[0]).length < 5)) {
        result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim().toLowerCase(),
          delimiter: ',', // Fallback para vírgula
          dynamicTyping: false,
        });
      }

      // Verificar erros de parsing
      if (result.errors.length > 0) {
        console.error('=== DETALHES DOS ERROS DE PARSING CSV ===');
        result.errors.forEach((err, index) => {
          console.error(`Erro ${index + 1}:`, {
            linha: err.row + 1,
            tipo: err.type,
            codigo: err.code,
            mensagem: err.message,
            preview: text.split('\n')[err.row]?.substring(0, 100) + '...'
          });
        });

        // Categorizar tipos de erro
        const delimiterErrors = result.errors.filter(err => err.code === 'UndetectableDelimiter' || err.code === 'TooFewFields');
        const missingFieldsErrors = result.errors.filter(err => err.type === 'FieldMismatch' && err.code !== 'TooFewFields');

        let errorMessage = 'Erros encontrados no arquivo CSV:\n';

        if (delimiterErrors.length > 0) {
          errorMessage += '• Problema de separador: Use ponto e vírgula (;) como separador (formato Excel brasileiro)\n';
          errorMessage += '• Dica: Abra o arquivo no Excel e salve como CSV, ou use o Bloco de Notas para verificar se os campos estão separados por ponto e vírgula\n';
        }

        if (missingFieldsErrors.length > 0) {
          errorMessage += '• Campos ausentes em algumas linhas\n';
        }

        // Adicionar mensagens específicas
        const specificErrors = result.errors.slice(0, 3).map(err =>
          `• Linha ${err.row + 1}: ${err.message}`
        ).join('\n');

        errorMessage += specificErrors;

        if (result.errors.length > 3) {
          errorMessage += `\n• ...e mais ${result.errors.length - 3} erros`;
        }

        toast.error(errorMessage);
        return;
      }

      // Verificar se há dados após parsing
      if (!result.data || result.data.length === 0) {
        toast.error('O arquivo CSV não contém dados válidos após o cabeçalho.');
        return;
      }

      // Verificar se há dados após parsing
      if (!result.data || result.data.length === 0) {
        toast.error('O arquivo CSV não contém dados válidos após o cabeçalho.');
        return;
      }

      const alunosData = result.data as any[];

      // Verificar colunas obrigatórias
      const firstRow = result.data[0] as any;
      if (!firstRow || typeof firstRow !== 'object') {
        toast.error('Formato de dados inválido. Verifique se o arquivo tem cabeçalhos corretos.');
        return;
      }

      const availableColumns = Object.keys(firstRow).map(col => col.toLowerCase().trim());

      const requiredColumns = ['nome', 'matricula'];
      const missingColumns = requiredColumns.filter(col => !availableColumns.includes(col));

      if (missingColumns.length > 0) {
        toast.error(`Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}\nColunas disponíveis: ${availableColumns.join(', ')}`);
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      let errorMessages: string[] = [];

      for (let i = 0; i < alunosData.length; i++) {
        const row = alunosData[i];
        const rowNumber = i + 2; // +2 porque header é linha 1 e array começa em 0

        try {
          // Validações básicas
          const nome = (row.nome || '').toString().trim();
          const matricula = (row.matricula || '').toString().trim();

          if (!nome) {
            errorMessages.push(`Linha ${rowNumber}: Campo 'nome' é obrigatório`);
            errorCount++;
            continue;
          }

          if (!matricula) {
            errorMessages.push(`Linha ${rowNumber}: Campo 'matricula' é obrigatório`);
            errorCount++;
            continue;
          }

          // Validar formato da data se presente
          let dataNascimento = null;
          if (row.data_nascimento) {
            const dataStr = row.data_nascimento.toString().trim();
            if (dataStr) {
              // Aceitar formatos YYYY-MM-DD ou DD/MM/YYYY
              const dateRegex = /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/;
              if (!dateRegex.test(dataStr)) {
                errorMessages.push(`Linha ${rowNumber}: Data '${dataStr}' deve estar no formato YYYY-MM-DD ou DD/MM/YYYY`);
                errorCount++;
                continue;
              }

              // Converter DD/MM/YYYY para YYYY-MM-DD se necessário
              if (dataStr.includes('/')) {
                const [dia, mes, ano] = dataStr.split('/');
                dataNascimento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
              } else {
                dataNascimento = dataStr;
              }

              // Validar se é uma data válida
              const date = new Date(dataNascimento);
              if (isNaN(date.getTime())) {
                errorMessages.push(`Linha ${rowNumber}: Data '${dataStr}' não é uma data válida`);
                errorCount++;
                continue;
              }
            }
          }

          // Validar ano
          let ano = new Date().getFullYear();
          if (row.ano) {
            const anoStr = row.ano.toString().trim();
            if (anoStr) {
              const anoParsed = parseInt(anoStr);
              if (isNaN(anoParsed)) {
                errorMessages.push(`Linha ${rowNumber}: Ano '${anoStr}' deve ser um número`);
                errorCount++;
                continue;
              }
              if (anoParsed < 2000 || anoParsed > 2030) {
                errorMessages.push(`Linha ${rowNumber}: Ano ${anoParsed} deve estar entre 2000 e 2030`);
                errorCount++;
                continue;
              }
              ano = anoParsed;
            }
          }

          // Validar matrícula (apenas números e letras)
          if (!/^[A-Za-z0-9]+$/.test(matricula)) {
            errorMessages.push(`Linha ${rowNumber}: Matrícula '${matricula}' deve conter apenas letras e números`);
            errorCount++;
            continue;
          }

          // Mapeamento dos dados
          const alunoData = {
            // Status e Informações Básicas
            status: (row.status || 'Frequentando').toString().trim() || 'Frequentando',
            matricula,
            nome,
            foto_url: row.foto_url ? row.foto_url.toString().trim() : null,
            // Informações Pessoais
            sexo: row.sexo ? row.sexo.toString().trim() : null,
            raca_cor: row.raca_cor ? row.raca_cor.toString().trim() : null,
            // Movimentação
            tipo_movimentacao: row.tipo_movimentacao ? row.tipo_movimentacao.toString().trim() : null,
            data_movimentacao: row.data_movimentacao ? row.data_movimentacao.toString().trim() : null,
            de_onde_veio: row.de_onde_veio ? row.de_onde_veio.toString().trim() : null,
            para_onde_vai: row.para_onde_vai ? row.para_onde_vai.toString().trim() : null,
            // Documentos e Dados Pessoais
            data_nascimento: dataNascimento,
            nacionalidade: row.nacionalidade ? row.nacionalidade.toString().trim() : 'Brasileira',
            naturalidade: row.naturalidade ? row.naturalidade.toString().trim() : null,
            uf: row.uf ? row.uf.toString().trim() : null,
            rg: row.rg ? row.rg.toString().trim() : null,
            cpf: row.cpf ? row.cpf.toString().trim() : null,
            // Programas Sociais
            bolsa_familia: row.bolsa_familia ? Boolean(row.bolsa_familia) : false,
            // Censo e SUS
            censo_escola: row.censo_escola ? Boolean(row.censo_escola) : false,
            id_censo: (row.censo_escola ? Boolean(row.censo_escola) : false) && row.id_censo ? row.id_censo.toString().trim() : null,
            cartao_sus: row.cartao_sus ? row.cartao_sus.toString().trim() : null,
            vacinado_covid: (() => {
              const vacinacaoValue = row.vacinado_covid ? row.vacinado_covid.toString().trim() : 'Não';
              const validOptions = ['Não', '1ª Dose', '2ª Dose', '3ª Dose', '4ª Dose', '5ª Dose'];
              return validOptions.includes(vacinacaoValue) ? vacinacaoValue : 'Não';
            })(),
            // Saúde
            aluno_pcd: row.aluno_pcd ? Boolean(row.aluno_pcd) : false,
            aluno_aee: row.aluno_aee ? Boolean(row.aluno_aee) : false,
            dieta_restritiva: row.dieta_restritiva ? Boolean(row.dieta_restritiva) : false,
            // Informações Escolares
            largura_farda: row.largura_farda ? row.largura_farda.toString().trim() : null,
            altura_farda: row.altura_farda ? row.altura_farda.toString().trim() : null,
            pasta: row.pasta ? row.pasta.toString().trim() : null,
            prateleira: row.prateleira ? row.prateleira.toString().trim() : null,
            transporte_escolar: row.transporte_escolar ? Boolean(row.transporte_escolar) : false,
            // Informações da Mãe
            mae_nome: row.mae_nome ? row.mae_nome.toString().trim() : null,
            mae_email: row.mae_email ? row.mae_email.toString().trim() : null,
            mae_contato: row.mae_contato ? row.mae_contato.toString().trim() : null,
            mae_rg: row.mae_rg ? row.mae_rg.toString().trim() : null,
            mae_cpf: row.mae_cpf ? row.mae_cpf.toString().trim() : null,
            // Informações do Pai
            pai_nome: row.pai_nome ? row.pai_nome.toString().trim() : null,
            pai_email: row.pai_email ? row.pai_email.toString().trim() : null,
            pai_contato: row.pai_contato ? row.pai_contato.toString().trim() : null,
            pai_rg: row.pai_rg ? row.pai_rg.toString().trim() : null,
            pai_cpf: row.pai_cpf ? row.pai_cpf.toString().trim() : null,
            // Endereço
            endereco: row.endereco ? row.endereco.toString().trim() : null,
            endereco_numero: row.endereco_numero ? row.endereco_numero.toString().trim() : null,
            bairro: row.bairro ? row.bairro.toString().trim() : null,
            cidade: row.cidade ? row.cidade.toString().trim() : null,
            estado: row.estado ? row.estado.toString().trim() : null,
            cep: row.cep ? row.cep.toString().trim() : null,
            // Outros
            ano,
            turma_id: row.turma_id ? row.turma_id.toString().trim() : null,
          };

          await addDoc(collection(db, 'alunos'), alunoData);
          successCount++;
        } catch (error) {
          errorMessages.push(`Linha ${rowNumber}: Erro ao salvar - ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          errorCount++;
          console.error(`Erro na linha ${rowNumber}:`, error);
        }
      }

      // Mostrar resultado
      if (successCount > 0) {
        toast.success(`${successCount} alunos importados com sucesso!`);
      }

      if (errorCount > 0) {
        const maxErrorsToShow = 5;
        const errorSummary = errorMessages.slice(0, maxErrorsToShow).join('\n');
        const remainingErrors = errorMessages.length - maxErrorsToShow;

        let errorMessage = `${errorCount} erros encontrados:\n${errorSummary}`;
        if (remainingErrors > 0) {
          errorMessage += `\n...e mais ${remainingErrors} erros`;
        }

        toast.error(errorMessage);
      }

      setImportDialogOpen(false);
      fetchAlunos();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao processar arquivo: ${errorMessage}`);
      console.error('Erro geral na importação:', error);
    } finally {
      setImporting(false);
    }
  }

  async function handleExportCSV() {
    try {
      // Buscar todos os alunos sem filtros para exportação completa
      const alunosQuery = query(collection(db, 'alunos'), orderBy('nome'));
      const querySnapshot = await getDocs(alunosQuery);
      
      const alunosData = await Promise.all(querySnapshot.docs.map(async (doc) => {
        const alunoData = doc.data() as Omit<Aluno, 'id' | 'turma_nome'>;
        let turma_nome: string | undefined = '';

        if (alunoData.turma_id) {
          const turmaDocRef = doc(db, 'turmas', alunoData.turma_id);
          const turmaDoc = await getDoc(turmaDocRef);
          if (turmaDoc.exists()) {
            turma_nome = turmaDoc.data().nome;
          }
        }
        
        return {
          // Status e Informações Básicas
          status: alunoData.status || '',
          matricula: alunoData.matricula || '',
          nome: alunoData.nome || '',
          foto_url: alunoData.foto_url || '',
          // Informações Pessoais
          sexo: alunoData.sexo || '',
          raca_cor: alunoData.raca_cor || '',
          // Movimentação
          tipo_movimentacao: alunoData.tipo_movimentacao || '',
          data_movimentacao: alunoData.data_movimentacao || '',
          de_onde_veio: alunoData.de_onde_veio || '',
          para_onde_vai: alunoData.para_onde_vai || '',
          // Documentos e Dados Pessoais
          data_nascimento: alunoData.data_nascimento || '',
          nacionalidade: alunoData.nacionalidade || '',
          naturalidade: alunoData.naturalidade || '',
          uf: alunoData.uf || '',
          rg: alunoData.rg || '',
          cpf: alunoData.cpf || '',
          // Programas Sociais
          bolsa_familia: alunoData.bolsa_familia || false,
          // Censo e SUS
          censo_escola: alunoData.censo_escola || false,
          id_censo: alunoData.id_censo || '',
          cartao_sus: alunoData.cartao_sus || '',
          vacinado_covid: alunoData.vacinado_covid || '',
          // Saúde
          aluno_pcd: alunoData.aluno_pcd || false,
          aluno_aee: alunoData.aluno_aee || false,
          dieta_restritiva: alunoData.dieta_restritiva || false,
          // Informações Escolares
          largura_farda: alunoData.largura_farda || '',
          altura_farda: alunoData.altura_farda || '',
          pasta: alunoData.pasta || '',
          prateleira: alunoData.prateleira || '',
          transporte_escolar: alunoData.transporte_escolar || false,
          // Informações da Mãe
          mae_nome: alunoData.mae_nome || '',
          mae_email: alunoData.mae_email || '',
          mae_contato: alunoData.mae_contato || '',
          mae_rg: alunoData.mae_rg || '',
          mae_cpf: alunoData.mae_cpf || '',
          // Informações do Pai
          pai_nome: alunoData.pai_nome || '',
          pai_email: alunoData.pai_email || '',
          pai_contato: alunoData.pai_contato || '',
          pai_rg: alunoData.pai_rg || '',
          pai_cpf: alunoData.pai_cpf || '',
          // Endereço
          endereco: alunoData.endereco || '',
          endereco_numero: alunoData.endereco_numero || '',
          bairro: alunoData.bairro || '',
          cidade: alunoData.cidade || '',
          estado: alunoData.estado || '',
          cep: alunoData.cep || '',
          // Outros
          ano: alunoData.ano || new Date().getFullYear(),
          turma_id: alunoData.turma_id || '',
          turma_nome: turma_nome || '',
        };
      }));

      // Gerar CSV com ponto e vírgula (formato Excel brasileiro)
      const csv = Papa.unparse(alunosData, {
        delimiter: ';'
      });

      // Adicionar BOM UTF-8 para garantir que caracteres acentuados sejam exibidos corretamente
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csv;

      // Criar blob e download
      const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `alunos_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Arquivo CSV exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar arquivo CSV');
      console.error(error);
    }
  }

  const columns = [
    { key: 'nome', header: 'Nome' },
    { key: 'matricula', header: 'Matrícula' },
    { key: 'ano', header: 'Ano' },
    { key: 'turma_nome', header: 'Turma', render: (aluno: Aluno) => aluno.turma_nome || '-' },
    { 
      key: 'status', 
      header: 'Status',
      render: (aluno: Aluno) => (
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          aluno.status === 'Ativo' || aluno.status === 'Frequentando' ? 'bg-success/10 text-success' :
          aluno.status === 'Inativo' || aluno.status === 'Desistente' ? 'bg-muted text-muted-foreground' :
          'bg-warning/10 text-warning'
        }`}>
          {aluno.status}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (aluno: Aluno) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/alunos/${aluno.id}`); }}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/alunos/${aluno.id}/editar`); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDeleteDialog(aluno); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout title="Alunos">
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou matrícula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex gap-2">
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
            <Button onClick={() => navigate('/alunos/novo')}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Aluno
            </Button>
          </div>
        </div>

        <DataTable columns={columns} data={alunos} loading={loading} emptyMessage="Nenhum aluno encontrado" />

        {/* Dialog de Importação CSV */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar Alunos via CSV</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecione um arquivo CSV com os dados dos alunos. O arquivo deve conter as seguintes colunas:
                nome, matricula, data_nascimento, status, endereco, bairro, cidade, estado, telefone, mae_nome, mae_contato, mae_email, pai_nome, pai_contato, pai_email, largura_farda, altura_farda, pasta, prateleira, turma_id, ano.
                A coluna turma_nome é opcional e será gerada automaticamente se não estiver presente.
                <br />
                <strong>Use ponto e vírgula (;) como separador de campos.</strong>
                <br />
                <em>Nota: O arquivo exportado usa UTF-8 com BOM, garantindo que acentos sejam exibidos corretamente no Excel.</em>
              </p>
              <p className="text-sm">
                <a href="/exemplo_alunos.csv" download className="text-primary hover:underline">
                  Baixar exemplo CSV (recomendado)
                </a>
                {' | '}
                <a href="/exemplo_alunos_com_erros.csv" download className="text-orange-600 hover:underline">
                  Baixar exemplo com erros (para teste)
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
              {importing && <p className="text-sm text-muted-foreground">Importando alunos...</p>}
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
                Tem certeza que deseja excluir o aluno "{alunoToDelete?.nome}"? 
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