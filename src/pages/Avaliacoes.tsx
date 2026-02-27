import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileWarning, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Avaliacoes() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Avaliações</h1>
            <p className="text-muted-foreground">
              Crie e gerencie as avaliações para suas turmas.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/diario-digital')} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para o Diário
          </Button>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Em Breve</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-md">
              <FileWarning className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-muted-foreground">
                Módulo de Avaliações em Desenvolvimento
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Esta funcionalidade será implementada em breve.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
