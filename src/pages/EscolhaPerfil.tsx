import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, UserCog, BookOpen, ClipboardList, User, Building2, Loader2, LogOut, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ROLE_LABELS: Record<string, string> = {
    professor: 'Professor(a)',
    gestor: 'Gestor(a)',
    pedagogo: 'Pedagogo(a)',
    secretario: 'Secretário(a)',
    admin: 'Administrador',
    responsavel: 'Responsável',
    estudante: 'Estudante',
};

const ROLE_ICONS: Record<string, React.ElementType> = {
    professor: GraduationCap,
    gestor: UserCog,
    pedagogo: BookOpen,
    secretario: ClipboardList,
    admin: User,
    responsavel: Users,
    estudante: GraduationCap,
};

const ROLE_COLORS: Record<string, { bg: string; icon: string; border: string }> = {
    professor: { bg: 'from-blue-500 to-blue-600', icon: 'bg-blue-100 text-blue-600', border: 'hover:border-blue-400' },
    gestor: { bg: 'from-purple-500 to-purple-600', icon: 'bg-purple-100 text-purple-600', border: 'hover:border-purple-400' },
    pedagogo: { bg: 'from-emerald-500 to-emerald-600', icon: 'bg-emerald-100 text-emerald-600', border: 'hover:border-emerald-400' },
    secretario: { bg: 'from-orange-500 to-orange-600', icon: 'bg-orange-100 text-orange-600', border: 'hover:border-orange-400' },
    admin: { bg: 'from-rose-500 to-rose-600', icon: 'bg-rose-100 text-rose-600', border: 'hover:border-rose-400' },
    responsavel: { bg: 'from-teal-500 to-teal-600', icon: 'bg-teal-100 text-teal-600', border: 'hover:border-teal-400' },
    estudante: { bg: 'from-sky-500 to-sky-600', icon: 'bg-sky-100 text-sky-600', border: 'hover:border-sky-400' },
};

/**
 * Mapa de redirecionamento para sistemas externos por perfil.
 * - professor e admin permanecem no Diário Digital (null = rota interna)
 * - demais perfis são redirecionados para o sistema correto
 */
const ROLE_SYSTEM_URL: Record<string, string | null> = {
    professor: null,                                  // fica no Diário Digital
    admin: null,                                      // admin acessa todos — fica aqui
    estudante: 'https://souestudante.web.app',
    responsavel: 'https://matriculaonline.web.app',
    gestor: 'https://educafacil1.web.app',
    pedagogo: 'https://educafacil1.web.app',
    secretario: 'https://educafacil1.web.app',
};

const ROLE_SYSTEM_LABEL: Record<string, string> = {
    professor: 'Diário Digital',
    admin: 'Todos os sistemas',
    estudante: 'Sou Estudante',
    responsavel: 'Matrícula Online',
    gestor: 'EducaFácil',
    pedagogo: 'EducaFácil',
    secretario: 'EducaFácil',
};

export default function EscolhaPerfil() {
    const navigate = useNavigate();
    const { availableProfiles, setActiveProfile, loading } = useUserRole();
    const { signOut } = useAuth();

    function handleSelectProfile(profile: { role: string; escola_id: string; escola_nome: string }) {
        const externalUrl = ROLE_SYSTEM_URL[profile.role];

        if (externalUrl) {
            // Redireciona para o sistema externo correto
            window.location.href = externalUrl;
        } else {
            // Permanece no Diário Digital (professor ou admin)
            setActiveProfile(profile);
            navigate('/painel', { replace: true });
        }
    }

    async function handleSignOut() {
        await signOut();
        navigate('/', { replace: true });
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col items-center justify-center p-6">
            {/* Header */}
            <div className="text-center mb-10">
                <div className="flex justify-center mb-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
                        <GraduationCap className="h-9 w-9 text-primary-foreground" />
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-foreground">Escolha seu Perfil</h1>
                <p className="mt-2 text-muted-foreground text-base">
                    Você tem <strong>{availableProfiles.length} perfis</strong> disponíveis. Selecione com qual deseja trabalhar:
                </p>
            </div>

            {/* Profile Cards */}
            <div className={`grid gap-5 w-full max-w-3xl ${availableProfiles.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                {availableProfiles.map((profile, idx) => {
                    const colors = ROLE_COLORS[profile.role] ?? ROLE_COLORS['admin'];
                    const Icon = ROLE_ICONS[profile.role] ?? User;
                    const systemLabel = ROLE_SYSTEM_LABEL[profile.role] ?? 'Sistema';
                    const isExternal = !!ROLE_SYSTEM_URL[profile.role];

                    return (
                        <button
                            key={idx}
                            onClick={() => handleSelectProfile(profile)}
                            className={`group relative flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-white p-7 text-left shadow-sm transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${colors.border} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                        >
                            {/* Gradient accent bar */}
                            <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl bg-gradient-to-r ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />

                            {/* Icon */}
                            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${colors.icon} transition-transform duration-200 group-hover:scale-110`}>
                                <Icon className="h-8 w-8" />
                            </div>

                            {/* Label */}
                            <div className="text-center">
                                <p className="text-lg font-bold text-foreground">{ROLE_LABELS[profile.role] ?? profile.role}</p>
                                <div className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                                    <span className="line-clamp-2 text-center leading-tight">{profile.escola_nome || 'Escola não informada'}</span>
                                </div>
                                {/* Badge do sistema de destino */}
                                <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gradient-to-r ${colors.bg} text-white`}>
                                    {isExternal ? '↗ ' : ''}{systemLabel}
                                </div>
                            </div>

                            {/* CTA */}
                            <span className={`mt-1 text-sm font-semibold bg-gradient-to-r ${colors.bg} bg-clip-text text-transparent opacity-0 group-hover:opacity-100 transition-opacity`}>
                                {isExternal ? 'Ir para o sistema →' : 'Acessar →'}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Sign out */}
            <Button
                variant="ghost"
                className="mt-10 text-muted-foreground hover:text-destructive"
                onClick={handleSignOut}
            >
                <LogOut className="h-4 w-4 mr-2" />
                Sair da conta
            </Button>
        </div>
    );
}
