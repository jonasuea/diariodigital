import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { School, Mail, Phone, MapPin, Clock, Bell, Shield, Wrench, User, Building } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export default function Configuracoes() {
  const { user } = useAuth();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isInstalacoesOpen, setIsInstalacoesOpen] = useState(false);
  
  const [escolaConfig, setEscolaConfig] = useState({
    nome: 'Escola Estadual Maria da Silva',
    email: 'contato@escolamaria.edu.br',
    telefone: '(11) 3456-7890',
    endereco: 'Rua das Flores, 123 - São Paulo',
    horarioFuncionamento: 'Segunda a Sexta, 7h às 18h',
  });

  const [instalacoes, setInstalacoes] = useState({
    salasAula: 12,
    laboratorios: 3,
    banheiros: 6,
    cantina: 1,
    biblioteca: 1,
    quadras: 2,
    secretaria: 1,
    salaProfessores: 1,
  });

  const [preferencias, setPreferencias] = useState({
    notificacoes: true,
    autenticacaoDoisFatores: false,
    modoManutencao: false,
  });

  const [profileData, setProfileData] = useState({
    nome: 'Admin',
    email: user?.email || 'admin@escola.com',
    telefone: '(11) 98765-4321',
    cargo: 'Administrador',
    novaSenha: '',
    confirmarSenha: '',
  });

  const handleSaveEscola = () => {
    toast.success('Informações da escola salvas com sucesso!');
  };

  const handleSaveInstalacoes = () => {
    toast.success('Instalações atualizadas com sucesso!');
    setIsInstalacoesOpen(false);
  };

  const handleSaveProfile = () => {
    if (profileData.novaSenha && profileData.novaSenha !== profileData.confirmarSenha) {
      toast.error('As senhas não coincidem');
      return;
    }
    toast.success('Perfil atualizado com sucesso!');
    setIsEditProfileOpen(false);
    setProfileData(prev => ({ ...prev, novaSenha: '', confirmarSenha: '' }));
  };

  return (
    <AppLayout title="Configurações">
      <div className="space-y-6 animate-fade-in">
        <p className="text-muted-foreground -mt-2">Gerencie as configurações do sistema</p>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações da Escola */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Informações da Escola</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome da Escola</Label>
                    <div className="flex items-center gap-2">
                      <School className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={escolaConfig.nome}
                        onChange={(e) => setEscolaConfig({ ...escolaConfig, nome: e.target.value })}
                        className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={escolaConfig.email}
                        onChange={(e) => setEscolaConfig({ ...escolaConfig, email: e.target.value })}
                        className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Telefone</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={escolaConfig.telefone}
                        onChange={(e) => setEscolaConfig({ ...escolaConfig, telefone: e.target.value })}
                        className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Endereço</Label>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={escolaConfig.endereco}
                        onChange={(e) => setEscolaConfig({ ...escolaConfig, endereco: e.target.value })}
                        className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Horário de Funcionamento</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={escolaConfig.horarioFuncionamento}
                      onChange={(e) => setEscolaConfig({ ...escolaConfig, horarioFuncionamento: e.target.value })}
                      className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-0"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveEscola} className="mt-2">
                  Salvar Alterações
                </Button>
              </CardContent>
            </Card>

            {/* Instalações da Escola */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Instalações da Escola</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setIsInstalacoesOpen(true)}>
                    <Building className="h-4 w-4 mr-2" />
                    Gerenciar Instalações
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Salas de Aula</p>
                      <p className="text-2xl font-bold">{instalacoes.salasAula}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Laboratórios</p>
                      <p className="text-2xl font-bold">{instalacoes.laboratorios}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Banheiros</p>
                      <p className="text-2xl font-bold">{instalacoes.banheiros}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Cantina</p>
                      <p className="text-2xl font-bold">{instalacoes.cantina}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Biblioteca</p>
                      <p className="text-2xl font-bold">{instalacoes.biblioteca}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Quadras</p>
                      <p className="text-2xl font-bold">{instalacoes.quadras}</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Preferências do Sistema */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Preferências do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Notificações</p>
                      <p className="text-sm text-muted-foreground">
                        Receber notificações de eventos e atividades
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={preferencias.notificacoes}
                    onCheckedChange={(checked) => setPreferencias({ ...preferencias, notificacoes: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Autenticação em Dois Fatores</p>
                      <p className="text-sm text-muted-foreground">
                        Aumenta a segurança da sua conta
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={preferencias.autenticacaoDoisFatores}
                    onCheckedChange={(checked) => setPreferencias({ ...preferencias, autenticacaoDoisFatores: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Modo de Manutenção</p>
                      <p className="text-sm text-muted-foreground">
                        Sistema disponível apenas para administradores
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={preferencias.modoManutencao}
                    onCheckedChange={(checked) => setPreferencias({ ...preferencias, modoManutencao: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar direita */}
          <div className="space-y-6">
            {/* Informações da Conta */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Informações da Conta</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center text-center">
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold mb-4">
                  {profileData.nome.substring(0, 2).toUpperCase()}
                </div>
                <h3 className="font-semibold text-lg">{profileData.nome}</h3>
                <p className="text-sm text-muted-foreground mb-4">{profileData.email}</p>
                <Button variant="outline" className="w-full" onClick={() => setIsEditProfileOpen(true)}>
                  Editar Perfil
                </Button>
              </CardContent>
            </Card>

            {/* Versão do Sistema */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Versão do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Versão Atual</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Última Atualização</span>
                  <span className="font-medium">30/06/2023</span>
                </div>
                <Button variant="outline" className="w-full mt-2">
                  Verificar Atualizações
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dialog Editar Perfil */}
        <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Perfil</DialogTitle>
              <DialogDescription>
                Atualize suas informações pessoais abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-nome">Nome</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-nome"
                    className="pl-10"
                    value={profileData.nome}
                    onChange={(e) => setProfileData({ ...profileData, nome: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-email"
                    type="email"
                    className="pl-10"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-telefone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-telefone"
                    className="pl-10"
                    value={profileData.telefone}
                    onChange={(e) => setProfileData({ ...profileData, telefone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-cargo">Cargo</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="profile-cargo"
                    className="pl-10"
                    value={profileData.cargo}
                    onChange={(e) => setProfileData({ ...profileData, cargo: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-senha">Nova Senha</Label>
                <Input
                  id="profile-senha"
                  type="password"
                  placeholder="Deixe em branco para não alterar"
                  value={profileData.novaSenha}
                  onChange={(e) => setProfileData({ ...profileData, novaSenha: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-confirmar-senha">Confirmar Nova Senha</Label>
                <Input
                  id="profile-confirmar-senha"
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={profileData.confirmarSenha}
                  onChange={(e) => setProfileData({ ...profileData, confirmarSenha: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditProfileOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveProfile}>
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Gerenciar Instalações */}
        <Dialog open={isInstalacoesOpen} onOpenChange={setIsInstalacoesOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gerenciar Instalações da Escola</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salasAula">Salas de Aula</Label>
                <Input
                  id="salasAula"
                  type="number"
                  value={instalacoes.salasAula}
                  onChange={(e) => setInstalacoes({ ...instalacoes, salasAula: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="laboratorios">Laboratórios</Label>
                <Input
                  id="laboratorios"
                  type="number"
                  value={instalacoes.laboratorios}
                  onChange={(e) => setInstalacoes({ ...instalacoes, laboratorios: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banheiros">Banheiros</Label>
                <Input
                  id="banheiros"
                  type="number"
                  value={instalacoes.banheiros}
                  onChange={(e) => setInstalacoes({ ...instalacoes, banheiros: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cantina">Cantina</Label>
                <Input
                  id="cantina"
                  type="number"
                  value={instalacoes.cantina}
                  onChange={(e) => setInstalacoes({ ...instalacoes, cantina: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biblioteca">Biblioteca</Label>
                <Input
                  id="biblioteca"
                  type="number"
                  value={instalacoes.biblioteca}
                  onChange={(e) => setInstalacoes({ ...instalacoes, biblioteca: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quadras">Quadras</Label>
                <Input
                  id="quadras"
                  type="number"
                  value={instalacoes.quadras}
                  onChange={(e) => setInstalacoes({ ...instalacoes, quadras: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretaria">Secretaria</Label>
                <Input
                  id="secretaria"
                  type="number"
                  value={instalacoes.secretaria}
                  onChange={(e) => setInstalacoes({ ...instalacoes, secretaria: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salaProfessores">Sala dos Professores</Label>
                <Input
                  id="salaProfessores"
                  type="number"
                  value={instalacoes.salaProfessores}
                  onChange={(e) => setInstalacoes({ ...instalacoes, salaProfessores: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsInstalacoesOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveInstalacoes}>
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
