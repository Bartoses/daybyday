/** Centralized env access. Secrets live in env only — never in the database (audit R2). */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  publicBaseUrl: string;
  twilio: {
    authToken: string;
    accountSid: string;
    phoneNumber: string;
    /** Ops kill-switch: set TWILIO_VALIDATE=false to bypass signature checks. */
    validate: boolean;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  vapid: {
    publicKey: string;
    privateKey: string;
    subject: string;
  };
  /** Shared secret guarding internal cron endpoints. */
  cronSecret: string;
  /** Email allowed to access admin endpoints. */
  adminEmail: string;
}

function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(env("PORT", "8080")),
    nodeEnv: env("NODE_ENV", "development"),
    publicBaseUrl: env("PUBLIC_BASE_URL", "http://localhost:8080"),
    twilio: {
      authToken: env("TWILIO_AUTH_TOKEN"),
      accountSid: env("TWILIO_ACCOUNT_SID"),
      phoneNumber: env("TWILIO_PHONE_NUMBER"),
      validate: env("TWILIO_VALIDATE", "true") !== "false",
    },
    supabase: {
      url: env("SUPABASE_URL"),
      anonKey: env("SUPABASE_ANON_KEY"),
      serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
    },
    vapid: {
      publicKey: env("VAPID_PUBLIC_KEY"),
      privateKey: env("VAPID_PRIVATE_KEY"),
      subject: env("VAPID_SUBJECT", "mailto:hello@daybyday.app"),
    },
    cronSecret: env("CRON_SECRET"),
    adminEmail: env("ADMIN_EMAIL", "bartoses1@gmail.com").toLowerCase(),
  };
}
