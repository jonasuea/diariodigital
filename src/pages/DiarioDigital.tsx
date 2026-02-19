import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Users, BookOpen, ClipboardList, GraduationCap } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

interface Professor {
  id: string;
  nome: string;
}

interface Turma {
  id: string;
  nome: string;
}

export default function DiarioDigital() {
  const navigate = useNavigate();
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedProfessor, setSelectedProfessor] = useState('');
  const [selectedTurma, setSelectedTurma] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const profQuery = query(collection(db, 'professores'), where('ativo', '==', true), orderBy('nome'));
      const turmasQuery = query(collection(db, 'turmas'), orderBy('nome'));
      
      const [profSnapshot, turmasSnapshot] = await Promise.all([
        getDocs(profQuery),
        getDocs(turmasQuery),
      ]);

      setProfessores(profSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Professor)));
      setTurmas(turmasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Turma)));
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  }

  const cards = [
    {
      title: 'Frequência',
      description: 'Lançar frequência dos alunos',
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      action: () => selectedTurma && navigate(`/turmas/${selectedTurma}/frequencia`),
    },
    {
      title: 'Objetos de Conhecimento',
      description: 'Registrar conteúdos e habilidades',
      icon: BookOpen,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      action: () => {},
    },
    {
      title: 'Avaliações',
      description: 'Criar e gerenciar avaliações',
      icon: ClipboardList,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      action: () => {},
    },
    {
      title: 'Notas',
      description: 'Lançar notas e paralelas',
      icon: GraduationCap,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      action: () => selectedTurma && navigate(`/turmas/${selectedTurma}/notas`),
    },
  ];

  return (
    <AppLayout title="Diário Digital">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Gestão pedagógica completa</p>

        {/* Seleção de Professor e Turma */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-6">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Seleção de Professor e Turma</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Professor</Label>
                <Select value={selectedProfessor} onValueChange={setSelectedProfessor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um professor" />
                  </SelectTrigger>
                  <SelectContent>
                    {professores.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id.toString()}>{prof.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Turma</Label>
                <Select value={selectedTurma} onValueChange={setSelectedTurma}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma turma" />
                  </SelectTrigger>
                  <SelectContent>
                    {turmas.map((turma) => (
                      <SelectItem key={turma.id} value={turma.id.toString()}>{turma.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Ações */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Card
              key={card.title}
              className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
              onClick={card.action}
            >
              <CardContent className="pt-6 text-center">
                <div className={`w-16 h-16 rounded-full ${card.bgColor} flex items-center justify-center mx-auto mb-4`}>
                  <card.icon className={`h-8 w-8 ${card.color}`} />
                </div>
                <h4 className="font-semibold text-lg mb-2">{card.title}</h4>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}