import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

// AES-256-GCM for OAuth tokens at rest. The key never touches the database: it's TOKEN_ENCRYPTION_KEY
// (32 bytes, base64) when set, otherwise derived from the Google client secret, so a database leak alone
// can't be used to read anyone's calendar.
let cachedKey: Buffer | null = null;
function key() {
  if (cachedKey) return cachedKey;
  const e = env();
  if (e.TOKEN_ENCRYPTION_KEY) {
    const k = Buffer.from(e.TOKEN_ENCRYPTION_KEY, "base64");
    if (k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
    cachedKey = k;
  } else {
    if (!e.AUTH_GOOGLE_SECRET) throw new Error("Token encryption needs AUTH_GOOGLE_SECRET or TOKEN_ENCRYPTION_KEY.");
    cachedKey = Buffer.from(hkdfSync("sha256", e.AUTH_GOOGLE_SECRET, "kingdom", "oauth-token-encryption-v1", 32));
  }
  return cachedKey;
}

export function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function open(sealed: string) {
  const [v, iv, tag, ct] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unreadable token.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}
