import {
  Activity,
  Bell,
  Brain,
  ChartColumn,
  Check,
  Clock,
  Cpu,
  EyeOff,
  FileText,
  Globe,
  Hand,
  HeartPulse,
  KeyRound,
  Link2,
  Lock,
  type LucideIcon,
  Moon,
  ScrollText,
  Settings,
  ShieldCheck,
  Siren,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { type SVGProps, useId } from "react";

/** A steering wheel, which lucide does not ship. Same stroke grammar. */
function SteeringWheel(props: SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }) {
  const { size = 24, strokeWidth = 2, ...rest } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M3.4 10.2 9.9 11.3M14.1 11.3l6.5-1.1M12 14.2V21" />
    </svg>
  );
}

const ICONS: Record<string, LucideIcon | typeof SteeringWheel> = {
  activity: Activity,
  bell: Bell,
  brain: Brain,
  chart: ChartColumn,
  check: Check,
  clock: Clock,
  cpu: Cpu,
  eyeOff: EyeOff,
  family: Users,
  file: FileText,
  globe: Globe,
  hand: Hand,
  heart: HeartPulse,
  key: KeyRound,
  link: Link2,
  lock: Lock,
  moon: Moon,
  scroll: ScrollText,
  settings: Settings,
  shield: ShieldCheck,
  siren: Siren,
  steering: SteeringWheel,
  user: UserRound,
  users: Users,
  zap: Zap,
};

export function Icon({
  name,
  size = 22,
  strokeWidth = 2,
  className,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Component = ICONS[name] ?? ShieldCheck;
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    />
  );
}

/** The CabinGuard shield with its check, drawn as in the mockups. */
export function ShieldMark({ size = 40, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size * 1.1}
      viewBox="0 0 40 44"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="8" y1="2" x2="32" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5aa2ff" />
          <stop offset="1" stopColor="#1452f0" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="20" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M20 2 4.5 7.6v11.6C4.5 30.4 11.2 38.7 20 42c8.8-3.3 15.5-11.6 15.5-22.8V7.6L20 2Z"
        fill={`url(#${id}-fill)`}
      />
      <path
        d="M20 2 4.5 7.6v11.6c0 .9.05 1.8.13 2.6C11 18.5 16 13 20 6.5c4 6.5 9 12 15.37 15.3.08-.8.13-1.7.13-2.6V7.6L20 2Z"
        fill={`url(#${id}-shine)`}
      />
      <path
        d="m12.8 21.6 5 5 9.6-10.2"
        fill="none"
        stroke="#fff"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ size = 26, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <ShieldMark size={size * 1.55} />
      <span
        className="font-extrabold tracking-[-0.035em]"
        style={{ fontSize: size, color: light ? "#ffffff" : "var(--lp-ink)" }}
      >
        CabinGuard
      </span>
    </span>
  );
}
