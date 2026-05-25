"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/people", label: "People", icon: "👤" },
  { href: "/events", label: "Events", icon: "✈️" },
  { href: "/groups", label: "Groups", icon: "👥" },
];

interface NavBarProps {
  initialUser?: { name: string | null; image?: string | null } | null;
}

export function NavBar({ initialUser }: NavBarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user ?? initialUser;

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop top bar */}
      <header className="hidden md:flex h-14 items-center border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 gap-6 sticky top-0 z-40">
        <Link href="/dashboard" className="font-bold text-lg text-brand-600 tracking-tight shrink-0">
          Splitkaro
        </Link>
        <nav className="flex gap-1 flex-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {user && (
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shrink-0"
          >
            <Avatar name={user.name} image={user.image} size="sm" />
            <span className="hidden lg:block">{user.name}</span>
          </button>
        )}
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 safe-area-inset-bottom">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors",
              isActive(item.href)
                ? "text-brand-600 dark:text-brand-400"
                : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
