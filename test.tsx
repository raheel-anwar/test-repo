"use client"

import * as React from "react"
import { Column } from "@tanstack/react-table"
import { Funnel } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { setHours, setMinutes, setSeconds, format } from "date-fns"

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

  const combineDateTime = (date: Date | undefined, time: string) => {
    if (!date) return undefined
    let dt = date
    if (isDateTime) {
      const [hours, minutes, seconds] = time.split(":").map(Number)
      dt = setSeconds(setMinutes(setHours(dt, hours), minutes), seconds || 0)
    }
    return dt
  }

  const formatLabel = (range: DateTimeRange) => {
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
          {formatLabel(range)}
          <Funnel className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-4 space-y-4" align="start">
        {(["from", "to"] as const).map((key) => {
          const label = key === "from" ? "From" : "To"
          const dateValue = range[key] ?? undefined
          const timeValue = dateValue ? format(dateValue, "HH:mm:ss") : "00:00:00"

          return (
            <div key={key} className="flex flex-col gap-2">
              <Label>{label}</Label>

              <div className="flex gap-2">
                {/* Date Input with Calendar Popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Input
                      value={dateValue ? format(dateValue, "MM/dd/yyyy") : ""}
                      placeholder="Select date"
                      readOnly
                      className="w-32 cursor-pointer"
                    />
                  </PopoverTrigger>

                  <PopoverContent className="w-auto p-0">
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
                  </PopoverContent>
                </Popover>

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
