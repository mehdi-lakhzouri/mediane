"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  CarFront,
  ChartColumn,
  Check,
  Gauge,
  Heart,
  HeartPulse,
  LayoutGrid,
  Mail,
  Search,
  Settings,
  Siren,
  UserRound,
  Users,
} from "lucide-react";
import Image from "next/image";
import { type ConsoleNavItem, ConsoleSidebar } from "./console-chrome";
import { ShieldMark } from "./icons";
import { CountUp, EASE, usePrefersReducedMotion, useSeen } from "./motion";

/** Design size of the live incident console in How it works, in pixels. */
export const INCIDENT_SIZE = { width: 520, height: 664 } as const;

export const INCIDENT_NAV: ConsoleNavItem[] = [
  { label: "Overview", icon: LayoutGrid },
  { label: "Drivers", icon: UserRound },
  { label: "Families", icon: Users },
  { label: "Incidents", icon: Mail },
  { label: "Health", icon: HeartPulse },
  { label: "Analytics", icon: ChartColumn },
  { label: "Settings", icon: Settings },
];

export function ConsoleIncident({ active }: { active?: string }) {
  return (
    <div className="lp-console relative h-full w-full">
      <div className="flex h-[88px] items-center gap-5 pl-6 pr-0">
        <span className="flex items-center gap-2.5">
          <ShieldMark size={30} />
          <span className="text-[21px] font-extrabold tracking-[-0.035em] text-[#0f1a3a]">CabinGuard</span>
        </span>
        <span className="ml-auto flex h-[38px] w-[260px] items-center gap-2 rounded-l-full border border-r-0 border-[#e6edf8] bg-white px-4 text-[12px] text-[#8b98b1]">
          <Search size={15} className="text-[#56647f]" /> Search drivers, families, incidents...
        </span>
      </div>
      <ConsoleSidebar
        items={INCIDENT_NAV}
        width={140}
        gap={40}
        active={active}
        brand={false}
        className="bottom-0 top-[88px] rounded-tr-[18px] pt-5"
      />
      <div className="absolute bottom-0 left-[140px] right-0 top-[88px] px-4 pt-5">
        <h3 className="text-[20px] font-extrabold leading-tight tracking-[-0.03em] text-[#0b1533]">
          Live incident response
        </h3>
        <p className="text-[11px] text-[#7a87a3]">Real-time monitoring and family notifications</p>
        <IncidentMap />
        <DriverCard />
        <FamilyCard />
        <span className="mt-3 flex h-[44px] items-center justify-center gap-2 rounded-[12px] bg-gradient-to-b from-[#2f6bff] to-[#1253fd] text-[13px] font-semibold text-white shadow-[0_12px_24px_-12px_rgba(18,83,253,0.8)]">
          Manage incident <ArrowRight size={15} />
        </span>
      </div>
    </div>
  );
}

const TRIP = "M6 196 C 40 180, 52 150, 72 140 S 100 118, 122 112";

function IncidentMap() {
  const reduced = usePrefersReducedMotion();
  const { ref, seen } = useSeen<HTMLDivElement>(0.3);
  const show = seen;
  return (
    <div ref={ref} className="lp-panel relative mt-3 h-[206px] overflow-hidden p-0">
      <svg width="100%" height="100%" viewBox="0 0 364 206" preserveAspectRatio="xMinYMin slice" aria-hidden="true">
        <rect width="364" height="206" fill="#eef3f8" />
        <path d="M0 150 C 30 150, 50 180, 40 206 L0 206Z" fill="#d3e5f7" />
        <rect x="190" y="150" width="90" height="40" rx="10" fill="#dcefe0" />
        <g stroke="#ffffff" strokeWidth="6" fill="none" strokeLinecap="round">
          <path d="M0 60 C 120 70, 240 40, 364 56" />
          <path d="M150 0 C 140 80, 170 150, 150 206" />
          <path d="M0 120 C 120 124, 250 140, 364 110" />
        </g>
        <g stroke="#ffffff" strokeWidth="3" fill="none">
          <path d="M60 0 L90 206" />
          <path d="M260 0 L240 206" />
        </g>
        <path d={TRIP} fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
        <motion.path
          d={TRIP}
          fill="none"
          stroke="#1d5cff"
          strokeWidth="4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={show ? { pathLength: 1 } : undefined}
          transition={{ duration: 1.6, delay: 0.4, ease: EASE }}
        />
      </svg>
      <div className="absolute" style={{ left: 122 - 30, top: 112 - 30 }}>
        <span className="relative grid size-[60px] place-items-center">
          {[0, 0.9].map((delay) => (
            <motion.span
              key={delay}
              className="absolute inset-0 rounded-full bg-[#ef2d35]/25"
              animate={reduced ? undefined : { scale: [0.45, 1.4], opacity: [0.85, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay, ease: "easeOut" }}
            />
          ))}
          <span className="absolute inset-[12px] rounded-full bg-[#ef2d35]/25" />
          <span className="relative grid size-[28px] place-items-center rounded-full border-[3px] border-white bg-[#ef2d35] text-white shadow-[0_6px_14px_-4px_rgba(239,45,53,0.7)]">
            <CarFront size={13} strokeWidth={2.4} />
          </span>
        </span>
      </div>
      <motion.div
        className="absolute right-3 top-4 w-[150px] rounded-[12px] bg-white p-2.5 shadow-[0_14px_30px_-14px_rgba(16,40,94,0.5)]"
        initial={{ opacity: 0, x: 12 }}
        animate={show ? { opacity: 1, x: 0 } : undefined}
        transition={{ duration: 0.6, delay: 1.6, ease: EASE }}
      >
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#14203f]">
          <Siren size={14} className="text-[#ef2d35]" /> Incident detected
        </p>
        <p className="mt-0.5 pl-5 text-[9.5px] leading-snug text-[#55627e]">
          I-80, New York, USA
          <br />
          <span className="text-[#8592ab]">2 minutes ago</span>
        </p>
      </motion.div>
    </div>
  );
}

function DriverCard() {
  return (
    <div className="lp-panel mt-3 p-3.5">
      <div className="flex items-center gap-3">
        <Image src="/landing/avatar-mike.webp" alt="" width={46} height={46} className="size-[46px] rounded-full object-cover" />
        <div className="leading-tight">
          <p className="text-[11px] text-[#55627e]">Driver</p>
          <p className="flex items-center gap-2 text-[15px] font-bold text-[#14203f]">
            Mike Taylor
            <span className="lp-pill lp-pill-green text-[9.5px] font-semibold">● Active</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center">
        <span className="flex flex-1 items-center gap-2.5">
          <span className="grid size-[26px] place-items-center rounded-full bg-[#1d5cff] text-white">
            <Heart size={13} fill="currentColor" strokeWidth={0} />
          </span>
          <span className="leading-tight">
            <span className="block text-[14px] font-bold text-[#14203f]">
              <CountUp value={128} suffix=" bpm" duration={1.1} />
            </span>
            <span className="block text-[10.5px] font-semibold text-[#e1262f]">↑ 45%</span>
          </span>
        </span>
        <span className="flex flex-1 items-center gap-2.5 border-l border-[#eef2f9] pl-4">
          <Gauge size={22} className="text-[#1d5cff]" />
          <span className="leading-tight">
            <span className="block text-[14px] font-bold text-[#14203f]">62</span>
            <span className="block text-[10.5px] text-[#7a87a3]">km/h</span>
          </span>
        </span>
      </div>
    </div>
  );
}

function FamilyCard() {
  return (
    <div className="lp-panel mt-3 flex items-center gap-3 p-3.5">
      <span className="flex -space-x-2">
        <span className="relative z-10 grid size-[30px] place-items-center rounded-full border-2 border-white bg-[#19b26b] text-white">
          <Check size={14} strokeWidth={3} />
        </span>
        <Image src="/landing/avatar-james.webp" alt="" width={30} height={30} className="size-[30px] rounded-full border-2 border-white object-cover" />
        <Image src="/landing/avatar-emma.webp" alt="" width={30} height={30} className="size-[30px] rounded-full border-2 border-white object-cover" />
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-bold text-[#14203f]">Family notified</span>
        <span className="block text-[10.5px] text-[#55627e]">3 family members alerted</span>
        <span className="block text-[10px] text-[#8592ab]">2 minutes ago</span>
      </span>
    </div>
  );
}
