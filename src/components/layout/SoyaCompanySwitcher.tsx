"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  listSoyaCompaniesAction,
  setActiveSoyaCompanyAction,
} from "@/app/soya/companies/actions";
import type { SoyaCompany } from "@/features/soya-companies/schemas";

/**
 * Colour per firm, by list position. Only a visual cue to tell the firms
 * apart at a glance; nothing stores it.
 */
const COMPANY_COLORS = ["#ff6a3d", "#2dd4bf", "#a78bfa", "#facc15", "#60a5fa", "#f472b6"];

export function soyaCompanyColor(index: number) {
  return COMPANY_COLORS[index % COMPANY_COLORS.length];
}

/**
 * The open trading firm, at the top of the Soya sidebar.
 *
 * The open firm is always shown on the closed selector: the selection lives in
 * a cookie rather than the URL, so the only thing stopping someone entering a
 * bill against the wrong firm is seeing which one is open. Managing firms is
 * the "Companies" nav item. See active-company.ts.
 */
export function SoyaCompanySwitcher() {
  const router = useRouter();
  const [companies, setCompanies] = useState<SoyaCompany[]>([]);
  const [activeId, setActiveId] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on a click outside or Escape, like any other dropdown.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    listSoyaCompaniesAction()
      .then((result) => {
        if (cancelled) return;
        setCompanies(result.companies);
        setActiveId(result.activeId);
        setState(result.ready ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = (company: SoyaCompany) => {
    setOpen(false);
    if (company.id === activeId || !company.id) return;
    startTransition(async () => {
      try {
        await setActiveSoyaCompanyAction(company.id);
        setActiveId(company.id);
        router.refresh();
        toast.success(`Switched to ${company.name}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not switch company",
        );
      }
    });
  };

  if (state === "unavailable") {
    return (
      <div className="mb-3 rounded-md border border-[#3d3418] bg-[#2a2412]/40 px-3 py-2 text-xs text-[#f7e3b0]">
        Run <code className="font-mono">supabase/soya-companies.sql</code> to
        enable companies.
      </div>
    );
  }

  const activeIndex = companies.findIndex((company) => company.id === activeId);
  const active = activeIndex >= 0 ? companies[activeIndex] : null;

  return (
    <div ref={rootRef} className="relative mb-3">
      <span className="mb-1 block px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Company
      </span>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={state === "loading" || isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg border bg-[#121317] px-3 text-left text-[13px] font-medium text-white transition-colors",
          open ? "border-[#3a3e47]" : "border-[#2a2d34] hover:border-[#3a3e47]",
          "disabled:cursor-wait disabled:opacity-60",
        )}
      >
        {state === "loading" ? (
          <span className="h-3 w-24 animate-pulse rounded bg-[#1d2026]" />
        ) : (
          <>
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: active ? soyaCompanyColor(activeIndex) : "#52525b" }}
            />
            <span className="min-w-0 flex-1 truncate">
              {active?.name ?? "Choose company"}
            </span>
          </>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Company"
          className="absolute left-0 right-0 top-full z-40 mt-1 space-y-0.5 rounded-lg border border-[#2a2d34] bg-[#121317] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
        >
          {companies.length === 0 ? (
            <p className="px-2 py-2 text-xs text-zinc-500">
              No companies yet. Add one under Companies.
            </p>
          ) : (
            companies.map((company, index) => {
              const isActive = company.id === activeId;
              return (
                <button
                  key={company.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={!company.is_active}
                  onClick={() => choose(company)}
                  title={company.gstin || undefined}
                  className={cn(
                    "flex h-7.5 w-full cursor-pointer items-center gap-2.5 rounded-md border px-2 text-left text-[13px] transition-colors",
                    isActive
                      ? "border-[#3a3e47] bg-white/6 font-medium text-white"
                      : "border-transparent text-zinc-400 hover:bg-white/4 hover:text-zinc-100",
                    !company.is_active && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: soyaCompanyColor(index) }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {company.name}
                    {company.is_active ? "" : " · inactive"}
                  </span>
                  {isActive ? <Check className="h-3.5 w-3.5 shrink-0 text-zinc-400" /> : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
