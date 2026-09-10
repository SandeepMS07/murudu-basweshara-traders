"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function NoAccessPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f1013] px-6 text-zinc-100">
      <div className="w-full max-w-md rounded-xl border border-[#2a2d34] bg-[#15171c] p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
        <h1 className="text-2xl font-semibold text-zinc-100">No access yet</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Your account doesn&apos;t have access to any modules. Please contact an
          administrator to be granted access.
        </p>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-md border border-[#ff6a3d] bg-[#ff6a3d] px-4 py-2 text-sm font-medium text-white hover:bg-[#ff5a28] disabled:opacity-50"
        >
          {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log out"}
        </button>
      </div>
    </main>
  );
}
