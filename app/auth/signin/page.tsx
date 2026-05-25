import { Suspense } from "react";
import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-50 to-white dark:from-zinc-950 dark:to-zinc-900 px-6">
      <Suspense fallback={<SignInSkeleton />}>
        <SignInForm />
      </Suspense>
    </main>
  );
}

function SignInSkeleton() {
  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-8">
      <div className="text-center">
        <span className="text-5xl">💸</span>
        <div className="mt-4 h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse mx-auto" />
      </div>
      <div className="h-12 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
    </div>
  );
}
