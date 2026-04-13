import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Monitor, Smartphone, MoreVertical, ShareAction, PlusSquare, ArrowRight } from "lucide-react";

interface PWAHelpDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: () => void;
  isInstallable: boolean;
}

export function PWAHelpDialog({ isOpen, onOpenChange, onInstall, isInstallable }: PWAHelpDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-primary/20 bg-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <Download className="h-6 w-6" />
            Baixar Diário Digital
          </DialogTitle>
          <DialogDescription className="text-base">
            Tenha acesso rápido e maior estabilidade offline instalando o sistema no seu dispositivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {isInstallable ? (
            <div className="bg-primary/5 p-6 rounded-xl border border-primary/10 text-center space-y-4">
              <p className="font-semibold text-primary">Seu navegador está pronto para a instalação automática!</p>
              <Button onClick={() => { onInstall(); onOpenChange(false); }} className="w-full h-12 text-lg shadow-lg">
                Instalar Agora
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 font-bold text-gray-800">
                  <Monitor className="h-5 w-5 text-blue-500" />
                  No Computador (Chrome ou Edge)
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 pl-2">
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    Clique nos três pontos <MoreVertical className="h-4 w-4 inline" /> no canto superior direito do navegador.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    Selecione <strong>"Salvar e Compartilhar"</strong> &gt; <strong>"Instalar Diário Digital"</strong>.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                    Confirme na janela que aparecerá.
                  </li>
                </ol>
              </div>

              <div className="space-y-3">
                <h4 className="flex items-center gap-2 font-bold text-gray-800">
                  <Smartphone className="h-5 w-5 text-green-500" />
                  No Celular (iPhone ou Android)
                </h4>
                <div className="grid grid-cols-1 gap-4 text-sm text-gray-600 pl-2">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="font-bold text-xs text-gray-500 uppercase mb-2">iOS (Safari)</p>
                    <p>Clique em <PlusSquare className="h-4 w-4 inline text-blue-500" /> e selecione <strong>"Adicionar à Tela de Início"</strong>.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="font-bold text-xs text-gray-500 uppercase mb-2">Android (Chrome)</p>
                    <p>Clique nos três pontos e selecione <strong>"Instalar Aplicativo"</strong>.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100">
            <p className="text-[10px] text-center text-gray-400 italic">
              O Diário Digital é um Progressive Web App (PWA) e não ocupa espaço como aplicativos tradicionais.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
