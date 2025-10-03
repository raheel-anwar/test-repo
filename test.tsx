// components/table/filters/TextFilter.tsx
import { Column } from "@tanstack/react-table";

export function TextFilter<TData>({ column }: { column: Column<TData, unknown> }) {
  return (
    <input
      type="text"
      value={(column.getFilterValue() as string) ?? ""}
      onChange={(e) => column.setFilterValue(e.target.value || undefined)}
      placeholder={`Filter...`}
      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    />
  );
}


// components/table/filters/SelectFilter.tsx
import { Column } from "@tanstack/react-table";

export function SelectFilter<TData>({
  column,
  options,
}: {
  column: Column<TData, unknown>;
  options: string[];
}) {
  return (
    <select
      value={(column.getFilterValue() as string) ?? ""}
      onChange={(e) => column.setFilterValue(e.target.value || undefined)}
      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    >
      <option value="">All</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

// components/table/DataTableColumnHeader.tsx
import { Column } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { TextFilter } from "./filters/TextFilter";
import { SelectFilter } from "./filters/SelectFilter";

type FilterType = "text" | "select";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const title = column.columnDef.header as string;
  const meta = column.columnDef.meta as {
    enableFilter?: boolean;
    filterType?: FilterType;
    filterOptions?: string[];
  };

  const enableFilter = meta?.enableFilter ?? false;
  const filterType = meta?.filterType ?? "text";

  return (
    <div className="flex flex-col items-start">
      {/* Header title + sorting */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span className="font-semibold">{title}</span>
        {column.getIsSorted() && (
          <ArrowUpDown
            className={`h-3 w-3 ${
              column.getIsSorted() === "asc" ? "rotate-180" : ""
            }`}
          />
        )}
      </div>

      {/* Filter */}
      {enableFilter && column.getCanFilter() && (
        <div className="mt-1 w-full">
          {filterType === "text" && <TextFilter column={column} />}
          {filterType === "select" && (
            <SelectFilter column={column} options={meta?.filterOptions ?? []} />
          )}
        </div>
      )}
    </div>
  );
}

const columns: ColumnDef<Execution>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    meta: { enableFilter: true, filterType: "text" },
  },
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    meta: { enableFilter: true, filterType: "text" },
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    meta: {
      enableFilter: true,
      filterType: "select",
      filterOptions: ["Running", "Failed", "Pending"],
    },
  },
  {
    accessorKey: "owner",
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    meta: { enableFilter: false },
  },
];

// components/DataTable/filters/DateRangeFilter.tsx
import { Column } from "@tanstack/react-table";

export function DateRangeFilter<TData>({ column }: { column: Column<TData, unknown> }) {
  const value = (column.getFilterValue() as { from?: string; to?: string }) ?? {};

  return (
    <div className="flex gap-2">
      {/* From Date */}
      <input
        type="date"
        value={value.from ?? ""}
        onChange={(e) =>
          column.setFilterValue({
            ...value,
            from: e.target.value || undefined,
          })
        }
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm
                   focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />

      {/* To Date */}
      <input
        type="date"
        value={value.to ?? ""}
        onChange={(e) =>
          column.setFilterValue({
            ...value,
            to: e.target.value || undefined,
          })
        }
        className="w-full rounded border border-gray-300 px-2 py-1 text-sm
                   focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}


// types/table.d.ts
import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    enableFilter?: boolean;
    filterType?: "text" | "select" | "dateRange";
    filterOptions?: string[];
  }
}

