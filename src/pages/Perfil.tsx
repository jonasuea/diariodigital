import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { doc, getDoc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { toast } from 'sonner';
import { logActivity } from '@/lib/logger';
import { Camera, Loader2 } from 'lucide-react';

interface ProfileData {
  nome: string;
  email: string;
  foto_url: string | null;
}

export default function Perfil() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [nome, setNome] = useState('');
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEditProfile = role === 'admin';

  useEffect(() => {
    async function fetchProfile() {
      if (!user || !role) return;
      setLoading(true);
      try {
        let userProfileData: ProfileData | null = null;
        
        // Para perfis com cadastro específico (gestor, professor, etc.), busca primeiro lá.
        if (['gestor', 'pedagogo', 'secretario', 'professor'].includes(role)) {
          const collectionName = role === 'professor' ? 'professores' : 'equipe_gestora';
          const q = query(collection(db, collectionName), where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            userProfileData = {
              nome: data.nome,
              email: data.email,
              foto_url: data.foto_url || null,
            };
          }
        }

        // Se não encontrou ou para outros perfis (admin), busca no perfil geral 'profiles'.
        if (!userProfileData) {
          const profileDocRef = doc(db, 'profiles', user.uid);
          const profileDoc = await getDoc(profileDocRef);
          if (profileDoc.exists()) {
            const data = profileDoc.data();
            userProfileData = {
              nome: data.nome,
              email: user.email || 'N/A',
              foto_url: data.foto_url || null,
            };
          }
        }

        if (userProfileData) {
          setProfile(userProfileData);
          setNome(userProfileData.nome);
        } else {
            // Fallback caso não encontre perfil em lugar nenhum.
            const fallbackName = user.displayName || user.email || 'Usuário';
            setProfile({
                nome: fallbackName,
                email: user.email || 'N/A',
                foto_url: user.photoURL || null
            });
            setNome(fallbackName);
        }

      } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        toast.error("Não foi possível carregar seu perfil.");
      } finally {
        setLoading(false);
      }
    }

    if (user && role) {
      fetchProfile();
    } else if (!user) {
      setLoading(false);
    }
  }, [user, role]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!user || !canEditProfile) return;
    setSaving(true);

    try {
      let newFotoUrl = profile?.foto_url;

      if (newAvatarFile) {
        const storageRef = ref(storage, `avatars/${user.uid}/${newAvatarFile.name}`);
        const snapshot = await uploadBytes(storageRef, newAvatarFile);
        newFotoUrl = await getDownloadURL(snapshot.ref);
      }

      const profileDocRef = doc(db, 'profiles', user.uid);
      await updateDoc(profileDocRef, {
        nome: nome,
        foto_url: newFotoUrl,
      });

      setProfile(prev => prev ? { ...prev, nome: nome, foto_url: newFotoUrl } : null);
      setNewAvatarFile(null);
      setPreviewUrl(null);
      await logActivity(`atualizou suas informações de perfil (nome e/ou foto).`);
      toast.success("Perfil atualizado com sucesso!");

    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      toast.error("Erro ao salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Meu Perfil">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout title="Meu Perfil">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Não foi possível carregar as informações do perfil.</p>
        </div>
      </AppLayout>
    );
  }

  const avatarSrc = previewUrl || profile.foto_url;
  const fallbackName = profile.nome.split(' ').map(n => n[0]).slice(0, 2).join('');

  return (
    <AppLayout title="Meu Perfil">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações do Perfil</CardTitle>
            <CardDescription>
              {canEditProfile 
                ? "Visualize e edite suas informações de perfil."
                : "Visualize suas informações de perfil. Para editar, contate um administrador."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarSrc || undefined} />
                  <AvatarFallback className="text-3xl bg-muted">
                    {fallbackName}
                  </AvatarFallback>
                </Avatar>
                {canEditProfile && (
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="absolute bottom-0 right-0 rounded-full h-8 w-8"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg"
                onChange={handleAvatarChange}
                disabled={!canEditProfile}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} disabled={!canEditProfile || saving} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile.email} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Perfil de Acesso</Label>
              <Input id="role" value={role?.charAt(0).toUpperCase() + role?.slice(1) || 'N/A'} disabled />
            </div>

            {canEditProfile && (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Alterações
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}