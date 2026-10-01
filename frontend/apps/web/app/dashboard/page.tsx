import type { Metadata } from "next";
import Link from "next/link";
import {
  ClipboardList,
  HeartPulse,
  Inbox,
  MailPlus,
  Siren,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { StatCard, type StatCardProps } from "../components/dashboard/stat-card";

export const metadata: Metadata = {
  title: "Overview | CabinGuard",
};

// No metric has a source yet: every tile shows an em dash and says so, rather
// than inventing numbers.
const stats: StatCardProps[] = [
  {
    label: "Active drivers",
    value: null,
    icon: Users,
    status: { text: "No data yet", variant: "outline" },
  },
  {
    label: "Pending invitations",
    value: null,
    icon: MailPlus,
    status: { text: "No data yet", variant: "outline" },
  },
  {
    label: "Health alerts",
    value: null,
    icon: HeartPulse,
    status: { text: "No data yet", variant: "outline" },
  },
  {
    label: "Open incidents",
    value: null,
    icon: Siren,
    status: { text: "No data yet", variant: "outline" },
  },
];

const services = [
  { name: "Authentication", state: "Operational", variant: "success" },
  { name: "Sessions", state: "Operational", variant: "success" },
  { name: "Driver management", state: "In development", variant: "warning" },
  { name: "Health monitoring", state: "In development", variant: "warning" },
] as const;

export default function DashboardOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Driver health and emergency response, at a glance.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard/audit">
              <ClipboardList />
              View audit log
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/dashboard/invitations">
              <UserPlus />
              Invite driver
            </Link>
          </Button>
        </div>
      </div>

      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <Badge variant="outline">Audit log</Badge>
          </CardHeader>
          <CardContent className="grid flex-1 place-items-center py-12 text-center">
            <div className="max-w-xs">
              <span className="mx-auto grid size-12 place-items-center rounded-xl bg-secondary">
                <Inbox className="size-6 text-primary" strokeWidth={1.8} />
              </span>
              <p className="mt-4 text-[15px] font-bold text-foreground">
                No activity yet
              </p>
              <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
                Every administrative action is recorded here. Invite your first
                driver to get started.
              </p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/dashboard/invitations">Invite driver</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System status</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="flex flex-col gap-2.5">
              {services.map((service) => (
                <li
                  key={service.name}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-background px-3.5 py-2.5"
                >
                  <span className="text-[13px] font-semibold text-foreground">
                    {service.name}
                  </span>
                  <Badge variant={service.variant}>{service.state}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
