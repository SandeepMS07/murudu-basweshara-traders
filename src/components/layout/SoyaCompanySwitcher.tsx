"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  listSoyaCompaniesAction,
  setActiveSoyaCompanyAction,
} from "@/app/soya/companies/actions";
import type { SoyaCompany } from "@/features/soya-companies/schemas";
import { stateNameForCode } from "@/features/soya/lib/gst";

/**
 * The open trading firm, at the top of the Soya sidebar.
 *
 * Always visible, deliberately: the selection lives in a cookie rather than the
 * URL, so the only thing stopping someone entering a bill against the wrong
 * firm is seeing which one is open. See active-company.ts.
 */
export function SoyaCompanySwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<SoyaCompany[]>([]);
  const [activeId, setActiveId] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [isPending, startTransition] = useTransition();

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

  const active = companies.find((company) => company.id === activeId) ?? null;

  const choose = (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      try {
        await setActiveSoyaCompanyAction(id);
        setActiveId(id);
        setOpen(false);
        router.refresh();
        const picked = companies.find((company) => company.id === id);
        toast.success(`Switched to ${picked?.name ?? "company"}`);
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

  return (
    <div className="relative mb-3">
      <span className="mb-1.5 block px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Company
      </span>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={isPending || state === "loading"}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
          "border-[#2a2d34] bg-[#14161b] text-zinc-100 hover:bg-[#1b1e24]",
          "disabled:cursor-wait disabled:opacity-60",
        )}
      >
        <Building2 className="h-4 w-4 shrink-0 text-[#ff8f6b]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {state === "loading"
              ? "Loading…"
              : (active?.name ?? "No company yet")}
          </span>
          {active?.gstin ? (
            <span className="block truncate font-mono text-[10px] text-zinc-500">
              {active.gstin}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-500" />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-[#2a2d34] bg-[#14161b] shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
        >
          {companies.length === 0 ? (
            <p className="px-3 py-3 text-xs text-zinc-500">
              No companies yet. Add the firm you invoice from.
            </p>
          ) : (
            companies.map((company) => {
              const isActive = company.id === activeId;
              return (
                <button
                  key={company.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={!company.is_active}
                  onClick={() => choose(company.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-sm transition-colors",
                    isActive
                      ? "bg-[#ff6a3d]/12 text-[#ff8f6b]"
                      : "text-zinc-300 hover:bg-[#1b1e24]",
                    !company.is_active && "cursor-not-allowed opacity-40",
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {company.name}
                      {company.is_active ? "" : " · inactive"}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-zinc-500">
                      {company.gstin || "no GSTIN"}
                      {company.state_code
                        ? ` · ${stateNameForCode(company.state_code)}`
                        : ""}
                    </span>
                  </span>
                </button>
              );
            })
          )}

          <Link
            href="/soya/companies"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="flex cursor-pointer items-center gap-2 border-t border-[#2a2d34] px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-[#1b1e24] hover:text-zinc-100"
          >
            <Plus className="h-4 w-4" />
            Manage companies
          </Link>
        </div>
      ) : null}
    </div>
  );
}
