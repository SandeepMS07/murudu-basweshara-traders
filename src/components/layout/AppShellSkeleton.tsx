import { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

export function AppShellSkeleton({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
