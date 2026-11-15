"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuthConfig } from "./auth-api";

export function useAuthConfig() {
  return useQuery({ queryKey: ["auth-config"], queryFn: getAuthConfig, staleTime: 60_000, retry: false });
}
