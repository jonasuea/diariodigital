import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, ShieldOff, Loader2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import {
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface TwoFactorSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEnabled: boolean;
  onStatusChange: (enabled: boolean) => void;
}

export function TwoFactorSetupDialog({ open, onOpenChange, isEnabled, onStatusChange }: TwoFactorSetupDialogProps) {
  const [step, setStep] = useState<'idle' | 'phone' | 'verify'>('idle');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  function initRecaptcha() {
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
    if (!recaptchaContainerRef.current) return null;
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
      size: 'invisible',
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  }

  async function handleSendCode() {
    const user = auth.currentUser;
    if (!user) return;
    if (!phoneNumber.trim()) {
      toast.error('Digite um número de telefone válido.');
      return;
    }
    setLoading(true);
    try {
      const verifier = initRecaptcha();
      if (!verifier) throw new Error('reCAPTCHA não inicializado.');
      const session = await multiFactor(user).getSession();
      const phoneInfoOptions = { phoneNumber: phoneNumber.trim(), session };
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const id = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, verifier);
      setVerificationId(id);
      setStep('verify');
      toast.success('Código enviado por SMS!');
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-phone-number'
        ? 'Número de telefone inválido. Use o formato +55 11 99999-9999.'
        : err.code === 'auth/requires-recent-login'
        ? 'Por segurança, faça login novamente antes de ativar o 2FA.'
        : 'Erro ao enviar SMS: ' + err.message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndEnroll() {
    if (verificationCode.length !== 6) {
      toast.error('Digite o código de 6 dígitos recebido por SMS.');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      const assertion = PhoneMultiFactorGenerator.assertion(credential);
      await multiFactor(user).enroll(assertion, 'Telefone');
      toast.success('Autenticação de dois fatores ativada!');
      onStatusChange(true);
      handleClose();
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-verification-code'
        ? 'Código inválido. Verifique o SMS e tente novamente.'
        : 'Erro ao verificar código: ' + err.message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    try {
      const enrolled = multiFactor(user).enrolledFactors;
      if (enrolled.length > 0) {
        await multiFactor(user).unenroll(enrolled[0]);
      }
      toast.success('Autenticação de dois fatores desativada.');
      onStatusChange(false);
      handleClose();
    } catch (err: any) {
      toast.error('Erro ao desativar 2FA: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setStep('idle');
    setPhoneNumber('');
    setVerificationCode('');
    setVerificationId('');
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Autenticação de Dois Fatores (2FA)
          </DialogTitle>
          <DialogDescription>
            {isEnabled
              ? 'Seu 2FA está ativo via SMS.'
              : 'Proteja sua conta com verificação por SMS.'}
          </DialogDescription>
        </DialogHeader>

        {/* reCAPTCHA invisível */}
        <div ref={recaptchaContainerRef} />

        {/* Ativo — opção de desativar */}
        {step === 'idle' && isEnabled && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">2FA Ativo</p>
                <p className="text-xs text-green-700">Sua conta está protegida com verificação por SMS.</p>
              </div>
              <Badge className="ml-auto bg-green-100 text-green-800 border-green-300">Ativo</Badge>
            </div>
            <Button variant="destructive" onClick={handleDisable} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldOff className="h-4 w-4 mr-2" />}
              Desativar 2FA
            </Button>
          </div>
        )}

        {/* Inativo — iniciar configuração */}
        {step === 'idle' && !isEnabled && (
          <div className="space-y-4 py-2">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Como funciona:</p>
              <p>1. Informe seu número de celular com DDD e código do país.</p>
              <p>2. Você receberá um SMS com um código de 6 dígitos.</p>
              <p>3. Digite o código para confirmar e ativar o 2FA.</p>
            </div>
            <Button onClick={() => setStep('phone')} className="w-full">
              <Phone className="h-4 w-4 mr-2" />
              Configurar via SMS
            </Button>
          </div>
        )}

        {/* Digitar telefone */}
        {step === 'phone' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Número de celular</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+55 92 99999-9999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Inclua o código do país. Ex: +55 para Brasil.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('idle')} disabled={loading} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleSendCode} disabled={loading || !phoneNumber.trim()} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enviar SMS
              </Button>
            </div>
          </div>
        )}

        {/* Verificar código */}
        {step === 'verify' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Digite o código de <strong>6 dígitos</strong> enviado para <strong>{phoneNumber}</strong>:
            </p>
            <div className="space-y-2">
              <Label htmlFor="sms-code">Código SMS</Label>
              <Input
                id="sms-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('phone')} disabled={loading} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleVerifyAndEnroll} disabled={loading || verificationCode.length !== 6} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ativar 2FA
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
