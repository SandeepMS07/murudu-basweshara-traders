"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { formatCurrencyINR } from "@/lib/number-format";

type TrendPoint = {
  date: string;
  amount: number;
};

type BarTrendChartProps = {
  data: TrendPoint[];
  barColor?: string;
};

export function BarTrendChart({ data, barColor = "#4f8cff" }: BarTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartWidth = 640;
  const chartHeight = 240;
  const paddingX = 22;
  const paddingY = 18;
  const gap = 10;

  const maxAmount = useMemo(() => Math.max(...data.map((item) => item.amount), 1), [data]);

  const bars = useMemo(() => {
    if (data.length === 0) return [] as Array<{ x: number; y: number; w: number; h: number; date: string; amount: number }>;
    const availableWidth = chartWidth - paddingX * 2;
    const barWidth = Math.max(18, (availableWidth - gap * (data.length - 1)) / data.length);

    return data.map((item, index) => {
      const h = Math.max(4, (item.amount / maxAmount) * (chartHeight - paddingY * 2));
      const x = paddingX + index * (barWidth + gap);
      const y = chartHeight - paddingY - h;
      return { x, y, w: barWidth, h, date: item.date, amount: item.amount };
    });
  }, [data, maxAmount]);

  const active = hoverIndex !== null ? bars[hoverIndex] : null;

  return (
    <div
      className="relative rounded-md border border-[#252932] bg-gradient-to-b from-[#14171d] to-[#101216] p-3"
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-64 w-full" role="img" aria-label="Bar trend chart">
        {bars.map((bar, index) => (
          <g key={`${bar.date}-${index}`}>
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.w}
              height={bar.h}
              rx={6}
              fill={barColor}
              opacity={hoverIndex === index ? 1 : 0.8}
              onMouseEnter={() => setHoverIndex(index)}
            />
            <rect
              x={bar.x - 2}
              y={bar.y - 2}
              width={bar.w + 4}
              height={bar.h + 4}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(index)}
            />
          </g>
        ))}
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-[#2a2d34] bg-[#181a1f] px-3 py-2 text-xs text-zinc-200 shadow-xl"
          style={{
            left: `${((active.x + active.w / 2) / chartWidth) * 100}%`,
            top: `${(active.y / chartHeight) * 100}%`,
            transform: "translate(-50%, -120%)",
          }}
        >
          <p className="text-zinc-400">{format(parseISO(active.date), "dd MMM yyyy")}</p>
          <p className="font-semibold text-zinc-100">{formatCurrencyINR(active.amount)}</p>
        </div>
      ) : null}
    </div>
  );
}
