import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
    { code: 'pt-BR', label: 'PT-BR', flag: '🇧🇷' },
    { code: 'en', label: 'EN', flag: '🇺🇸' },
    { code: 'es', label: 'ES', flag: '🇪🇸' },
];

export function LanguageSelector() {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0];

    const handleSelect = (code: string) => {
        i18n.changeLanguage(code);
        setOpen(false);
    };

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 text-sm font-semibold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full hover:bg-muted transition-colors"
                aria-label="Select language"
            >
                <span className="text-lg">{current.flag}</span>
                <span>{current.label}</span>
                <span className="text-[10px]">▼</span>
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-xl z-[200] overflow-hidden animate-in fade-in zoom-in-95">
                    {LANGUAGES.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => handleSelect(lang.code)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors
                ${lang.code === i18n.language
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                }`}
                        >
                            <span className="text-base">{lang.flag}</span>
                            <span>{lang.label}</span>
                            {lang.code === i18n.language && (
                                <span className="ml-auto text-[10px] text-primary">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
