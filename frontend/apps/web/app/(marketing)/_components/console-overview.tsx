"use client";

import { motion } from "framer-motion";
import { ChevronRight, HeartPulse, Siren, Users, UsersRound } from "lucide-react";
import { areaPath, lastPoint, smoothPath, toPoints } from "../_lib/chart";
import { Donut, Sparkline } from "./charts";
import {
  ConsoleSidebar,
  ConsoleTopBar,
  OVERVIEW_NAV,
  RangePill,
  StatPanel,
} from "./console-chrome";
import { Lines } from "../../../lib/i18n/lines";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { consoleMessages } from "../_lib/console.messages";
import { EASE, useSeen } from "./motion";

/** Design size of the overview console, in pixels. */
export const OVERVIEW_SIZE = { width: 850, height: 540 } as const;

const ACTIVE = [52, 64, 60, 78, 86, 82, 96, 104, 100, 112, 122, 118, 132, 146, 152, 164, 160, 172, 184, 196, 190, 204, 214, 222, 218, 228, 236, 240, 244, 248];
const NEW = [18, 20, 19, 24, 22, 26, 25, 28, 24, 27, 30, 26, 29, 31, 28, 30, 27, 29, 31, 30, 28, 32, 30, 29, 31, 30, 32, 31, 30, 32];

export function ConsoleOverview() {
  const t = useMessages(consoleMessages);
  return (
    <div className="lp-console relative h-full w-full">
      <ConsoleSidebar items={OVERVIEW_NAV} />
      <div className="absolute inset-y-0 left-[112px] right-0 px-5 pt-4">
        <ConsoleTopBar />
        <div className="mt-6 flex items-end justify-between">
          <div>
            <h3 className="text-[26px] font-extrabold leading-none tracking-[-0.035em] text-[#0b1533]">
              {t.overview.title}
            </h3>
            <p className="mt-1.5 text-[11.5px] text-[#6e7c98]">{t.overview.subtitle}</p>
          </div>
          <RangePill />
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2.5">
          <StatPanel icon={<Users size={15} />} label={t.stats.activeDrivers} value="248" delta="12%" trend="up" good note={t.fromLastMonth("+26")}>
            <Sparkline values={[10, 14, 12, 18, 16, 22, 20, 28, 34, 30]} width={66} height={30} delay={0.9} />
          </StatPanel>
          <StatPanel icon={<UsersRound size={15} />} label={t.stats.families} value="184" delta="8%" trend="up" good note={t.fromLastMonth("+14")}>
            <Sparkline values={[8, 12, 10, 14, 13, 18, 17, 20, 22, 26]} width={66} height={30} delay={1} />
          </StatPanel>
          <StatPanel icon={<HeartPulse size={15} />} label={t.stats.openIncidents} value="7" delta="30%" trend="down" good note={t.fromLastMonth("-3")}>
            <Sparkline values={[4, 6, 5, 7, 6, 9, 8, 12, 10, 9]} color="amber" width={66} height={30} delay={1.1} jagged />
          </StatPanel>
          <StatPanel icon={<Siren size={15} />} tone="red" label={t.stats.healthAlerts} value="12" delta="50%" trend="up" good={false} note={t.fromLastMonth("+4")}>
            <Sparkline values={[3, 5, 4, 7, 6, 9, 8, 12, 10, 11]} color="red" width={66} height={30} delay={1.2} jagged />
          </StatPanel>
        </div>

        <div className="mt-2.5 grid grid-cols-[1.42fr_1fr_0.98fr] gap-2.5">
          <ActivityPanel />
          <IncidentsPanel />
          <StatusPanel />
        </div>
      </div>
    </div>
  );
}

function ActivityPanel() {
  const t = useMessages(consoleMessages).overview;
  const { ref, seen } = useSeen<HTMLDivElement>(0.2);
  const w = 268;
  const h = 132;
  const active = toPoints(ACTIVE, w, h, { min: 0, max: 260, padY: 0 });
  const added = toPoints(NEW, w, h, { min: 0, max: 260, padY: 0 });
  const activeLine = smoothPath(active);
  const addedLine = smoothPath(added);
  const show = seen;
  const tip = lastPoint(active);
  const addedTip = lastPoint(added);

  return (
    <div ref={ref} className="lp-panel p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2">
          <span className="lp-tile size-[28px] rounded-[9px]">
            <Users size={14} />
          </span>
          <div>
            <p className="text-[12px] font-bold text-[#14203f]">{t.activity}</p>
            <p className="text-[9.5px] leading-tight text-[#8592ab]">
              <Lines lines={t.activityHint} />
            </p>
          </div>
        </div>
        <div className="flex rounded-[9px] border border-[#e6edf8] p-0.5 text-[9.5px] text-[#6e7c98]">
          <span className="px-1.5 py-1">{t.days(7)}</span>
          <span className="rounded-[7px] bg-[#1253fd] px-1.5 py-1 font-semibold text-white">{t.days(30)}</span>
          <span className="px-1.5 py-1">{t.days(90)}</span>
        </div>
      </div>
      <div className="relative mt-2 flex">
        <div className="flex h-[132px] flex-col justify-between pr-1.5 text-[8.5px] text-[#9aa6bd]">
          {["250", "200", "150", "50", "0"].map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible" aria-hidden="true">
          <defs>
            <linearGradient id="lp-activity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1d6bff" stopOpacity="0.28" />
              <stop offset="1" stopColor="#1d6bff" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1="0" x2={w} y1={f * h} y2={f * h} stroke="#eef2f9" />
          ))}
          <motion.path
            d={areaPath(activeLine, active, h)}
            fill="url(#lp-activity-fill)"
            initial={{ opacity: 0 }}
            animate={show ? { opacity: 1 } : undefined}
            transition={{ duration: 1, delay: 1.5 }}
          />
          <motion.path
            d={addedLine}
            fill="none"
            stroke="#8fb0ff"
            strokeWidth={1.6}
            initial={{ pathLength: 0 }}
            animate={show ? { pathLength: 1 } : undefined}
            transition={{ duration: 1.4, delay: 1.1, ease: EASE }}
          />
          <motion.path
            d={activeLine}
            fill="none"
            stroke="#1d5cff"
            strokeWidth={2.2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={show ? { pathLength: 1 } : undefined}
            transition={{ duration: 1.5, delay: 1, ease: EASE }}
          />
          <circle cx={tip.x} cy={tip.y} r={4} fill="#fff" stroke="#1d5cff" strokeWidth={2} />
          <circle cx={addedTip.x} cy={addedTip.y} r={3.5} fill="#fff" stroke="#8fb0ff" strokeWidth={2} />
        </svg>
        <motion.div
          className="absolute right-6 top-0 rounded-[10px] border border-[#eef2f9] bg-white px-2.5 py-2 text-[9.5px] shadow-[0_12px_24px_-12px_rgba(16,40,94,0.35)]"
          initial={{ opacity: 0, y: 6 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.5, delay: 2.2, ease: EASE }}
        >
          <p className="mb-1 font-bold text-[#14203f]">{t.tipDate}</p>
          <p className="flex items-center gap-1.5 text-[#55627e]">
            <span className="size-1.5 rounded-full bg-[#1d5cff]" /> {t.active}
            <b className="ml-3 text-[#14203f]">248</b>
          </p>
          <p className="flex items-center gap-1.5 text-[#55627e]">
            <span className="size-1.5 rounded-full bg-[#b9ccff]" /> {t.added}
            <b className="ml-auto text-[#14203f]">32</b>
          </p>
        </motion.div>
      </div>
      <div className="mt-1 flex justify-between pl-5 text-[8.5px] text-[#9aa6bd]">
        {t.axis.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1.5 flex justify-center gap-5 text-[9.5px] text-[#55627e]">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#1d5cff]" /> {t.active}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#8fb0ff]" /> {t.added}</span>
      </div>
    </div>
  );
}

const BREAKDOWN = [
  { value: 6, color: "#ef3b45" },
  { value: 9, color: "#f7a531" },
  { value: 5, color: "#3b7bff" },
  { value: 4, color: "#d5dcea" },
];

function IncidentsPanel() {
  const t = useMessages(consoleMessages).overview;
  const breakdown = BREAKDOWN.map((item, index) => ({
    ...item,
    label: t.breakdown[index] ?? "",
  }));
  return (
    <div className="lp-panel p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2">
          <span className="lp-tile size-[28px] rounded-[9px]">
            <HeartPulse size={14} />
          </span>
          <div>
            <p className="text-[12px] font-bold text-[#14203f]">{t.health}</p>
            <p className="text-[9px] leading-tight text-[#8592ab]">{t.healthHint}</p>
          </div>
        </div>
        <span className="flex items-center gap-0.5 rounded-[8px] border border-[#dbe5fb] px-1.5 py-1 text-[9px] font-semibold text-[#1253fd]">
          {t.viewAll} <ChevronRight size={10} />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Donut segments={breakdown} size={98} thickness={13}>
          <span>
            <span className="block text-[19px] font-extrabold leading-none text-[#0b1533]">24</span>
            <span className="block text-[9px] text-[#7a87a3]">{t.total}</span>
          </span>
        </Donut>
        <ul className="flex-1 space-y-2.5 text-[10px]">
          {breakdown.map((item) => (
            <li key={item.color} className="flex items-center justify-between text-[#3b4a6b]">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: item.color }} />
                {item.label}
              </span>
              <b className="text-[#14203f]">{item.value}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Index of the one service shown as under watch in the mockup. */
const MONITORED_SERVICE = 3;

function StatusPanel() {
  const t = useMessages(consoleMessages).overview;
  const services = t.services.map((name, index) => ({
    name,
    ok: index !== MONITORED_SERVICE,
  }));
  return (
    <div className="lp-panel p-3">
      <p className="text-[12px] font-bold text-[#14203f]">{t.system}</p>
      <p className="text-[9px] text-[#8592ab]">{t.systemHint}</p>
      <ul className="mt-3 space-y-2">
        {services.map((service) => {
          const ok = service.ok;
          return (
            <li key={service.name} className="flex items-center justify-between gap-2 text-[9.5px] text-[#3b4a6b]">
              <span className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${ok ? "bg-[#19b26b]" : "bg-[#f5a524]"}`} />
                {service.name}
              </span>
              <span className={`lp-pill text-[8.5px] ${ok ? "lp-pill-green" : "lp-pill-amber"}`}>
                {ok ? t.operational : t.monitoring}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
