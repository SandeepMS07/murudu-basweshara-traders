"use client";

import { useEffect } from "react";

interface BillPrintAutoProps {
  redirectTo?: string;
}

export function BillPrintAuto({ redirectTo = "/bills" }: BillPrintAutoProps) {
  useEffect(() => {
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
  }, [redirectTo]);

  return null;
}
