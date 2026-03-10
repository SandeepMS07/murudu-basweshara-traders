"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, LogOut, LayoutDashboard, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { SessionUser } from "@/features/auth/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Purchases", href: "/purchases", icon: ShoppingCart },
];

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<SessionUser | null>(null);

  const handleLogout = async () => {
    setIsDialogOpen(false);
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    let active = true;

    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!active || !response.ok) return;
        const payload = await response.json();
        if (!active) return;
        setUserInfo(payload.user ?? null);
      } catch (error) {
        console.error(error);
      }
    };

    fetchUser();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className={cn(
        "flex w-full flex-col border-b bg-card px-4 py-6 text-card-foreground",
        "lg:border-b-0 lg:border-r lg:px-4 lg:py-6 lg:h-screen",
        className
      )}
    >
      <div className="flex items-center gap-2 px-2 pb-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <LayersIcon className="h-5 w-5" />
        </div>
        <span className="text-xl font-bold tracking-tight text-primary">PB Manager</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t">
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          disabled={isLoggingOut}
          className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 className="h-5 w-5 animate-spin shrink-0" />
          ) : (
            <LogOut className="h-5 w-5 shrink-0" />
          )}
          Logout
        </button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              You will be signed out of PB Manager. Please confirm that you want to
              log out of the console.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-foreground">
            {userInfo ? (
              <div className="rounded-md border border-muted/40 bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-[0.2em]">
                  Signing out
                </p>
                <p className="font-semibold text-foreground">{userInfo.email}</p>
                <p className="text-muted-foreground">Role: {userInfo.role}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading user details…</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoggingOut}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Logout"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LayersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 12 12 17 22 12" />
      <polyline points="2 17 12 22 22 17" />
    </svg>
  );
}
