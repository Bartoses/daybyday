/// <reference types="expo/types" />

// Public env vars bundled by Expo (EXPO_PUBLIC_*).
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
    EXPO_PUBLIC_API_URL: string;
  }
}
