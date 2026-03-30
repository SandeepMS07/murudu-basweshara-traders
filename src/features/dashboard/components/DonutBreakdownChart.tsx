"use client";

import { useMemo, useState } from "react";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

type Slice = {
  label: string;
  value: number;
  color: string;
};

type DonutBreakdownChartProps = {
  title?: string;
  slices: Slice[];
};

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = {
    x: cx + r * Math.cos(startAngle),
    y: cy + r * Math.sin(startAngle),
  };
  const end = {
    x: cx + r * Math.cos(endAngle),
    y: cy + r * Math.sin(endAngle),
  };
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export function DonutBreakdownChart({ title = "Breakdown", slices }: DonutBreakdownChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const total = useMemo(() => slices.reduce((sum, slice) => sum + slice.value, 0), [slices]);

  const chartData = useMemo(() => {
    return slices
      .reduce<
        Array<Slice & { start: number; end: number; ratio: number }>
      >((acc, slice) => {
        const prevEnd = acc.length > 0 ? acc[acc.length - 1].end : -Math.PI / 2;
        const ratio = total > 0 ? slice.value / total : 0;
        const end = prevEnd + ratio * Math.PI * 2;
        acc.push({ ...slice, start: prevEnd, end, ratio });
        return acc;
      }, []);
  }, [slices, total]);

  const active = hoverIndex !== null ? chartData[hoverIndex] : null;

  return (
    <div className="rounded-md border border-[#252932] bg-gradient-to-b from-[#14171d] to-[#101216] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-300">{title}</h4>
        <p className="text-xs text-zinc-500">Total {formatCurrencyINR(total)}</p>
      </div>

      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:gap-6">
        <svg viewBox="0 0 220 220" className="h-52 w-52" role="img" aria-label={title}>
          <circle cx="110" cy="110" r="72" fill="none" stroke="#232734" strokeWidth="24" />
          {chartData.map((slice, index) => (
            <path
              key={slice.label}
              d={arcPath(110, 110, 72, slice.start, slice.end)}
              fill="none"
              stroke={slice.color}
              strokeWidth={hoverIndex === index ? 28 : 24}
              strokeLinecap="round"
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          ))}
          <text x="110" y="102" textAnchor="middle" className="fill-zinc-500 text-[11px]">Total</text>
          <text x="110" y="124" textAnchor="middle" className="fill-zinc-100 text-[15px] font-semibold">
            {formatNumberIN(total, { maximumFractionDigits: 0 })}
          </text>
        </svg>

        <div className="w-full space-y-2">
          {chartData.map((slice, index) => (
            <div
              key={slice.label}
              className="rounded-md border border-[#2a2d34] bg-[#12151c] px-3 py-2"
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="text-sm text-zinc-200">{slice.label}</span>
                </div>
                <span className="text-xs text-zinc-500">{formatNumberIN(slice.ratio * 100, { maximumFractionDigits: 1 })}%</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-zinc-100">{formatCurrencyINR(slice.value)}</p>
            </div>
          ))}

          {active ? (
            <p className="pt-1 text-xs text-zinc-500">
              Focus: <span className="text-zinc-300">{active.label}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
