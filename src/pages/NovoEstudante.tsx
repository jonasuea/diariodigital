import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, User, Save, X, Upload, Plus, Trash2 } from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, addDoc, getDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';

const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const SEXO_OPTIONS = ['Masculino', 'Feminino', 'Outro'];
const RACA_COR_OPTIONS = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não declarada'];
const MOVIMENTACAO_OPTIONS = ['Matrícula', 'Transferência Entrada', 'Transferência Saída', 'Remanejamento', 'Reclassificação'];
const STATUS_OPTIONS = ['Frequentando', 'Transferido', 'Desistente', 'Concluído'];
const VACINACAO_OPTIONS = ['Não', '1ª Dose', '2ª Dose', '3ª Dose', '4ª Dose', '5ª Dose'];

interface Turma {
  id: string;
  nome: string;
  serie: string;
}

const initialState = {
  // Status e Informações Básicas
  status: 'Frequentando',
  matricula: '',
  nome: '',
  foto_url: '',
  // Informações Pessoais
  sexo: '',
  raca_cor: '',
  // Movimentação
  tipo_movimentacao: '',
  data_movimentacao: '',
  de_onde_veio: '',
  para_onde_vai: '',
  // Documentos e Dados Pessoais
  data_nascimento: '',
  nacionalidade: 'Brasileira',
  naturalidade: '',
  uf: '',
  rg: '',
  cpf: '',
  contato: '',
  email: '',
  // Programas Sociais
  bolsa_familia: false,
  // Censo e SUS
  censo_escola: false,
  id_censo: '',
  cartao_sus: '',
  vacinado_covid: 'Não',
  // Saúde
  estudante_pcd: false,
  estudante_aee: false,
  dieta_restritiva: false,
  // Informações Escolares
  largura_farda: '',
  altura_farda: '',
  pasta: '',
  prateleira: '',
  transporte_escolar: false,
  // Informações da Mãe
  mae_nome: '',
  mae_email: '',
  mae_contato: '',
  mae_rg: '',
  mae_cpf: '',
  // Informações do Pai
  pai_nome: '',
  pai_email: '',
  pai_contato: '',
  pai_rg: '',
  pai_cpf: '',
  // Endereço
  endereco: '',
  endereco_numero: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
  // Outros
  ano: new Date().getFullYear(),
  turma_id: null as string | null,
  // Responsável pelo estudante (extra aos dados de mãe/pai)
  responsavel_relacao: '',
  responsavel_nome: '',
  responsavel_rg: '',
  responsavel_contato: '',
  responsavel_email: '',
  responsavel_cpf: '',
  historico_academico: [] as HistoricoAnual[],
};

export default function NovoEstudante() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmasCarregadas, setTurmasCarregadas] = useState(false);
  const [formData, setFormData] = useState(initialState);

  // if responsible is mother or father, mirror their fields automatically
  useEffect(() => {
    const rel = formData.responsavel_relacao;
    if (rel === 'Mãe') {
      setFormData(prev => ({
        ...prev,
        responsavel_nome: prev.mae_nome,
        responsavel_rg: prev.mae_rg,
        responsavel_contato: prev.mae_contato,
        responsavel_email: prev.mae_email,
        responsavel_cpf: prev.mae_cpf,
      }));
    } else if (rel === 'Pai') {
      setFormData(prev => ({
        ...prev,
        responsavel_nome: prev.pai_nome,
        responsavel_rg: prev.pai_rg,
        responsavel_contato: prev.pai_contato,
        responsavel_email: prev.pai_email,
        responsavel_cpf: prev.pai_cpf,
      }));
    }
  }, [
    formData.responsavel_relacao,
    formData.mae_nome,
    formData.mae_rg,
    formData.mae_contato,
    formData.mae_email,
    formData.mae_cpf,
    formData.pai_nome,
    formData.pai_rg,
    formData.pai_contato,
    formData.pai_email,
    formData.pai_cpf,
  ]);

  // debugging helper: warn if historico becomes invalid
  useEffect(() => {
    if (!Array.isArray(formData.historico_academico)) {
      console.warn('formData.historico_academico is not an array:', formData.historico_academico);
    }
  }, [formData]);

  useEffect(() => {
    async function carregarDependencias() {
      try {
        const querySnapshot = await getDocs(collection(db, 'turmas'));
        const turmasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turma));
        setTurmas(turmasData.sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch (error) {
        console.error("Error fetching turmas: ", error);
        toast.error("Erro ao carregar a lista de turmas.");
      } finally {
        setTurmasCarregadas(true);
      }
    }
    carregarDependencias();
  }, []);

  useEffect(() => {
    // Garante que os dados do estudante só são carregados depois de as turmas estarem disponíveis
    if (isEditing && id && turmasCarregadas) {
      fetchEstudante(id);
    }
    // Garante que o formulário é resetado se navegar de uma página de edição para uma de criação
    if (!isEditing) {
      setFormData(initialState);
    }
  }, [id, isEditing, turmasCarregadas]);

  async function fetchEstudante(estudanteId: string) {
    try {
      setLoading(true);
      const estudanteDoc = await getDoc(doc(db, 'estudantes', estudanteId));
      if (estudanteDoc.exists()) {
        const estudanteData = estudanteDoc.data();
        // garante que historico_academico seja sempre array
        let historico = estudanteData.historico_academico;
        if (!Array.isArray(historico)) {
          historico = [];
        }
        // normalize cada ano para ter array de componentes
        historico = historico.map((ano: any) => ({
          ...ano,
          componentes: Array.isArray(ano.componentes)
            ? ano.componentes
            : [{ id: `disciplina_${Date.now()}`, nome: '', nota_b1: '', nota_b2: '', nota_b3: '', nota_b4: '', media_final: '' }]
        }));

        // Busca notas do estudante e mescla no histórico para preencher os campos B1-B4
        try {
          const notasSnap = await getDocs(
            query(collection(db, 'notas'), where('estudante_id', '==', id))
          );
          // Mapa: `${ano}_${componente}` → nota
          const notasMap = new Map<string, any>();
          notasSnap.docs.forEach(d => {
            const n = d.data();
            if (n.ano != null) notasMap.set(`${n.ano}_${n.componente}`, n);
          });

          if (notasMap.size > 0) {
            const fmtN = (v: number | null | undefined) => v != null ? v.toFixed(1) : '';
            historico = historico.map((ano: any) => ({
              ...ano,
              componentes: ano.componentes.map((comp: any) => {
                const key = `${ano.ano_letivo}_${comp.nome}`;
                const nota = notasMap.get(key);
                if (!nota) return comp;
                const media = (nota.bimestre_1 != null && nota.bimestre_2 != null && nota.bimestre_3 != null && nota.bimestre_4 != null)
                  ? ((nota.bimestre_1 + nota.bimestre_2 + nota.bimestre_3 + nota.bimestre_4) / 4)
                  : null;
                return {
                  ...comp,
                  nota_b1: nota.bimestre_1 != null ? fmtN(nota.bimestre_1) : (comp.nota_b1 || ''),
                  nota_b2: nota.bimestre_2 != null ? fmtN(nota.bimestre_2) : (comp.nota_b2 || ''),
                  nota_b3: nota.bimestre_3 != null ? fmtN(nota.bimestre_3) : (comp.nota_b3 || ''),
                  nota_b4: nota.bimestre_4 != null ? fmtN(nota.bimestre_4) : (comp.nota_b4 || ''),
                  media_final: nota.media_anual != null ? fmtN(nota.media_anual)
                    : (media != null ? fmtN(Math.round(media * 10) / 10) : (comp.media_final || '')),
                };
              }),
            }));
          }
        } catch (notasErr) {
          console.warn('Não foi possível carregar notas para o histórico:', notasErr);
        }

        // Combina o estado inicial com os dados carregados para garantir que todos os campos existam
        setFormData({
          ...initialState,
          ...estudanteData,
          historico_academico: historico,
          turma_id: estudanteData.turma_id || null,
          responsavel_relacao: estudanteData.responsavel_relacao || '',
          responsavel_nome: estudanteData.responsavel_nome || '',
          responsavel_rg: estudanteData.responsavel_rg || '',
          responsavel_contato: estudanteData.responsavel_contato || '',
          responsavel_email: estudanteData.responsavel_email || '',
          responsavel_cpf: estudanteData.responsavel_cpf || '',
        });
      } else {
        toast.error('Estudante não encontrado');
        navigate('/estudantes');
      }
    } catch (error) {
      toast.error('Erro ao carregar dados do estudante');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `estudante-${Date.now()}.${fileExt}`;
      const storageRef = ref(storage, `Estudantes/${fileName}`);

      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      setFormData(prev => ({ ...prev, foto_url: photoURL }));
      toast.success('Foto carregada com sucesso!');
    } catch (error) {
      toast.error('Erro ao fazer upload da foto!');
      console.error(error)
    } finally {
      setUploading(false);
    }
  }

  const handleChange = (field: string, value: string | boolean | number | null) => {
    // historico_academico deve ser manipulado apenas pelas funções específicas
    if (field === 'historico_academico') {
      console.warn('Ignorando tentativa de atualização direta de historico_academico', value);
      return;
    }
    setFormData(prevFormData => {
      const newFormData = { ...prevFormData, [field]: value };
      // Ao transferir o estudante, remove a turma do cadastro
      if (field === 'status' && value === 'Transferido') {
        newFormData.turma_id = null;
      }
      console.log(`Campo '${field}' atualizado para:`, value);
      return newFormData;
    });
  };

  // Funções para gerenciar o Histórico Acadêmico
  const addAnoHistorico = () => {
    const novoAno: HistoricoAnual = {
      id: `ano_${Date.now()}`,
      ano_letivo: new Date().getFullYear().toString(),
      serie: '',
      escola: '',
      concluido: false,
      componentes: [{
        id: `disciplina_${Date.now()}`,
        nome: '', nota_b1: '', nota_b2: '', nota_b3: '', nota_b4: '', media_final: ''
      }]
    };
    setFormData(prev => ({
      ...prev,
      historico_academico: [...(prev.historico_academico || []), novoAno]
    }));
  };

  const removeAnoHistorico = (anoId: string) => {
    setFormData(prev => ({
      ...prev,
      historico_academico: (prev.historico_academico || []).filter(ano => ano.id !== anoId)
    }));
  };

  const handleHistoricoChange = (anoId: string, field: keyof Omit<HistoricoAnual, 'id' | 'componentes' | 'concluido'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      historico_academico: (prev.historico_academico || []).map(ano =>
        ano.id === anoId ? { ...ano, [field]: value } : ano
      )
    }));
  };

  const handleHistoricoSwitchChange = (anoId: string, field: 'concluido', value: boolean) => {
    setFormData(prev => ({
      ...prev,
      historico_academico: (prev.historico_academico || []).map(ano =>
        ano.id === anoId ? { ...ano, [field]: value } : ano
      )
    }));
  };

  const addDisciplinaHistorico = (anoId: string) => {
    const novaDisciplina: HistoricoDisciplina = {
      id: `disciplina_${Date.now()}`,
      nome: '', nota_b1: '', nota_b2: '', nota_b3: '', nota_b4: '', media_final: ''
    };
    setFormData(prev => ({
      ...prev,
      historico_academico: (prev.historico_academico || []).map(ano =>
        ano.id === anoId ? { ...ano, componentes: [...ano.componentes, novaDisciplina] } : ano
      )
    }));
  };

  const removeDisciplinaHistorico = (anoId: string, disciplinaId: string) => {
    setFormData(prev => ({
      ...prev,
      historico_academico: (prev.historico_academico || []).map(ano =>
        ano.id === anoId
          ? { ...ano, componentes: ano.componentes.filter(d => d.id !== disciplinaId) }
          : ano
      )
    }));
  };

  const handleDisciplinaChange = (anoId: string, disciplinaId: string, field: keyof Omit<HistoricoDisciplina, 'id'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      historico_academico: prev.historico_academico.map(ano =>
        ano.id === anoId
          ? {
            ...ano,
            componentes: ano.componentes.map(d =>
              d.id === disciplinaId ? { ...d, [field]: value } : d
            )
          }
          : ano
      )
    }));
  };

  // Máscara decimal para campos de nota: permite apenas dígitos e ponto (0–10)
  const maskNota = (raw: string): string => {
    // Remove tudo que não seja dígito ou ponto
    let v = raw.replace(/[^0-9.]/g, '');
    // Garante apenas um ponto decimal
    const parts = v.split('.');
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    // Limita a um dígito após o ponto
    if (parts.length === 2) v = parts[0] + '.' + parts[1].slice(0, 1);
    // Limita o valor máximo a 10
    const num = parseFloat(v);
    if (!isNaN(num) && num > 10) v = '10';
    return v;
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age.toString();
  };

  const calculateCensusAge = (birthDate: string) => {
    if (!birthDate) return '';
    const censusDate = new Date(new Date().getFullYear(), 2, 31); // 31 de março
    const birth = new Date(birthDate);
    let age = censusDate.getFullYear() - birth.getFullYear();
    const monthDiff = censusDate.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && censusDate.getDate() < birth.getDate())) {
      age--;
    }
    return age.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.matricula || !formData.nome) {
      toast.error('Os campos Nome e Matrícula são obrigatórios.');
      return;
    }

    setLoading(true);

    try {
      // Verificar a unicidade da matrícula
      const q = query(collection(db, 'estudantes'), where('matricula', '==', formData.matricula));
      const querySnapshot = await getDocs(q);

      let isDuplicate = false;
      if (!querySnapshot.empty) {
        if (isEditing) {
          if (querySnapshot.docs.some(doc => doc.id !== id)) {
            isDuplicate = true;
          }
        } else {
          isDuplicate = true;
        }
      }

      if (isDuplicate) {
        toast.error('O número de matrícula já está em uso por outro estudante.');
        setLoading(false);
        return;
      }

      // Se há turma selecionada, cria automaticamente o histórico do ano vigente
      let historicoAtualizado = [...(formData.historico_academico || [])];
      if (formData.turma_id) {
        try {
          // Busca turma e nome da escola em paralelo
          const [turmaSnap, configSnap] = await Promise.all([
            getDoc(doc(db, 'turmas', formData.turma_id)),
            getDoc(doc(db, 'configuracoes', 'escola')),
          ]);

          let nomeEscola = '';
          if (configSnap.exists()) nomeEscola = configSnap.data()?.escolaConfig?.nome || '';

          if (turmaSnap.exists()) {
            const turmaData = turmaSnap.data();
            const anoAtual = new Date().getFullYear().toString();
            const serieAtual = turmaData.serie || '';

            // Verifica entrada existente para o mesmo ano e série
            const idxExistente = historicoAtualizado.findIndex(
              h => h.ano_letivo === anoAtual && h.serie === serieAtual
            );

            if (idxExistente !== -1) {
              const entradaExistente = historicoAtualizado[idxExistente];
              if (!entradaExistente.concluido) {
                // Ano não concluído: atualiza nome da escola (transferência durante o ano)
                const novoHistorico = [...historicoAtualizado];
                novoHistorico[idxExistente] = { ...entradaExistente, escola: nomeEscola };
                historicoAtualizado = novoHistorico;
              }
              // Se concluído: não altera nada
            } else {
              // Cria nova entrada de histórico
              const novaEntrada = {
                id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                ano_letivo: anoAtual,
                serie: serieAtual,
                escola: nomeEscola,
                concluido: false,
                componentes: (turmaData.componentes || []).map((c: any, i: number) => ({
                  id: `disc_${Date.now()}_${i}`,
                  nome: c.nome,
                  nota_b1: '',
                  nota_b2: '',
                  nota_b3: '',
                  nota_b4: '',
                  media_final: '',
                })),
              };
              historicoAtualizado = [...historicoAtualizado, novaEntrada];
            }
          }
        } catch (err) {
          console.warn('Não foi possível carregar a turma para o histórico automático.', err);
        }
      }

      const finalFormData = {
        ...formData,
        historico_academico: historicoAtualizado,
        nome_lower: formData.nome.toLowerCase()
      };

      if (isEditing && id) {
        await updateDoc(doc(db, 'estudantes', id), finalFormData);
        await logActivity(`atualizou o cadastro do estudante "${formData.nome}".`);
        toast.success('Estudante atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'estudantes'), finalFormData);
        await logActivity(`cadastrou o novo estudante "${formData.nome}".`);
        toast.success('Estudante cadastrado com sucesso!');
      }
      navigate('/estudantes');
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast.error('Permissão negada. Verifique as regras de segurança do Firestore.');
      } else {
        toast.error(`Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} estudante`);
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title={isEditing ? "Editar Estudante" : "Novo Estudante"}>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">
              {isEditing ? "Edite as informações do estudante" : "Cadastre um novo estudante no sistema"}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/estudantes')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Lista de Estudantes
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{isEditing ? "Editar Estudante" : "Novo Estudante"}</CardTitle>
              <span className="rounded-full px-3 py-1 text-sm font-medium bg-success/10 text-success">
                {formData.status}
              </span>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Foto do Estudante */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Foto do Estudante</h3>
                <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted mb-4 overflow-hidden">
                    {formData.foto_url ? (
                      <img src={formData.foto_url} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    type="button"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? 'Carregando...' : 'Carregar Foto'}
                  </Button>
                </div>
              </div>

              {/* Status e Informações Básicas */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Status e Informações Básicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Status do Estudante</Label>
                    <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Matrícula</Label>
                    <Input placeholder="Número da matrícula" value={formData.matricula} onChange={(e) => handleChange('matricula', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input placeholder="Nome do estudante" value={formData.nome} onChange={(e) => handleChange('nome', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Turma</Label>
                    <Select
                      value={formData.turma_id || '__none__'}
                      onValueChange={(v) => handleChange('turma_id', v === '__none__' ? null : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Sem turma —</SelectItem>
                        {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome} - {t.serie}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Informações Pessoais */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Informações Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <Select value={formData.sexo} onValueChange={(v) => handleChange('sexo', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {SEXO_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Raça/Cor/Etnia</Label>
                    <Select value={formData.raca_cor} onValueChange={(v) => handleChange('raca_cor', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {RACA_COR_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Movimentação */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Movimentação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Movimentação</Label>
                    <Select value={formData.tipo_movimentacao} onValueChange={(v) => handleChange('tipo_movimentacao', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {MOVIMENTACAO_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data da Movimentação</Label>
                    <Input type="date" value={formData.data_movimentacao} onChange={(e) => handleChange('data_movimentacao', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>De onde veio</Label>
                    <Input placeholder="Escola, Município, ..." value={formData.de_onde_veio} onChange={(e) => handleChange('de_onde_veio', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Para onde vai</Label>
                    <Input placeholder="Escola, Município, ..." value={formData.para_onde_vai} onChange={(e) => handleChange('para_onde_vai', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Documentos e Dados Pessoais */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Documentos e Dados Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Nascimento</Label>
                    <Input type="date" value={formData.data_nascimento} onChange={(e) => handleChange('data_nascimento', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Idade Atual</Label>
                    <Input value={calculateAge(formData.data_nascimento)} placeholder="Idade" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Idade Censo (31/03)</Label>
                    <Input value={calculateCensusAge(formData.data_nascimento)} placeholder="Idade para o censo" disabled />
                    <p className="text-xs text-muted-foreground">Idade calculada até 31 de março do ano vigente</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Nacionalidade</Label>
                    <Input value={formData.nacionalidade} onChange={(e) => handleChange('nacionalidade', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Naturalidade</Label>
                    <Input placeholder="Cidade de nascimento" value={formData.naturalidade} onChange={(e) => handleChange('naturalidade', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Select value={formData.uf} onValueChange={(v) => handleChange('uf', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>RG</Label>
                    <Input placeholder="RG do estudante" value={formData.rg} onChange={(e) => handleChange('rg', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input placeholder="CPF do estudante" value={formData.cpf} onChange={(e) => handleChange('cpf', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contato</Label>
                    <Input placeholder="Telefone do estudante" value={formData.contato} onChange={(e) => handleChange('contato', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="Email do estudante" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Programas Sociais */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Programas Sociais</h3>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <Label htmlFor="bolsa_familia">Recebe Bolsa Família?</Label>
                  <Switch id="bolsa_familia" checked={formData.bolsa_familia} onCheckedChange={(v) => handleChange('bolsa_familia', v)} />
                </div>
              </div>

              {/* Censo e SUS */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Censo e SUS</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <Label htmlFor="censo_escola">Está no Censo da Escola?</Label>
                    <Switch id="censo_escola" checked={formData.censo_escola} onCheckedChange={(v) => handleChange('censo_escola', v)} />
                  </div>
                  {formData.censo_escola && (
                    <div className="space-y-2">
                      <Label>ID Censo</Label>
                      <Input placeholder="ID do Censo Escolar" value={formData.id_censo} onChange={(e) => handleChange('id_censo', e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Número Cartão SUS</Label>
                    <Input placeholder="Número do Cartão SUS" value={formData.cartao_sus} onChange={(e) => handleChange('cartao_sus', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Vacinado COVID?</Label>
                  <Select value={formData.vacinado_covid} onValueChange={(v) => handleChange('vacinado_covid', v)}>
                    <SelectTrigger className="md:w-1/2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VACINACAO_OPTIONS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Saúde */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Saúde</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label htmlFor="estudante_pcd">Estudante PCD?</Label>
                      <p className="text-xs text-muted-foreground">Pessoa com Deficiência</p>
                    </div>
                    <Switch id="estudante_pcd" checked={formData.estudante_pcd} onCheckedChange={(v) => handleChange('estudante_pcd', v)} />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label htmlFor="estudante_aee">Estudante AEE?</Label>
                      <p className="text-xs text-muted-foreground">Atendimento Educacional Especializado</p>
                    </div>
                    <Switch id="estudante_aee" checked={formData.estudante_aee} onCheckedChange={(v) => handleChange('estudante_aee', v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg md:w-1/2">
                  <Label htmlFor="dieta_restritiva">O estudante tem dieta restritiva?</Label>
                  <Switch id="dieta_restritiva" checked={formData.dieta_restritiva} onCheckedChange={(v) => handleChange('dieta_restritiva', v)} />
                </div>
              </div>

              {/* Informações Escolares */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Informações Escolares</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Largura da Farda</Label>
                    <Input placeholder="Largura em cm" value={formData.largura_farda} onChange={(e) => handleChange('largura_farda', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Altura da Farda</Label>
                    <Input placeholder="Altura em cm" value={formData.altura_farda} onChange={(e) => handleChange('altura_farda', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pasta</Label>
                    <Input placeholder="Número da pasta" value={formData.pasta} onChange={(e) => handleChange('pasta', e.target.value)} />
                    <p className="text-xs text-muted-foreground">Localização da pasta física do estudante</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Prateleira</Label>
                    <Input placeholder="Localização da prateleira" value={formData.prateleira} onChange={(e) => handleChange('prateleira', e.target.value)} />
                    <p className="text-xs text-muted-foreground">Prateleira onde está arquivada a pasta</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg md:w-1/2">
                  <Label htmlFor="transporte_escolar">Transporte Escolar?</Label>
                  <Switch id="transporte_escolar" checked={formData.transporte_escolar} onCheckedChange={(v) => handleChange('transporte_escolar', v)} />
                </div>
              </div>

              {/* Informações da Mãe */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Informações da Mãe</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Mãe</Label>
                    <Input placeholder="Nome completo da mãe" value={formData.mae_nome} onChange={(e) => handleChange('mae_nome', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="Email da mãe" value={formData.mae_email} onChange={(e) => handleChange('mae_email', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contato</Label>
                    <Input placeholder="Telefone da mãe" value={formData.mae_contato} onChange={(e) => handleChange('mae_contato', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>RG</Label>
                    <Input placeholder="RG da mãe" value={formData.mae_rg} onChange={(e) => handleChange('mae_rg', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2 md:w-1/2">
                  <Label>CPF</Label>
                  <Input placeholder="CPF da mãe" value={formData.mae_cpf} onChange={(e) => handleChange('mae_cpf', e.target.value)} />
                </div>
              </div>

              {/* Informações do Pai */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Informações do Pai</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Pai</Label>
                    <Input placeholder="Nome completo do pai" value={formData.pai_nome} onChange={(e) => handleChange('pai_nome', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="Email do pai" value={formData.pai_email} onChange={(e) => handleChange('pai_email', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contato</Label>
                    <Input placeholder="Telefone do pai" value={formData.pai_contato} onChange={(e) => handleChange('pai_contato', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>RG</Label>
                    <Input placeholder="RG do pai" value={formData.pai_rg} onChange={(e) => handleChange('pai_rg', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2 md:w-1/2">
                  <Label>CPF</Label>
                  <Input placeholder="CPF do pai" value={formData.pai_cpf} onChange={(e) => handleChange('pai_cpf', e.target.value)} />
                </div>
              </div>

              {/* Informações do Responsável */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Informações do Responsável</h3>
                <div className="space-y-2 md:w-1/2">
                  <Label>Responsável</Label>
                  <Select value={formData.responsavel_relacao} onValueChange={(v) => handleChange('responsavel_relacao', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {['Estudante', 'Mãe', 'Pai', 'Avó', 'Avô', 'Tia', 'Tio'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Responsável</Label>
                    <Input placeholder="Nome completo do responsável" value={formData.responsavel_nome} onChange={(e) => handleChange('responsavel_nome', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="Email do responsável" value={formData.responsavel_email} onChange={(e) => handleChange('responsavel_email', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contato</Label>
                    <Input placeholder="Telefone do responsável" value={formData.responsavel_contato} onChange={(e) => handleChange('responsavel_contato', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>RG</Label>
                    <Input placeholder="RG do responsável" value={formData.responsavel_rg} onChange={(e) => handleChange('responsavel_rg', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2 md:w-1/2">
                  <Label>CPF</Label>
                  <Input placeholder="CPF do responsável" value={formData.responsavel_cpf} onChange={(e) => handleChange('responsavel_cpf', e.target.value)} />
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Endereço</h3>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input placeholder="Rua, Avenida, etc." value={formData.endereco} onChange={(e) => handleChange('endereco', e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nº</Label>
                    <Input placeholder="Número" value={formData.endereco_numero} onChange={(e) => handleChange('endereco_numero', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input placeholder="Bairro" value={formData.bairro} onChange={(e) => handleChange('bairro', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input placeholder="Cidade" value={formData.cidade} onChange={(e) => handleChange('cidade', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={formData.estado} onValueChange={(v) => handleChange('estado', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2 md:w-1/2">
                  <Label>CEP</Label>
                  <Input placeholder="CEP" value={formData.cep} onChange={(e) => handleChange('cep', e.target.value)} />
                </div>
              </div>

              {/* Histórico Acadêmico */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">Histórico Acadêmico</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addAnoHistorico}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Ano Letivo
                  </Button>
                </div>

                <Accordion type="multiple" className="w-full">
                  {(() => {
                    const historicoList = Array.isArray(formData.historico_academico)
                      ? formData.historico_academico
                      : [];
                    return historicoList.map((ano, index) => (
                      <AccordionItem value={ano.id} key={ano.id}>
                        <AccordionTrigger>
                          <div className="flex justify-between w-full pr-4">
                            <span>{ano.serie || `Ano Letivo ${index + 1}`} ({ano.ano_letivo})</span>
                            <span className="text-sm text-muted-foreground">{ano.escola}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="p-4 border rounded-lg space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>Ano Letivo</Label>
                                <Input value={ano.ano_letivo} onChange={(e) => handleHistoricoChange(ano.id, 'ano_letivo', e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label>Série</Label>
                                <Input placeholder="Ex: 1º Ano Fundamental" value={ano.serie} onChange={(e) => handleHistoricoChange(ano.id, 'serie', e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                <Label>Escola</Label>
                                <Input placeholder="Nome da escola" value={ano.escola} onChange={(e) => handleHistoricoChange(ano.id, 'escola', e.target.value)} />
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                              <Switch
                                id={`concluido-${ano.id}`}
                                checked={ano.concluido}
                                onCheckedChange={(checked) => handleHistoricoSwitchChange(ano.id, 'concluido', checked)}
                              />
                              <Label htmlFor={`concluido-${ano.id}`}>Ano Concluído</Label>
                            </div>

                            <div className="space-y-2 pt-4 border-t">
                              <h4 className="font-semibold text-sm">Componentes Curriculares</h4>
                              {(ano.componentes || []).map((componente) => (
                                <div key={componente.id} className="grid grid-cols-12 gap-2 items-center">
                                  <Input placeholder="componente" value={componente.nome} className="col-span-3" onChange={(e) => handleDisciplinaChange(ano.id, componente.id, 'nome', e.target.value)} />
                                  <Input placeholder="B1" value={componente.nota_b1} className="col-span-1" onChange={(e) => handleDisciplinaChange(ano.id, componente.id, 'nota_b1', maskNota(e.target.value))} inputMode="decimal" />
                                  <Input placeholder="B2" value={componente.nota_b2} className="col-span-1" onChange={(e) => handleDisciplinaChange(ano.id, componente.id, 'nota_b2', maskNota(e.target.value))} inputMode="decimal" />
                                  <Input placeholder="B3" value={componente.nota_b3} className="col-span-1" onChange={(e) => handleDisciplinaChange(ano.id, componente.id, 'nota_b3', maskNota(e.target.value))} inputMode="decimal" />
                                  <Input placeholder="B4" value={componente.nota_b4} className="col-span-1" onChange={(e) => handleDisciplinaChange(ano.id, componente.id, 'nota_b4', maskNota(e.target.value))} inputMode="decimal" />
                                  <Input placeholder="Média" value={componente.media_final} className="col-span-2" onChange={(e) => handleDisciplinaChange(ano.id, componente.id, 'media_final', maskNota(e.target.value))} inputMode="decimal" />
                                  <div className="col-span-3 flex justify-end">
                                    {ano.componentes.length > 1 && (
                                      <Button type="button" variant="ghost" size="icon" onClick={() => removeDisciplinaHistorico(ano.id, componente.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => addDisciplinaHistorico(ano.id)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar componente
                              </Button>
                            </div>
                            <div className="flex justify-end pt-4">
                              <Button type="button" variant="destructive" size="sm" onClick={() => removeAnoHistorico(ano.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remover Ano Letivo
                              </Button>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ));
                  })()}
                </Accordion>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={() => navigate('/estudantes')}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? (isEditing ? 'Atualizando...' : 'Salvando...') : (isEditing ? 'Atualizar' : 'Salvar')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}