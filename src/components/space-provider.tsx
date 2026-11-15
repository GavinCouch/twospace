"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { SpaceSnapshot } from "@/shared/types";

export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(typeof options.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new RequestError(
      body?.error?.message ||
        body?.error ||
        body?.message ||
        "That didn’t save. Please try again.",
      response.status,
    );
  return body as T;
}
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: (count, error) =>
              !(error instanceof RequestError && error.status < 500) &&
              count < 2,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const SpaceEnabled = createContext(true);
export function SpaceAccess({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <SpaceEnabled.Provider value={enabled}>{children}</SpaceEnabled.Provider>
  );
}
export function useSpace() {
  const enabled = useContext(SpaceEnabled);
  return useQuery({
    queryKey: ["space"],
    queryFn: () => api<SpaceSnapshot>("/api/space"),
    enabled,
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  });
}
export function useAction() {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T = unknown>(
    path: string,
    body?: unknown,
    method = "POST",
  ): Promise<T> {
    setPending(true);
    setError(null);
    try {
      const result = await api<T>(path, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      await client.invalidateQueries({ queryKey: ["space"] });
      return result;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "That didn’t save. Please try again.",
      );
      throw cause;
    } finally {
      setPending(false);
    }
  }
  return { run, pending, error, clearError: () => setError(null) };
}
