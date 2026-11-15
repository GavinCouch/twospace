import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";
const accessedKeys = new Set<string>();
const storage = {
  getItemAsync(key: string) { accessedKeys.add(key); return SecureStore.getItemAsync(key); },
  setItemAsync(key: string, value: string) { accessedKeys.add(key); return SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
  getItem(key: string) { accessedKeys.add(key); return SecureStore.getItem(key); },
  setItem(key: string, value: string) { accessedKeys.add(key); SecureStore.setItem(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
};
export const auth = createAuthClient({
  baseURL: API_URL,
  plugins: [expoClient({ scheme: "twospace", storagePrefix: "twospace", storage, disableCache: true })],
});
export async function clearLocalSession() {
  await Promise.all([...accessedKeys].map((key) => SecureStore.deleteItemAsync(key)));
}
