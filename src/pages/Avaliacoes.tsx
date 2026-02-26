import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileWarning } from 'lucide-react';

export default function Avaliacoes() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Avaliações</h1>
        <p className="text-muted-foreground">
          Crie e gerencie as avaliações para suas turmas.
        </p>

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
