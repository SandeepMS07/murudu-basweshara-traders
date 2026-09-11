"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Factory,
  LayoutDashboard,
  LayoutList,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SoyaNavChild = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type SoyaNavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: SoyaNavChild[];
};

/**
 * Soya runs two record modules, both clones of a maize module: Factory (the
 * bilty shape) and Parties (the sales shape). Each mirrors its maize
 * counterpart's Overview + master-data pair.
 */
const soyaNavItems: SoyaNavItem[] = [
  { name: "Dashboard", href: "/soya/dashboard", icon: LayoutDashboard },
  {
    name: "Factory",
    href: "/soya/factory",
    icon: Factory,
    children: [
      { name: "Overview", href: "/soya/factory", icon: LayoutList },
      { name: "Parties", href: "/soya/factory/parties", icon: Building2 },
    ],
  },
  {
    name: "Parties",
    href: "/soya/parties",
    icon: Users,
    children: [
      { name: "Overview", href: "/soya/parties", icon: LayoutList },
      { name: "Companies", href: "/soya/parties/companies", icon: Building2 },
    ],
  },
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
    <nav className="flex-1 space-y-1">
      {soyaNavItems.map((item) => {
        const isActive =
          pathname.startsWith(item.href) ||
          item.children?.some((child) => pathname.startsWith(child.href));
        const Icon = item.icon;

        return (
          <div key={item.href}>
            <div
              className={cn(
                "group flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border border-[#ff6a3d]/40 bg-[#ff6a3d]/14 text-[#ff8f6b]"
                  : "text-zinc-400 hover:bg-[#181a1f] hover:text-zinc-100",
              )}
            >
              <Link
                href={item.href}
                onClick={onNavigate}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
              >
                <Icon className="h-5 w-5 shrink-0" />
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
                  className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm text-zinc-400 hover:bg-[#1d2026] hover:text-zinc-100"
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
              <div className="relative ml-8 mt-1 border-l border-[#2a2d34] pl-3">
                {item.children.map((child) => {
                  const childActive =
                    child.href === item.href
                      ? pathname === child.href
                      : pathname.startsWith(child.href);
                  const ChildIcon = child.icon;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative mt-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-2 before:bg-[#2a2d34]",
                        childActive
                          ? "text-[#ff8f6b]"
                          : "text-zinc-500 hover:bg-[#181a1f] hover:text-zinc-100",
                      )}
                    >
                      <ChildIcon className="h-4 w-4 shrink-0" />
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
