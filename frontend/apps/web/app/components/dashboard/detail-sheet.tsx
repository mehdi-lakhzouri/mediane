"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { LoaderCircle } from "lucide-react";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { cn } from "@repo/ui/lib/utils";

/**
 * Side sheet with the layout of the driver details: a sticky title, a
 * summary card, then titled sections of label/value rows. Shared by the
 * console screens so every record opens the same way.
 */
export function DetailSheet({
  open,
  onClose,
  title,
  subtitle,
  loading = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        overlayClassName="bg-[#101828]/28 backdrop-blur-[8px] backdrop-saturate-75"
        closeClassName="top-6 right-6 z-20 text-[#39507f] opacity-100 hover:bg-[#eef3ff] [&_svg]:size-5"
        className="w-full bg-white shadow-[-18px_0_60px_rgba(16,24,40,.18)] sm:max-w-[614px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="sticky top-0 z-10 gap-1 border-0 bg-white/95 px-7 pt-7 pb-5 pr-16 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-[26px] leading-8 tracking-[-0.035em]">
              {title}
            </SheetTitle>
            {loading && (
              <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <SheetDescription className="text-[14px] leading-5 text-[#536489]">
            {subtitle}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="px-7 pt-0 pb-6">{children}</SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/** The record at a glance: visual, name, secondary line, badges, actions. */
export function SheetSummary({
  visual,
  title,
  subtitle,
  badges,
  actions,
}: {
  visual: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-[#d7e1f2] bg-[#f8faff] shadow-[0_1px_2px_rgba(16,24,40,.02)]">
      <div className="flex items-center gap-5 px-5 py-5">
        {visual}
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-foreground [overflow-wrap:anywhere]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-[14px] text-[#536489] [overflow-wrap:anywhere]">
              {subtitle}
            </p>
          )}
          {badges && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {badges}
            </div>
          )}
        </div>
      </div>
      {actions && <div className="flex gap-3 px-5 pb-4">{actions}</div>}
    </section>
  );
}

/** Big round or rounded-square visual for the summary card. */
export function SummaryVisual({
  icon: Icon,
  tone = "primary",
}: {
  icon: LucideIcon;
  tone?: "primary" | "danger";
}) {
  return (
    <span
      className={cn(
        "grid size-[72px] shrink-0 place-items-center rounded-[20px]",
        tone === "danger"
          ? "bg-danger-surface text-danger"
          : "bg-[#e7edff] text-[#2441d5]",
      )}
    >
      <Icon className="size-8" strokeWidth={1.8} />
    </span>
  );
}

export function DetailSection({
  icon: Icon,
  title,
  children,
  list = true,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  /** false for free content (a timeline, a list) instead of rows. */
  list?: boolean;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-[12px] border border-[#d7e1f2] bg-white px-5 pt-4 pb-0">
      <h3 className="flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.02em] text-foreground">
        <Icon className="size-5 text-[#2947e8]" strokeWidth={1.9} />
        {title}
      </h3>
      {list ? (
        <dl className="mt-3 divide-y divide-[#dce4f0] border-t border-[#dce4f0]">
          {children}
        </dl>
      ) : (
        <div className="mt-3 border-t border-[#dce4f0] py-4">{children}</div>
      )}
    </section>
  );
}

export function DetailRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  /** Short help under the value. */
  hint?: ReactNode;
}) {
  return (
    <div className="grid min-h-11 grid-cols-[minmax(130px,.9fr)_minmax(0,1.1fr)] items-center gap-4 py-2 sm:grid-cols-[200px_minmax(0,1fr)]">
      <dt className="flex items-center gap-3 text-[14px] text-[#607096]">
        <Icon
          className="size-[19px] shrink-0 text-[#2947e8]"
          strokeWidth={1.9}
        />
        {label}
      </dt>
      <dd className="min-w-0 text-[14px] font-medium break-words text-[#172554]">
        {value}
        {hint && (
          <p className="mt-1 text-[12px] leading-relaxed font-normal text-muted-foreground">
            {hint}
          </p>
        )}
      </dd>
    </div>
  );
}
