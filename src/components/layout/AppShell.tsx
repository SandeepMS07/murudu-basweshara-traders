"use client";

import { ReactNode, useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between border-b border-muted/20 bg-card px-4 py-3 lg:hidden">
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-lg font-semibold tracking-tight">PB Manager</span>
          <div className="h-10 w-10" />
        </div>

        <div className="flex flex-1">
          <div className="hidden lg:block lg:w-64 lg:flex-shrink-0">
            <Sidebar />
          </div>
          <main className="flex-1 overflow-y-auto w-full">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 lg:p-10">
              {children}
            </div>
          </main>
        </div>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <div className="fixed inset-y-0 left-0 z-40 w-64 border-r border-muted/20 bg-card p-0 lg:hidden">
              <Sidebar onNavigate={() => setMenuOpen(false)} className="h-full w-full" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
