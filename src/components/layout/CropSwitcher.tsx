"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { MAIZE_HOME, SOYA_HOME, type Workspace } from "@/features/soya/lib/constants";

const options: {
  key: Workspace;
  label: string;
  href: string;
}[] = [
  { key: "maize", label: "Maize", href: MAIZE_HOME },
  { key: "soya", label: "Soya", href: SOYA_HOME },
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
    <div className="mb-4 grid grid-cols-2 gap-0.5 rounded-lg bg-[#17191e] p-0.5">
      {options.map((option) => {
        const isActive = option.key === workspace;
        return (
          <Link
            key={option.key}
            href={option.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-7 cursor-pointer items-center justify-center rounded-md text-[13px] font-medium transition-colors",
              isActive
                ? "bg-[#2a2d35] text-white shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                : "text-zinc-500 hover:text-zinc-200",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
