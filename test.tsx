// src/status/config.ts
import { CheckCircle, XCircle, Loader, PauseCircle, Truck } from "lucide-react"

export type StatusStyle = {
  label: string
  className: string
  icon?: React.ComponentType<{ className?: string }>
}

// 🔹 Job Status
export const jobStatusConfig = {
  RUNNING: {
    label: "Running",
    className: "bg-blue-100 text-blue-800 border border-blue-300",
    icon: Loader,
  },
  TERMINATED: {
    label: "Terminated",
    className: "bg-gray-100 text-gray-800 border border-gray-300",
    icon: PauseCircle,
  },
  PENDING: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border border-yellow-300",
    icon: Loader,
  },
  FAILED: {
    label: "Failed",
    className: "bg-red-100 text-red-800 border border-red-300",
    icon: XCircle,
  },
} as const
export type JobStatus = keyof typeof jobStatusConfig

// 🔹 Order Status
export const orderStatusConfig = {
  DISPATCHED: {
    label: "Dispatched",
    className: "bg-purple-100 text-purple-800 border border-purple-300",
    icon: Truck,
  },
  PROCESSING: {
    label: "Processing",
    className: "bg-yellow-100 text-yellow-800 border border-yellow-300",
    icon: Loader,
  },
  DONE: {
    label: "Done",
    className: "bg-green-100 text-green-800 border border-green-300",
    icon: CheckCircle,
  },
} as const
export type OrderStatus = keyof typeof orderStatusConfig

// 🔹 Registry
export const statusRegistry = {
  job: jobStatusConfig,
  order: orderStatusConfig,
} as const

export type StatusType = keyof typeof statusRegistry


// src/components/common/StatusBadge.tsx
import { Badge } from "@/components/ui/badge"
import { statusRegistry, StatusType, StatusStyle } from "@/status/config"

type StatusBadgeProps<T extends StatusType> = {
  type: T
  status: keyof typeof statusRegistry[T]
  fallbackLabel?: string
}

export function StatusBadge<T extends StatusType>({
  type,
  status,
  fallbackLabel = "Unknown",
}: StatusBadgeProps<T>) {
  const config = statusRegistry[type] as Record<string, StatusStyle>
  const item = config[status as string]

  if (!item) {
    return (
      <Badge
        className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300"
        variant="outline"
      >
        {fallbackLabel}
      </Badge>
    )
  }

  const Icon = item.icon

  return (
    <Badge
      className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${item.className}`}
      variant="outline"
    >
      {Icon && <Icon className="h-3 w-3" />}
      {item.label}
    </Badge>
  )
}

// JobCard.tsx
import { StatusBadge } from "@/components/common/StatusBadge"
import type { JobStatus } from "@/status/config"

export function JobCard({ status }: { status: JobStatus }) {
  return (
    <div className="p-4 border rounded-lg shadow-sm space-y-2">
      <h3 className="text-sm font-semibold">Job #123</h3>
      <StatusBadge type="job" status={status} />
    </div>
  )
}
