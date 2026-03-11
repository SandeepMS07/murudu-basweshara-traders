"use client";

import { LoginThreeScene } from "@/components/auth/LoginThreeScene";

export function LoginHeroPanel() {
  return (
    <div className="relative hidden border-r border-[#1d1f24] p-14 lg:flex lg:flex-col">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">PB Manager</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">
          Manage Purchases
          <br />
          With Better Control
        </h1>
        <p className="mt-4 max-w-md text-zinc-400">
          Centralized purchase records, payment tracking, and printable bills in one place.
        </p>
      </div>

      <LoginThreeScene />
    </div>
  );
}
