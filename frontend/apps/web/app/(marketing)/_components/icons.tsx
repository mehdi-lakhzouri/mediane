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
import { type SVGProps } from "react";
import { MedianeWordmark } from "../../components/mediane-brand";

/** A steering wheel, which lucide does not ship. Same stroke grammar. */
function SteeringWheel(
  props: SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number },
) {
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

export function Wordmark({
  size = 26,
  light = false,
}: {
  size?: number;
  light?: boolean;
}) {
  return (
    <MedianeWordmark height={size * 1.6} surface={light ? "dark" : "light"} />
  );
}
