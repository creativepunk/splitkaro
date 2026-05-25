import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 text-center bg-gradient-to-b from-brand-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <span className="text-7xl">💸</span>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Split<span className="text-brand-600">karo</span>
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-sm">
          Group expense splitting with precision — scan receipts, split by item, settle with one tap.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/auth/signin">
          <Button size="lg" variant="primary">
            Get started free
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6 max-w-lg mt-4 text-sm text-zinc-500">
        {[
          { icon: "🧾", label: "OCR receipt scanning" },
          { icon: "⅓", label: "Fractional item splits" },
          { icon: "🤝", label: "Multi-payer bills" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col items-center gap-1">
            <span className="text-2xl">{f.icon}</span>
            {f.label}
          </div>
        ))}
      </div>
    </main>
  );
}
