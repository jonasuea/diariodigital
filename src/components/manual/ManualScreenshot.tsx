import React, { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface ManualScreenshotProps {
    sectionId: string;
    placeholder: string;
}

export function ManualScreenshot({ sectionId, placeholder }: ManualScreenshotProps) {
    const { isAdmin } = useUserRole();
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const docRef = doc(db, 'configuracoes', 'manual');

        // Usamos onSnapshot para atualização em tempo real se o admin trocar a imagem
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data[sectionId]) {
                    setImageUrl(data[sectionId]);
                }
            }
            setLoading(false);
        }, (error) => {
            console.error("Sem permissão para buscar imagem do manual:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [sectionId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Por favor, selecione um arquivo de imagem.');
            return;
        }

        setUploading(true);
        try {
            const storageRef = ref(storage, `manual/screenshots/${sectionId}_${Date.now()}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            // Salva a URL no Firestore
            const docRef = doc(db, 'configuracoes', 'manual');
            await setDoc(docRef, {
                [sectionId]: url
            }, { merge: true });

            setImageUrl(url);
            toast.success('Imagem enviada com sucesso!');
        } catch (error) {
            console.error('Erro no upload:', error);
            toast.error('Sem permissão para enviar imagem.');
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = async () => {
        if (!window.confirm('Tem certeza que deseja remover esta imagem?')) return;

        try {
            const docRef = doc(db, 'configuracoes', 'manual');
            await setDoc(docRef, {
                [sectionId]: null
            }, { merge: true });
            setImageUrl(null);
            toast.success('Imagem removida.');
        } catch (error) {
            console.error('Sem permissão para remover:', error);
            toast.error('Sem permissão para remover imagem.');
        }
    };

    if (loading) {
        return (
            <Card className="bg-muted/30 border-dashed animate-pulse">
                <CardContent className="py-12 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="relative group">
            {imageUrl ? (
                <div className="space-y-2">
                    <div className="rounded-lg overflow-hidden border shadow-sm bg-background">
                        <img
                            src={imageUrl}
                            alt={`Manual - ${sectionId}`}
                            className="w-full h-auto max-h-[500px] object-contain"
                        />
                    </div>
                    {isAdmin && (
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={handleRemove} className="text-destructive hover:bg-destructive/10">
                                <X className="h-4 w-4 mr-2" /> Remover
                            </Button>
                            <Label htmlFor={`upload-${sectionId}`} className="cursor-pointer">
                                <div className="flex items-center gap-2 bg-primary text-primary-foreground h-9 px-3 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                                    <Upload className="h-4 w-4" /> {uploading ? 'Enviando...' : 'Trocar Imagem'}
                                </div>
                                <input
                                    id={`upload-${sectionId}`}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleUpload}
                                    disabled={uploading}
                                />
                            </Label>
                        </div>
                    )}
                </div>
            ) : (
                <Card className="bg-muted/50 border-dashed relative overflow-hidden">
                    <CardContent className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                {placeholder}
                            </p>

                            {isAdmin && (
                                <div className="mt-4">
                                    <Label htmlFor={`upload-${sectionId}`} className="cursor-pointer">
                                        <div className="flex items-center gap-2 bg-primary text-primary-foreground h-10 px-4 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                                            <Upload className="h-4 w-4" /> {uploading ? 'Enviando...' : 'Inserir Imagem'}
                                        </div>
                                        <input
                                            id={`upload-${sectionId}`}
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleUpload}
                                            disabled={uploading}
                                        />
                                    </Label>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// Pequeno hack para usar Label sem importar tudo
function Label({ children, htmlFor, className }: { children: React.ReactNode, htmlFor: string, className?: string }) {
    return (
        <label htmlFor={htmlFor} className={className}>
            {children}
        </label>
    );
}
