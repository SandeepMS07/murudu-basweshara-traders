"use client";

import { useEffect } from "react";

import {
  applyPrintOrientation,
  isPrintOrientation,
  type PrintOrientation,
} from "@/lib/print-orientation";

interface BillPrintAutoProps {
  redirectTo?: string;
  /**
   * Paper orientation for this sheet. The page auto-prints, so there is no
   * toolbar to choose it here — the caller passes it through `?orient=`.
   */
  orientation?: PrintOrientation;
  /** Margin for the unnamed `@page`; the named sheets keep their own. */
  margin?: string;
}

export function BillPrintAuto({
  redirectTo = "/bills",
  orientation,
  margin = "8mm",
}: BillPrintAutoProps) {
  useEffect(() => {
    if (isPrintOrientation(orientation)) {
      applyPrintOrientation(document, orientation, margin);
    }

    const handleAfterPrint = () => {
      window.location.href = redirectTo;
    };

    window.addEventListener("afterprint", handleAfterPrint);

    const timer = window.setTimeout(() => {
      window.print();
    }, 200);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [redirectTo, orientation, margin]);

  return null;
}
