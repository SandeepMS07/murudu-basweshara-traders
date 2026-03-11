"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { formatCurrencyINR } from "@/lib/number-format";

type TrendPoint = {
  date: string;
  amount: number;
};

type PurchaseTrendChartProps = {
  data: TrendPoint[];
};

export function PurchaseTrendChart({ data }: PurchaseTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartWidth = 640;
  const chartHeight = 240;
  const paddingX = 28;
  const paddingY = 20;

  const maxAmount = useMemo(
    () => Math.max(...data.map((item) => item.amount), 1),
    [data]
  );

  const points = useMemo(
    () =>
      data.map((item, index) => {
        const x =
          data.length === 1
            ? chartWidth / 2
            : paddingX + (index / (data.length - 1)) * (chartWidth - paddingX * 2);
        const y =
          chartHeight -
          paddingY -
          (item.amount / maxAmount) * (chartHeight - paddingY * 2);
        return { ...item, x, y };
      }),
    [data, maxAmount]
  );

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaLine = points.map((point) => `L ${point.x} ${point.y}`).join(" ");
  const areaPath = points.length
    ? `M ${points[0].x} ${chartHeight - paddingY} ${areaLine} L ${
        points[points.length - 1].x
      } ${chartHeight - paddingY} Z`
    : "";

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div
      className="relative rounded-md border border-[#252932] bg-gradient-to-b from-[#14171d] to-[#101216] p-3"
      onMouseLeave={() => setHoverIndex(null)}
    >
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="h-64 w-full"
        role="img"
        aria-label="Purchase trend chart"
      >
        {areaPath ? <path d={areaPath} fill="url(#trendFill)" /> : null}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          points={linePoints}
          className="text-[#ff6a3d]"
        />
        {points.map((point, index) => (
          <g key={`${point.date}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={hoverIndex === index ? 8 : 5}
              className="fill-[#ff6a3d]"
              onMouseEnter={() => setHoverIndex(index)}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={14}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(index)}
            />
          </g>
        ))}
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6a3d" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ff6a3d" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {activePoint ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-[#2a2d34] bg-[#181a1f] px-3 py-2 text-xs text-zinc-200 shadow-xl"
          style={{
            left: `${(activePoint.x / chartWidth) * 100}%`,
            top: `${(activePoint.y / chartHeight) * 100}%`,
            transform: "translate(-50%, -120%)",
          }}
        >
          <p className="text-zinc-400">{format(parseISO(activePoint.date), "dd MMM yyyy")}</p>
          <p className="font-semibold text-zinc-100">{formatCurrencyINR(activePoint.amount)}</p>
        </div>
      ) : null}
    </div>
  );
}
