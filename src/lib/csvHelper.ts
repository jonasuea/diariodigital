import Papa from 'papaparse';

export interface CSVParseResult<T> {
  data: T[];
  errors: any[];
  meta: any;
}

export class CSVUtility {
  /**
   * Reads and parses a local CSV file, dynamically handling delimiters (; and ,) and UTF-8 encoding.
   */
  static async parseCSV<T = Record<string, string>>(
    file: File, 
    requiredColumns: string[] = []
  ): Promise<T[]> {
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsText(file, 'UTF-8');
    });

    if (!text.trim()) {
      throw new Error('O arquivo CSV está vazio.');
    }

    // 1. Try first with ";" (Excel standard in Portuguese-speaking regions)
    let result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase(),
      delimiter: ';',
    });

    // 2. If it fails or has only 1 column, fallback to "," (international standard)
    if (
      result.errors.length > 0 || 
      (result.data && result.data.length > 0 && Object.keys(result.data[0]).length < 2)
    ) {
      result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase(),
        delimiter: ',',
      });
    }

    if (result.errors.length > 0) {
      console.error('Erros no PapaParse:', result.errors);
      throw new Error('Falha ao processar o formato do CSV. Verifique a codificação.');
    }

    // 3. Mandatory column validation
    const availableColumns = result.meta.fields?.map(f => f.toLowerCase().trim()) || [];
    const missingColumns = requiredColumns.filter(col => !availableColumns.includes(col.toLowerCase().trim()));

    if (missingColumns.length > 0) {
      throw new Error(`O arquivo está sem as colunas obrigatórias: ${missingColumns.join(', ')}`);
    }

    return result.data as T[];
  }

  /**
   * Exports an array of items to CSV format for browser download.
   */
  static exportToCSV<T>(data: T[], filename: string) {
    const csv = Papa.unparse(data, { delimiter: ';' });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
