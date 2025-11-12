import { useCallback } from 'react';
import { saveAs } from 'file-saver';
import { Table } from '@tanstack/react-table';

export function useTableExport<TData>(table: Table<TData>) {
  /**
   * Exports the table to CSV using meta.displayName as header
   */
  const exportToCSV = useCallback(() => {
    if (!table) return;

    // 1️⃣ Get all columns for headers
    const columns = table.getAllColumns();

    // Use meta.displayName if present, fallback to column.id
    const headers = columns.map(col => col.columnDef.meta?.displayName ?? col.id);

    // 2️⃣ Get rows after filtering & sorting (pre-pagination)
    const rows = table.getPrePaginationRowModel().rows;

    // 3️⃣ Build CSV content
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

    // 4️⃣ Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'export.csv');
  }, [table]);

  return { exportToCSV };
}
