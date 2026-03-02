import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Building2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';

const ZONA_OPTIONS = ['Urbana', 'Rural - Várzea', 'Rural - Terra Firme'];

const initialState = {
    // Identificação principal
    inep: '',
    nome: '',
    decreto_criacao: '',
    email: '',
    telefone: '',
    zona: '',
    endereco: '',
    horario_funcionamento: '',
    // Estrutura física
    salas_aula: '',
    laboratorios: '',
    banheiros: '',
    cantina: '',
    biblioteca: '',
    quadras: '',
};

export default function NovaEscola() {
    const navigate = useNavigate();
    const { id } = useParams(); // 'id' will receive the 'inep' when editing
    const isEditing = !!id;

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState(initialState);
    const [initialInep, setInitialInep] = useState('');

    useEffect(() => {
        if (isEditing && id) {
            loadEscolaData(id);
        }
    }, [id, isEditing]);

    const loadEscolaData = async (escolaInep: string) => {
        setLoading(true);
        try {
            const docRef = doc(db, 'escolas', escolaInep);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                setFormData({
                    ...initialState,
                    ...data,
                    inep: docSnap.id // Ensures INEP maps to document ID
                });
                setInitialInep(docSnap.id);
            } else {
                toast.error('Escola não encontrada');
                navigate('/escolas');
            }
        } catch (error) {
            console.error('Erro ao carregar escola:', error);
            toast.error('Erro ao carregar dados da escola');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: string, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.inep || !formData.nome) {
            toast.error('Campos INEP e Nome da Escola são obrigatórios');
            return;
        }

        setLoading(true);
        try {
            // Usaremos o próprio INEP como ID do documento
            const docId = formData.inep.trim();
            const escolaRef = doc(db, 'escolas', docId);

            const dataToSave = {
                inep: docId,
                nome: formData.nome,
                decreto_criacao: formData.decreto_criacao,
                email: formData.email,
                telefone: formData.telefone,
                zona: formData.zona,
                endereco: formData.endereco,
                horario_funcionamento: formData.horario_funcionamento,
                salas_aula: formData.salas_aula,
                laboratorios: formData.laboratorios,
                banheiros: formData.banheiros,
                cantina: formData.cantina,
                biblioteca: formData.biblioteca,
                quadras: formData.quadras,
                atualizado_em: new Date().toISOString()
            };

            if (isEditing) {
                // Se mudou o INEP, cria um novo e exclui o antigo? 
                // Em regras gerais, INEP não deveria mudar, mas caso necessário tratamos a alteração de chave
                if (docId !== initialInep) {
                    // Cria o novo documento e copia dados
                    await setDoc(escolaRef, {
                        ...dataToSave,
                        criado_em: new Date().toISOString() // presumes new
                    });
                    // Warning: Ideal approach requires deeper re-referencing, mas aqui focamos na criação/edição básica do doc
                    toast.warning('O INEP foi modificado. Um novo registro foi criado.');
                } else {
                    await updateDoc(escolaRef, dataToSave);
                }
                await logActivity(`Edição de Escola: Escola ${formData.nome} (INEP: ${docId}) foi atualizada`);
                toast.success('Escola atualizada com sucesso!');
            } else {
                // Verifica se já existe
                const docExist = await getDoc(escolaRef);
                if (docExist.exists()) {
                    toast.error('Já existe uma escola cadastrada com este INEP.');
                    setLoading(false);
                    return;
                }

                await setDoc(escolaRef, {
                    ...dataToSave,
                    criado_em: new Date().toISOString()
                });
                await logActivity(`Cadastro de Escola: Nova escola ${formData.nome} cadastrada (INEP: ${docId})`);
                toast.success('Escola cadastrada com sucesso!');
            }

            navigate('/escolas');
        } catch (error) {
            console.error('Erro ao salvar escola:', error);
            toast.error('Erro ao salvar os dados. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout title={isEditing ? 'Editar Escola' : 'Nova Escola'}>
            <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Building2 className="h-6 w-6 text-primary" />
                        <h2 className="text-3xl font-bold tracking-tight">
                            {isEditing ? 'Editar Escola' : 'Cadastrar Escola'}
                        </h2>
                    </div>
                    <div className="flex space-x-2">
                        <Button variant="outline" onClick={() => navigate('/escolas')}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Voltar
                        </Button>
                        <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                            <Save className="mr-2 h-4 w-4" />
                            {loading ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Identificação</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="inep">INEP*</Label>
                                    <Input
                                        id="inep"
                                        placeholder="Código INEP"
                                        value={formData.inep}
                                        onChange={(e) => handleChange('inep', e.target.value)}
                                        disabled={isEditing}
                                    />
                                    {isEditing && <p className="text-xs text-muted-foreground">O INEP não pode ser modificado. Em caso de erro, exclua a escola e recadastre.</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="decreto_criacao">Decreto de Criação</Label>
                                    <Input
                                        id="decreto_criacao"
                                        placeholder="Ex: Decreto nº 123/2022"
                                        value={formData.decreto_criacao}
                                        onChange={(e) => handleChange('decreto_criacao', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2 lg:col-span-2">
                                    <Label htmlFor="nome">Nome da Escola*</Label>
                                    <Input id="nome" placeholder="Ex: Escola Municipal..." value={formData.nome} onChange={(e) => handleChange('nome', e.target.value)} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="zona">Zona</Label>
                                    <Select value={formData.zona} onValueChange={(value) => handleChange('zona', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ZONA_OPTIONS.map((zona) => (
                                                <SelectItem key={zona} value={zona}>{zona}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">E-mail</Label>
                                    <Input id="email" type="email" placeholder="contato@escola.com" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="telefone">Telefone / Contato</Label>
                                    <Input id="telefone" placeholder="(00) 0000-0000" value={formData.telefone} onChange={(e) => handleChange('telefone', e.target.value)} />
                                </div>

                                <div className="space-y-2 lg:col-span-2">
                                    <Label htmlFor="endereco">Endereço Completo</Label>
                                    <Input id="endereco" placeholder="Ex: Rua XYZ, Bairro, Cidade-UF" value={formData.endereco} onChange={(e) => handleChange('endereco', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="horario_funcionamento">Horário de Funcionamento</Label>
                                    <Input id="horario_funcionamento" placeholder="Ex: 07:00 às 17:00" value={formData.horario_funcionamento} onChange={(e) => handleChange('horario_funcionamento', e.target.value)} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Estrutura Física</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="salas_aula">Salas de Aula (Qtd)</Label>
                                    <Input id="salas_aula" type="number" min="0" placeholder="Ex: 10" value={formData.salas_aula} onChange={(e) => handleChange('salas_aula', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="laboratorios">Laboratórios (Qtd)</Label>
                                    <Input id="laboratorios" type="number" min="0" placeholder="Ex: 2" value={formData.laboratorios} onChange={(e) => handleChange('laboratorios', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="banheiros">Banheiros (Qtd)</Label>
                                    <Input id="banheiros" type="number" min="0" placeholder="Ex: 4" value={formData.banheiros} onChange={(e) => handleChange('banheiros', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cantina">Cantina / Refeitório (Qtd)</Label>
                                    <Input id="cantina" type="number" min="0" placeholder="Ex: 1" value={formData.cantina} onChange={(e) => handleChange('cantina', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="biblioteca">Biblioteca (Qtd)</Label>
                                    <Input id="biblioteca" type="number" min="0" placeholder="Ex: 1" value={formData.biblioteca} onChange={(e) => handleChange('biblioteca', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="quadras">Quadras Poliesportivas (Qtd)</Label>
                                    <Input id="quadras" type="number" min="0" placeholder="Ex: 1" value={formData.quadras} onChange={(e) => handleChange('quadras', e.target.value)} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </main>
        </AppLayout>
    );
}
