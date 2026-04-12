import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCPF = (value: string) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

/**
 * Converte com segurança diversos formatos de data (Timestamp do Firebase, 
 * Timestamp serializado do IndexedDB, string ISO ou objeto Date) para Date.
 */
export function safeToDate(dateValue: any): Date {
  if (!dateValue) return new Date();
  
  // Se já for Date
  if (dateValue instanceof Date) return dateValue;
  
  // Se for Timestamp do Firebase (tem toDate)
  if (typeof dateValue.toDate === 'function') return dateValue.toDate();
  
  // Se for um Timestamp serializado (objeto com seconds e nanoseconds)
  if (typeof dateValue.seconds === 'number') {
    return new Date(dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000);
  }
  
  // Se for string (ISO ou formatada)
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  
  return new Date();
}
