import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MoreVertical } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  mobileTitleKey?: string;
  mobileSubtitleKey?: string;
  rowClassName?: (item: T) => string;
}

export function DataTable<T extends { id: number | string }>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'Nenhum registro encontrado',
  loading = false,
  mobileTitleKey,
  mobileSubtitleKey,
  rowClassName,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop View */}
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn("font-semibold text-foreground", column.className)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow
                  key={item.id}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer hover:bg-muted/50",
                    rowClassName && rowClassName(item)
                  )}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.render
                        ? column.render(item)
                        : (item as Record<string, unknown>)[column.key] as React.ReactNode}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile View - Automatic Card Conversion */}
      <div className="md:hidden space-y-4">
        {data.length === 0 ? (
          <div className="text-center py-12 border rounded-xl bg-card text-muted-foreground shadow-sm">
            {emptyMessage}
          </div>
        ) : (
          data.map((item) => {
            const titleCol = mobileTitleKey
              ? columns.find(c => c.key === mobileTitleKey)
              : columns.find(c => c.key === 'nome' || c.key === 'name') || columns[0];

            const subtitleCol = mobileSubtitleKey
              ? columns.find(c => c.key === mobileSubtitleKey)
              : columns.find(c => c.key === 'inep' || c.key === 'matricula' || c.key === 'id') || columns[1];

            const actionCol = columns.find(c => c.key === 'actions');
            const detailCols = columns.filter(c => c.key !== titleCol?.key && c.key !== subtitleCol?.key && c.key !== 'actions');

            return (
              <Card key={item.id} className={cn("overflow-hidden border-border shadow-sm", rowClassName && rowClassName(item))}>
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-bold text-foreground">
                        {titleCol?.render
                          ? titleCol.render(item)
                          : (item as any)[titleCol?.key || '']}
                      </CardTitle>
                      {(subtitleCol || mobileSubtitleKey) && (
                        <CardDescription className="text-xs font-medium text-primary">
                          {subtitleCol?.render
                            ? subtitleCol.render(item)
                            : (item as any)[subtitleCol?.key || '']}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {detailCols.length > 0 && (
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="details" className="border-none">
                        <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
                          Mais informações
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-0">
                          <div className="grid gap-2 p-3 bg-muted/30 rounded-lg border border-border/50">
                            {detailCols.map(col => (
                              <div key={col.key} className="flex justify-between items-center gap-2">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">{col.header}</span>
                                <span className="text-xs font-medium text-foreground text-right truncate">
                                  {col.render ? col.render(item) : (item as any)[col.key]}
                                </span>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                  {actionCol && actionCol.render && (
                    <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
                      {actionCol.render(item)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}