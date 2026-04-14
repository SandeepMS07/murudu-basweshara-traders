"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type RangeValue = "fy" | "all";

interface RangeToggleProps {
  className?: string;
  defaultValue?: RangeValue;
}

export function RangeToggle({ className, defaultValue = "fy" }: RangeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = (searchParams.get("range") as RangeValue | null) ?? defaultValue;

  const setValue = (next: RangeValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-[#2a2d34] bg-[#17191f] p-1 text-xs text-zinc-200",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setValue("fy")}
        className={cn(
          "rounded px-2.5 py-1 font-semibold transition-colors",
          value === "fy"
            ? "bg-[#ff6a3d] text-white"
            : "text-zinc-300 hover:text-zinc-100"
        )}
      >
        FY
      </button>
      <button
        type="button"
        onClick={() => setValue("all")}
        className={cn(
          "rounded px-2.5 py-1 font-semibold transition-colors",
          value === "all"
            ? "bg-[#ff6a3d] text-white"
            : "text-zinc-300 hover:text-zinc-100"
        )}
      >
        All
      </button>
    </div>
  );
}
