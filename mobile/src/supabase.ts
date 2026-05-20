import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
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
      detectSessionInUrl: false,
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
