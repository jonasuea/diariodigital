import { Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/usePWA";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { PWAHelpDialog } from "./PWAHelpDialog";

interface PWAInstallButtonProps {
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  showIconOnly?: boolean;
}

export function PWAInstallButton({ 
  className, 
  variant = "outline",
  showIconOnly = false 
}: PWAInstallButtonProps) {
  const { isInstallable, installApp, isStandalone, isSupported } = usePWA();
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // If already running as PWA, don't show the button
  if (isStandalone) {
    return null;
  }

  // If browser doesn't support PWA at all (very rare modern browsers), don't show
  if (!isSupported) {
    return null;
  }

  const handleClick = () => {
    if (isInstallable) {
      installApp();
    } else {
      setIsDialogOpen(true);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={showIconOnly ? "icon" : "default"}
        onClick={handleClick}
        className={cn(
          "transition-all duration-300 gap-2 font-semibold shadow-sm animate-in fade-in zoom-in duration-500",
          !className?.includes("bg-") && "bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground",
          !isInstallable && "opacity-80 hover:opacity-100",
          className
        )}
        title={isInstallable ? "Instalar Diário Digital" : "Como baixar o sistema"}
      >
        {isInstallable ? (
          <Download className={cn("h-4 w-4", !showIconOnly && "animate-bounce")} />
        ) : (
          <Info className="h-4 w-4" />
        )}
        {!showIconOnly && (
          <span className="hidden xs:inline">
            {isInstallable ? "Baixar Sistema" : "Como Baixar"}
          </span>
        )}
      </Button>

      <PWAHelpDialog 
        isOpen={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        onInstall={installApp}
        isInstallable={isInstallable}
      />
    </>
  );
}
