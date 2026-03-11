"use client";

import { Loader2 } from "lucide-react";

type LoginLoadingOverlayProps = {
  visible: boolean;
};

export function LoginLoadingOverlay({ visible }: LoginLoadingOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[#0b0d11]/75 backdrop-blur-[1px]">
      <div className="flex items-center gap-2 rounded-lg border border-[#2a2d34] bg-[#15171c] px-4 py-2 text-sm text-zinc-200">
        <Loader2 className="h-4 w-4 animate-spin text-[#ff6a3d]" />
        Authenticating...
      </div>
    </div>
  );
}
