import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Sidebar />
      <main className="flex-1 overflow-y-auto w-full">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
