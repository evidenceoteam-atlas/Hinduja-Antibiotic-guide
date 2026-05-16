import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

declare const process: {
  env?: Record<string, string | undefined>;
};

const env = process.env ?? {};

export const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const storage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") {
      return globalThis.localStorage?.getItem(key) ?? null;
    }

    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === "web",
      persistSession: true,
      storage: Platform.OS === "web" ? undefined : storage,
    },
    global: {
      headers: {
        "X-Client-Info": "hinduja-antibiotic-guide-mobile",
      },
    },
  },
);

export const persistentKeyValue = Platform.OS === "web" ? undefined : AsyncStorage;
