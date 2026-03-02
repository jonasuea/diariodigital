import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import {
    LayoutDashboard,
    Users,
    School,
    BookOpen,
    FileText,
    Settings,
    Info,
    Calendar,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';

export default function ManualUso() {
    return (
        <AppLayout title="Manual de Uso">
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
                <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground">
                        Bem-vindo ao guia oficial do sistema EducaFácil. Aqui você encontrará instruções detalhadas sobre como utilizar cada módulo do sistema.
                    </p>
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4 flex gap-3 text-blue-700">
                        <Info className="h-5 w-5 flex-shrink-0" />
                        <p className="text-sm italic">
                            Nota: As capturas de tela mencionadas neste manual devem ser inseridas pelo administrador para refletir a versão mais recente da interface.
                        </p>
                    </div>
                </div>

                <Accordion type="single" collapsible className="w-full space-y-4">

                    {/* 1. Painel Inicial */}
                    <AccordionItem value="painel" className="border rounded-lg bg-card px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                                <LayoutDashboard className="h-5 w-5 text-primary" />
                                <span className="text-lg font-semibold">1. Painel (Dashboard)</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <p>O Painel é a tela inicial onde você tem uma visão geral dos indicadores da escola ou de suas turmas.</p>
                            <ul className="list-disc ml-6 space-y-2">
                                <li><strong>Métricas:</strong> Visualize o total de estudantes, turmas e professores.</li>
                                <li><strong>Gráficos:</strong> Acompanhe o desempenho geral e a frequência do mês.</li>
                                <li><strong>Atalhos:</strong> Acesse rapidamente as funcionalidades mais usadas.</li>
                            </ul>
                            <Card className="bg-muted/50 border-dashed">
                                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                    [IMAGEM: Print da tela do Painel Inicial mostrando os cartões de métricas e gráficos de pizza/barra]
                                </CardContent>
                            </Card>
                        </AccordionContent>
                    </AccordionItem>

                    {/* 2. Gestão de Estudantes */}
                    <AccordionItem value="estudantes" className="border rounded-lg bg-card px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                                <Users className="h-5 w-5 text-primary" />
                                <span className="text-lg font-semibold">2. Gestão de Estudantes</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <p>Módulo para gerenciar toda a vida escolar do estudante, desde a matrícula até a emissão de documentos.</p>

                            <div className="space-y-2">
                                <h4 className="font-medium flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Matrícula e Edição
                                </h4>
                                <p className="text-sm ml-6">Para matricular um novo aluno, acesse "Estudantes" e clique em "Novo Estudante". Preencha os dados pessoais, de endereço e filiação.</p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-medium flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Perfil do Estudante
                                </h4>
                                <p className="text-sm ml-6">No perfil, você encontra o histórico, notas consolidadas e botões rápidos para emissão de documentos como: <strong>Termo de Trajeto, Uso de Imagem e Declaração de Matrícula</strong>.</p>
                            </div>

                            <Card className="bg-muted/50 border-dashed">
                                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                    [IMAGEM: Print do Perfil do Estudante destacando o cabeçalho com os novos botões de documentos]
                                </CardContent>
                            </Card>
                        </AccordionContent>
                    </AccordionItem>

                    {/* 3. Turmas e Diário Digital */}
                    <AccordionItem value="diario" className="border rounded-lg bg-card px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                                <BookOpen className="h-5 w-5 text-primary" />
                                <span className="text-lg font-semibold">3. Turmas e Diário Digital</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <p>Este é o coração do trabalho docente. Onde são registradas as frequências, conteúdos e avaliações.</p>

                            <div className="space-y-4">
                                <div className="bg-muted p-3 rounded-md">
                                    <h4 className="font-bold text-sm mb-1 uppercase">Frequência</h4>
                                    <p className="text-sm">Selecione a turma, data e componente curricular. Clique nos nomes para marcar faltas ou presenças em lote.</p>
                                </div>

                                <div className="bg-muted p-3 rounded-md">
                                    <h4 className="font-bold text-sm mb-1 uppercase">Notas Parciais (Novo)</h4>
                                    <p className="text-sm">Agora é possível lançar avaliações (AV1, AV2...) individualmente por bimestre. O sistema calcula a média bimestral automaticamente ao sincronizar com o boletim principal.</p>
                                </div>

                                <div className="bg-muted p-3 rounded-md">
                                    <h4 className="font-bold text-sm mb-1 uppercase">Objetos de Conhecimento</h4>
                                    <p className="text-sm">Registre o que foi lecionado em cada aula, selecionando o bimestre correspondente.</p>
                                </div>
                            </div>

                            <Card className="bg-muted/50 border-dashed">
                                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                    [IMAGEM: Print da tela de Notas Parciais mostrando as colunas AV1 a AV4 e o botão de Sincronizar]
                                </CardContent>
                            </Card>
                        </AccordionContent>
                    </AccordionItem>

                    {/* 4. Relatórios e Documentos */}
                    <AccordionItem value="relatorios" className="border rounded-lg bg-card px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-primary" />
                                <span className="text-lg font-semibold">4. Relatórios e Documentos</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <p>O sistema permite a geração de diversos documentos oficiais em formato PDF/Impressão HTML.</p>

                            <ul className="list-disc ml-6 space-y-2">
                                <li><strong>Documentos do Estudante:</strong> Declaração de Matrícula, Termo de Uso de Imagem, Autorização de Trajeto e Comparecimento.</li>
                                <li><strong>Relatórios Administrativos:</strong> Ata Final de Resultados, Lotação, P.S.E e Contato de Pais.</li>
                                <li><strong>Acadêmicos:</strong> Boletins, Mapas de Notas e Diários de Frequência.</li>
                            </ul>

                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 flex gap-3 text-yellow-800">
                                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                <p className="text-sm italic">
                                    <strong>Dica:</strong> Na página de Relatórios, use a busca por Ano &gt; Turma &gt; Estudante para localizar rapidamente quem precisa do documento.
                                </p>
                            </div>

                            <Card className="bg-muted/50 border-dashed">
                                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                    [IMAGEM: Print da página de Relatórios com a lista de Documentos e Termos do Estudante]
                                </CardContent>
                            </Card>
                        </AccordionContent>
                    </AccordionItem>

                    {/* 5. Configurações e Administração */}
                    <AccordionItem value="config" className="border rounded-lg bg-card px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                                <Settings className="h-5 w-5 text-primary" />
                                <span className="text-lg font-semibold">5. Configurações e Administração</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <p>Acesso restrito a gestores e administradores para manutenção do sistema.</p>
                            <ul className="list-disc ml-6 space-y-2">
                                <li><strong>Minha Escola:</strong> Altere nome, INEP, logotipo e assinatura do gestor que aparecerá nos documentos.</li>
                                <li><strong>Usuários:</strong> Gerencie acessos de professores, secretários e equipe gestora.</li>
                                <li><strong>Calendário:</strong> Defina dias letivos, feriados e reuniões (isso impacta nos cálculos de frequência).</li>
                            </ul>
                            <Card className="bg-muted/50 border-dashed">
                                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                    [IMAGEM: Print da tela de Usuários mostrando as permissões/cargos de cada membro]
                                </CardContent>
                            </Card>
                        </AccordionContent>
                    </AccordionItem>

                </Accordion>

                <div className="text-center pt-8 border-t">
                    <p className="text-sm text-muted-foreground italic flex items-center justify-center gap-2">
                        EducaFácil - Sistema de Gestão Escolar Inteligente © {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </AppLayout>
    );
}
