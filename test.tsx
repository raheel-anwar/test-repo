import { create } from "zustand";

interface PermissionErrorsState {
  messages: Record<string, string[]>; // queryKey → list of messages
  addMessage: (queryKey: string, msg: string) => void;
  clearQuery: (queryKey: string) => void;
  dismissMessage: (queryKey: string, index: number) => void;
}

export const usePermissionErrors = create<PermissionErrorsState>((set) => ({
  messages: {},
  addMessage: (queryKey, msg) =>
    set((state) => {
      const existing = state.messages[queryKey] || [];
      if (existing.includes(msg)) return state; // avoid duplicates
      return { messages: { ...state.messages, [queryKey]: [...existing, msg] } };
    }),
  clearQuery: (queryKey) =>
    set((state) => {
      const newMessages = { ...state.messages };
      delete newMessages[queryKey];
      return { messages: newMessages };
    }),
  dismissMessage: (queryKey, index) =>
    set((state) => {
      const queryMessages = [...(state.messages[queryKey] || [])];
      queryMessages.splice(index, 1);
      return { messages: { ...state.messages, [queryKey]: queryMessages } };
    }),
}));


queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'queryUpdated' || event.type === 'queryAdded') return;

  if (event.type === 'queryFailed') {
    const { query, error } = event;
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      const key = JSON.stringify(query.queryKey);
      const serverMessage = error.response?.data?.message || "Access denied.";
      usePermissionErrors.getState().addMessage(key, serverMessage);
    }
  }

  if (event.type === 'querySuccess') {
    const { query } = event;
    const key = JSON.stringify(query.queryKey);
    usePermissionErrors.getState().clearQuery(key);
  }
});

import { usePermissionErrors } from "./permissionErrorsStore";
import { AlertTriangle } from "lucide-react";

export function AccessDeniedBanner() {
  const { messages, dismissMessage } = usePermissionErrors();
  const queryKeys = Object.keys(messages);
  if (queryKeys.length === 0) return null;

  return (
    <div className="bg-red-600 text-white p-3 space-y-2 rounded-lg">
      {queryKeys.map((key) =>
        messages[key].map((msg, idx) => (
          <div key={`${key}-${idx}`} className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{msg}</span>
            <button
              onClick={() => dismissMessage(key, idx)}
              className="ml-auto text-sm underline"
            >
              Dismiss
            </button>
          </div>
        ))
      )}
    </div>
  );
}


import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { AccessDeniedBanner } from "./AccessDeniedBanner";

export function ProjectsPage() {
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await axios.get("/api/projects");
      return res.data;
    },
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await axios.get("/api/users");
      return res.data;
    },
  });

  const isLoading = projectsQuery.isLoading || usersQuery.isLoading;

  return (
    <div className="p-4">
      {/* Banner automatically shows per-query permission errors */}
      <AccessDeniedBanner />

      {isLoading && <p>Loading...</p>}

      {projectsQuery.isSuccess && (
        <div>
          <h2>Projects</h2>
          <pre>{JSON.stringify(projectsQuery.data, null, 2)}</pre>
        </div>
      )}

      {usersQuery.isSuccess && (
        <div>
          <h2>Users</h2>
          <pre>{JSON.stringify(usersQuery.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}





