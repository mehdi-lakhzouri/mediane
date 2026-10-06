"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { areaPath, lastPoint, linePath, smoothPath, toPoints } from "../_lib/chart";
import { EASE, useSeen } from "./motion";

const COLORS = {
  blue: "#1d6bff",
  violet: "#5b3df5",
  red: "#ef2d35",
  green: "#19b26b",
  amber: "#f5a524",
} as const;

export type ChartColor = keyof typeof COLORS;

/** Line that draws itself in, with a soft gradient fill beneath. */
export function Sparkline({
  values,
  color = "blue",
  width = 120,
  height = 44,
  jagged = false,
  dot = false,
  markers = false,
  strokeWidth = 2,
  delay = 0,
  className,
}: {
  values: readonly number[];
  color?: ChartColor;
  width?: number;
  height?: number;
  jagged?: boolean;
  /** A larger dot on the latest value. */
  dot?: boolean;
  /** Small dots on every earlier value. */
  markers?: boolean;
  strokeWidth?: number;
  delay?: number;
  className?: string;
}) {
  const { ref, seen } = useSeen<SVGSVGElement>(0.3);
  const id = useId().replace(/:/g, "");
  const stroke = COLORS[color];
  const points = toPoints(values, width, height, { padY: strokeWidth + 2 });
  const line = jagged ? linePath(points) : smoothPath(points);
  const area = areaPath(line, points, height);
  const last = lastPoint(points);
  const show = seen;

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      overflow="visible"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#${id}-fill)`}
        initial={{ opacity: 0 }}
        animate={show ? { opacity: 1 } : undefined}
        transition={{ duration: 0.9, delay: delay + 0.5, ease: EASE }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={show ? { pathLength: 1 } : undefined}
        transition={{ duration: 1.3, delay, ease: EASE }}
      />
      {markers
        ? points.slice(0, -1).map((point, index) => (
            <motion.circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={2.2}
              fill={stroke}
              initial={{ opacity: 0 }}
              animate={show ? { opacity: 1 } : undefined}
              transition={{ duration: 0.3, delay: delay + (index / points.length) * 1.1 }}
            />
          ))
        : null}
      {dot ? (
        <motion.circle
          cx={last.x}
          cy={last.y}
          r={strokeWidth + 2}
          fill={stroke}
          stroke="#fff"
          strokeWidth={2}
          initial={{ scale: 0 }}
          animate={show ? { scale: 1 } : undefined}
          transition={{ duration: 0.4, delay: delay + 1.2, ease: EASE }}
        />
      ) : null}
    </svg>
  );
}

/** Rising columns, light to strong, for growth counts. */
export function Columns({
  values,
  width = 200,
  height = 64,
  className,
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const { ref, seen } = useSeen<SVGSVGElement>(0.3);
  const max = Math.max(...values);
  const gap = 10;
  const barWidth = (width - gap * (values.length - 1)) / values.length;
  return (
    <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      {values.map((value, index) => {
        const barHeight = (value / max) * height;
        const strength = 0.25 + (index / (values.length - 1)) * 0.75;
        const lastBar = index === values.length - 1;
        return (
          <motion.rect
            key={index}
            x={index * (barWidth + gap)}
            width={barWidth}
            rx={3}
            fill={lastBar ? "#b5a8ff" : COLORS.blue}
            fillOpacity={lastBar ? 1 : strength}
            initial={{ height: 0, y: height }}
            animate={
              seen
                ? { height: barHeight, y: height - barHeight }
                : undefined
            }
            transition={{ duration: 0.8, delay: index * 0.06, ease: EASE }}
          />
        );
      })}
    </svg>
  );
}

/** Ring chart whose segments sweep in one after another. */
export function Donut({
  segments,
  size = 170,
  thickness = 22,
  children,
}: {
  segments: readonly { value: number; color: string }[];
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}) {
  const { ref, seen } = useSeen<HTMLDivElement>(0.3);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const gap = 4;
  // Each arc starts where the previous one (plus the gap) ended.
  const arcs = segments.map((segment, index) => {
    const before = segments.slice(0, index).reduce((sum, s) => sum + (s.value / total) * circumference, 0);
    return { segment, length: (segment.value / total) * circumference - gap, dashOffset: -before };
  });

  return (
    <div ref={ref} className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        {arcs.map(({ segment, length, dashOffset }, index) => {
          return (
            <motion.circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDashoffset={dashOffset}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={
                seen
                  ? { strokeDasharray: `${length} ${circumference}` }
                  : undefined
              }
              transition={{ duration: 0.9, delay: 0.15 + index * 0.18, ease: EASE }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
