// lib/notifications.tsx
import { toast } from "sonner"
import { ShieldAlert, CheckCircle2, Info, AlertTriangle } from "lucide-react"
import React from "react"

type NotifyType = "success" | "error" | "info" | "warning"

interface NotifyOptions {
  description?: string
  duration?: number // in ms
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  closable?: boolean
}

const DEFAULT_DURATION = 5000
const DEFAULT_POSITION: NotifyOptions["position"] = "top-right"

export function notify(
  type: NotifyType,
  message: string,
  options: NotifyOptions = {}
) {
  const { description, duration = DEFAULT_DURATION, position = DEFAULT_POSITION, closable = true } = options

  const icons: Record<NotifyType, React.ReactNode> = {
    success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    error: <ShieldAlert className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  }

  const id = toast(message, {
    description,
    duration,
    position,
    icon: icons[type],
    action: closable
      ? { label: "Close", onClick: () => toast.dismiss(id) }
      : undefined,
  })

  return id
}
