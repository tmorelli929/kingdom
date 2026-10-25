import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

const ERRORS: Record<string, string> = {
  "not-allowed": "That Google account isn't on this Kingdom's allowlist.",
  expired: "Sign-in took too long or was interrupted. Try again.",
  google: "Google didn't complete the sign-in. Try again.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/");
  const { error } = await searchParams;
  const dev = env().DEV_LOGIN;
  return (
    <main className="login">
      <div className="card">
        <span className="brand">KINGDOM</span>
        <h1 style={{ fontSize: 26 }}>Seek first the kingdom.</h1>
        <p className="muted">Your private dashboard for living according to what matters most.</p>
        {error && <p style={{ color: "var(--warn)" }}>{ERRORS[error] ?? "Sign-in failed. Try again."}</p>}
        <a className="btn primary" href="/api/auth/google" style={{ justifyContent: "center" }}>Continue with Google</a>
        {dev && <a className="btn ghost" href="/api/auth/dev-login" style={{ justifyContent: "center" }}>Local dev sign-in</a>}
        <p className="small faint">Signing in only shares your name and email with Kingdom. Calendar and email access are separate and optional.</p>
      </div>
    </main>
  );
}
