import { Wrench } from 'lucide-react';

interface MaintenancePageProps {
    message?: string;
}

export function MaintenancePage({ message = 'Sistema em manutenção. Retornaremos em breve.' }: MaintenancePageProps) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
            <div className="max-w-md w-full text-center space-y-6">
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center">
                        <Wrench className="w-12 h-12 text-amber-500" />
                    </div>
                </div>

                {/* Title */}
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">
                        Em Manutenção
                    </h1>
                    <p className="mt-3 text-muted-foreground text-base leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Decoration bar */}
                <div className="flex justify-center gap-2 pt-4">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
                </div>

                <p className="text-xs text-muted-foreground/50 uppercase tracking-widest font-medium">
                    Matrículas Online — SEMED Itacoatiara
                </p>
            </div>
        </div>
    );
}
