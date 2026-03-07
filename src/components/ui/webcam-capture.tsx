import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Camera, RefreshCw, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface WebcamCaptureProps {
    onCapture: (file: File) => void;
    trigger?: React.ReactNode;
}

export function WebcamCapture({ onCapture, trigger }: WebcamCaptureProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setCapturedImage(null);
        } catch (err) {
            console.error("Sem permissão para acessar webcam:", err);
            toast.error("Não foi possível acessar a webcam. Verifique as permissões.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            startCamera();
        } else {
            stopCamera();
        }
    };

    const capturePhoto = useCallback(() => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (context) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                setCapturedImage(dataUrl);
                stopCamera();
            }
        }
    }, [stream]);

    const savePhoto = () => {
        if (capturedImage) {
            // Converter dataUrl para File
            fetch(capturedImage)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onCapture(file);
                    setIsOpen(false);
                });
        }
    };

    const retake = () => {
        startCamera();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" type="button">
                        <Camera className="h-4 w-4 mr-2" />
                        Tirar Foto
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Capturar Foto</DialogTitle>
                </DialogHeader>

                <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                    {!capturedImage ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <img
                            src={capturedImage}
                            alt="Captura"
                            className="w-full h-full object-cover"
                        />
                    )}

                    <canvas ref={canvasRef} className="hidden" />
                </div>

                <DialogFooter className="flex sm:justify-between gap-2">
                    {!capturedImage ? (
                        <>
                            <Button variant="ghost" onClick={() => setIsOpen(false)} type="button">
                                Cancelar
                            </Button>
                            <Button onClick={capturePhoto} type="button" className="gap-2">
                                <Camera className="h-4 w-4" />
                                Capturar
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={retake} type="button" className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Refazer
                            </Button>
                            <Button onClick={savePhoto} type="button" className="gap-2 bg-success hover:bg-success/90">
                                <Check className="h-4 w-4" />
                                Confirmar e Salvar
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
