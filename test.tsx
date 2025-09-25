import { create } from "zustand"

export type NotificationType = "success" | "error" | "info" | "warning"

export type Notification = {
  id: string
  message: string
  description?: string
  type: NotificationType
}

type NotificationState = {
  notifications: Notification[]
  addNotification: (n: Omit<Notification, "id">) => void
  removeNotification: (id: string) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (n) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...n, id: crypto.randomUUID() },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}))


import { useEffect } from "react"
import { toast } from "sonner"
import { useNotificationStore } from "@/store/notificationStore"
import { CheckCircle2, ShieldAlert, Info, AlertTriangle } from "lucide-react"

const icons = {
  success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
  error: <ShieldAlert className="w-5 h-5 text-red-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
}

const DEFAULT_DURATION = 5000
const DEFAULT_POSITION: "top-left" | "top-right" | "bottom-left" | "bottom-right" =
  "top-right"

export function NotificationManager() {
  const { notifications, removeNotification } = useNotificationStore()

  useEffect(() => {
    notifications.forEach((n) => {
      const common = {
        description: n.description,
        icon: icons[n.type],
        duration: DEFAULT_DURATION,
        position: DEFAULT_POSITION,
      }

      switch (n.type) {
        case "success":
          toast.success(n.message, common)
          break
        case "error":
          toast.error(n.message, common)
          break
        case "warning":
          toast.warning?.(n.message, common)
          break
        case "info":
        default:
          toast(n.message, common)
      }

      removeNotification(n.id) // cleanup after showing
    })
  }, [notifications, removeNotification])

  return null
}

import { useNotificationStore, NotificationType } from "@/store/notificationStore"

export function useNotify() {
  const addNotification = useNotificationStore((s) => s.addNotification)

  const notify = (
    type: NotificationType,
    message: string,
    description?: string
  ) => {
    addNotification({ message, description, type })
  }

  return {
    success: (msg: string, desc?: string) => notify("success", msg, desc),
    error: (msg: string, desc?: string) => notify("error", msg, desc),
    info: (msg: string, desc?: string) => notify("info", msg, desc),
    warning: (msg: string, desc?: string) => notify("warning", msg, desc),
  }
}


import { Toaster } from "sonner"
import { NotificationManager } from "@/components/NotificationManager"

export default function App() {
  return (
    <>
      <YourRoutes />
      <NotificationManager />
      <Toaster richColors position="top-right" />
    </>
  )
}
