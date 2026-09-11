"use client";

import Link from "next/link";
import { Leaf, Wheat } from "lucide-react";

import { cn } from "@/lib/utils";
import { MAIZE_HOME, SOYA_HOME, type Workspace } from "@/features/soya/lib/constants";

const options: {
  key: Workspace;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "maize", label: "Maize", href: MAIZE_HOME, icon: Wheat },
  { key: "soya", label: "Soya", href: SOYA_HOME, icon: Leaf },
];

/** Admin-only Maize/Soya workspace toggle shown at the top of the sidebar. */
export function CropSwitcher({
  workspace,
  onNavigate,
}: {
  workspace: Workspace;
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-[#252932] bg-[#15171c] p-1">
      {options.map((option) => {
        const isActive = option.key === workspace;
        const Icon = option.icon;
        return (
          <Link
            key={option.key}
            href={option.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
              isActive
                ? "bg-[#ff6a3d] text-white"
                : "text-zinc-400 hover:bg-[#1d2026] hover:text-zinc-100",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
