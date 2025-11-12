import { useCallback } from 'react';
import { saveAs } from 'file-saver';
import { Table } from '@tanstack/react-table';

export function useTableExport<TData>(table: Table<TData>) {
  /**
   * Exports the table to CSV using meta.displayName as header
   * @param filename Optional filename. Defaults to 'export.csv'
   */
  const exportToCSV = useCallback(
    (filename: string = 'export.csv') => {
      if (!table) return;

      const columns = table.getAllColumns();

      // Use meta.displayName if present, fallback to column.id
      const headers = columns.map(col => col.columnDef.meta?.displayName ?? col.id);

      const rows = table.getPrePaginationRowModel().rows;

      const csvContent = [
        headers.join(','), // header row
        ...rows.map(row =>
          columns
            .map(col => {
              const val = row.getValue(col.id);
              return `"${val !== undefined && val !== null ? val : ''}"`; // quote values
            })
            .join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, filename);
    },
    [table]
  );

  /**
   * Exports the table to JSON using column ids as keys
   * @param filename Optional filename. Defaults to 'export.json'
   */
  const exportToJSON = useCallback(
    (filename: string = 'export.json') => {
      if (!table) return;

      const columns = table.getAllColumns();
      const rows = table.getPrePaginationRowModel().rows;

      const data = rows.map(row => {
        const obj: Record<string, any> = {};
        columns.forEach(col => {
          obj[col.columnDef.meta?.displayName ?? col.id] = row.getValue(col.id);
        });
        return obj;
      });

      const jsonString = JSON.stringify(data, null, 2); // pretty-print with 2 spaces
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      saveAs(blob, filename);
    },
    [table]
  );

  return { exportToCSV, exportToJSON };
}
