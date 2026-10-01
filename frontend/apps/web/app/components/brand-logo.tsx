import { ShieldCheck } from "lucide-react";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-center ${compact ? "gap-3" : "gap-4"}`}
      aria-label="CabinGuard"
    >
      <div
        className={`relative grid place-items-center bg-[linear-gradient(145deg,#25d3ff,#1762f2)] shadow-[0_0_32px_rgba(31,142,255,.28)] ${
          compact
            ? "size-12 rounded-[15px]"
            : "size-[68px] rounded-[22px] sm:size-[72px]"
        }`}
      >
        <div
          className={`absolute bg-white/90 ${compact ? "inset-1 rounded-[12px]" : "inset-[5px] rounded-[18px]"}`}
        />
        <ShieldCheck
          className={`relative text-[#087fcf] ${compact ? "size-7" : "size-11"}`}
          strokeWidth={1.8}
        />
      </div>
      <div
        className={`${compact ? "text-[25px]" : "text-[clamp(27px,2.45vw,42px)]"} font-extrabold leading-none tracking-[-0.055em]`}
        style={{ color: "var(--sx-ink)" }}
      >
        <span>Cabin</span>
        <span className="bg-gradient-to-r from-[#2cc6f9] to-[#168eee] bg-clip-text text-transparent">
          Guard
        </span>
      </div>
    </div>
  );
}
