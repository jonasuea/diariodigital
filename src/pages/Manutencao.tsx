import { Wrench } from 'lucide-react';

export default function Manutencao() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
      <div className="p-8 rounded-lg max-w-lg w-full">
        <div className="flex justify-center mb-6">
          <Wrench className="h-16 w-16 text-primary animate-bounce" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-4">Sistema em Manutenção</h1>
        <p className="text-lg text-muted-foreground">
          O Sistema EducaFácil está em manutenção para melhorar a experiência do usuário, voltaremos em breve!
        </p>
      </div>
    </div>
  );
}
