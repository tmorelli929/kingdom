// Every secret comes from the environment. Missing values fail loudly instead of running half-configured.
type Env = {
  DATABASE_URL: string;
  APP_URL: string;
  AUTH_GOOGLE_ID: string;
  AUTH_GOOGLE_SECRET: string;
  ALLOWED_EMAILS: string[];
  ANTHROPIC_API_KEY: string;
  TOKEN_ENCRYPTION_KEY: string;
  DEV_LOGIN: boolean;
};

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const get = (k: string) => (process.env[k] ?? "").trim();
  const e: Env = {
    DATABASE_URL: get("DATABASE_URL"),
    APP_URL: get("APP_URL").replace(/\/$/, ""),
    AUTH_GOOGLE_ID: get("AUTH_GOOGLE_ID"),
    AUTH_GOOGLE_SECRET: get("AUTH_GOOGLE_SECRET"),
    ALLOWED_EMAILS: get("ALLOWED_EMAILS").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    ANTHROPIC_API_KEY: get("ANTHROPIC_API_KEY"),
    TOKEN_ENCRYPTION_KEY: get("TOKEN_ENCRYPTION_KEY"),
    // Never honored in a production build.
    DEV_LOGIN: process.env.NODE_ENV !== "production" && get("DEV_LOGIN") === "1",
  };
  const required: (keyof Env)[] = ["DATABASE_URL", "APP_URL"];
  if (process.env.NODE_ENV === "production") required.push("AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET");
  const missing = required.filter((k) => !e[k]);
  if (!e.ALLOWED_EMAILS.length) missing.push("ALLOWED_EMAILS");
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  cached = e;
  return e;
}
