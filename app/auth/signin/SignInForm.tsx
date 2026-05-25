"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const IS_DEV = process.env.NODE_ENV === "development";

export function SignInForm() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const [googleLoading, setGoogleLoading] = useState(false);
  const [devEmail, setDevEmail] = useState("alice@example.com");
  const [devName, setDevName] = useState("Alice");
  const [devLoading, setDevLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevLoading(true);
    const result = await signIn("dev-login", {
      email: devEmail,
      name: devName,
      redirect: false,
    });
    if (result?.ok) {
      router.replace("/dashboard");
    } else {
      setDevLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-6 animate-slide-up">
      <div className="text-center">
        <span className="text-5xl">💸</span>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">
          Sign in to Splitkaro
        </h1>
      </div>

      {error && (
        <div className="w-full rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          Sign-in failed. Please try again.
        </div>
      )}

      {/* ── Dev bypass (only in development) ─────────────────────────────── */}
      {IS_DEV && (
        <div className="w-full rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 p-4">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-3 uppercase tracking-wide">
            Dev login — local only
          </p>
          <form onSubmit={handleDevLogin} className="flex flex-col gap-3">
            <Input
              label="Email"
              type="email"
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
              required
            />
            <Input
              label="Display name"
              type="text"
              value={devName}
              onChange={(e) => setDevName(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" size="md" className="w-full" loading={devLoading}>
              Sign in as {devName || "…"}
            </Button>
          </form>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
            Creates/reuses an account in the local SQLite DB. Not available in production.
          </p>
        </div>
      )}

      {/* ── Google OAuth (production) ─────────────────────────────────────── */}
      {!IS_DEV && (
        <>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            loading={googleLoading}
            onClick={handleGoogle}
          >
            <GoogleIcon />
            Continue with Google
          </Button>
          <p className="text-xs text-zinc-400 text-center">
            By signing in you agree to our Terms of Service and Privacy Policy.
          </p>
        </>
      )}

      {/* Show Google button in dev too, if real credentials are configured */}
      {IS_DEV && process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED === "true" && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          loading={googleLoading}
          onClick={handleGoogle}
        >
          <GoogleIcon />
          Or sign in with Google
        </Button>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
