"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Loader2,
  LogOut,
  LayoutDashboard,
  ShoppingCart,
  HandCoins,
  Building2,
} from "lucide-react";
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
  {
    name: "Sales",
    href: "/sales",
    icon: HandCoins,
    children: [
      { name: "Overview", href: "/sales", icon: HandCoins },
      { name: "Companies", href: "/companies", icon: Building2 },
    ],
  },
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
        "flex h-full w-full flex-col bg-[#0f1013] px-4 py-6 text-zinc-100",
        "lg:px-4 lg:py-6",
        className
      )}
    >
      <div className="flex items-center gap-2 px-2 pb-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#181a1f] text-zinc-200">
          <LayersIcon className="h-5 w-5" />
        </div>
        <span className="text-xl font-bold tracking-tight text-zinc-100">PB Manager</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname.startsWith(item.href) ||
            item.children?.some((child) => pathname.startsWith(child.href));
          const Icon = item.icon;

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border border-[#ff6a3d]/40 bg-[#ff6a3d]/14 text-[#ff8f6b]"
                    : "text-zinc-400 hover:bg-[#181a1f] hover:text-zinc-100"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.name}
              </Link>

              {item.children ? (
                <div className="relative ml-8 mt-1 border-l border-[#2a2d34] pl-3">
                  {item.children.map((child) => {
                    const childActive = pathname.startsWith(child.href);
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
                            : "text-zinc-500 hover:bg-[#181a1f] hover:text-zinc-100"
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

      <div className="mt-auto border-t border-[#1d1f24] pt-4">
        {userInfo ? (
          <div className="mb-3 rounded-md border border-[#282b31] bg-[#15171c] p-3 text-xs text-zinc-400">
            <p className="truncate text-sm font-semibold text-zinc-100">{userInfo.email}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{userInfo.role}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          disabled={isLoggingOut}
          className="group flex w-full items-center gap-3 rounded-md border border-[#282b31] bg-[#15171c] px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:border-[#3b3f47] hover:text-zinc-100 disabled:opacity-50"
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
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.55)] [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-[#2a2d34] [&_[data-slot=dialog-close]]:bg-[#1b1e24] [&_[data-slot=dialog-close]]:text-zinc-300 [&_[data-slot=dialog-close]]:hover:bg-[#23262e] [&_[data-slot=dialog-close]]:hover:text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Confirm Logout</DialogTitle>
            <DialogDescription className="text-zinc-400">
              You will be signed out of PB Manager. Please confirm that you want to
              log out of the console.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-zinc-100">
            {userInfo ? (
              <div className="rounded-md border border-[#2a2d34] bg-[#1b1e24] p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Signing out
                </p>
                <p className="font-semibold text-zinc-100">{userInfo.email}</p>
                <p className="text-zinc-400">Role: {userInfo.role}</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Loading user details…</p>
            )}
          </div>
          <DialogFooter className="-mx-4 -mb-4 rounded-b-xl border-t border-[#2a2d34] bg-[#15171c] p-4">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoggingOut}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
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
