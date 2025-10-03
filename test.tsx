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

import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

import { Column } from "@tanstack/react-table";
import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";

interface TextFilterProps<TData> {
  column: Column<TData, unknown>;
  debounceMs?: number;
  placeholder?: string;
}

export function TextFilter<TData>({
  column,
  debounceMs = 300,
  placeholder = "Filter...",
}: TextFilterProps<TData>) {
  // Local state keeps input value to prevent focus loss
  const [value, setValue] = useState((column.getFilterValue() as string) ?? "");

  // Debounced value updates table filter
  const debouncedValue = useDebounce(value, debounceMs);

  useEffect(() => {
    column.setFilterValue(debouncedValue || undefined);
  }, [debouncedValue, column]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-gray-300 px-2 py-1 text-sm
                 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    />
  );
}

import { useState } from "react";
import { Column } from "@tanstack/react-table";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Funnel } from "lucide-react";

interface IconTextFilterProps<TData> {
  column: Column<TData, unknown>;
}

export function IconTextFilter<TData>({ column }: IconTextFilterProps<TData>) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState((column.getFilterValue() as string) ?? "");

  // Check if filter is applied
  const isFiltered = Boolean(column.getFilterValue());

  const applyFilter = () => {
    column.setFilterValue(value || undefined);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      applyFilter();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`p-1 rounded hover:bg-gray-100 ${isFiltered ? "text-blue-500" : "text-gray-500"}`}
        >
          <Funnel className="h-4 w-4" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="p-2 w-40">
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Filter..."
          className="text-sm"
        />
      </PopoverContent>
    </Popover>
  );
}

import { FilterFn } from "@tanstack/react-table";
import { DateRange } from "./DateRangeFilter";

export const dateRangeFilter: FilterFn<any> = (row, columnId, value: DateRange) => {
  if (!value) return true;

  const cellValue = row.getValue(columnId);
  if (!cellValue) return false;

  const cellDate = new Date(cellValue);

  if (value.from && cellDate < value.from) return false;
  if (value.to && cellDate > value.to) return false;

  return true;
};

const table = useReactTable({
  data,
  columns,
  filterFns: { dateRange: dateRangeFilter },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
});

const columns = [
  {
    accessorKey: "createdAt",
    header: "Created At",
    filterFn: "dateRange",  // use custom filterFn
    meta: {
      filterType: "date",   // tells the header renderer which filter UI to use
      enableFilter: true,
    },
  },
];

"use client"

import * as React from "react"
import { Column } from "@tanstack/react-table"
import { Funnel } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, parseISO, set } from "date-fns"

interface DateTimeRange {
  from?: Date
  to?: Date
}

interface DateTimeRangeFilterProps<TData> {
  column: Column<TData, unknown>
}

export function DateTimeRangeFilter<TData>({ column }: DateTimeRangeFilterProps<TData>) {
  const currentValue = column.getFilterValue() as DateTimeRange | undefined
  const [open, setOpen] = React.useState(false)
  const [range, setRange] = React.useState<DateTimeRange>(currentValue ?? {})

  const filterType = (column.columnDef.meta as any)?.filterType ?? "date"
  const isDateTime = filterType === "datetime"

  const isFiltered = Boolean(currentValue?.from || currentValue?.to)

  const applyFilter = () => {
    column.setFilterValue(range.from || range.to ? range : undefined)
    setOpen(false)
  }

  const resetFilter = () => {
    setRange({})
    column.setFilterValue(undefined)
  }

  // Combine calendar date + time string into one Date
  const combineDateTime = (date: Date | undefined, time: string) => {
    if (!date) return undefined
    if (!isDateTime) return set(date, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 })

    const [hours, minutes, seconds] = time.split(":").map(Number)
    return set(date, { hours, minutes, seconds: seconds || 0, milliseconds: 0 })
  }

  // Format short label using date-fns
  const formatShortLabel = (range: DateTimeRange) => {
    if (!range.from && !range.to) return "Select date"
    const fmt = isDateTime ? "MM/dd/yy HH:mm" : "MM/dd/yy"
    const fromStr = range.from ? format(range.from, fmt) : "-"
    const toStr = range.to ? format(range.to, fmt) : "-"
    return `${fromStr} → ${toStr}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-40 justify-between font-normal ${isFiltered ? "text-blue-500" : "text-gray-700"}`}
        >
          {formatShortLabel(range)}
          <Funnel className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-4 space-y-4" align="start">
        {["from", "to"].map((key) => {
          const label = key === "from" ? "From" : "To"
          const dateValue = range[key as keyof DateTimeRange] ?? undefined
          const timeValue = dateValue ? format(dateValue, "HH:mm:ss") : "00:00:00"

          return (
            <div key={key} className="flex flex-col gap-2">
              <Label>{label}</Label>
              <div className="flex gap-2">
                <Calendar
                  mode="single"
                  selected={dateValue}
                  captionLayout="dropdown"
                  onSelect={(date) =>
                    setRange({
                      ...range,
                      [key]: combineDateTime(date, timeValue),
                    })
                  }
                />
                {isDateTime && (
                  <Input
                    type="time"
                    step="1"
                    value={timeValue}
                    onChange={(e) =>
                      setRange({
                        ...range,
                        [key]: combineDateTime(dateValue, e.target.value),
                      })
                    }
                    className="w-24"
                  />
                )}
              </div>
            </div>
          )
        })}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={resetFilter}>
            Reset
          </Button>
          <Button size="sm" onClick={applyFilter}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

