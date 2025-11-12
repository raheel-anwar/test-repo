import { useCallback } from 'react';
import { saveAs } from 'file-saver';
import { Table } from '@tanstack/react-table';

export function useTableExport<TData>(table: Table<TData>) {
  /**
   * Exports the table to CSV
   */
  const exportToCSV = useCallback(() => {
    if (!table) return;

    // 1️⃣ Get all column IDs for headers
    const headers = table.getAllColumns().map(col => col.id);

    // 2️⃣ Get rows after filtering & sorting (pre-pagination)
    const rows = table.getPrePaginationRowModel().rows;

    // 3️⃣ Build CSV content
    const csvContent = [
      headers.join(','), // header row
      ...rows.map(row =>
        headers
          .map(header => {
            const val = row.getValue(header);
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
