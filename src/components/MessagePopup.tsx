import { useMessage } from '@/contexts/MessageContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function MessagePopup() {
    const { currentMessage, open, handleRead } = useMessage();

    if (!currentMessage) return null;

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent
                className="max-w-md sm:rounded-2xl border-primary/20 shadow-2xl"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader className="flex flex-col items-center text-center pb-4 border-b">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Bell className="h-6 w-6 text-primary animate-bounce" />
                    </div>
                    <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
                        Nova Mensagem Recebida
                    </DialogTitle>
                    <DialogDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-1">
                        De: {currentMessage.remetente_nome}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                    <h3 className="font-bold text-lg mb-2 text-foreground">{currentMessage.assunto}</h3>
                    <div className="bg-muted/30 p-4 rounded-xl text-sm leading-relaxed text-foreground whitespace-pre-wrap max-h-[300px] overflow-y-auto border">
                        {currentMessage.conteudo}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-4 text-right">
                        Enviada em {currentMessage.data_envio?.toDate ? format(currentMessage.data_envio.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
                    </p>
                </div>

                <DialogFooter className="sm:justify-center pt-2">
                    <Button
                        onClick={handleRead}
                        className="w-full h-12 gap-2 font-bold text-base shadow-lg transition-all hover:scale-[1.02]"
                    >
                        <CheckCircle2 className="h-5 w-5" /> LI E ESTOU CIENTE
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
