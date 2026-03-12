"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Menu, Search, UserCircle2, X, ArrowLeft } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SessionUser } from "@/features/auth/types";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [userInfo, setUserInfo] = useState<SessionUser | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const profileRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const pathParts = pathname.split("/").filter(Boolean);
  const isNestedPage = pathParts.length > 1;

  const labelMap: Record<string, string> = {
    dashboard: "Dashboard",
    purchases: "Purchases",
    sales: "Sales",
    bills: "Bills",
    new: "New",
    edit: "Edit",
    print: "Print",
  };

  const formatLabel = (segment: string) => {
    if (labelMap[segment]) return labelMap[segment];
    if (segment.length > 14 && /[0-9a-f-]/i.test(segment)) return "Details";
    return segment
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const breadcrumbItems = pathParts.map((segment, index) => ({
    label: formatLabel(segment),
    href: `/${pathParts.slice(0, index + 1).join("/")}`,
  }));
  const pageTitle = breadcrumbItems[breadcrumbItems.length - 1]?.label ?? "Dashboard";
  const searchItems = useMemo(
    () => [
      { label: "Dashboard", href: "/dashboard", keywords: "home overview" },
      { label: "Purchases", href: "/purchases", keywords: "purchase list table" },
      { label: "Create Purchase", href: "/purchases/new", keywords: "new add purchase" },
      { label: "Sales", href: "/sales", keywords: "sales bill list table" },
      { label: "Create Sale", href: "/sales/new", keywords: "new add sale" },
    ],
    []
  );
  const filteredSearchItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return searchItems;
    return searchItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.keywords.toLowerCase().includes(query)
    );
  }, [searchItems, searchTerm]);

  useEffect(() => {
    let active = true;

    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok || !active) return;
        const payload = await response.json();
        if (!active) return;
        setUserInfo(payload.user ?? null);
      } catch {
        // ignore fetch errors in shell profile widget
      }
    };

    fetchUser();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!searchRef.current) return;
      if (!searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-[#0b0b0d] text-zinc-100 selection:bg-zinc-700/50">
      <div className="flex h-full min-h-0 flex-col px-2 py-2 lg:px-6 lg:py-6">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-3xl border border-[#1d1f24] bg-[#0f1013] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
          <div className="hidden border-r border-[#1d1f24] lg:block lg:w-72 lg:flex-shrink-0">
            <Sidebar />
          </div>
          <main className="min-h-0 min-w-0 w-full flex-1 overflow-auto bg-[#0f1013]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 lg:p-8">
              <header className="sticky top-0 z-20 rounded-2xl border border-[#1d1f24] bg-[#111214]/95 px-3 py-2 backdrop-blur-md lg:px-4 lg:py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2 lg:hidden">
                    <button
                      type="button"
                      aria-label={menuOpen ? "Close menu" : "Open menu"}
                      onClick={() => setMenuOpen((value) => !value)}
                      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#282b31] bg-[#181a1f] text-zinc-300"
                    >
                      {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </button>
                    <div className="relative min-w-0 flex-1" ref={searchRef}>
                      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search anything..."
                        value={searchTerm}
                        onFocus={() => setSearchOpen(true)}
                        onChange={(event) => {
                          setSearchTerm(event.target.value);
                          setSearchOpen(true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && filteredSearchItems.length > 0) {
                            router.push(filteredSearchItems[0].href);
                            setSearchOpen(false);
                            setSearchTerm("");
                          }
                        }}
                        className="h-9 w-full rounded-md border border-[#282b31] bg-[#181a1f] pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6a3d]/60"
                      />
                      {searchOpen ? (
                        <div className="absolute left-0 right-0 top-11 z-40 rounded-md border border-[#2a2d34] bg-[#181a1f] p-1 shadow-[0_16px_36px_rgba(0,0,0,0.5)]">
                          {filteredSearchItems.length > 0 ? (
                            filteredSearchItems.slice(0, 6).map((item) => (
                              <button
                                key={item.href}
                                type="button"
                                onClick={() => {
                                  router.push(item.href);
                                  setSearchOpen(false);
                                  setSearchTerm("");
                                }}
                                className="block w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm text-zinc-200 transition-colors hover:bg-[#2a2e37] hover:text-zinc-100"
                              >
                                {item.label}
                              </button>
                            ))
                          ) : (
                            <p className="px-2 py-1.5 text-sm text-zinc-500">No results</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="relative" ref={profileRef}>
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#282b31] bg-[#181a1f] text-zinc-400 transition-colors hover:border-[#3b3f47] hover:text-zinc-100"
                        aria-label="Profile"
                        onClick={() => setProfileOpen((open) => !open)}
                      >
                        <UserCircle2 className="h-5 w-5" />
                      </button>
                      {profileOpen ? (
                        <div className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-[#2a2d34] bg-[#181a1f] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.5)]">
                          <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Signed in as</p>
                          <p className="truncate text-sm font-semibold text-zinc-100">
                            {userInfo?.email ?? "Loading..."}
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">Role: {userInfo?.role ?? "-"}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {isNestedPage ? (
                        <button
                          type="button"
                          onClick={() => router.back()}
                          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-[#282b31] bg-[#181a1f] text-zinc-400 transition-colors hover:border-[#3b3f47] hover:text-zinc-100"
                          aria-label="Go back"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <nav className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
                        <Link href="/dashboard" className="hover:text-zinc-100 transition-colors">
                          Home
                        </Link>
                        {breadcrumbItems.map((item) => (
                          <span key={item.href} className="inline-flex items-center gap-1">
                            <ChevronRight className="h-3 w-3" />
                            <Link href={item.href} className="hover:text-zinc-100 transition-colors">
                              {item.label}
                            </Link>
                          </span>
                        ))}
                      </nav>
                    </div>
                    <h1 className="hidden truncate text-2xl font-semibold tracking-tight text-zinc-100 lg:block lg:text-lg">
                      {pageTitle}
                    </h1>
                  </div>
                  <div className="hidden w-full items-center gap-2 lg:flex lg:w-auto lg:justify-end">
                    <div className="relative min-w-0 flex-1 lg:min-w-[220px] lg:w-72 lg:flex-none" ref={searchRef}>
                      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search anything..."
                        value={searchTerm}
                        onFocus={() => setSearchOpen(true)}
                        onChange={(event) => {
                          setSearchTerm(event.target.value);
                          setSearchOpen(true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && filteredSearchItems.length > 0) {
                            router.push(filteredSearchItems[0].href);
                            setSearchOpen(false);
                            setSearchTerm("");
                          }
                        }}
                        className="h-9 w-full rounded-md border border-[#282b31] bg-[#181a1f] pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6a3d]/60"
                      />
                      {searchOpen ? (
                        <div className="absolute left-0 right-0 top-11 z-40 rounded-md border border-[#2a2d34] bg-[#181a1f] p-1 shadow-[0_16px_36px_rgba(0,0,0,0.5)]">
                          {filteredSearchItems.length > 0 ? (
                            filteredSearchItems.slice(0, 6).map((item) => (
                              <button
                                key={item.href}
                                type="button"
                                onClick={() => {
                                  router.push(item.href);
                                  setSearchOpen(false);
                                  setSearchTerm("");
                                }}
                                className="block w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm text-zinc-200 transition-colors hover:bg-[#2a2e37] hover:text-zinc-100"
                              >
                                {item.label}
                              </button>
                            ))
                          ) : (
                            <p className="px-2 py-1.5 text-sm text-zinc-500">No results</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="relative hidden lg:block" ref={profileRef}>
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#282b31] bg-[#181a1f] text-zinc-400 transition-colors hover:border-[#3b3f47] hover:text-zinc-100"
                        aria-label="Profile"
                        onClick={() => setProfileOpen((open) => !open)}
                      >
                        <UserCircle2 className="h-5 w-5" />
                      </button>
                      {profileOpen ? (
                        <div className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-[#2a2d34] bg-[#181a1f] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.5)]">
                          <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Signed in as</p>
                          <p className="truncate text-sm font-semibold text-zinc-100">
                            {userInfo?.email ?? "Loading..."}
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">Role: {userInfo?.role ?? "-"}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </header>
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
            <div className="fixed inset-y-0 left-0 z-40 w-72 border-r border-[#1d1f24] bg-[#0f1013] p-0 lg:hidden">
              <Sidebar onNavigate={() => setMenuOpen(false)} className="h-full w-full" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
