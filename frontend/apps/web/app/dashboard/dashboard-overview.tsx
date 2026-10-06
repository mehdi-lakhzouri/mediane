"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Database,
  HeartPulse,
  Inbox,
  MailPlus,
  MoreVertical,
  RefreshCcw,
  Siren,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { formatAuditAction } from "../components/dashboard/audit/audit-badges";
import {
  ctaMotion,
  EASE,
  headerMotion,
  listItemMotion,
  PulseDot,
  stagger,
  statCardMotion,
} from "../components/dashboard/motion";
import {
  StatCard,
  type StatCardProps,
} from "../components/dashboard/stat-card";
import {
  formatDateTime,
  fullName,
  initials,
} from "../components/dashboard/users/format";
import {
  listAdminAudit,
  type AdminAuditEntry,
} from "../../lib/api/admin-audit";
import { listAdminDevices } from "../../lib/api/admin-devices";
import {
  getAdminInvitationStats,
  listAdminInvitations,
  type AdminInvitation,
  type AdminInvitationStats,
} from "../../lib/api/admin-invitations";
import {
  getFamilyStats,
  type AdminFamilyStats,
} from "../../lib/api/admin-families";
import { listUsers } from "../../lib/api/admin-users";
import { getApiHealth, type ApiHealth } from "../../lib/api/health";
import { getUnreadNotificationCount } from "../../lib/api/notifications";

type RangeDays = "7" | "30" | "90";

const MotionCard = motion.create(Card);
const MotionLink = motion.create(Link);

interface OverviewData {
  activeDrivers: number | null;
  invitationStats: AdminInvitationStats | null;
  familyStats: AdminFamilyStats | null;
  audit: AdminAuditEntry[];
  invitations: AdminInvitation[];
  deviceCount: number | null;
  apiHealth: ApiHealth | null;
  unreadNotifications: number | null;
  serviceChecks: {
    drivers: boolean | null;
    devices: boolean | null;
  };
}

const EMPTY_DATA: OverviewData = {
  activeDrivers: null,
  invitationStats: null,
  familyStats: null,
  audit: [],
  invitations: [],
  deviceCount: null,
  apiHealth: null,
  unreadNotifications: null,
  serviceChecks: {
    drivers: null,
    devices: null,
  },
};

export function DashboardOverview() {
  const [range, setRange] = useState<RangeDays>("30");
  const [data, setData] = useState<OverviewData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      const id = ++requestId.current;
      if (quiet) setRefreshing(true);
      else setLoading(true);

      const from = new Date(
        Date.now() - Number(range) * 24 * 60 * 60 * 1000,
      ).toISOString();
      const [
        drivers,
        invitationStats,
        families,
        audit,
        invitations,
        devices,
        health,
        unread,
      ] = await Promise.allSettled([
        listUsers({
          page: 1,
          pageSize: 1,
          role: "DRIVER",
          status: "ACTIVE",
        }),
        getAdminInvitationStats(),
        getFamilyStats(),
        listAdminAudit({
          page: 1,
          pageSize: 5,
          from,
          sortDir: "desc",
        }),
        listAdminInvitations({
          page: 1,
          pageSize: 2,
          sortBy: "createdAt",
          sortDir: "desc",
        }),
        listAdminDevices({ page: 1, pageSize: 1 }),
        getApiHealth(),
        getUnreadNotificationCount(),
      ]);

      if (id !== requestId.current) return;
      setData({
        activeDrivers: fulfilled(drivers)?.totalItems ?? null,
        invitationStats: fulfilled(invitationStats),
        familyStats: fulfilled(families),
        audit: fulfilled(audit)?.items ?? [],
        invitations: fulfilled(invitations)?.items ?? [],
        deviceCount: fulfilled(devices)?.totalItems ?? null,
        apiHealth: fulfilled(health),
        unreadNotifications: fulfilled(unread),
        serviceChecks: {
          drivers: isFulfilled(drivers),
          devices: isFulfilled(devices),
        },
      });
      setLoading(false);
      setRefreshing(false);
    },
    [range],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo<StatCardProps[]>(
    () => [
      {
        label: "Active drivers",
        value: data.activeDrivers,
        icon: Users,
        loading,
        status: sourceStatus(data.activeDrivers),
      },
      {
        label: "Pending invitations",
        value: data.invitationStats?.pending ?? null,
        icon: MailPlus,
        loading,
        status: sourceStatus(data.invitationStats),
      },
      {
        label: "Monitored families",
        value: data.familyStats?.totalFamilies ?? null,
        icon: HeartPulse,
        loading,
        status: sourceStatus(data.familyStats),
      },
      {
        label: "Open incidents",
        value: null,
        icon: Siren,
        status: { text: "No admin API", variant: "outline" },
      },
      {
        label: "Health alerts",
        value: null,
        icon: HeartPulse,
        status: { text: "No admin API", variant: "outline" },
      },
    ],
    [data, loading],
  );

  return (
    <motion.div
      variants={stagger(0.12)}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-4"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div variants={headerMotion.overview.title}>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.035em] text-foreground">
            Overview
          </h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            Monitor drivers, family safety, incidents, and platform activity at
            a glance.
          </p>
        </motion.div>
        <motion.div
          variants={stagger(0.06)}
          className="flex flex-wrap items-center gap-2.5"
        >
          <motion.div variants={headerMotion.overview.actions}>
            <Select
              value={range}
              onValueChange={(value) => setRange(value as RangeDays)}
            >
              <SelectTrigger className="h-10 w-[168px] rounded-[9px] bg-white text-[12px] font-semibold">
                <CalendarDays className="size-4 text-[#40557c]" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>
          <motion.div variants={headerMotion.overview.actions}>
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-[9px] bg-white px-4 text-[12px]"
            >
              <Link href="/dashboard/audit">
                <ClipboardList /> View audit log
              </Link>
            </Button>
          </motion.div>
          <motion.div variants={headerMotion.overview.actions}>
            <motion.div {...ctaMotion} className="inline-flex">
              <Button asChild className="h-10 rounded-[9px] px-4 text-[12px]">
                <Link href="/dashboard/invitations">
                  <UserPlus /> Invite driver
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </header>

      <motion.section
        aria-label="Key metrics"
        variants={stagger(0.07)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </motion.section>

      <motion.section
        variants={stagger(0.09)}
        className="grid grid-cols-1 gap-3 xl:grid-cols-12"
      >
        <Panel className="min-h-[270px] xl:col-span-6">
          <PanelHeading
            icon={Users}
            title="Driver activity overview"
            description="Historical driver totals need a time-series API."
          />
          <UnavailableChart />
        </Panel>

        <Panel className="min-h-[270px] xl:col-span-3">
          <PanelHeading
            icon={HeartPulse}
            title="Health & incidents"
            description="Administrator medical aggregates are not exposed."
            action={<SmallLink href="/dashboard/health" label="View" />}
          />
          <HealthIncidentBreakdown />
        </Panel>

        <Panel className="min-h-[270px] xl:col-span-3">
          <PanelHeading
            icon={Database}
            title="System status"
            description="Live responses from core services."
          />
          <SystemStatus data={data} loading={loading} />
        </Panel>
      </motion.section>

      <motion.section
        variants={stagger(0.09)}
        className="grid grid-cols-1 gap-3 xl:grid-cols-12"
      >
        <Panel className="min-h-[340px] xl:col-span-8 xl:h-[340px]">
          <PanelHeading
            icon={ClipboardList}
            title="Recent activity"
            description={`Latest administrative actions from the last ${range} days.`}
            action={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void load(true)}
                disabled={refreshing}
                aria-label="Refresh overview"
              >
                <RefreshCcw
                  className={refreshing ? "animate-spin" : undefined}
                />
              </Button>
            }
          />
          <RecentActivity rows={data.audit} loading={loading} />
        </Panel>

        <motion.div
          variants={stagger(0.09)}
          className="grid gap-3 xl:col-span-4 xl:grid-rows-[198px_130px]"
        >
          <Panel className="min-h-[177px] xl:min-h-0">
            <PanelHeading
              icon={Siren}
              title="Priority incidents"
              description="Incidents requiring attention."
              action={
                <SmallLink href="/dashboard/incidents" label="View all" />
              }
              danger
              compact
            />
            <EmptyInline
              icon={Siren}
              title="No administrator incident feed"
            />
          </Panel>

          <Panel className="min-h-[150px] overflow-hidden xl:min-h-0">
            <PanelHeading
              icon={MailPlus}
              title="Recent invitations"
              description="Latest driver invitations."
              action={
                <SmallLink href="/dashboard/invitations" label="View all" />
              }
              compact
            />
            <RecentInvitations rows={data.invitations} loading={loading} />
          </Panel>
        </motion.div>
      </motion.section>
    </motion.div>
  );
}

function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <MotionCard variants={statCardMotion.overview} className={className}>
      {children}
    </MotionCard>
  );
}

function PanelHeading({
  icon: Icon,
  title,
  description,
  action,
  danger = false,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  danger?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 ${compact ? "pt-2.5 pb-1.5" : "pt-4 pb-3"}`}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-[10px] ${compact ? "size-9" : "size-10"} ${danger ? "bg-danger-surface text-danger" : "bg-secondary text-primary"}`}
      >
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[14px] font-bold leading-5 text-foreground">
          {title}
        </h2>
        <p className="truncate text-[11px] text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function SmallLink({ href, label }: { href: string; label: string }) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-8 rounded-[7px] bg-white px-2.5 text-[10px] text-primary"
    >
      <Link href={href}>
        {label} <ChevronRight className="size-3" />
      </Link>
    </Button>
  );
}

function UnavailableChart() {
  const reduced = useReducedMotion();
  return (
    <div className="relative mx-4 mb-4 flex flex-1 items-center justify-center overflow-hidden rounded-[9px] border border-dashed border-[#dce3ed] bg-[#fbfcfe]">
      {/* A slow scanline: the panel is listening for data it does not have yet. */}
      {reduced ? null : (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(48,71,217,.07),transparent)]"
          initial={{ x: "-100%" }}
          animate={{ x: "320%" }}
          transition={{
            duration: 3.4,
            ease: "linear",
            repeat: Infinity,
            repeatDelay: 1.4,
            delay: 1,
          }}
        />
      )}
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full opacity-80"
        preserveAspectRatio="none"
      >
        {[20, 40, 60, 80].map((y, index) => (
          <motion.line
            key={y}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 + index * 0.08 }}
            x1="0"
            y1={`${y}%`}
            x2="100%"
            y2={`${y}%`}
            stroke="#e9edf4"
            strokeDasharray="4 4"
          />
        ))}
        {[16, 32, 48, 64, 80].map((x, index) => (
          <motion.line
            key={x}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 + index * 0.06 }}
            x1={`${x}%`}
            y1="0"
            x2={`${x}%`}
            y2="100%"
            stroke="#eef1f6"
          />
        ))}
      </svg>
      <div className="relative max-w-[260px] px-5 text-center">
        <motion.span
          className="mx-auto grid size-10 place-items-center rounded-full bg-secondary text-primary"
          animate={reduced ? undefined : { y: [0, -4, 0] }}
          transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
        >
          <Inbox className="size-5" />
        </motion.span>
        <p className="mt-2 text-[12px] font-semibold text-foreground">
          No historical series available
        </p>
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
          Current totals remain live; the API does not yet expose daily
          snapshots.
        </p>
      </div>
    </div>
  );
}

function HealthIncidentBreakdown() {
  const categories = [
    { label: "Critical", color: "bg-danger" },
    { label: "Warning", color: "bg-warning" },
    { label: "Info", color: "bg-primary" },
    { label: "Resolved", color: "bg-[#cbd5e1]" },
  ];
  return (
    <div className="flex flex-1 items-center justify-center gap-5 px-4 pb-5">
      <motion.div
        initial={{ rotate: -120, scale: 0.7, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 120,
          damping: 18,
          delay: 0.45,
        }}
        className="relative grid size-[112px] shrink-0 place-items-center rounded-full bg-[conic-gradient(#e3e9f2_0deg,#e3e9f2_360deg)] before:absolute before:size-[70px] before:rounded-full before:bg-white"
      >
        <div className="relative text-center">
          <p className="font-mono text-xl font-bold text-muted-foreground/55">
            —
          </p>
          <p className="text-[10px] text-muted-foreground">No data</p>
        </div>
      </motion.div>
      <ul className="min-w-[82px] space-y-3">
        {categories.map((category, index) => (
          <motion.li
            key={category.label}
            custom={index + 4}
            variants={listItemMotion}
            initial="hidden"
            animate="show"
            className="flex items-center gap-2"
          >
            <span className={`size-2 rounded-full ${category.color}`} />
            <span className="flex-1 text-[10px] text-[#425170]">
              {category.label}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              —
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function SystemStatus({
  data,
  loading,
}: {
  data: OverviewData;
  loading: boolean;
}) {
  const checks = [
    {
      label: "API service",
      value:
        data.apiHealth?.status === "ok"
          ? true
          : data.apiHealth === null
            ? null
            : false,
    },
    {
      label: "Data services",
      value:
        data.apiHealth?.database === "up"
          ? true
          : data.apiHealth === null
            ? null
            : false,
    },
    {
      label: "Notifications",
      value: data.unreadNotifications !== null,
      detail:
        data.unreadNotifications === null
          ? undefined
          : `${data.unreadNotifications} unread`,
    },
    { label: "Driver management", value: data.serviceChecks.drivers },
    {
      label: "Device monitoring",
      value: data.serviceChecks.devices,
      detail:
        data.deviceCount === null ? undefined : `${data.deviceCount} units`,
    },
  ];

  return (
    <ul className="px-4 pb-4">
      {checks.map((check, index) => (
        <motion.li
          key={check.label}
          custom={index}
          variants={listItemMotion}
          initial="hidden"
          animate="show"
          className="flex min-h-9 items-center gap-2 border-t border-border first:border-t-0"
        >
          <PulseDot
            live={!loading && Boolean(check.value)}
            className={
              loading
                ? "bg-[#cbd5e1]"
                : check.value
                  ? "bg-success"
                  : "bg-danger"
            }
          />
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#30405f]">
            {check.label}
          </span>
          {loading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <Badge
              variant={check.value ? "success" : "danger"}
              className="h-6 px-2 py-0 text-[9px]"
            >
              {check.value
                ? check.detail
                  ? check.detail
                  : "Operational"
                : "Unavailable"}
            </Badge>
          )}
        </motion.li>
      ))}
    </ul>
  );
}

function RecentActivity({
  rows,
  loading,
}: {
  rows: AdminAuditEntry[];
  loading: boolean;
}) {
  if (loading) return <RowsSkeleton rows={5} />;
  if (rows.length === 0) {
    return (
      <EmptyInline
        icon={ClipboardList}
        title="No activity in this date range"
      />
    );
  }
  return (
    <div className="mx-4 overflow-hidden rounded-[9px] border border-border">
      <div className="grid grid-cols-[minmax(150px,1.1fr)_minmax(140px,1fr)_minmax(150px,1.1fr)_130px_90px_34px] gap-3 bg-[#f3f6fb] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.04em] text-[#61708c] max-lg:hidden">
        <span>Activity</span>
        <span>Actor</span>
        <span>Target</span>
        <span>Time</span>
        <span>Status</span>
        <span />
      </div>
      {rows.map((entry, index) => (
        <motion.div
          key={entry.id}
          custom={index}
          variants={listItemMotion}
          initial="hidden"
          animate="show"
          className="grid min-h-[48px] grid-cols-[minmax(150px,1.1fr)_minmax(140px,1fr)_minmax(150px,1.1fr)_130px_90px_34px] items-center gap-3 border-t border-border px-3 first:border-t-0 max-lg:grid-cols-[1fr_auto]"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
              <ClipboardList className="size-3.5" />
            </span>
            <span className="truncate text-[10px] font-medium text-foreground">
              {formatAuditAction(entry.action)}
            </span>
          </div>
          <Actor entry={entry} />
          <div className="min-w-0 max-lg:hidden">
            <p className="truncate text-[10px] font-medium text-foreground">
              {entry.targetType ?? "No target"}
            </p>
            <p className="truncate font-mono text-[9px] text-muted-foreground">
              {entry.targetId ?? entry.requestId ?? "—"}
            </p>
          </div>
          <div className="max-lg:hidden">
            <p className="text-[10px] text-foreground">
              {relativeTime(entry.createdAt)}
            </p>
            <p className="text-[9px] text-muted-foreground">
              {formatDateTime(entry.createdAt)}
            </p>
          </div>
          <Badge
            variant={entry.outcome === "SUCCESS" ? "success" : "danger"}
            className="h-6 px-2 py-0 text-[9px] max-lg:hidden"
          >
            {entry.outcome === "SUCCESS" ? "Completed" : "Failed"}
          </Badge>
          <Button
            asChild
            variant="ghost"
            size="icon-xs"
            aria-label="View audit event"
          >
            <Link href="/dashboard/audit">
              <MoreVertical />
            </Link>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

function Actor({ entry }: { entry: AdminAuditEntry }) {
  if (!entry.actor) {
    return (
      <span className="truncate text-[10px] text-muted-foreground max-lg:hidden">
        {entry.actorType.toLowerCase()}
      </span>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2 max-lg:hidden">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e8eefc] text-[9px] font-bold text-primary">
        {initials(entry.actor)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold text-foreground">
          {fullName(entry.actor)}
        </p>
        <p className="truncate text-[9px] text-muted-foreground">
          {entry.actor.email}
        </p>
      </div>
    </div>
  );
}

function RecentInvitations({
  rows,
  loading,
}: {
  rows: AdminInvitation[];
  loading: boolean;
}) {
  if (loading) return <RowsSkeleton rows={2} />;
  if (rows.length === 0) {
    return <EmptyInline icon={MailPlus} title="No invitations yet" compact />;
  }
  return (
    <div className="px-4 pb-1">
      {rows.map((invitation, index) => (
        <MotionLink
          key={invitation.invitationId}
          custom={index}
          variants={listItemMotion}
          initial="hidden"
          animate="show"
          href="/dashboard/invitations"
          className="flex min-h-[37px] items-center gap-2.5 border-t border-border first:border-t-0"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e9eefc] text-[9px] font-bold text-primary">
            {initials(invitation)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold text-foreground">
              {invitation.email}
            </p>
            <p className="truncate text-[9px] text-muted-foreground">
              Invited {relativeTime(invitation.createdAt)}
            </p>
          </div>
          <Badge
            variant={invitationVariant(invitation.status)}
            className="h-6 px-2 py-0 text-[9px]"
          >
            {titleCase(invitation.status)}
          </Badge>
          <ChevronRight className="size-3.5 text-primary" />
        </MotionLink>
      ))}
    </div>
  );
}

function EmptyInline({
  icon: Icon,
  title,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE, delay: 0.3 }}
      className={`mx-4 flex min-h-0 flex-1 items-center justify-center rounded-[9px] border border-dashed border-border bg-[#fbfcfe] px-4 text-center ${compact ? "mb-2 py-2" : "mb-4 py-5"}`}
    >
      <div>
        <Icon className="mx-auto size-5 text-muted-foreground/60" />
        <p className="mt-2 text-[10px] font-medium text-muted-foreground">
          {title}
        </p>
      </div>
    </motion.div>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="px-4 pb-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex h-12 items-center gap-3 border-t border-border first:border-t-0"
        >
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function fulfilled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

function isFulfilled<T>(result: PromiseSettledResult<T>): boolean {
  return result.status === "fulfilled";
}

function sourceStatus(value: unknown): StatCardProps["status"] {
  return value === null
    ? { text: "Unavailable", variant: "outline" }
    : { text: "Live API", variant: "success" };
}

function invitationVariant(
  status: AdminInvitation["status"],
): "success" | "warning" | "outline" {
  if (status === "ACCEPTED") return "success";
  if (status === "PENDING") return "warning";
  return "outline";
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function relativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
