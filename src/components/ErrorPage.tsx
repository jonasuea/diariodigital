import { useRouteError, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react';

export default function ErrorPage() {
    const error: any = useRouteError();
    const navigate = useNavigate();

    console.error('Routing Error:', error);

    const errorMessage = error?.statusText || error?.message || 'Ocorreu um erro inesperado';

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-900">
            <div className="w-full max-w-md text-center space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="flex justify-center">
                    <div className="p-4 bg-red-100 rounded-full">
                        <AlertTriangle className="h-12 w-12 text-red-600" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ops! Algo deu errado.</h1>
                    <p className="text-slate-500">
                        Não conseguimos processar esta página no momento.
                    </p>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <p className="text-sm font-mono text-slate-600 break-words">
                        {errorMessage}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                    <Button
                        onClick={() => window.location.reload()}
                        variant="default"
                        className="gap-2"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Tentar Novamente
                    </Button>
                    <Button
                        onClick={() => navigate('/')}
                        variant="outline"
                        className="gap-2"
                    >
                        <Home className="h-4 w-4" />
                        Voltar ao Início
                    </Button>
                </div>

                <p className="text-xs text-slate-400">
                    Se o problema persistir, entre em contato com o suporte técnico.
                </p>
            </div>
        </div>
    );
}
