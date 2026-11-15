import { useEffect } from "react";
import { AppState } from "react-native";
import { QueryClient, focusManager, onlineManager, useQuery } from "@tanstack/react-query";
import * as Network from "expo-network";
import type { Account, SpaceSnapshot } from "../domain";
import { api, ApiError } from "./api";
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: (count, error) => !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && count < 1, staleTime: 4000, gcTime: 5 * 60_000 } } });
export function useNativeQueryEvents() {
  useEffect(() => {
    focusManager.setFocused(AppState.currentState === "active");
    const app = AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
    const network = Network.addNetworkStateListener((state) => onlineManager.setOnline(state.isConnected !== false && state.isInternetReachable !== false));
    return () => { app.remove(); network.remove(); };
  }, []);
}
export const accountKey = ["account"] as const;
export function useAccount() {
  return useQuery({ queryKey: accountKey, queryFn: async ({ signal }) => {
    try { return await api<Account>("/api/account", { signal }); }
    catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error; }
  } });
}
export const spaceKey = (userId: string) => ["space", userId] as const;
export function useSpace(userId: string) {
  return useQuery({ queryKey: spaceKey(userId), queryFn: ({ signal }) => api<SpaceSnapshot>("/api/space", { signal }), refetchInterval: 4000, refetchIntervalInBackground: false });
}
export async function refreshSpace(userId: string) { await queryClient.invalidateQueries({ queryKey: spaceKey(userId) }); }
export async function refreshAccount() { await queryClient.cancelQueries(); queryClient.clear(); await queryClient.invalidateQueries({ queryKey: accountKey }); }
