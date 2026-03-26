import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { printElement } from '@/lib/print-utils';

export interface Questao {
  id: string;
  tipo: 'objetiva' | 'descritiva';
  enunciado: string;
  imagemUrl?: string;
  alternativas?: string[];
  respostaCorreta?: string;
  valor?: number;
}

interface ProvaPDFDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avaliacao: {
    titulo: string;
    tipo: string;
    valor: number;
    bimestre: string;
  };
  turma: {
    nome: string;
    serie: string;
    turno: string;
  };
  escolaInfo: {
    nome: string;
    inep: string;
    decreto: string;
  };
  questoes: Questao[];
}

export function ProvaPDFDialog({
  open,
  onOpenChange,
  avaliacao,
  turma,
  escolaInfo,
  questoes
}: ProvaPDFDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (printRef.current) {
      printElement(printRef.current);
    }
  };

  const dataAtual = new Date().toLocaleDateString('pt-BR');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-none shadow-2xl [&>button]:hidden">

        <div ref={printRef} className="print-container p-8 bg-white text-black min-h-screen">
          {/* Cabeçalho */}
          <div className="border border-black p-4 mb-6">
            <h1 className="text-center font-bold text-xl uppercase mb-4 border-b border-black pb-2">
              {escolaInfo.nome || 'NOME DA ESCOLA'}
            </h1>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">INEP:</span>
                <span>{escolaInfo.inep || '---'}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">DECRETO:</span>
                <span>{escolaInfo.decreto || '---'}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">SÉRIE:</span>
                <span>{turma.serie || '---'}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">TURMA:</span>
                <span>{turma.nome || '---'}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">TURNO:</span>
                <span>{turma.turno || '---'}</span>
              </div>
              <div className="flex border-b border-black pb-1">
                <span className="font-bold mr-2">DATA DE EMISSÃO:</span>
                <span>{dataAtual}</span>
              </div>
            </div>

            <div className="mt-4 bg-orange-100/50 p-2 border border-black text-center font-bold uppercase">
              {avaliacao.titulo} - {avaliacao.bimestre} Bimentre ({avaliacao.valor} pontos)
            </div>
          </div>

          {/* Dados do Aluno para preenchimento */}
          <div className="border border-black p-4 mb-6">
            <div className="flex gap-4 pb-2 mb-2 border-b border-black">
              <div className="flex items-baseline gap-2 w-auto">
                <span className="font-bold">Nº:</span>
                <span className="w-20 border-b-2 border-dotted border-gray-500">&nbsp;</span>
              </div>
              <div className="flex items-baseline gap-2 flex-1">
                <span className="font-bold">DATA:</span>
                <span className="flex-1 border-b-2 border-dotted border-gray-500">&nbsp;</span>
              </div>
              <div className="flex items-baseline gap-2 w-auto">
                <span className="font-bold">NOTA:</span>
                <span className="w-32 border-b-2 border-dotted border-gray-500">&nbsp;</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2 pt-2">
              <span className="font-bold mr-2">ESTUDANTE:</span>
              <span className="flex-1 border-b-2 border-dotted border-gray-500">&nbsp;</span>
            </div>
          </div>

          {/* Questões */}
          <div className="columns-2 gap-8">
            {questoes.length === 0 ? (
              <p className="text-center italic text-gray-500 py-10 break-inside-avoid">Nenhuma questão adicionada à avaliação.</p>
            ) : (
              questoes.map((questao, index) => (
                <div key={questao.id} className="text-sm mb-6 break-inside-avoid">
                  <div className="flex gap-2 font-medium mb-2">
                    <span className="whitespace-nowrap">{index + 1})</span>
                    <div className="whitespace-pre-wrap">{questao.enunciado}</div>
                  </div>

                  {questao.imagemUrl && (
                    <div className="my-4 ml-6">
                      <img src={questao.imagemUrl} alt="Questão" className="max-w-md max-h-64 object-contain" />
                    </div>
                  )}

                  <div className="ml-6 space-y-2 mt-3">
                    {questao.tipo === 'objetiva' && questao.alternativas ? (
                      questao.alternativas.map((alt, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span>{String.fromCharCode(97 + i)})</span>
                          <span>( {` `} ) {alt}</span>
                        </div>
                      ))
                    ) : (
                      <div className="space-y-8 mt-4">
                        <div className="border-b border-black"></div>
                        <div className="border-b border-black"></div>
                        <div className="border-b border-black"></div>
                        <div className="border-b border-black"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Buttons (Sticky at bottom) */}
        <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-3 no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
            <X className="h-4 w-4" /> Fechar
          </Button>
          <Button onClick={handlePrint} disabled={questoes.length === 0} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Printer className="h-4 w-4" /> Imprimir Avaliação
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
