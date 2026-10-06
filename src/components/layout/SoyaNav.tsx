"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Factory,
  FileText,
  Landmark,
  LayoutDashboard,
  Package,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { SoyaCompanySwitcher } from "./SoyaCompanySwitcher";

type SoyaNavChild = {
  name: string;
  href: string;
};

type SoyaNavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: SoyaNavChild[];
};

/**
 * Soya runs two record modules: Factory (who we buy from) and Parties (who we
 * sell to), each with an Overview and a master list, both scoped to the open
 * company.
 *
 * The master links are labelled "Factory master" / "Party master" rather than
 * by their route segments, which read backwards — /soya/factory/parties is the
 * factory list and /soya/parties/companies is the party list. "Companies" at
 * the top means something else again: the firms we invoice from.
 */
const soyaNavItems: SoyaNavItem[] = [
  { name: "Dashboard", href: "/soya/dashboard", icon: LayoutDashboard },
  { name: "Companies", href: "/soya/companies", icon: Landmark },
  {
    name: "Factory",
    href: "/soya/factory",
    icon: Factory,
    children: [
      { name: "Overview", href: "/soya/factory" },
      { name: "Factory master", href: "/soya/factory/parties" },
    ],
  },
  {
    name: "Parties",
    href: "/soya/parties",
    icon: Users,
    children: [
      { name: "Overview", href: "/soya/parties" },
      { name: "Party master", href: "/soya/parties/companies" },
    ],
  },
  { name: "Items", href: "/soya/items", icon: Package },
  { name: "Invoices", href: "/soya/invoices", icon: FileText },
];

/**
 * Sidebar nav for the Soya workspace. Not filtered by can() — Soya is
 * admin-only and the switcher that leads here is already admin-gated.
 */
export function SoyaNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >(() => {
    const initial: Record<string, boolean> = {};
    for (const item of soyaNavItems) {
      if (item.children) {
        initial[item.href] = pathname.startsWith(item.href);
      }
    }
    return initial;
  });

  return (
    <nav className="flex-1 space-y-0.5">
      {/* Which firm is open decides which ledgers and which GSTIN an invoice
          uses, and it lives in a cookie rather than the URL — so it is shown
          on every Soya screen rather than hidden behind a menu. */}
      <SoyaCompanySwitcher />

      {soyaNavItems.map((item) => {
        const isActive =
          pathname.startsWith(item.href) ||
          item.children?.some((child) => pathname.startsWith(child.href));
        const Icon = item.icon;

        return (
          <div key={item.href}>
            <div
              className={cn(
                "group flex h-8.5 items-center justify-between gap-2 rounded-md px-2 text-sm transition-colors",
                isActive
                  ? "bg-white/6 font-medium text-white"
                  : "text-zinc-400 hover:bg-white/4 hover:text-zinc-100",
              )}
            >
              <Link
                href={item.href}
                onClick={onNavigate}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5"
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-[#ff8f6b]" : "text-zinc-500",
                  )}
                />
                <span className="truncate">{item.name}</span>
              </Link>
              {item.children ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSections((current) => ({
                      ...current,
                      [item.href]: !current[item.href],
                    }))
                  }
                  className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm text-zinc-500 hover:bg-white/6 hover:text-zinc-100"
                  aria-label={
                    expandedSections[item.href]
                      ? "Collapse menu"
                      : "Expand menu"
                  }
                >
                  {expandedSections[item.href] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : null}
            </div>

            {item.children && expandedSections[item.href] ? (
              <div className="mb-1 ml-[18px] mt-0.5 space-y-0.5 pl-3">
                {item.children.map((child) => {
                  const childActive =
                    child.href === item.href
                      ? pathname === child.href
                      : pathname.startsWith(child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex h-7.5 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] transition-colors",
                        childActive
                          ? "font-medium text-white"
                          : "text-zinc-500 hover:bg-white/4 hover:text-zinc-100",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          childActive ? "bg-[#ff8f6b]" : "bg-transparent",
                        )}
                      />
                      {child.name}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
