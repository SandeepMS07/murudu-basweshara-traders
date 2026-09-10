"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HandCoins, LayoutDashboard } from "lucide-react";

import { cn } from "@/lib/utils";

type SoyaNavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

// Bilty and Sales are appended here as each module lands, so the nav never
// shows a link to a route that doesn't exist yet.
const soyaNavItems: SoyaNavItem[] = [
  { name: "Dashboard", href: "/soya/dashboard", icon: LayoutDashboard },
  { name: "Purchases", href: "/soya/purchases", icon: HandCoins },
];

/**
 * Sidebar nav for the Soya workspace. Not filtered by can() — Soya is
 * admin-only and the switcher that leads here is already admin-gated.
 */
export function SoyaNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1">
      {soyaNavItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border border-[#ff6a3d]/40 bg-[#ff6a3d]/14 text-[#ff8f6b]"
                : "text-zinc-400 hover:bg-[#181a1f] hover:text-zinc-100",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="truncate">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
